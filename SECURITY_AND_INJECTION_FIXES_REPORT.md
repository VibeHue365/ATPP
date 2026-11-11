# BÁO CÁO CHI TIẾT TRIỂN KHAI BẢO MẬT & KHẮC PHỤC LỖ HỔNG INJECTION
**Project:** VibeHue Platform  
**Hạng mục:** II. BẢO MẬT & CÁC NGUY CƠ INJECTION (SECURITY & INJECTION AUDIT)  
**Thời gian hoàn thành:** 24/10/2026  
**Trạng thái:** ✅ Đã hoàn thành 100% & Đã kiểm thử xác thực tự động (20/20 tests Passed)

---

## TỔNG QUAN CÁC LỖ HỔNG ĐÃ ĐƯỢC KHẮC PHỤC

| STT | Lỗ hổng bảo mật | Mức độ rủi ro | Trạng thái trước khi fix | Giải pháp khắc phục | Kết quả sau khi fix |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | **Regex / NoSQL Injection & ReDoS** | 🔴 **Cao** | Ký tự tìm kiếm truyền trực tiếp vào `$regex`/`new RegExp()`, dễ crash HTTP 500 khi gặp `(`, `[`, `{`, `\`, ReDoS treo CPU. | Tạo tiện ích `escapeRegex` & `createSafeRegex`, giới hạn độ dài `maxLength = 100`, bọc `try/catch`. | 100% an toàn trước ký tự độc hại, không văng lỗi cú pháp, triệt tiêu ReDoS. |
| **2** | **Chưa có Rate Limiting trên API** | 🔴 **Cao** | Không có giới hạn tần suất request. Nguy cơ bị brute-force mật khẩu và spam cạn kiệt tài nguyên gửi OTP/Mail. | Tích hợp `@nestjs/throttler` đa tầng (100 req/phút toàn hệ thống, 5 req/phút cho Auth), gắn `ThrottlerGuard`. | Chặn đứng brute-force; request vượt ngưỡng tự động nhận mã HTTP 429 Too Many Requests. |
| **3** | **CORS & Helmet CSP lỏng lẻo ở Production** | 🟡 **Trung bình** | Luôn cho phép localhost/127.0.0.1 bất kể môi trường; CSP chứa `'unsafe-eval'` và `imgSrc: ['*']`. | Phân tách cấu hình theo `NODE_ENV`. Production chỉ whitelist `FRONTEND_URL`, xóa `'unsafe-eval'`, bỏ wildcard `*`. | Tuân thủ nghiêm ngặt tiêu chuẩn OWASP CSP & CORS cho môi trường triển khai thực tế. |

---

## 1. CHI TIẾT KHẮC PHỤC LỖ HỔNG REGEX & NoSQL INJECTION

### 1.1. Module tiện ích tập trung mới
Đã khởi tạo file: [`backend/src/common/utils/regex.util.ts`](backend/src/common/utils/regex.util.ts)
- `escapeRegex(text?: string | null): string`: Escape toàn bộ các ký tự meta-characters của RegExp: `/[.*+?^${}()|[\]\\/]/g` -> `\\$&`.
- `createSafeRegex(text?: string | null, flags = 'i', maxLength = 100): RegExp | null`:
  - Cắt chuỗi an toàn tối đa 100 ký tự (chống ReDoS từ các chuỗi cực lớn).
  - Escape ký tự đặc biệt.
  - Bọc khối `try...catch`, trả về `null` thay vì quăng `SyntaxError`.

### 1.2. Chuẩn hóa tìm kiếm Tiếng Việt
Đã cập nhật: [`backend/src/common/utils/vietnamese.util.ts`](backend/src/common/utils/vietnamese.util.ts)
- Tích hợp `escapeRegex` và cắt chuỗi 100 ký tự trước khi chuyển đổi biểu thức tiếng Việt có dấu/không dấu.

### 1.3. Các Repository và Service được refactor
1. **[`backend/src/modules/products/repositories/products.repository.ts`](backend/src/modules/products/repositories/products.repository.ts)**:
   - Thay thế việc ghép regex màu sắc, kích thước, chất liệu:
     `options.colors.map(c => new RegExp(`^${escapeRegex(c)}$`, 'i'))` (Tương tự cho `sizes`, `materials`).
   - Sửa `getMyListings` (L398): Thay `{ name: { $regex: search, $options: 'i' } }` bằng `createSafeRegex(search)`.
   - Sửa tìm kiếm Moderation (L541): Thay `new RegExp(query.search.trim(), 'i')` bằng `createSafeRegex(query.search)`.
   - Sửa `getProviderIdsByLocation` (L59-60): Sử dụng `createSafeRegex(normalized)`.
2. **[`backend/src/modules/products/services/combo-promotion.service.ts`](backend/src/modules/products/services/combo-promotion.service.ts)**:
   - Sửa tìm kiếm combo: Dùng `createSafeRegex(query.search)` cho cả `name` và `description`.
3. **[`backend/src/modules/providers/services/provider-verification.service.ts`](backend/src/modules/providers/services/provider-verification.service.ts)**:
   - Sửa lọc tỉnh thành (L828): Dùng `createSafeRegex(query.province)`.
   - Sửa tìm kiếm thông tin doanh nghiệp (L835): Dùng `createSafeRegex(query.search)`.
4. **[`backend/src/modules/categories/services/categories.service.ts`](backend/src/modules/categories/services/categories.service.ts)**:
   - Chuyển toàn bộ tìm kiếm danh mục sang `createSafeRegex(query.keyword)`, loại bỏ hàm private cục bộ.
5. **[`backend/src/modules/users/repositories/users.repository.ts`](backend/src/modules/users/repositories/users.repository.ts)**:
   - Sử dụng `createSafeRegex(filters.keyword)` cho cả 4 trường: `userCode`, `profile.fullName`, `auth.email`, `auth.phone`.
6. **[`backend/src/modules/products/services/inventory.service.ts`](backend/src/modules/products/services/inventory.service.ts)**:
   - Sử dụng `createSafeRegex(search)` khi lọc SKU và sản phẩm trong kho.

---

## 2. CHI TIẾT TRIỂN KHAI RATE LIMITING (@nestjs/throttler)

### 2.1. Cài đặt & Cấu hình toàn cục
Đã cài đặt `@nestjs/throttler` (v6.x) tương thích với NestJS 11.
Đã cấu hình tại [`backend/src/app.module.ts`](backend/src/app.module.ts):
- **Tầng `default`**: 100 requests / 60 giây (bảo vệ toàn bộ API endpoints).
- **Tầng `auth`**: 10 requests / 60 giây (hạn ngạch riêng cho module định danh).
- Đăng ký `ThrottlerGuard` qua `APP_GUARD` toàn cục.

### 2.2. Gắn hạn ngạch nghiêm ngặt cho Authentication Controller
Đã cập nhật [`backend/src/modules/auth/controllers/auth.controller.ts`](backend/src/modules/auth/controllers/auth.controller.ts):
- `@Throttle({ auth: { limit: 5, ttl: 60000 } })`: Gắn trên `/auth/login` (Tối đa 5 lần thử/phút, chặn Brute-Force mật khẩu).
- `@Throttle({ auth: { limit: 5, ttl: 60000 } })`: Gắn trên `/auth/register` (Tối đa 5 lần đăng ký/phút).
- `@Throttle({ auth: { limit: 3, ttl: 60000 } })`: Gắn trên `/auth/forgot-password` & `/auth/resend-verification` (Tối đa 3 lần/phút, bảo vệ mail server).
- `@Throttle({ auth: { limit: 5, ttl: 60000 } })`: Gắn trên `/auth/verify-email` & `/auth/reset-password`.

### 2.3. Loại trừ Rate Limit cho các endpoint hạ tầng
- Gắn `@SkipThrottle()` trên [`StorageHealthController`](backend/src/modules/storage/controllers/storage-health.controller.ts) và [`ApiDocsController`](backend/src/common/controllers/api-docs.controller.ts) để các probe kiểm tra sức khỏe của Kubernetes/Nginx không bị chặn nhầm.

---

## 3. CHI TIẾT SIẾT CHẶT CORS & HELMET CSP

Đã cập nhật [`backend/src/main.ts`](backend/src/main.ts):

### 3.1. CORS Whitelist theo môi trường (`allowedCorsOrigins`)
- **Khi `NODE_ENV === 'production'`**:
  - Tuyệt đối **KHÔNG** chấp nhận regex localhost hoặc 127.0.0.1.
  - Chỉ chấp nhận các domain được khai báo tường minh trong biến môi trường `FRONTEND_URL` (ví dụ: `https://vibehue.com,https://admin.vibehue.com`).
- **Khi `NODE_ENV !== 'production'` (Development)**:
  - Cho phép thêm các port local dev thông dụng (`5170-5179`, `3000-3009`, `4170-4179`).

### 3.2. Helmet Content Security Policy (CSP)
- **Loại bỏ hoàn toàn `'unsafe-eval'`** khỏi `scriptSrc`.
- Ở Production:
  - `scriptSrc`: Khóa cứng chỉ cho phép `["'self'"]` (loại bỏ cdn tailwind và unsafe-inline).
  - `imgSrc`: **Loại bỏ hoàn toàn wildcard `'*'`**. Chỉ cho phép các domain tin cậy:
    - `'self'` (ảnh local uploads)
    - `data:`, `blob:` (preview canvas/blob)
    - `https://img.vietqr.io` (VietQR banking)
    - `https://images.unsplash.com` (kho ảnh mẫu)
    - `https://res.cloudinary.com` (Cloudinary CDN)
    - Domain MinIO / S3 lấy tự động từ `STORAGE_PUBLIC_DOMAIN` hoặc `MINIO_ENDPOINT`.
  - Bổ sung `objectSrc: ["'none'"]` và `frameAncestors: ["'none'"]` (ngăn chặn Clickjacking và nhúng frame).

---

## 4. KẾT QUẢ KIỂM THỬ XÁC THỰC (VERIFICATION RESULTS)

### 4.1. Unit Test Suite (`regex.util.spec.ts`)
```
PASS src/common/utils/regex.util.spec.ts
  RegexUtil
    escapeRegex
      √ should return empty string for null, undefined, or empty input (3 ms)
      √ should escape all special regex characters (1 ms)
      √ should preserve alphanumeric characters and spaces
    createSafeRegex
      √ should return null for invalid, empty, or whitespace inputs (1 ms)
      √ should safely compile malformed regex inputs without throwing SyntaxError (2 ms)
      √ should truncate input exceeding maxLength to prevent ReDoS

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        0.372 s
```

### 4.2. Runtime Integration Suite (`verify_security.js`)
Đã bắn trực tiếp các payload tấn công thực tế vào backend đang chạy trên cổng 3000:
```
=== STARTING SECURITY VERIFICATION SUITE ===

--- 1. Testing Regex Injection & Syntax Crash Resistance ---
[PASS] GET /products?search=( returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword=( returned HTTP 200 (Expected 200)
[PASS] GET /products?search=[ returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword=[ returned HTTP 200 (Expected 200)
[PASS] GET /products?search={ returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword={ returned HTTP 200 (Expected 200)
[PASS] GET /products?search=\ returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword=\ returned HTTP 200 (Expected 200)
[PASS] GET /products?search=((((( returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword=((((( returned HTTP 200 (Expected 200)
[PASS] GET /products?search=.*.*.*.*a returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword=.*.*.*.*a returned HTTP 200 (Expected 200)
[PASS] GET /products?search=test[0-9 returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword=test[0-9 returned HTTP 200 (Expected 200)
[PASS] GET /products?search=+*?^$ returned HTTP 200 (Expected 200)
[PASS] GET /categories?keyword=+*?^$ returned HTTP 200 (Expected 200)

--- 2. Testing Security Headers & Helmet CSP ---
[PASS] CSP correctly excludes 'unsafe-eval'
[PASS] X-Frame-Options is DENY
[PASS] X-Content-Type-Options is nosniff

--- 3. Testing Rate Limiting on Sensitive Endpoint (/auth/login) ---
Request #6 triggered HTTP 429 Too Many Requests as expected.
[PASS] Rate limiter successfully triggered HTTP 429 on excessive requests

=== VERIFICATION SUMMARY ===
Total Passed: 20
Total Failed: 0
ALL SECURITY CHECKS PASSED SUCCESSFULLY!
```

---

## 5. KẾT LUẬN & HƯỚNG DẪN BẢO TRÌ

Hệ thống hiện tại đã đáp ứng đầy đủ các tiêu chuẩn bảo mật cho môi trường triển khai thực tế (Production Readiness):
1. **Không còn lỗ hổng Regex Crash / ReDoS**: Bất kỳ chuỗi tìm kiếm nào do người dùng nhập vào đều được escape và truncate an toàn.
2. **Có cơ chế Rate Limiting**: Tự động chặn các cuộc tấn công Brute-force mật khẩu hoặc spam OTP/Email với mã HTTP 429.
3. **CORS & CSP an toàn**: Sẵn sàng deploy production chỉ cần thiết lập biến môi trường `FRONTEND_URL` và `NODE_ENV=production`.
