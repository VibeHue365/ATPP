# ATPP Mobile

Ứng dụng mobile dành cho khách hàng, được xây dựng bằng React Native, Expo SDK 57, Expo Router và TypeScript.

Đối chiếu chức năng customer với web và các phần chủ động hoãn được ghi tại [USER_FLOW_AUDIT.md](./USER_FLOW_AUDIT.md).

## Chạy dự án

```bash
npm install
npx expo start
```

Sau khi Metro khởi động, mở Expo Go trên BlueStacks và kết nối tới địa chỉ Expo được hiển thị. Nếu ADB đã nhận BlueStacks, có thể nhấn `a` trong terminal để mở ứng dụng.

Tạo file `.env` từ `.env.example` và chỉnh `EXPO_PUBLIC_API_URL` về địa chỉ backend mà giả lập truy cập được. Không dùng `localhost` trong giả lập Android vì đó là chính máy ảo.

Trên Android/iOS và Expo Go, trang thanh toán được mở trong WebView của ứng dụng. Mobile chặn callback `vibehue://payment/...` rồi kiểm tra trạng thái thật với API trước khi hiển thị kết quả. Trên React Native Web, liên kết thanh toán được mở ngoài và có thể dùng nút **Kiểm tra lại** khi quay về ứng dụng.

## Kiểm tra

```bash
npm run typecheck
npx expo install --check
npx expo export --platform android
```

## Phạm vi hiện tại

- Chỉ triển khai luồng khách hàng: khám phá, thuê áo dài, đặt lịch chụp, giỏ hàng, checkout/thanh toán, đơn hàng và lịch, yêu thích, thông báo, đánh giá, hồ sơ và xác thực.
- Giao diện tham chiếu Figma; luồng và hợp đồng API tham chiếu frontend web cùng backend hiện có.
- Không triển khai màn hình admin hoặc provider trong ứng dụng này.
- Các vấn đề cần thay đổi backend được ghi riêng trong `BACKEND_NOTES.md` và chưa được can thiệp.

## Cấu trúc chính

- `app/`: route và màn hình theo Expo Router.
- `components/`: thành phần giao diện dùng lại.
- `apis/`: lớp gọi API.
- `contexts/`: trạng thái dùng chung như đăng nhập, giỏ hàng và thông báo.
- `types/`: kiểu dữ liệu TypeScript.
- `constants/`: theme và hằng số giao diện.
