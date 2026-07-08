# Hướng Dẫn Sử Dụng & Tổng Kết Dự Án Di Sản Áo Dài

Tài liệu này tổng hợp toàn bộ các Usecase đã được xây dựng, cấu trúc kết nối của Trợ Lý AI Chatbot, và hướng dẫn chi tiết cách chạy thử nghiệm hệ thống.

---

## 1. Hoạt Động Của Trợ Lý AIChatBot & Kết Nối `ai-service`

**Hệ thống AI Chatbot hoạt động theo mô hình 3 lớp:**
1. **Frontend (`Vite + React`)**: Thành phần `AIChatBot` gửi tin nhắn của người dùng thông qua API `httpClient.post('/ai/chat', { message: text })`.
2. **Backend (`NestJS`)**: 
   - Nhận yêu cầu tại `POST /ai/chat` (yêu cầu đăng nhập thông qua `JwtAuthGuard`).
   - Gọi đến dịch vụ Python `ai-service` qua cấu hình biến môi trường `AI_SERVICE_URL` (mặc định là `http://127.0.0.1:8000/chat?message=<tin_nhắn>`).
3. **Python FastAPI Model (`ai-service`)**:
   - Nhận câu hỏi, chạy mô hình để trả về câu trả lời tối ưu cùng các thông số bổ sung (chủ đề, độ tin cậy, nguồn dữ liệu).
   - Nếu `ai-service` của bạn đang chạy ở cổng `8000`, NestJS sẽ lấy trực tiếp câu trả lời của mô hình và hiển thị lên giao diện.

### Cơ Chế Offline Fallback (Phòng Vệ Sự Cố)
Nếu `ai-service` (dịch vụ FastAPI Python) **chưa được bật hoặc bị lỗi kết nối**, NestJS sẽ tự động ghi nhận cảnh báo và chuyển sang chế độ **Offline Fallback** để phản hồi ngay lập tức cho người dùng bằng tiếng Việt các thông tin thiết kế Áo Dài (như dáng cổ áo, tay áo, chất liệu vải, giá thuê,...) dựa trên từ khóa tìm kiếm. Nhờ vậy, giao diện chatbot không bị gián đoạn hay báo lỗi đỏ.

---

## 2. Danh Sách Các Usecase Đã Được Thực Hiện

Hệ thống đã được thiết kế và đồng bộ hoàn thiện cả Backend và Frontend:

| Mã Usecase | Tính Năng | Mô Tả Chi Tiết |
| :--- | :--- | :--- |
| **UC-M06** | **AI Chatbot** | Giao diện Chatbot cổ phong, kết nối `ai-service` FastAPI (kèm chế độ offline fallback). |
| **UC-B06** | **Thông Tin Nhà Cung Cấp** | Cho phép Provider cập nhật thông tin dịch vụ, địa chỉ, số điện thoại và chính sách hủy lịch. |
| **UC-B08** | **Quản Lý Portfolio** | Nhà cung cấp có thể thêm/xóa các hình ảnh dự án mẫu trong bộ sưu tập. |
| **UC-F01** | **Lịch Trình Cá Nhân** | Nhà cung cấp thiết lập khung giờ làm việc cố định hàng tuần và chặn các ngày bận đột xuất. |
| **UC-P01** | **Tạo Mã Khuyến Mãi** | Nhà cung cấp tạo Voucher giảm giá theo % hoặc số tiền mặt trực tiếp. |
| **UC-G08** | **Áp Dụng Voucher** | Khách hàng áp dụng mã giảm giá và tính toán trực tiếp số tiền phải thanh toán khi đặt lịch. |
| **UC-G02** | **Thanh Toán Đặt Cọc** | Hệ thống tự động tính số tiền cọc cần trả trước (20-30% tổng giá trị). |
| **UC-G01** | **Thanh Toán Online** | Tích hợp cổng PayOS để tạo link thanh toán, kèm theo màn hình giả lập hóa đơn PayOS chuyên nghiệp. |
| **UC-G04** | **Xác Nhận Thanh Toán** | Tự động xử lý webhook cập nhật trạng thái đơn hàng khi khách hàng xác nhận "Thành Công/Hủy" trên PayOS. |
| **UC-G03** | **Lịch Sử Giao Dịch** | Hiển thị lịch sử thanh toán tiền cọc, ngày giờ giao dịch của khách hàng và nhà cung cấp. |
| **UC-H01 & UC-H04** | **Đánh Giá & Phản Hồi** | Khách hàng đánh giá sao/bình luận dịch vụ; nhà cung cấp phản hồi lại các bình luận đó. |
| **UC-H05** | **Báo Cáo Đánh Giá** | Thống kê số lượng đánh giá và số sao trung bình của nhà cung cấp trực quan. |
| **UC-H06** | **Đánh Giá 2 Chiều** | Nhà cung cấp có thể đánh giá mức độ uy tín của khách hàng sau khi hoàn thành dịch vụ. |
| **UC-H03** | **Báo Cáo Vi Phạm** | Cho phép báo cáo các bình luận đánh giá spam hoặc không phù hợp để xử lý. |

---

## 3. Kiến Trúc Thanh Toán & Đối Soát Trực Tiếp (Không Dùng Ví - No-Wallet Compliance)

Để tuân thủ các quy định pháp lý liên quan đến ví điện tử trung gian, hệ thống đã loại bỏ hoàn toàn cơ chế ví nội bộ và thay thế bằng kiến trúc **Đối soát & Thanh toán trực tiếp**:

1. **Ký Quỹ Tạm Khóa (`BookingEscrow`)**:
   - Khi Khách hàng đặt combo (Tiền dịch vụ + Tiền cọc giữ đồ) thành công qua PayOS, số tiền này được tự động đưa vào trạng thái **Ký quỹ tạm khóa (Escrow)** trên hệ thống, ghi nhận lượng tiền đang nằm giữ bởi cổng thanh toán PayOS.
2. **Tự Động Đối Soát Chia Tiền (`BookingSettlement`)**:
   - Ngay khi đơn hàng hoàn thành (`COMPLETED`), hệ thống sẽ kích hoạt lệnh chia tiền tự động:
     - Trích **10%** giá trị dịch vụ làm hoa hồng sàn.
     - **90%** còn lại được đối soát trực tiếp cho Đối tác (Provider).
3. **Chi Trả Tự Động Qua Ngân Hàng (`MockBankingService`)**:
   - Hệ thống mô phỏng lệnh chi tiền tự động từ tài khoản sàn sang tài khoản ngân hàng đã đăng ký của Đối tác qua `MockBankingService`. Mọi thông tin chuyển khoản (tên ngân hàng, số tài khoản, tên chủ thẻ, mã giao dịch ngân hàng) được lưu trữ đầy đủ tại schema `SettlementTransfer`.
4. **Hoàn Trả Tiền Cọc Tự Động (`PayOSRefundService`)**:
   - Khi đơn hàng được hủy thành công và đáp ứng đúng chính sách hủy lịch (hoặc sau khi tranh chấp được giải quyết), hệ thống gọi API PayOS Sandbox hoàn trả trực tiếp tiền cọc vào tài khoản/thẻ của Khách hàng mà không qua trung gian.
5. **Cơ Chế Phân Định Tranh Chấp Admin**:
   - Admin có quyền giải quyết tranh chấp qua endpoint phân bổ tiền ký quỹ (`POST /payments/settlement/:bookingId/resolve-dispute`) để phân bổ chia tỷ lệ tiền đền bù trực tiếp (ví dụ: hoàn khách 50%, trả shop 50%).

---

## 4. Hướng Dẫn Cách Chạy Thử Nghiệm Dự Án

### Bước 1: Khởi động FastAPI AI Service (Python)
Đảm bảo bạn đã khởi động dịch vụ Python `ai-service` của mình.
- Thường chạy ở cổng `http://127.0.0.1:8000`.

### Bước 2: Cấu HÌnh Biến Môi Trường NestJS Backend
1. Di chuyển vào thư mục `backend` và tạo/chỉnh sửa file `.env`:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/di-san-ao-dai
   JWT_SECRET=your_jwt_super_secret_key
   AI_SERVICE_URL=http://127.0.0.1:8000

   # Cấu hình PayOS (Dùng Sandbox để test hoặc để trống để hệ thống tự động giả lập thành công)
   PAYOS_CLIENT_ID=your_payos_client_id
   PAYOS_API_KEY=your_payos_api_key
   PAYOS_CHECKSUM_KEY=your_payos_checksum_key
   ```
2. Cài đặt thư viện và khởi chạy Backend:
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

### Bước 3: Khởi động Frontend
1. Di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Mở trình duyệt truy cập vào cổng mặc định hiển thị trên terminal (thường là `http://localhost:5173`).

---

## 5. Cách Kiểm Tra Các Chức Năng Chính Trên UI

1. **Thử nghiệm AI Chatbot:**
   - Đăng nhập tài liệu hệ thống, bấm vào biểu tượng hoặc tab **Trợ Lý AI** ở góc màn hình.
   - Nhập các câu hỏi tư vấn về Áo dài (Ví dụ: *"Nên chọn dáng cổ áo dài nào để che khuyết điểm cổ ngắn?"*, *"Chất liệu vải lụa tơ tằm có ưu điểm gì?"*).
   - Nếu `ai-service` đang chạy, Chatbot sẽ hiển thị phản hồi từ mô hình của bạn. Nếu không chạy, hệ thống sẽ tự động phản hồi thông minh thông qua cơ chế Offline Fallback.
   
2. **Thử nghiệm Đặt Lịch & Thanh Toán PayOS Mô Phỏng:**
   - Chọn một sản phẩm hoặc gói chụp ảnh, nhấn **Đặt Lịch**.
   - Giao diện `BookingCheckoutModal` sẽ hiện ra để bạn:
     - Nhập mã giảm giá (Voucher).
     - Xem số tiền đặt cọc cần trả trước (20-30%).
     - Bấm **Thanh toán**.
   - Bạn sẽ được chuyển hướng tới trang hóa đơn giả lập **PayOS Invoice**. Tại đây, bạn có thể click nút **"Pay Success"** (Thành công) hoặc **"Cancel"** (Hủy thanh toán) để mô phỏng webhook của PayOS gửi về NestJS Backend cập nhật đơn hàng thành công lập tức.

3. **Quản Lý Bảng Điều Khiển (Provider & Customer Dashboards):**
   - Đăng nhập tài khoản có role `PROVIDER`: Truy cập Trang cá nhân (Profile) để quản lý lịch biểu bận, thêm ảnh Portfolio, trả lời đánh giá, chấm điểm uy tín khách hàng và tạo Voucher.
   - Đăng nhập tài khoản có role `CUSTOMER`: Xem lịch sử giao dịch thanh toán đặt cọc, các đơn hàng đã đặt và viết bình luận đánh giá.

4. **Thử nghiệm Dòng Tiền & Đối Soát (No-Wallet Flow):**
   - Khi đơn được chuyển sang **COMPLETED**, bạn có thể kiểm tra cơ sở dữ liệu MongoDB các bảng `booking-escrows`, `booking-settlements` và `settlement-transfers` để thấy tiền hoa hồng và tiền nhận của shop được tính toán và chi trả tự động thông qua ngân hàng mô phỏng.
   - Thử nghiệm chức năng hủy lịch hẹn từ phía khách hàng hoặc nhà cung cấp để thấy hoàn tiền tự động qua PayOS Sandbox.
