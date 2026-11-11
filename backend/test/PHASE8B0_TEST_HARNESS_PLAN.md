# VIBEHUE — PHASE 8B.0: TEST HARNESS & SAFETY GATE SPECIFICATION

**Document Version:** 1.0.0  
**Phase:** 8B.0 — Isolated Synthetic E2E Safety Gate  
**Branch:** `feat/electronic-contracts`  
**Date:** 29/10/2026  
**Auditor:** Antigravity AI Quality Gate  

---

## 1. Cơ chế Cô lập Cờ Tính năng (Feature Flag Isolation)

### 1.1 Nguyên tắc Bất biến (Core Invariant)
- **Môi trường ứng dụng thực tế (Production / Default):**
  - Backend: `CONTRACTS_V2_ENABLED = false` (Cấu hình mặc định trong `backend/src/modules/contracts/contracts.module.ts`: `config.get('CONTRACTS_V2_ENABLED', 'false') === 'true'`).
  - Frontend: `VITE_CONTRACTS_V2_ENABLED = false` (Cấu hình trong `frontend/src/config/features.ts`).
- **Nghiêm cấm tuyệt đối:** Không sửa đổi file `.env` hoặc `.env.example` của ứng dụng để bật cờ tính năng; không hard-code `true` vào logic sản phẩm.

### 1.2 Kỹ thuật Override Cờ Tính năng qua Dependency Injection trong Process Test
Synthetic E2E test harness chỉ bật cờ tính năng trong **tiến trình bộ nhớ của Jest worker** thông qua cơ chế Dependency Injection của NestJS Test Module:

```typescript
// Chỉ áp dụng bên trong file test (e.g., contract-synthetic.e2e-spec.ts)
const moduleRef = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(CONTRACTS_V2_ENABLED)
  .useValue(true) // Chỉ bật V2 trong phạm vi memory của test runner
  .compile();
```

Khi tiến trình Jest kết thúc (Exit code 0 hoặc error), toàn bộ memory worker được giải phóng hoàn toàn; môi trường runtime của ứng dụng và các service khác vẫn giữ nguyên trạng thái `CONTRACTS_V2_ENABLED=false` (Fail-closed).

---

## 2. Thiết kế Điểm nối Kiểm thử An toàn cho Template & Provider Mechanism (Safe Test Seams)

### 2.1 Hiện trạng Fail-Closed của Mã nguồn Sản xuất
Trong mã nguồn hiện tại:
- `AO_DAI_RENTAL_V1` có `status: 'DRAFT'`, `approvedAt: null`.
- `AUTO_ACCEPTANCE_MECHANISM_V1` có `status: 'DRAFT'`, `approvedAt: null`.
- Phương thức `ContractTemplateService.getApproved()` và `ContractMechanismService.getApproved()` chủ động ném lỗi `UnprocessableEntityException` nếu được gọi.

> [!CAUTION]
> **Quy định nghiêm ngặt:** Không được sửa đổi `AO_DAI_RENTAL_V1.approvedAt` trong mã nguồn sản xuất để phục vụ kiểm thử. Làm như vậy là giả mạo việc phê duyệt pháp lý.

### 2.2 Thiết kế Test Fixture Độc lập (`TEST_ONLY`)
Test harness tạo ra các fixture tổng hợp chỉ tồn tại trong bộ nhớ kiểm thử:

```typescript
export const SYNTHETIC_APPROVED_TEMPLATE: ContractTemplate = Object.freeze({
  version: 'synthetic-rental-approved-v1',
  status: 'APPROVED',
  approvedAt: '2026-10-28T00:00:00.000Z',
  title: 'Hợp đồng kiểm thử tự động (Synthetic Test Only — Không có giá trị pháp lý)',
  sections: [
    { id: 'parties', heading: 'Các bên tham gia', source: 'snapshot.customer/provider' },
    { id: 'items', heading: 'Trang phục thuê', source: 'snapshot.providerItems' },
    { id: 'pricing', heading: 'Chi phí và tiền cọc', source: 'snapshot.pricing' },
    { id: 'policies', heading: 'Chính sách áp dụng', source: 'snapshot.policies' },
  ],
});

export const SYNTHETIC_APPROVED_MECHANISM: AutoAcceptanceMechanism = Object.freeze({
  version: 'synthetic-auto-acceptance-v1',
  status: 'APPROVED',
  approvedAt: '2026-10-28T00:00:00.000Z',
  scope: 'AO_DAI_RENTAL',
  description: 'Cơ chế chấp thuận trước thử nghiệm (Synthetic Test Only)',
});
```

### 2.3 Điểm nối Kiểm thử (Safe Test Seam Injection)
Trong test harness module, hai service này được override bằng mock implementation trả về fixture trên:
```typescript
.overrideProvider(ContractTemplateService)
.useValue({
  getDraft: () => SYNTHETIC_APPROVED_TEMPLATE,
  getApproved: () => SYNTHETIC_APPROVED_TEMPLATE,
})
.overrideProvider(ContractMechanismService)
.useValue({
  getDraft: () => ({ ...SYNTHETIC_APPROVED_MECHANISM, hash: 'a'.repeat(64) }),
  getApproved: () => ({ ...SYNTHETIC_APPROVED_MECHANISM, hash: 'a'.repeat(64) }),
})
```
*Lợi ích:* Mã nguồn sản xuất giữ nguyên 100% cơ chế fail-closed; bài test chứng minh được toàn bộ logic nghiệp vụ mà không làm suy yếu hàng rào an ninh.

---

## 3. Thiết kế Bộ Mô phỏng Thanh toán & Webhook (Synthetic Payment & Webhook Harness)

### 3.1 Cấu trúc Chuẩn của PayOS Webhook
Hệ thống PayOS thật sử dụng chuẩn dữ liệu Webhook kèm chữ ký số HMAC-SHA256 tính trên các trường sắp xếp theo thứ tự alphabet:

```json
{
  "code": "00",
  "desc": "success",
  "data": {
    "orderCode": 123456,
    "amount": 500000,
    "description": "Thanh toan don hang VIBE-001",
    "accountNumber": "0123456789",
    "reference": "FT26123456",
    "transactionDateTime": "2026-10-29 21:00:00",
    "currency": "VND",
    "paymentLinkId": "link_test_123456",
    "code": "00",
    "desc": "success"
  },
  "signature": "<HMAC-SHA256 signature>"
}
```

### 3.2 Thuật toán Sinh Chữ ký Webhook trong Test Harness
Test harness triển khai helper mô phỏng đúng 100% thuật toán của PayOS SDK:

```typescript
import { createHmac } from 'node:crypto';

export function signPayOSWebhook(data: Record<string, unknown>, checksumKey: string): string {
  // Sắp xếp các key theo thứ tự a-z
  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys
    .map((key) => `${key}=${data[key]}`)
    .join('&');
  return createHmac('sha256', checksumKey).update(queryString).digest('hex');
}
```

### 3.3 Khả năng Kiểm thử của Webhook Harness
1. **Thanh toán thành công (`PAID`):** Gửi payload `code: "00"`, `desc: "success"`, chữ ký hợp lệ -> Backend kích hoạt `V2PaymentFinalizationService` và `generateAndStorePdf`.
2. **Khách hủy giao dịch (`CANCELLED` / `FAILED`):** Gửi payload mã lỗi -> Backend cập nhật `payment.status: 'CANCELLED'` và giữ nguyên trạng thái hợp đồng.
3. **Idempotency & Duplicate Webhook:** Gửi liên tiếp 2 request cùng `orderCode` và `signature` -> Kiểm tra `WebhookEventRepository` chặn xử lý lần 2, không ghi trùng giao dịch vào `booking_escrows`.
4. **Chữ ký giả mạo (Tampered Signature):** Sửa số tiền `amount` nhưng giữ nguyên chữ ký -> Backend từ chối ngay lập tức với `400 Bad Request` (`Signature verification failed`).

---

## 4. Bảng Đối chiếu Ma trận 17 Kịch bản E2E (E2E Reconciliation Matrix)

| Kịch bản Phase 8A | Phân loại Khả năng Thực thi trong Phase 8B | Yêu cầu Fixture / Test Harness bổ sung | Ghi chú & Rào cản còn lại |
| :--- | :---: | :--- | :--- |
| **1. Rental booking 1 provider** | **SẴN SÀNG CHẠY NGAY** | Cần `SYNTHETIC_APPROVED_TEMPLATE` | Đầy đủ dữ liệu & logic |
| **2. Combo booking nhiều provider** | **CÓ ĐIỀU KIỆN (CONDITIONAL)** | Cần fixture giá không có voucher toàn sàn | **BỊ CHẶN** nếu có voucher/travelFee (`CONTRACT_PRICING_ALLOCATION_UNDEFINED`) |
| **3. Khách ACCEPT tất cả hợp đồng** | **SẴN SÀNG CHẠY NGAY** | Dùng multi-provider seed | Chứng minh ghi nhận đầy đủ consents |
| **4. Khách DECLINE một hợp đồng** | **SẴN SÀNG CHẠY NGAY** | Dùng multi-provider seed | Chứng minh chặn tạo link thanh toán |
| **5. Hợp đồng stale version** | **SẴN SÀNG CHẠY NGAY** | Fixture sửa đổi snapshot sinh Version 2 | Bắt lỗi 409 Conflict chuẩn xác |
| **6. Booking hold expired** | **SẴN SÀNG CHẠY NGAY** | Fixture đặt `holdExpiresAt: now - 1m` | Chứng minh blocker `BOOKING_NOT_PREPARABLE` |
| **7. Payment sandbox success** | **SẴN SÀNG CHẠY NGAY** | Dùng `signPayOSWebhook` helper | Chạy qua `V2PaymentFinalizationService` |
| **8. Payment sandbox failure/cancel** | **SẴN SÀNG CHẠY NGAY** | Webhook simulator gửi `CANCELLED` | Kiểm tra fail-closed của escrow |
| **9. Duplicate webhook** | **SẴN SÀNG CHẠY NGAY** | Webhook simulator gửi 2 lần | Kiểm tra claim idempotency |
| **10. Recovery sau khi worker bị ngắt**| **SẴN SÀNG CHẠY NGAY** | Fixture version có `GENERATING` quá 60s | Gọi trực tiếp `recoverFailedPdfs` |
| **11. PDF generation READY** | **SẴN SÀNG CHẠY NGAY** | Engine PDFKit + Unicode Noto Sans | Kiểm tra 2 trang, tiếng Việt hoàn hảo |
| **12. PDF hash verification** | **SẴN SÀNG CHẠY NGAY** | Web Crypto Subtle digest SHA-256 | Kiểm tra khớp byte stream 64 hex |
| **13. Customer download PDF** | **CÓ ĐIỀU KIỆN (CONDITIONAL)** | Dùng endpoint `GET /contracts/:id/pdf` | Đạt yêu cầu theo từng hợp đồng; **API GAP** tra cứu toàn bộ danh sách `GET /my` |
| **14. Provider isolation (IDOR)** | **SẴN SÀNG CHẠY NGAY** | Token của 2 providers khác nhau | Chứng minh 404 cho mọi truy cập chéo |
| **15. Legacy checkout regression** | **SẴN SÀNG CHẠY NGAY** | Đơn hàng `contractFlowVersion: 1` | Kiểm tra bỏ qua modal, checkout mượt mà |
| **16. Photography-only regression** | **SẴN SÀNG CHẠY NGAY** | Đơn hàng `bookingType: 'PHOTOGRAPHY'`| Kiểm tra 0 hợp đồng được tạo |
| **17. Feature flag mismatch** | **SẴN SÀNG CHẠY NGAY** | Cấu hình lệch cờ Backend/Frontend | Kiểm tra hành vi fail-closed của checkout guard |

---

## 5. Danh mục File Dự kiến Thay đổi / Bổ sung cho Phase 8B.1

Để chuẩn bị cho Phase 8B.1, các file sau đây dự kiến được tạo mới trong thư mục kiểm thử (hoàn toàn không sửa đổi mã nguồn sản phẩm):
1. `backend/src/modules/contracts/tests/contract-synthetic-e2e.spec.ts` (File chứa 17 kịch bản kiểm thử tích hợp tự động).
2. `backend/src/modules/contracts/tests/fixtures/synthetic-contract.fixture.ts` (Nơi định nghĩa `SYNTHETIC_APPROVED_TEMPLATE`, `SYNTHETIC_APPROVED_MECHANISM` và `signPayOSWebhook`).
