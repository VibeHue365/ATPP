# VIBEHUE — CHECKOUT RESULT ROOT CAUSE & GUARD PLACEMENT TRACE (P0)

**Date**: 2026-11-03  
**Environment**: Isolated Test Replica Set `127.0.0.1:27028` (`rsContractTest`), DB: `contract_stuck_test`  
**Git Branch**: `feat/electronic-contracts`  

---

## 1. Truy vết cốt lõi: Tại sao Payment được tạo khi Contract Guard đang fail?

Câu hỏi then chốt: **Nếu Contract Guard đang fail-closed (chặn quy chế DRAFT), tại sao giao dịch `PAYV2_6A98684B253C` lại tồn tại trên màn hình người dùng?**

Qua đối chiếu lịch sử git và kiến trúc thực thi:

```
[Thời điểm 1: Trước bản vá P0.2]
  • CONTRACTS_V2_ENABLED=true trả về AUTO_ACCEPTANCE_MECHANISM_V2 với status: 'APPROVED' (hardcoded mock).
  • Khách mở checkout -> ContractReviewModal chấp thuận hợp đồng.
  • POST /payments/create-link được gọi.
  • createV2PaymentIntent() gọi ContractCheckoutGuard.evaluate() -> THÀNH CÔNG (do mock APPROVED).
  • PaymentDocument được tạo với paymentCode = PAYV2_6A98684B253C, lưu contractBinding hợp lệ.
  • Khách được chuyển hướng sang URL: /checkout/result?paymentCode=PAYV2_6A98684B253C.
                                │
                                ▼
[Thời điểm 2: Bản vá bảo mật P0.2 được áp dụng]
  • Quy định P0.2: Xóa bỏ hardcode APPROVED gắn với feature flag; quy chế chưa có Business/Legal Sign-off phải là DRAFT.
  • ContractMechanismService.getApproved() ném UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED').
                                │
                                ▼
[Thời điểm 3: Khách reload / tiếp tục bước xác nhận thanh toán]
  • CheckoutResultPage gọi GET /payments/:code/status.
  • Sandbox auto-confirm gọi confirmV2Payment().
  • confirmV2Payment() gọi ContractCheckoutGuard.evaluate() để kiểm tra lại tính hợp lệ tại thời điểm chốt đơn.
  • Guard phát hiện Quy chế lúc này là DRAFT -> NÉM LỖI CONTRACT_MECHANISM_NOT_APPROVED!
  • Backend bắt lỗi, kích hoạt acknowledgeV2ForReview: set payment.needsManualReview=true, booking giữ PENDING_PAYMENT.
  • Frontend nhận { paymentStatus: 'SUCCESS', confirmed: false } -> Kẹt vòng quay vô tận.
```

### Kết luận phân loại giao dịch:
1. **Giao dịch hiện tại trên màn hình (`PAYV2_...`)**: Là giao dịch được khởi tạo **trước khi áp dụng P0.2** (hoặc trong phiên kiểm thử khi quy chế còn mock `APPROVED`). Tại thời điểm tạo, Guard đã chạy và cho qua. Đến thời điểm finalization sau P0.2, Guard đã phát hiện điều kiện quy chế bị hủy/stale và **chặn fail-closed thành công**.
2. **Giao dịch mới tạo sau P0.2**: Khi gọi `POST /payments/create-link` lúc quy chế đang `DRAFT`, `createV2PaymentIntent` tại dòng [`payments.service.ts#L268`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L268) lập tức gọi `ContractCheckoutGuard.evaluate()` và **chặn ngay từ đầu (HTTP 422 `CONTRACT_MECHANISM_NOT_APPROVED`)**. Hoàn toàn không tạo payment thừa.
3. **Guard Placement Gap**: **KHÔNG CÓ LỖ HỔNG VỊ TRÍ GUARD**. Guard được đặt ở đủ 3 chốt chặn:
   - Chốt 1: Trước khi tạo Payment Intent ([`payments.service.ts#L268`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L268)).
   - Chốt 2: Trước khi Finalize Payment ([`payments.service.ts#L1029`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L1029)).
   - Chốt 3: Bên trong Session Transaction nguyên tử ([`payments.service.ts#L1048`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L1048)).

---

## 2. Đối chiếu 8 câu hỏi kiểm chứng Runtime (Runtime Evidence)

| # | Câu hỏi kiểm chứng | Trạng thái thực tế tại Runtime | Vị trí mã nguồn & Bằng chứng kỹ thuật |
|:---:|---|---|---|
| **1** | **Payment status trong DB là gì?** | Ban đầu là `PENDING`. Sau khi trigger qua simulator, payment chuyển sang **`SUCCESS`** nhưng kèm cờ **`needsManualReview: true`**. | [`payments.service.ts#L1119`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L1119): `status: PaymentStatus.Success, needsManualReview: true`. |
| **2** | **Booking status là gì?** | Vẫn giữ nguyên là **`PENDING_PAYMENT`** (không được chuyển thành `CONFIRMED` hay `DEPOSIT_PAID`). | Kèm theo các cờ: `paymentReviewRequired: true`, `paymentReviewReason: "CONTRACT_BINDING_STALE"`. |
| **3** | **Payment method là gì?** | **`PAYOS_SIMULATOR`**. | Được gán tại [`payments.service.ts#L324`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L324) trong môi trường phát triển. |
| **4** | **Backend có ghi nhận payment success chưa?** | **ĐÃ GHI NHẬN Ở BẢNG PAYMENT**, nhưng **CHƯA HOÀN TẤT ĐƠN HÀNG** (`finalizedPaymentId = null`). | Tiền cọc đã ghi nhận nhận đủ nhưng đơn hàng bị kẹt ở tầng Hợp đồng điện tử. |
| **5** | **Guard thực sự ném lỗi nào?** | Guard ném **`CONTRACT_MECHANISM_NOT_APPROVED`**. | Theo đúng thiết kế bảo mật P0.2, quy chế tự động V2 đang ở `DRAFT` nên [`contract-mechanism.service.ts#L46`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/contracts/contract-mechanism.service.ts#L46) ném ngoại lệ fail-closed. |
| **6** | **`needsManualReview` và recovery state có được thiết lập không?** | **CÓ, THIẾT LẬP NGUYÊN TỬ TRÊN CẢ 3 TẦNG DỮ LIỆU**: | 1) `payments.needsManualReview = true`<br/>2) `payment_recoveries.state = "REVIEW_REQUIRED"`<br/>3) `bookings.paymentReviewRequired = true` ([`payments.service.ts#L1110-L1147`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L1110-L1147)). |
| **7** | **Frontend polling bao nhiêu lần và kết thúc ra sao?** | Polling chạy đúng **30 lần** (khoảng cách 2,000ms = 60s). Khi hết 30 lần, vòng lặp dừng nhưng **React state cũ vẫn là `PENDING`**. | Khối `useEffect` dừng timer nhưng không đổi state, khiến giao diện kẹt vĩnh viễn ở spinner "Vui lòng chờ trong giây lát". |
| **8** | **Có side effect khi gọi GET payment status không?** | **CÓ SIDE EFFECT NGHIÊM TRỌNG TRONG SANDBOX.** | Request `GET /payments/:code/status` là thao tác đọc nhưng lại tự ý gọi `this.confirmPayment()`, mở transaction, ghi DB và thay đổi trạng thái payment ([`payments.service.ts#L427-L455`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L427-L455)). |
