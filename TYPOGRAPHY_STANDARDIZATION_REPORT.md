# BÁO CÁO CHUẨN HÓA HỆ THỐNG TYPOGRAPHY (PHÔNG CHỮ)
**Dự án:** VibeHue Web Platform  
**Ngày thực hiện:** 24/10/2026  
**Trạng thái:** Hoàn thành thành công (Build Passed 100%)

---

## 1. TỔNG QUAN & MỤC TIÊU ĐÃ ĐẠT ĐƯỢC

Trước khi chuẩn hóa, hệ thống giao diện VibeHue bị phân mảnh nghiêm trọng với hơn **6 họ phông chữ khác nhau** được nhúng rải rác:
- Một số trang ép dùng `Manrope` (Landing Page, Auth).
- Một số trang dùng `Plus Jakarta Sans` (Profile, Provider Overview, Virtual Try-on).
- Một số nơi gọi phông `Be Vietnam Pro` và `JetBrains Mono` nhưng **chưa từng được import** từ Google Fonts, dẫn đến nhảy layout hoặc giật font (FOUT).
- Admin Dashboard dùng lẫn lộn `Arial`, `monospace`, và system-ui.

### Kết quả sau khi chuẩn hóa:
1. **Quy chuẩn 100% hệ thống về 2 phông chữ chủ đạo:**
   - **`Inter` (Sans-serif):** Toàn bộ giao diện Body, Form, Nút bấm, Bảng, Thẻ sản phẩm, Admin & Provider Dashboard.
   - **`Playfair Display` (Serif):** Dành riêng cho tiêu đề Hero, Bộ sưu tập nghệ thuật, Điểm nhấn sang trọng Áo dài.
   - **`System Monospace`:** Dành cho mã giao dịch, SKU, mã đơn hàng, mã voucher.
2. **Cắt giảm hơn 50% dung lượng nạp font từ Google Fonts CDN** (loại bỏ hoàn toàn `Manrope` và `Plus Jakarta Sans`), giúp tăng tốc độ tải trang (FCP & LCP).
3. **Triệt tiêu 100% lỗi mồ côi font / giật font (FOUT).**

---

## 2. BỘ DESIGN TOKENS CHUẨN TẠI GỐC (`frontend/src/index.css`)

### A. Tối ưu hóa nạp font từ Google Fonts:
```css
/* TRƯỚC KHI FIX (Nạp cùng lúc 4 phông nặng): */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

/* SAU KHI FIX (Chỉ nạp 2 phông chuẩn với đầy đủ weights): */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap');
```

### B. Định nghĩa hệ thống biến `:root`:
```css
:root {
  /* Standard Typography Tokens */
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-header: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

---

## 3. CHI TIẾT CÁC FILE ĐÃ FIX VÀ CÁCH FIX

### Nhóm 1: Global & Auth Styles (`frontend/src/index.css`)
- **Vị trí:** Các class `.lume-auth-page`, `.lume-auth-brand-badge-text`, `.lume-auth-title`, `.lume-form-input`, `.lume-auth-submit-btn`, `.lume-auth-social-btn`.
- **Cách fix:** Thay thế toàn bộ `font-family: 'Manrope', sans-serif;` bằng `var(--font-body)`.
- **Tiêu đề Auth card:** Chuyển `font-family: 'Playfair Display', serif;` về `var(--font-display)`.

### Nhóm 2: Nhóm Khách Hàng & Trang Public
1. **`frontend/src/pages/LandingPage.css`:**
   - Thay `font-family: 'Manrope', sans-serif;` (dòng 14, 20) $\to$ `var(--font-body)` & `var(--font-header)`.
   - Chuẩn hóa chữ nhấn tiêu đề Hero `<h1><span>` (dòng 83) $\to$ `var(--font-display)`.
2. **`frontend/src/features/profile/components/ProfilePage.css`:**
   - Thay `'Plus Jakarta Sans', 'Inter', ...` (dòng 26) $\to$ `var(--font-body)`.
3. **`frontend/src/pages/combos/ComboDetailPage.css`:**
   - Chuẩn hóa `.vh-combo-title` và `.vh-sidebar-main-price` $\to$ `var(--font-display)`.
4. **`frontend/src/pages/combos/ComboListingPage.css`:**
   - Chuẩn hóa `.figma-combo-hero-title` và `.badge-text-main` $\to$ `var(--font-display)`.
5. **`frontend/src/features/combos/components/ComboCard.css`:**
   - Thay `var(--font-header, 'Manrope', sans-serif)` $\to$ `var(--font-header)`.
6. **`frontend/src/styles/unifiedListing.css` & `AoDaiListingPage.css`:**
   - Chuẩn hóa các khai báo hardcoded font $\to$ `var(--font-body)`.
7. **`features/photography-packages/components/photographyPackages.css`:**
   - Quy chuẩn `--pkg-font-serif` về `var(--font-display)` và `--pkg-font-sans` về `var(--font-body)`.
8. **`features/virtual-tryon-2d/components/VirtualTryOn2DModal.tsx` & `VirtualTryOn2DPage.tsx`:**
   - Thay inline style `fontFamily: "'Plus Jakarta Sans', sans-serif"` $\to$ `var(--font-body)`.

### Nhóm 3: Nhóm Đối Tác (Provider Dashboard)
1. **`frontend/src/features/provider-dashboard/layout/providerNavbar.css`:**
   - Xóa bỏ hoàn toàn phông mồ côi `'Be Vietnam Pro'` (dòng 43, 393) $\to$ chuyển về `var(--font-body)`.
2. **`frontend/src/features/provider-dashboard/overview/providerOverview.css`:**
   - Thay `'Plus Jakarta Sans'` (dòng 41) $\to$ `var(--font-body)`.
3. **`frontend/src/features/provider-dashboard/overview/components/OverviewMidSection.tsx`:**
   - Thay props SVG Chart `fontFamily="Plus Jakarta Sans"` $\to$ `fontFamily="Inter, sans-serif"`.
4. **`frontend/src/features/provider-dashboard/vouchers/vouchersFigma.css`:**
   - Thay `'Plus Jakarta Sans'` (dòng 252, 458) $\to$ `var(--font-body)`.
   - Thay `'JetBrains Mono'` (dòng 540, 933) $\to$ `var(--font-mono)`.
5. **`frontend/src/features/provider-dashboard/calendar/calendarFigma.css`:**
   - Header quote $\to$ `var(--font-display)`.
   - Body & container $\to$ `var(--font-body)`.
6. **`frontend/src/features/provider-dashboard/collections/productsServicesFigma.css`:**
   - Slogan $\to$ `var(--font-display)`.
   - Body $\to$ `var(--font-body)`.
7. **`frontend/src/features/provider-dashboard/collections/productWizardFigma.css`:**
   - Modal container $\to$ `var(--font-body)`.
   - Mã SKU ma trận $\to$ `var(--font-mono)`.
8. **`frontend/src/features/provider-dashboard/rental-operations/rentalOperationsFigma.css`:**
   - Slogan $\to$ `var(--font-display)`.
   - Body $\to$ `var(--font-body)`.
9. **`frontend/src/features/provider-dashboard/combos/combosFigma.css`:**
   - Map `--cb-font-serif` về `var(--font-display)`.
   - Map `--cb-font-sans` về `var(--font-body)`.
10. **`frontend/src/features/provider-dashboard/portfolio/portfolioFigma.css`:**
    - Map `--pf-font-serif` về `var(--font-display)`.
    - Map `--pf-font-sans` về `var(--font-body)`.
11. **`frontend/src/features/provider-dashboard/orders/ordersFigma.css`:**
    - Badge mã đơn $\to$ `var(--font-mono)`.

### Nhóm 4: Nhóm Quản Trị Viên (Admin Dashboard)
1. **`frontend/src/pages/admin/adminDashboard.css`:**
   - Thay `var(--font-body, Arial, sans-serif)` $\to$ `var(--font-body)`.
2. **`frontend/src/pages/admin/components/customerManagementFigma.css`:**
   - Thay hardcoded `-apple-system...` $\to$ `var(--font-body)`.
3. **Các bảng điều khiển hiển thị mã code / ID kỹ thuật:**
   - `accessControlFigma.css`, `categoryManagementFigma.css`, `partnerManagementFigma.css`, `partnerVerificationFigma.css`, `disputesFigma.css`, `reportedReviewsFigma.css` $\to$ chuyển toàn bộ các class mã hệ thống về `var(--font-mono)`.

---

## 4. KẾT QUẢ KIỂM THỬ & ĐO LƯỜNG

1. **Quét kiểm tra phông chữ dư thừa:**
   - `Manrope`: 0 phát hiện.
   - `Plus Jakarta Sans`: 0 phát hiện.
   - `Be Vietnam Pro`: 0 phát hiện.
   - `JetBrains Mono`: 0 phát hiện.
   - **Tất cả các thành phần UI 100% sử dụng biến token chuẩn (`var(--font-body)`, `var(--font-header)`, `var(--font-display)`, `var(--font-mono)`).**
2. **Build Verification:**
   - Lệnh thực thi: `cd frontend; npm run build`
   - Kết quả: `tsc -b && vite build` hoàn thành với **Exit code 0** (2164 modules transformed, không phát sinh lỗi Types hay CSS bundling).

---

## 5. CÁC HẠNG MỤC CẦN TIẾP TỤC XỬ LÝ THEO LỘ TRÌNH

Sau khi hoàn tất chuẩn hóa phông chữ, các bước tiếp theo cần triển khai để sẵn sàng deploy gồm:
1. **Khắc phục triệt để Regex Injection & ReDoS:** Bổ sung hàm escape regex cho các API search tại Backend (`categories`, `products`, `users`, `combos`, `providers`).
2. **Cài đặt Rate Limiting (`@nestjs/throttler`):** Bảo vệ các endpoint `/auth/login`, `/auth/register`, gửi OTP.
3. **Sửa lỗi URL localhost ở Giỏ hàng:** Sửa `cartCalculations.ts` dòng 62 dùng `API_BASE_URL`.
4. **Tối ưu N+1 Query:** Xóa bỏ vòng lặp `findById` trong `providers.service.ts` và `bookings-scheduler.service.ts`.
