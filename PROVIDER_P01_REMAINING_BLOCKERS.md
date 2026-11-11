# BÁO CÁO CÁC ĐIỂM NGHẼN & BƯỚC TIẾP THEO (PROVIDER P0.1 REMAINING BLOCKERS)

---

## 1. Phân tích Khoảng trống Quy trình Chấp thuận (Provider Acceptance Flow Gap)

### 1.1. Hiện trạng API `POST /contracts/provider/acceptance`
- **Tình trạng Backend:** **Đã sẵn sàng (Ready).**
  - Endpoint nhận `{ mechanismHash: string }` thông qua `ProviderAcceptMechanismDto`.
  - Được bảo vệ bởi `JwtAuthGuard`, kiểm tra quyền sở hữu Shop (`requireActiveRentalProvider`), so khớp mã băm quy chế với phiên bản sàn đã duyệt (`getApproved()`), băm `policyFingerprint` từ dữ liệu thực tế và ghi nhận vào MongoDB với Partial Unique Index chống race condition.
- **Tình trạng Frontend UI:** **Chưa sẵn sàng (Not Ready).**
  - Giao diện `ProviderContractStatusCard.tsx` tại Dashboard hiện chỉ hiển thị thẻ thông tin trạng thái tĩnh (Badge, ngày chấp thuận, mô tả).
  - **Chưa có nút "Xem & Ký cam kết Quy chế"** và **chưa có Modal đọc văn bản quy chế** để Provider chủ động bấm xác nhận và gửi request lên API.

### 1.2. Hiện trạng Quy chế Sàn (`ContractMechanismService.getApproved()`)
- Trong mã nguồn `ContractMechanismService`:
  - `AUTO_ACCEPTANCE_MECHANISM_V1` có trạng thái `DRAFT`.
  - `AUTO_ACCEPTANCE_MECHANISM_V2` có trạng thái `APPROVED` với ngày duyệt hardcode `2026-10-31T00:00:00.000Z`.
- **Thực tế nghiệp vụ:** Phiên bản `V2` này do developer định nghĩa để phục vụ kiểm thử, **chưa được Ban Giám đốc / Pháp chế ký duyệt chính thức (Business Sign-off)**.
- Khi chưa có quy chế được phê duyệt chính thức, Provider không thể thực hiện giao kết hợp lệ vì `approval.accept()` sẽ ném lỗi `CONTRACT_MECHANISM_NOT_APPROVED` nếu cơ chế ở trạng thái DRAFT.

### 1.3. Tác động Thực tế khi Dashboard thiếu nút ACCEPT
- Do backend đã đóng chặt lỗ hổng auto-upsert (Fail-Closed), nếu một Shop chưa có bản ghi acceptance trong cơ sở dữ liệu, **Shop đó hiện không có công cụ giao diện để tự kích hoạt cam kết**.
- **Hệ quả đối với khách hàng:** Khi khách hàng đặt thuê áo dài của shop đó, API `readiness` và `prepare` sẽ ném `PROVIDER_AUTO_ACCEPTANCE_MISSING`, giỏ hàng báo blocker `PROVIDER_ACCEPTANCE_MISSING` và **khách hàng không thể bấm thanh toán**.
- Đây là hành vi đúng chuẩn an toàn (Fail-Closed Gate), ngăn chặn triệt để giao kết giả mạo.

### 1.4. Các bước Cần thiết để Hoàn tất Quy trình Chấp thuận (Đề xuất triển khai P1)
1. **Bước 1 — Phê duyệt Quy chế (Business Sign-off):** Ban Quản trị phê duyệt nội dung văn bản quy chế sàn chính thức, cập nhật `AUTO_ACCEPTANCE_MECHANISM` sang trạng thái APPROVED với ngày duyệt thực tế.
2. **Bước 2 — API Xem Quy chế:** Cung cấp endpoint `GET /contracts/provider/mechanism` trả về toàn văn quy chế kèm mã băm SHA-256.
3. **Bước 3 — Nút & Modal trên Dashboard:** Bổ sung nút **"Xem & Ký cam kết Quy chế"** trên `ProviderContractStatusCard.tsx`. Khi bấm, mở Modal toàn màn hình hiển thị toàn văn quy chế và checkbox cam kết.
4. **Bước 4 — Bấm Ký:** Khi Shop bấm xác nhận, frontend gọi `POST /contracts/provider/acceptance` gửi `mechanismHash` để backend ghi nhận cam kết mang danh tính của chính shop.

---

## 2. Trạng thái Đề xuất Nghiệp vụ (Business Policy Sign-Off Status)

Toàn bộ các điều khoản nghiệp vụ sau đây **bắt buộc giữ trạng thái `PROPOSED / NEEDS_APPROVAL`**, tuyệt đối không coi là chính sách chính thức khi chưa có văn bản phê duyệt:

| Nội dung chính sách đề xuất | Trạng thái hiện tại | Ghi chú kiểm soát |
| :--- | :---: | :--- |
| Hoàn 100% tiền cọc khi hủy trước bàn giao | `PROPOSED / NEEDS_APPROVAL` | Đang chờ Ban Giám đốc phê duyệt quy chế tài chính. |
| Khung giờ hoàn tiền thuê 48h (Shop) vs 72h (Sàn) | `PROPOSED / NEEDS_APPROVAL` | Đang chờ thống nhất ngưỡng bảo vệ người tiêu dùng. |
| Phạm vi tính phí hủy (chỉ trên tiền thuê) | `PROPOSED / NEEDS_APPROVAL` | Đang chờ thẩm định kế toán & cổng thanh toán. |
| Mức phạt trả trễ (ngưỡng 200.000đ/ngày, ân hạn 1-4h) | `PROPOSED / NEEDS_APPROVAL` | Là guardrail kỹ thuật đề xuất, không phải luật định. |
| Giới hạn bồi thường mất trang phục (100% giá niêm yết) | `PROPOSED / NEEDS_APPROVAL` | Đang chờ mẫu hợp đồng pháp lý hoàn chỉnh. |
| Cơ chế Provider AUTO_ACCEPTANCE | `PROPOSED / NEEDS_APPROVAL` | Văn bản cam kết điện tử chờ ban hành chính thức. |

---

## 3. Kiểm toán Dữ liệu Cũ (Legacy Records Audit & Provenance)

### 3.1. Truy vấn Kiểm toán Chỉ đọc (Read-Only)
```javascript
use('vibehue');
db.provider_contract_acceptances.aggregate([
  { $match: { status: "ACTIVE" } },
  {
    $lookup: {
      from: "providers",
      localField: "providerId",
      foreignField: "_id",
      as: "providerDoc"
    }
  },
  { $unwind: { path: "$providerDoc", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 1,
      providerId: 1,
      businessName: "$providerDoc.businessName",
      acceptedByUserId: 1,
      providerOwnerUserId: "$providerDoc.userId",
      mechanismVersion: 1,
      mechanismHash: 1,
      policyFingerprint: 1,
      templateVersion: 1,
      acceptedAt: 1
    }
  },
  { $sort: { acceptedAt: -1 } }
]);
```

### 3.2. Kết luận về Nguồn gốc Dữ liệu (Data Provenance Verdict)
- **Đánh giá cấu trúc Schema:** Bảng `provider_contract_acceptances` hiện chỉ lưu trữ: `providerId`, `acceptedByUserId`, `scope`, `mechanismVersion`, `mechanismHash`, `policyFingerprint`, `templateVersion`, `status`, `acceptedAt`.
- **Hạn chế:** Bản ghi không chứa thông tin nguồn gốc gọi (`sourceChannel`: UI vs Backend Auto-prep), không lưu IP Address hay Request ID.
- **Kết luận:** **`PROVENANCE_NOT_VERIFIABLE`** (Không thể xác minh chắc chắn 100% bản ghi nào do shop bấm thật và bản ghi nào do backend auto-upsert trước đây tạo ra).
- **Hành động an toàn:** **Tuyệt đối không tự ý xóa, sửa hoặc revoke hàng loạt các bản ghi acceptance cũ trên Atlas**. Mọi can thiệp dữ liệu phải đợi quyết định chính thức từ Quản trị viên hệ thống.

---

## 4. Bảng Kết luận & Quyết định Nghiệm thu (Final Decisions)

| Hạng mục đánh giá | Kết luận | Căn cứ xác nhận |
| :--- | :---: | :--- |
| **P0 Code Fix (Backend Guard)** | **PASS** | Đã xóa triệt để auto-upsert và silent fingerprint mutation. Code fail-closed 100%. |
| **MongoDB Integration Tests** | **PASS** | 10 kịch bản kiểm thử tích hợp trên replica set `rsContractTest` port 27028 đạt 100%. |
| **HTTP / Startup Verification** | **PASS** | NestJS khởi động sạch, không có `UnknownDependenciesException`, resolve controller & 9 routes. |
| **Provider Self-Acceptance UI** | **NOT READY** | Frontend chưa có nút "Ký cam kết quy chế" và chưa có modal xem toàn văn quy chế. |
| **Production Readiness** | **NO-GO** | **Chưa sẵn sàng bật production.** Cần bổ sung UI ký cam kết cho Shop và phê duyệt quy chế chính thức. |
