# VIBEHUE — KẾ HOẠCH TRIỂN KHAI BACKEND GET PAYMENT STATUS THUẦN ĐỌC (READ-ONLY)
## PAYMENT_GET_READONLY_IMPLEMENTATION_PLAN.md

**Tài liệu**: Kế hoạch kiến trúc & thiết kế kỹ thuật (Chỉ thiết kế — Chưa áp dụng mã nguồn)  
**Tác giả**: Antigravity  
**Trạng thái**: ĐANG CHỜ PHÊ DUYỆT (PENDING BUSINESS/TECH LEAD APPROVAL)  
**Phạm vi**: `PaymentsController`, `PaymentsService`, `V2PaymentFinalizationService`  

---

## 1. TỔNG QUAN VÀ MỤC TIÊU (EXECUTIVE SUMMARY)

Hiện tại, endpoint `GET /api/payments/:code/status` vi phạm nghiêm trọng tính chất bất biến và phi tác dụng phụ (idempotent, side-effect free) của phương thức HTTP GET: trong môi trường có `paymentMethod === 'PAYOS_SIMULATOR'`, hàm `getPaymentStatus()` tự ý kích hoạt `this.confirmPayment()`, mở transaction ghi dữ liệu, thay đổi trạng thái thanh toán và nuốt lỗi âm thầm khi gặp sự cố.

**Mục tiêu thiết kế**:
1. Biến `GET /api/payments/:code/status` thành **thao tác thuần đọc (Pure Read-Only)** 100%: không mở transaction, không ghi DB, không chuyển đổi trạng thái đơn hàng.
2. Trả về DTO phản hồi giàu ngữ cảnh, phân biệt rõ giữa đơn hàng đã xác nhận thành công, đơn hàng đang chờ thanh toán, và đơn hàng cần đối soát thủ công (`needsManualReview`).
3. Đảm bảo tính tương thích tuyệt đối cho các luồng Legacy, luồng Chụp ảnh (Photography) và luồng PayOS Webhook thật.
4. Thiết lập cơ chế dọn dẹp timer và lifecycle shutdown NestJS để loại bỏ hoàn toàn lỗi `MongoNotConnectedError` và open handles trong runtime và test runner.

---

## 2. PHÂN TÍCH RỦI RO HIỆN TRẠNG (AS-IS VULNERABILITY AUDIT)

Vị trí mã nguồn: [`backend/src/modules/payments/services/payments.service.ts`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L427-L455)

```typescript
// MÃ HIỆN TẠI ĐANG CÓ LỖ HỔNG KIẾN TRÚC:
if (
  payment.status === PaymentStatus.Pending &&
  payment.paymentMethod === 'PAYOS_SIMULATOR'
) {
  try {
    const isV2Rental =
      booking.contractFlowVersion === 2 &&
      booking.bookingType !== BookingType.Photography;
    if (isV2Rental) {
      await this.confirmPayment(paymentCode, {
        source: 'SIMULATOR',
        orderCode: payment.payos?.orderCode,
      });
    } else {
      await this.confirmPayment(paymentCode);
    }
    const updated = await this.paymentsRepository.findPaymentWithBooking(paymentCode);
    if (updated) {
      payment = updated;
      booking = updated.bookingId as unknown as Booking & { _id: Types.ObjectId };
    }
  } catch (e) {
    console.warn('Sandbox auto-confirm payment skipped:', e); // <-- NUỐT LỖI
  }
}
```

### Các rủi ro vận hành nghiêm trọng:
1. **Xung đột tài nguyên đồng thời (Race Condition)**: Nếu một Webhook PayOS thực tế (hoặc background worker) đến cùng lúc với request polling `GET` từ Frontend, cả hai bên đều gọi `confirmPayment()`, dẫn đến MongoDB write conflict hoặc duplicate event processing.
2. **Che giấu lỗi nghiệp vụ & bảo mật (Security Gate Obfuscation)**: Khi `ContractCheckoutGuard` ném lỗi `CONTRACT_MECHANISM_NOT_APPROVED` hoặc `PROVIDER_ACCEPTANCE_MISSING`, khối `catch (e)` đã nuốt lỗi, khiến client nhận HTTP 200 với trạng thái không nhất quán, dẫn đến UI kẹt spinner vô hạn.
3. **Mất kiểm soát quyền thực thi (Privilege Escalation on GET)**: Bất kỳ ai có mã giao dịch hợp lệ khi gọi GET đều có thể gián tiếp kích hoạt luồng thanh toán và finalization mà không cần thẩm định quyền hành động.

---

## 3. THIẾT KẾ KIẾN TRÚC MỚI: PURE READ-ONLY STATUS

### 3.1. Sơ đồ xử lý dữ liệu mới (Read Pipeline)

```
[Client / Frontend Polling]
             │
             ▼
  GET /payments/:code/status
             │
             ▼
[PaymentsController.getStatus] ──── Guard kiểm tra JWT & User ownership
             │
             ▼
[PaymentsService.getPaymentStatus]
             │
             ├─ 1. Query Payment + populate Booking (Read-Only findOne)
             ├─ 2. Kiểm tra customerId === user.sub (Chống IDOR)
             ├─ 3. Đánh giá cờ đối soát:
             │     needsReview = payment.needsManualReview || booking.paymentReviewRequired || false
             ├─ 4. Đánh giá tính xác nhận hợp lệ:
             │     isConfirmed = (booking.status in [CONFIRMED, DEPOSIT_PAID]) && !needsReview
             └─ 5. Map sang PaymentStatusResponseDto
             │
             ▼
      Trả về HTTP 200 OK (TUYỆT ĐỐI KHÔNG GHI DATABASE)
```

### 3.2. Cấu trúc Response DTO chuẩn hóa

```typescript
export interface PaymentStatusResponseDto {
  paymentCode: string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  bookingId: string;
  bookingCode: string;
  bookingStatus: BookingStatus;
  bookingPaymentStatus: string;
  
  /**
   * Chỉ TRUE khi booking đã thực sự hoàn tất và KHÔNG có cờ đối soát thủ công.
   */
  confirmed: boolean;
  
  /**
   * TRUE nếu tiền đã ghi nhận hoặc giao dịch bị vướng điều kiện hợp đồng / giữ chỗ.
   */
  needsManualReview: boolean;
  reviewReason?: string | null;

  /**
   * Phân loại hợp đồng phục vụ hiển thị chi tiết (nếu có).
   */
  contractFlowVersion: number | null;
  
  paymentMethod: string;
  amount: number;
  checkoutUrl: string | null;
}
```

### 3.3. Thuật toán phân định `confirmed` và `needsManualReview`
* `confirmed` là `true` khi và chỉ khi:
  $$\text{confirmed} \iff (\text{booking.status} \in \{\text{CONFIRMED}, \text{DEPOSIT\_PAID}\}) \;\land\; \neg \text{needsManualReview} \;\land\; \neg \text{booking.paymentReviewRequired}$$
* Nếu `payment.status === 'SUCCESS'` nhưng `booking.status === 'PENDING_PAYMENT'`, trường `needsManualReview` bắt buộc phải là `true` và `confirmed` bắt buộc là `false`. Frontend sẽ lập tức chuyển sang trạng thái `REVIEW_REQUIRED`, dừng spinner và hướng dẫn khách hàng an toàn.

---

## 4. PHÂN TÍCH TÁC ĐỘNG VÀ BẢO TỒN TÍNH TOÀN VẸN (IMPACT & INVARIANTS)

| Thành phần | Hành vi trước đây | Hành vi sau khi Read-Only | Tác động & Biện pháp bảo vệ |
|---|---|---|---|
| **Frontend Polling** | Gọi GET mỗi 2s, tự động kích hoạt confirm trong sandbox. | Gọi GET mỗi 2s để đọc trạng thái thuần túy. Hết 30 lần chuyển sang `TIMEOUT`. | **Cải thiện lớn**: Không còn side effect ngầm, giao diện chuyển trạng thái dứt khoát. |
| **Legacy Checkout** | Giao dịch `contractFlowVersion === null \|\| 1` tự confirm trên GET nếu là simulator. | Đọc trạng thái bình thường; việc confirm thực hiện qua webhook hoặc test action explicit. | **Không ảnh hưởng**: Luồng thanh toán legacy không có hợp đồng vẫn chuyển Confirmed bình thường khi có webhook. |
| **Photography-only** | Gói chụp ảnh tự confirm trên GET nếu là simulator. | Đọc trạng thái bình thường; confirm qua webhook thực hoặc simulator endpoint có kiểm soát. | **Không ảnh hưởng**: Gói chụp ảnh không bị vướng guard hợp đồng. |
| **PayOS Real Webhook** | Webhook cạnh tranh với GET nếu đến cùng lúc. | **Webhook là nguồn ghi nhận thanh toán duy nhất** cho môi trường production. | **An toàn tuyệt đối**: Loại bỏ triệt để race condition và transaction conflict. |

---

## 5. XỬ LÝ VÒNG ĐỜI NESTJS & TIMER ĐỂ LOẠI BỎ `MongoNotConnectedError`

### 5.1. Nguyên nhân gốc của `MongoNotConnectedError`
Trong [`V2PaymentFinalizationService`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/v2-payment-finalization.service.ts#L60), decorator `@Interval(15_000)` đăng ký một timer định kỳ vào Node.js Event Loop.
Khi ứng dụng NestJS hoặc test runner (Jest) thực hiện teardown:
1. Kết nối MongoDB Mongoose bị đóng trước (`connection.close()`).
2. Timer 15 giây vẫn tiếp tục tick trong background.
3. Hàm `processDue()` chạy câu lệnh `this.recoveries.find(...)` trên kết nối đã đóng.
4. Ném lỗi: `MongoNotConnectedError: Client must be connected before running operations`.
5. Jest cảnh báo: `Jest did not exit one second after the test run has completed... open handles`.

### 5.2. Giải pháp kỹ thuật chuẩn hóa (Graceful Shutdown Pattern)

1. **`V2PaymentFinalizationService` triển khai `OnApplicationShutdown` & `OnModuleDestroy`**:
   ```typescript
   @Injectable()
   export class V2PaymentFinalizationService implements OnModuleDestroy, OnApplicationShutdown {
     private isShuttingDown = false;

     onModuleDestroy() {
       this.isShuttingDown = true;
     }

     onApplicationShutdown(signal?: string) {
       this.isShuttingDown = true;
     }

     @Interval(15_000)
     async processDue(): Promise<number> {
       if (!this.enabled || this.isShuttingDown) return 0;
       // Kiểm tra trạng thái sẵn sàng của connection trước khi truy vấn
       if (this.recoveries.db.readyState !== 1) return 0;
       ...
     }
   }
   ```
2. **Kích hoạt Shutdown Hooks trong `main.ts`**:
   ```typescript
   app.enableShutdownHooks();
   ```
3. **Thứ tự đóng trong Test Runner**:
   - Bước 1: Gọi `await app.close()` (kích hoạt hủy toàn bộ timer và provider trước).
   - Bước 2: Đóng kết nối Mongoose Database.
   - Bước 3: Đảm bảo không còn bất kỳ unhandled promise nào.

---

## 6. KẾ HOẠCH TRIỂN KHAI PHÂN KỲ (PHASED ROLLOUT)

* **Giai đoạn 1**: Phê duyệt tài liệu thiết kế kiến trúc này.
* **Giai đoạn 2**: Tạo endpoint giả lập riêng biệt có kiểm soát bảo mật (xem tài liệu `SIMULATOR_CONFIRMATION_SECURITY_DESIGN.md`).
* **Giai đoạn 3**: Xóa bỏ khối mã auto-confirm trong `getPaymentStatus()`.
* **Giai đoạn 4**: Bổ sung interface `OnModuleDestroy` cho `V2PaymentFinalizationService`.
* **Giai đoạn 5**: Kiểm chứng hồi quy toàn bộ trên replica set test `127.0.0.1:27028`.
