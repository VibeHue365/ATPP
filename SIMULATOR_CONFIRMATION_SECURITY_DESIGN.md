# VIBEHUE — THIẾT KẾ BẢO MẬT XÁC NHẬN THANH TOÁN GIẢ LẬP (SIMULATOR)
## SIMULATOR_CONFIRMATION_SECURITY_DESIGN.md

**Tài liệu**: Thiết kế kiến trúc bảo mật (Chỉ thiết kế — Chưa áp dụng mã nguồn)  
**Tác giả**: Antigravity  
**Trạng thái**: ĐANG CHỜ PHÊ DUYỆT (PENDING BUSINESS/TECH LEAD APPROVAL)  
**Phạm vi**: `PaymentsModule`, `PaymentsController`, `PaymentsService`, `ContractCheckoutGuard`  

---

## 1. MỤC TIÊU VÀ NGUYÊN TẮC BẢO MẬT CỐT LÕI

Mục đích của cơ chế Simulator là phục vụ kiểm thử tích hợp tự động (E2E / Integration Test Harness) trong môi trường phát triển cục bộ và CI cô lập.

### Các nguyên tắc bất khả xâm phạm:
1. **Không bao giờ cho phép khách hàng thông thường kích hoạt**: Người dùng mang role `CUSTOMER` tuyệt đối không thể tự kích hoạt thanh toán thành công cho đơn hàng của mình hoặc của người khác.
2. **Không phụ thuộc vào biến môi trường đơn lẻ (`NODE_ENV`) hoặc chuỗi URI**: Thiết lập cơ chế phòng thủ chiều sâu nhiều lớp (Defense-in-Depth) ngăn chặn tuyệt đối việc simulator vô tình chạy trên dữ liệu thật hoặc môi trường Production.
3. **Không bao giờ bypass Contract Checkout Guard**: Thanh toán giả lập **bắt buộc phải tuân thủ đúng 100% điều kiện Hợp đồng điện tử**. Nếu Quy chế nền tảng chưa duyệt (`DRAFT`) hoặc Shop chưa chấp thuận quy chế, giao dịch giả lập **bắt buộc bị chặn** và chuyển sang `REVIEW_REQUIRED`, không bao giờ được phép gán `CONFIRMED` giả mạo.
4. **Idempotency & Concurrency Lock**: Chống gọi trùng lặp và bảo vệ giao dịch khỏi race conditions.

---

## 2. HỆ THỐNG RÀO CHẮN BẢO VỆ 4 TẦNG (DEFENSE-IN-DEPTH)

```
                 [Request tới Endpoint Giả lập]
                               │
                               ▼
   ┌───────────────────────────────────────────────────────┐
   │ TẦNG 1: XÁC THỰC BẢN QUYỀN HỆ THỐNG (SECRET ATTESTATION) │
   │ • Header 'X-Simulator-Secret' khớp SIMULATOR_KEY      │
   │ • Biến SIMULATOR_KEY TUYỆT ĐỐI KHÔNG TỒN TẠI trên Prod│
   └───────────────────────────┬───────────────────────────┘
                               │ Hợp lệ
                               ▼
   ┌───────────────────────────────────────────────────────┐
   │ TẦNG 2: XÁC THỰC KẾT NỐI DATABASE VÀ CỔNG PAYOS      │
   │ • DB Name bắt buộc khớp regex: ^contract_.*_test$     │
   │ • Replica Set bắt buộc là rsContractTest              │
   │ • CẤM chạy nếu URI chứa 'vibehue_db' hoặc 'cluster0'  │
   │ • PayOS Client ID bắt buộc là 'mock_*' hoặc 'dummy_*' │
   └───────────────────────────┬───────────────────────────┘
                               │ Hợp lệ
                               ▼
   ┌───────────────────────────────────────────────────────┐
   │ TẦNG 3: PHÂN QUYỀN VAI TRÒ & NGƯỜI DÙNG (RBAC GUARD)  │
   │ • Bắt buộc role: ADMIN hoặc TEST_HARNESS_SERVICE      │
   │ • Quyền hạn: 'payment:simulate'                       │
   │ • Khách hàng (CUSTOMER) bị từ chối 403 Forbidden     │
   └───────────────────────────┬───────────────────────────┘
                               │ Hợp lệ
                               ▼
   ┌───────────────────────────────────────────────────────┐
   │ TẦNG 4: THẨM ĐỊNH HỢP ĐỒNG & KHÓA NGUYÊN TỬ           │
   │ • Kiểm tra ContractCheckoutGuard.evaluate()           │
   │ • Atomic Lock: { _id: paymentId, status: 'PENDING' }  │
   │ • Nếu Guard ném lỗi -> Chuyển sang REVIEW_REQUIRED    │
   └───────────────────────────────────────────────────────┘
```

### Chi tiết các tầng kiểm soát:

#### Tầng 1: Cryptographic Attestation Secret
* Endpoint yêu cầu header `X-Simulator-Secret`.
* Giá trị này được đối chiếu với `process.env.SIMULATOR_AUTH_SECRET`.
* Trong hệ thống quản lý bí mật Production (AWS Secrets Manager / Vault / Cloud Run Secrets), key này hoàn toàn không được cấu hình. Nếu key rỗng hoặc undefined, endpoint tự động từ chối với `HTTP 404 Not Found` (ẩn hoàn toàn sự tồn tại của endpoint).

#### Tầng 2: Cluster Topology & Metadata Attestation (Không dựa vào chuỗi URL tĩnh)
* Hệ thống thực hiện lệnh runtime kiểm tra metadata của connection driver:
  ```typescript
  const adminDb = connection.db.admin();
  const hello = await adminDb.command({ hello: 1 });
  if (hello.setName !== 'rsContractTest') {
    throw new ForbiddenException('SIMULATOR_PROHIBITED_ON_NON_TEST_CLUSTER');
  }
  const dbName = connection.db.databaseName;
  if (!/^contract_.*_test$/.test(dbName)) {
    throw new ForbiddenException('SIMULATOR_PROHIBITED_ON_NON_TEST_DATABASE');
  }
  ```
* Nếu kết nối trỏ tới bất kỳ cơ sở dữ liệu thật nào (kể cả Atlas Staging hoặc Production), lệnh lập tức hủy bỏ.

#### Tầng 3: Role-Based Access Control (RBAC)
* Chặn đứng việc khách hàng thông thường gọi API bằng token cá nhân:
  ```typescript
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN', 'TEST_HARNESS')
  @Permissions('payment:simulate')
  ```

#### Tầng 4: Thực thi Guard hợp đồng nguyên vẹn
* Simulator gọi trực tiếp vào lõi:
  ```typescript
  await this.confirmV2Payment(candidate, booking);
  ```
* Nếu quy chế là `DRAFT` hoặc Provider chưa chấp thuận, `ContractCheckoutGuard` ném `CONTRACT_MECHANISM_NOT_APPROVED` -> hệ thống chuyển giao dịch sang `needsManualReview: true`, giữ booking `PENDING_PAYMENT`. **Không một dòng code simulator nào được phép ép trạng thái `CONFIRMED` khi Guard không thỏa mãn.**

---

## 3. THÔNG SỐ ENDPOINT ĐỀ XUẤT (API SPECIFICATION)

### Đường dẫn:
`POST /api/payments/:code/simulate-confirm`

### Headers:
* `Authorization: Bearer <admin_or_test_token>`
* `X-Simulator-Secret: <simulator_secret>`
* `Content-Type: application/json`

### Body DTO:
```typescript
export class SimulatePaymentConfirmDto {
  @IsOptional()
  @IsNumber()
  orderCode?: number;

  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean; // Cho phép test kịch bản ngân hàng từ chối
}
```

### Phản hồi:
* **200 OK**: Giao dịch hoàn tất thành công (khi thỏa mãn 100% điều kiện Hợp đồng).
* **200 OK** (kèm `needsManualReview: true`): Giao dịch ghi nhận tiền nhưng đưa vào đối soát vì vướng Guard.
* **403 Forbidden**: Vi phạm bất kỳ điều kiện nào trong 4 tầng bảo vệ.
* **409 Conflict**: Giao dịch đã được xác nhận trước đó hoặc đang có tiến trình xử lý song song.
* **422 Unprocessable Entity**: Dữ liệu thanh toán hoặc số tiền không hợp lệ.

---

## 4. BẢO VỆ CHỐNG TRÙNG LẶP & XUNG ĐỘT ĐỒNG THỜI (IDEMPOTENCY & LOCKING)

Để chống race condition giữa các test chạy song song hoặc giữa simulator và webhook:
1. **Khóa lạc quan cấp Document (Atomic Status Transition)**:
   ```typescript
   const locked = await this.paymentsRepository.model.findOneAndUpdate(
     { _id: paymentId, status: PaymentStatus.Pending },
     { $set: { processingToken: randomUUID(), processingStartedAt: new Date() } },
     { new: true, session },
   );
   if (!locked) {
     throw new ConflictException('PAYMENT_ALREADY_PROCESSING_OR_CONFIRMED');
   }
   ```
2. Nếu document không còn ở `Pending`, lệnh lập tức trả lỗi `409 Conflict`, đảm bảo mỗi giao dịch chỉ có đúng một tiến trình được thực thi finalization.
