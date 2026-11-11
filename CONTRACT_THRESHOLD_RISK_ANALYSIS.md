# VIBEHUE — BÁO CÁO PHÂN TÍCH RỦI RO CƠ CHẾ HẠN MỨC HỢP ĐỒNG (CONTRACT THRESHOLD RISK ANALYSIS)

Tài liệu phân tích chuyên sâu về mặt pháp lý, nghiệp vụ thương mại điện tử, và rủi ro kiến trúc kỹ thuật liên quan đến đề xuất áp dụng **"Hạn mức hợp đồng" (Contract Threshold Amount)** hoặc **"Cho phép khách hàng bỏ qua hợp đồng điện tử khi đơn hàng dưới ngưỡng"**.

---

## 1. Cơ sở Nghiệp vụ & Pháp lý về Thuê Tài sản (Civil Code & Legal Grounds)

### 1.1. Bản chất Hợp đồng Thuê Tài sản
- Theo quy định tại Điều 472 Bộ luật Dân sự 2015:
  > *"Hợp đồng thuê tài sản là sự thỏa thuận giữa các bên, theo đó bên cho thuê giao tài sản cho bên thuê để sử dụng trong một thời hạn, bên thuê phải trả tiền thuê."*
- Khác với giao dịch **Mua bán hàng hóa** (quyền sở hữu chuyển giao vĩnh viễn cho người mua ngay khi nhận hàng), giao dịch **Thuê áo dài truyền thống** có đặc thù:
  - Tài sản vật lý tạm thời rời khỏi sự kiểm soát của Nhà cung cấp.
  - Giá trị thực tế của bộ trang phục (nhất là áo dài lụa, gấm, tơ tằm thêu tay) thường gấp **5 đến 15 lần** số tiền thuê một ngày.
  - Tranh chấp phổ biến không phải là việc trả tiền thuê, mà là: **hư hỏng, rách lụa, dính vết bẩn không thể tẩy, tráo đổi phụ kiện, hoặc chậm trả/không chịu trả lại trang phục**.

### 1.2. Hậu quả khi Bỏ qua Hợp đồng Điện tử
- Theo Điều 119 và Điều 472 Bộ luật Dân sự 2015, một giao dịch thuê tài sản dù không lập văn bản hợp đồng điện tử thì vẫn không tự động bị coi là vô hiệu (vẫn có thể hình thành qua hành vi giao nhận tài sản và thanh toán).
- Tuy nhiên, khi bỏ qua Hợp đồng điện tử có mã băm SHA-256 và snapshot tình trạng sản phẩm:
  - Sàn VibeHue và Provider **bị mất đi chứng cứ pháp lý xác thực bằng văn bản dữ liệu điện tử** để chứng minh sự đồng thuận của khách đối với các điều khoản giữ cọc, trách nhiệm bồi thường theo giá niêm yết, và quy tắc trả muộn.
  - Khi khách hàng khiếu nại qua cổng thanh toán (PayOS / Ngân hàng) hoặc phát sinh tranh chấp hư hỏng tài sản, việc thiếu hợp đồng điện tử có chữ ký/chấp thuận điện tử khiến bên cho thuê gần như luôn ở thế yếu và không thể chứng minh căn cứ khấu trừ tiền cọc.
  - Do đó, việc duy trì hợp đồng điện tử 100% bắt buộc là giải pháp phòng vệ pháp lý tối ưu cho cả Sàn và Nhà cung cấp.

---

## 2. Rủi ro Đa tầng khi Triển khai Hạn mức Hợp đồng (Multi-dimensional Risks)

### 2.1. Sự mơ hồ về Căn cứ So sánh Ngưỡng (Threshold Baseline Ambiguity)
Khi nói "Đơn hàng dưới 500.000đ thì không cần hợp đồng", hệ thống đối mặt với câu hỏi cốt lõi: **Giá trị nào được dùng làm căn cứ so sánh?**
1. **Tiền thuê (Rental Subtotal)?** Ví dụ: Tiền thuê áo là 400.000đ (dưới 500k), nhưng tiền cọc trang phục là 2.000.000đ. Nếu bỏ qua hợp đồng vì tiền thuê dưới ngưỡng, 2.000.000đ tiền cọc và tài sản giá trị cao sẽ nằm ngoài sự bảo vệ của hợp đồng!
2. **Tiền cọc (Deposit Total)?** Có những bộ áo giá trị cao nhưng tiền cọc ưu đãi thấp, hoặc ngược lại.
3. **Tổng thanh toán (Grand Total)?** Bao gồm cả phụ phí dịch vụ, phí vận chuyển (travel fee).
4. **Ảnh hưởng của Mã giảm giá (Vouchers / Platform Subsidies):**
   - Đơn hàng gốc: `1.050.000đ` (vượt ngưỡng 1.000.000đ -> Bắt buộc hợp đồng).
   - Khách nhập Voucher giảm `100.000đ` -> Số tiền phải trả còn `950.000đ` (rơi xuống dưới ngưỡng -> Bỏ qua hợp đồng).
   - **Hệ quả tiêu cực:** Chỉ vì một mã giảm giá 50k - 100k mà toàn bộ tính chất pháp lý bảo vệ tài sản của hợp đồng bị bật/tắt liên tục (Flickering Contract Requirement), gây hoang mang cho người dùng và lỗi trạng thái hệ thống.

---

### 2.2. Xung đột Đơn hàng Nhiều Shop (Multi-provider & Combo Carts)
- Một giỏ hàng của khách hàng có thể chứa:
  - Áo dài của **Shop A** (Shop A đặt ngưỡng bắt buộc hợp đồng: `500.000đ`).
  - Áo dài của **Shop B** (Shop B đặt ngưỡng bắt buộc hợp đồng: `1.500.000đ`).
  - Gói chụp ảnh của **Photographer C** (Không yêu cầu hợp đồng thuê).
- Đơn hàng tổng trị giá `1.200.000đ`:
  - Đối với Shop A: Bắt buộc hợp đồng.
  - Đối với Shop B: Không bắt buộc hợp đồng.
- **Xung đột nghiệp vụ:**
  - Khách hàng có phải ký hợp đồng lẻ với Shop A và bỏ qua Shop B không?
  - Trải nghiệm Checkout sẽ bị phân mảnh: Khách vừa phải ký 1 hợp đồng, vừa thanh toán phần không hợp đồng trong cùng một lượt thanh toán PayOS duy nhất. Nếu xảy ra hủy đơn hoặc hoàn tiền một phần, việc đối soát pháp lý cực kỳ phức tạp.

---

### 2.3. Xung đột Thời gian thực và Cạnh tranh Dữ liệu (Race Conditions)
1. **Provider đổi ngưỡng khi Khách đang giữ chỗ (Hold):**
   - Lúc 14:00: Shop đặt ngưỡng `1.000.000đ`. Khách tạo đơn giữ chỗ `800.000đ` (hệ thống đánh dấu `NOT_REQUIRED`).
   - Lúc 14:05: Shop hạ ngưỡng xuống `500.000đ`.
   - Lúc 14:08: Khách bấm thanh toán. Lúc này `ContractCheckoutGuard` kiểm tra theo ngưỡng cũ hay ngưỡng mới? Nếu ném lỗi chặn khách, tỷ lệ bỏ rơi giỏ hàng (Drop-off Rate) sẽ tăng vọt.
2. **Kẽ hở trục lợi:**
   - Người thuê cố tình chia nhỏ đơn hàng thành nhiều đơn lẻ dưới ngưỡng để né tránh việc phải ký hợp đồng điện tử cam kết bồi thường, sau đó chiếm đoạt trang phục hoặc tráo đổi phụ kiện.

---

## 3. Bảng Ma trận Đánh giá Rủi ro (Risk Evaluation Matrix)

| Kịch bản đề xuất | Mức độ Rủi ro Pháp lý | Mức độ Phức tạp Kỹ thuật | Tác động Trải nghiệm Khách hàng | Khuyến nghị của Kiến trúc sư |
| :--- | :---: | :---: | :---: | :--- |
| **A. Cho khách checkbox tự chọn có làm hợp đồng hay không** | **CỰC KỲ CAO (P0)** | Trung bình | Tốt cho khách xấu, nguy hiểm cho Shop | **BÁC BỎ HOÀN TOÀN.** Khách có ý định tráo đồ sẽ luôn bỏ chọn hợp đồng. |
| **B. Cho Provider tự đặt ngưỡng tiền bỏ qua hợp đồng** | **CAO (P1)** | Rất cao (Multi-shop, Voucher race) | Gây bối rối (mỗi shop một kiểu ngưỡng) | **KHÔNG TRIỂN KHAI.** Phá vỡ tính đồng nhất của hệ sinh thái Contracts V2. |
| **C. Giữ nguyên 100% hợp đồng điện tử bắt buộc cho mọi đơn thuê** | **RẤT THẤP (An toàn)** | Đã kiểm thử ổn định, tối ưu | Rõ ràng, minh bạch, chuyên nghiệp | **KHUYẾN NGHỊ DUY TRÌ 100%.** Bảo vệ tuyệt đối cả Provider, Khách hàng và Sàn. |

---

## 4. Kết luận và Quyết định Kiến trúc

1. **Tuân thủ Quyết định của Người dùng:**
   - **DỪNG VÀ KHÔNG TRIỂN KHAI** bất kỳ tính năng nào liên quan đến `contractThresholdAmount` hoặc Checkbox tùy chọn bỏ qua hợp đồng.
   - Giữ nguyên `ContractCheckoutGuard` ở chế độ **bắt buộc 100% (Mandatory)** đối với toàn bộ các giao dịch thuê trang phục áo dài trên nền tảng VibeHue.
2. **Tập trung Nguồn lực:**
   - Dồn toàn bộ ưu tiên vào việc **hoàn thiện giao diện quản lý chính sách có cấu trúc cho Provider** và **cơ chế Provider chủ động ký cam kết quy chế** để đảm bảo đầy đủ căn cứ pháp lý trước khi khách hàng bấm ký chấp thuận.
