# Provider Dashboard

Điểm vào vẫn là `src/pages/providerdashboard/ProviderDashboard.tsx`, với default/named export và route hiện có. File này điều phối các feature, effect và ghép UI.

## Cấu trúc

- `layout/`: sidebar, header, footer.
- Các thư mục nghiệp vụ (`orders`, `collections`, `inventory`, `service-profile`, `portfolio`, `calendar`, `promotions`, `reviews`, `trust`, `payouts`, `analytics`): panel/modal, state và action tương ứng.
- `hooks/`: phiên đăng nhập, điều hướng, tải provider, thông báo.
- `api/providerDashboardApi.ts`: endpoint dùng chung qua httpClient hiện có; không thay đổi giao thức hay cách xử lý lỗi.
- `types.ts`, `constants.ts`, các file `*Helpers.ts`: kiểu dữ liệu, hằng số và phép chuyển đổi.

## Những điều phải giữ khi thay đổi tiếp

1. Các hook state được gọi vô điều kiện tại dashboard. Chuyển state vào panel mount/unmount có thể làm mất form đang nhập khi đổi tab.
2. Action factory được tạo mỗi render để giữ dữ liệu của render đó. Các callback chuyển tiếp giữa feature được gọi lúc thao tác, không gọi khi tạo factory.
3. Giữ dependency và điều kiện tải dữ liệu trong effect. Thêm action factory vào dependency có thể tạo vòng lặp fetch vì identity thay đổi mỗi render. Setter từ useState vẫn ổn định.
4. Socket dùng ref để gọi phiên bản fetchOrders mới nhất và giữ một subscription; thông báo polling 30 giây, có cleanup khi unmount.
5. Tồn kho phân biệt tải toàn bộ, silent, itemsOnly và page override. Wizard sản phẩm giữ draft ID qua các bước, xóa draft sau xác nhận hủy.
6. Không sửa hoặc xóa bản tham chiếu trong `docs/refactor-baselines/provider-dashboard-2026-09-21` trước nghiệm thu. Bản này chỉ được loader kiểm thử đọc; không đưa vào production bundle.

## Kiểm tra

Chạy trong thư mục frontend:

```sh
npm run test:provider
npm run test:provider:browser
npm run build
```

Kiểm thử browser cần Google Chrome và hai cổng local 5188/5189 còn trống. API được intercept bằng fixture, không truy cập tài khoản thật. Ảnh và báo cáo xuất vào thư mục baseline/browser-parity, được gitignore. Tolerance tối đa 10 pixel với độ lệch màu 2/255 để xử lý antialiasing; kích thước ảnh phải bằng nhau.

Các test DOM/hành vi chạy cùng kịch bản trên bản gốc và bản refactor; một số component dùng chung được mock. Kiểm thử này không thay thế kiểm tra luồng backend thật, upload thật và nghiệm thu UI.
