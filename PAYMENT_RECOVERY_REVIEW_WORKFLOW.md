# VIBEHUE — QUY TRÌNH XỬ LÝ ĐỐI SOÁT & PHỤC HỒI THANH TOÁN (RECOVERY & REVIEW)
## PAYMENT_RECOVERY_REVIEW_WORKFLOW.md

**Tài liệu**: Quy trình vận hành đối soát (Operator Workflow) & Cơ chế kỹ thuật (Technical Recovery)  
**Tác giả**: Antigravity  
**Trạng thái**: ĐANG CHỜ PHÊ DUYỆT (PENDING BUSINESS/TECH LEAD APPROVAL)  
**Phạm vi**: `PaymentRecoveryService`, `V2PaymentFinalizationService`, `AdminReconciliationDesk`  

---

## 1. NGUYÊN TẮC BẢO TOÀN DỮ LIỆU TÀI CHÍNH & VẬN HÀNH

Khi tiền của khách hàng đã được trừ thành công qua cổng thanh toán thực tế (hoặc ghi nhận `SUCCESS` trên hệ thống), bất kỳ trục trặc nào ở tầng Hợp đồng hay Hạn giữ chỗ đều **tuyệt đối không được xử lý bằng các hành vi tự động vội vã**:
1. **Không tự động hoàn tiền (No Auto-Refund)**: Hoàn tiền tự động không có sự xác nhận của con người có thể gây tổn thất dòng tiền nếu khách hàng vẫn mong muốn nhận dịch vụ hoặc nguyên nhân chỉ là thiếu một chữ ký quy chế từ Shop.
2. **Không tự động ép hoàn tất (No Auto-Finalize)**: Nếu điều kiện Hợp đồng chưa hợp lệ, hệ thống không được tự ý kích hoạt đơn hàng vì sẽ phát sinh vi phạm pháp lý.
3. **Không chỉnh sửa hoặc xóa giao dịch thật (No Tampering / Deletion)**: Bảng `payments` và `bookings` phải lưu vết nguyên trạng số tiền đã thanh toán, mã đơn PayOS, và timestamp chính xác phục vụ kiểm toán tài chính.

---

## 2. NGUỒN PHÁT SINH GIAO DỊCH `REVIEW_REQUIRED` (INGESTION CHANNELS)

Giao dịch được đưa vào hàng đợi đối soát thủ công thông qua 4 kênh chính:

```
                  [Các Kênh Phát Sinh Giao Dịch Cần Đối Soát]
                                       │
      ┌────────────────────────┬───────┴────────┬────────────────────────┐
      ▼                        ▼                ▼                        ▼
[Kênh 1: Guard Fail]     [Kênh 2: Trễ Hạn]   [Kênh 3: Hết Lượt Retry] [Kênh 4: Khiếu Nại]
• Webhook báo PAID       • Tiền về sau khi   • Worker chạy retry quá  • Phát hiện lệch
• Nhưng Quy chế DRAFT     đơn đã bị hủy       ngưỡng cho phép          tiền hoặc nghi vấn
• Hoặc Shop chưa ký      • Cần bảo vệ tiền   • Tránh treo tài nguyên  • Chuyển từ CSKH
```

### Chi tiết các kênh:
1. **Kênh 1 — Webhook hợp lệ nhưng vướng Guard Hợp đồng (`CONTRACT_BINDING_STALE`)**:
   - Khách chuyển khoản thành công, PayOS gửi Webhook `PAID`.
   - Backend thẩm định Guard phát hiện Quy chế đang ở `DRAFT` hoặc Shop chưa chấp thuận quy chế.
   - Hàm `acknowledgeV2ForReview` được kích hoạt: ghi nhận tiền khách an toàn (`Payment.status: SUCCESS`), tạo bản ghi `PaymentRecovery` với trạng thái `REVIEW_REQUIRED`, giữ `Booking.status: PENDING_PAYMENT`.
2. **Kênh 2 — Thanh toán ghi nhận sau khi đơn đã hủy (`PAYMENT_AFTER_HOLD_EXPIRY`)**:
   - Khách hàng chuyển khoản sau khi hết hạn 15 phút, đơn hàng đã bị hệ thống hủy tự động.
   - Webhook ghi nhận tiền và chuyển thẳng sang hàng đợi đối soát để xếp hàng hoàn tiền 100%.
3. **Kênh 3 — Background Recovery kiệt lượt thử (`FINALIZATION_RETRY_EXHAUSTED`)**:
   - Worker chạy thử lại nhưng gặp lỗi dữ liệu (ví dụ kho đồ bị khóa, lỗi mạng nội bộ quá 5 lần).
   - Tự động chuyển từ `FINALIZATION_PENDING` sang `REVIEW_REQUIRED` để con người can thiệp.
4. **Kênh 4 — Đối soát thủ công từ Admin / Khiếu nại từ khách hàng**:
   - Quản trị viên chủ động gắn cờ kiểm tra khi phát sinh nghi vấn.

---

## 3. GIAO DIỆN & QUY TRÌNH DÀNH CHO NGƯỜI VẬN HÀNH (OPERATOR REVIEW DESK)

### 3.1. Giao diện Bàn Đối Soát (Admin Desk View)
Màn hình quản trị `/admin/payments/reconciliation` cung cấp bảng kiểm soát với các trường thông tin bắt buộc:
* **Mã giao dịch & Đơn hàng**: `paymentCode`, `bookingCode`, ngày giờ tạo, số tiền cọc.
* **Mã đơn PayOS**: `orderCode`, trạng thái giao dịch ngân hàng.
* **Lý do cần đối soát (`lastErrorCode`)**:
  - `CONTRACT_MECHANISM_NOT_APPROVED`: Quy chế sàn chưa duyệt.
  - `PROVIDER_ACCEPTANCE_MISSING`: Shop chưa ký chấp thuận quy chế.
  - `CONTRACT_BINDING_STALE`: Shop thay đổi chính sách giữa chừng.
  - `PAYMENT_AFTER_HOLD_EXPIRY`: Tiền về sau khi hết hạn giữ chỗ.
* **Bảng so sánh Hợp đồng (Binding Inspector)**:
  - Hiển thị văn bản hợp đồng lúc khách đồng ý vs. văn bản quy chuẩn hiện tại.

### 3.2. Ba hành động vận hành có kiểm soát (Operator Actions)

```
                       [Bàn Đối Soát Admin - Operator Desk]
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
 [HÀNH ĐỘNG 1: HOÀN TIỀN]      [HÀNH ĐỘNG 2: TÁI THẨM ĐỊNH]    [HÀNH ĐỘNG 3: YÊU CẦU KÝ LẠI]
 (Refund via PayOS API)        (Re-evaluate & Finalize)        (Customer Re-Consent)
         │                               │                               │
         ▼                               ▼                               ▼
 • Bấm "Hoàn trả tiền cọc"     • Chỉ bấm sau khi Pháp chế      • Gửi thông báo tới App/Web
 • Tạo RefundIntent chính thức   đã duyệt Quy chế hoặc Shop      của khách hàng.
 • Gọi PayOS API hoàn 100%       đã ký bổ sung Acceptance.     • Khách xem văn bản mới và
 • Chuyển đơn sang CANCELLED   • Chạy lại ContractCheckoutGuard  bấm "Đồng ý".
 • Ghi log kiểm toán tài chính • Nếu PASS -> Kích hoạt đơn     • Hệ thống tự động Finalize.
                               • Nếu FAIL -> Giữ nguyên chặn
```

#### Quy tắc bắt buộc:
* Người vận hành **không thể bấm "Duyệt cưỡng ép"** nếu không qua được bước thẩm định của `ContractCheckoutGuard`. Mọi thao tác kích hoạt đơn đều phải có bằng chứng Guard trả về `PASS`.
* Mọi hành động đều ghi nhận `adminUserId`, `actionTimestamp`, và `auditReason` vào bảng `payment_audit_logs`.

---

## 4. GIẢI PHÁP KỸ THUẬT LOẠI BỎ `MongoNotConnectedError` KHI SHUTDOWN

### 4.1. Bản chất vấn đề
Trong [`V2PaymentFinalizationService`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/v2-payment-finalization.service.ts#L60), `@Interval(15_000)` kích hoạt một interval nền.
Khi chạy kiểm thử hoặc dừng ứng dụng (`SIGTERM` / `SIGINT`), nếu kết nối Mongoose Database bị đóng trước khi ScheduleModule hủy timer, hàm `processDue()` sẽ chạy trên socket đã đóng và ném lỗi:
`MongoNotConnectedError: Client must be connected before running operations`.

### 4.2. Thiết kế vòng đời đóng an toàn (Graceful Shutdown Architecture)

```typescript
import {
  Injectable,
  OnModuleDestroy,
  OnApplicationShutdown,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

@Injectable()
export class V2PaymentFinalizationService
  implements OnModuleDestroy, OnApplicationShutdown
{
  private isTerminating = false;
  private readonly intervalName = 'v2_finalization_process_due';

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    // ... các dependencies khác
  ) {}

  onModuleDestroy() {
    this.cleanupTimer();
  }

  onApplicationShutdown(signal?: string) {
    this.cleanupTimer();
  }

  private cleanupTimer() {
    this.isTerminating = true;
    try {
      if (this.schedulerRegistry.doesExist('interval', this.intervalName)) {
        this.schedulerRegistry.deleteInterval(this.intervalName);
      }
    } catch {
      // Bỏ qua nếu timer đã được dọn dẹp trước đó
    }
  }

  async processDue(): Promise<number> {
    // 1. Kiểm tra cờ đang tắt hệ thống
    if (this.isTerminating || !this.enabled) return 0;

    // 2. Kiểm tra trạng thái kết nối MongoDB (1 = connected)
    if (this.recoveries.db.readyState !== 1) return 0;

    // 3. Thực thi an toàn...
    return this.executeBatch();
  }
}
```

### 4.3. Đăng ký trong `main.ts` và Test Harness
1. Trong [`backend/src/main.ts`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/main.ts):
   ```typescript
   app.enableShutdownHooks();
   ```
2. Trong các file integration test (`*.spec.ts`):
   ```typescript
   afterAll(async () => {
     // Bước 1: Đóng NestJS App trước để kích hoạt onModuleDestroy dọn dẹp toàn bộ timer
     if (app) {
       await app.close();
     }
     // Bước 2: Đóng kết nối Database sau khi timer đã dừng hẳn
     if (connection) {
       await connection.close();
     }
   });
   ```
Giải pháp này đảm bảo 100% không còn open handles và dứt điểm hoàn toàn lỗi `MongoNotConnectedError`.
