# 📖 HƯỚNG DẪN CHI TIẾT LUỒNG BOOKING, THANH TOÁN & QUYẾT TOÁN (ATPP / VIBEHUE365)

Tài liệu mô tả toàn bộ quy trình hoạt động của các luồng Booking từ khi **Chọn sản phẩm** đến **Thanh toán**, **Thực hiện**, **Hoàn đơn**, **Kiểm tra lịch sử thanh toán**, **Tố cáo/Tranh chấp** và **Quyết toán tiền cho Nhà cung cấp (Provider)** thông qua **Sơ đồ khung hộp trực quan (Visual Box Diagrams)**, văn bản giải thích và **Đặc tả kỹ thuật chuẩn xác dành cho AI Agent / Developer**.

---

## 📌 1. TỔNG QUAN HỆ THỐNG & CÁC BÊN THAM GIA

| Vai trò | Ký hiệu | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Khách hàng (Customer)** | 👤 Customer | Tìm kiếm, đặt lịch, thanh toán tiền thuê & tiền cọc, nghiệm thu sản phẩm/dịch vụ. |
| **Nhà cung cấp (Provider)** | 🏬 Shop / 📸 Photo | Tiếp nhận đơn, xác nhận/từ chối, bàn giao đồ/chụp ảnh, báo cáo sự cố (nếu có). |
| **Hệ thống (Platform)** | ⚙️ System | Giữ lịch (Hold), trung gian giữ tiền (Escrow), tự động hóa cọc/hoàn tiền, tính toán hoa hồng. |
| **Quản trị viên (Admin)** | 🛡️ Admin | Trọng tài giải quyết tranh chấp (Dispute), duyệt quyết toán (Settlement & Payout). |

---

## 🔄 2. SƠ ĐỒ LUỒNG CHÍNH TỔNG THỂ (END-TO-END HAPPY PATH DIAGRAM)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        👤 KHÁCH CHỌN SẢN PHẨM / DỊCH VỤ                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               🛒 TẠO BOOKING & GIỮ LỊCH (HoldSchedule 15 Phút)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────┴────────────────────────────────────┐
│                    💳 THANH TOÁN QUA CỔNG NẠP TIỀN                      │
└─────────┬────────────────────────────────────────────────────┬─────────┘
          │ (Thanh toán Thành Công)                            │ (Hết 15p / Thất bại)
          ▼                                                    ▼
┌───────────────────────────────────┐               ┌────────────────────┐
│  🔒 TIỀN VÀO VÍ TẠM GIỮ ESCROW    │               │ ❌ HỦY BOOKING     │
│  & TỰ ĐỘNG SINH HỢP ĐỒNG ĐIỆN TỬ  │               │ & MỞ KHÓA KHUNG GIỜ│
└─────────────────┬─────────────────┘               └────────────────────┘
                  │
        ┌─────────┴─────────────────────────────────┐
        │ (Kiểm tra Loại Booking)                   │
        ▼                                           ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│   👗 DỊCH VỤ THUÊ ÁO DÀI      │   │       📸 DỊCH VỤ CHỤP ẢNH         │
├───────────────────────────────┤   ├───────────────────────────────────┤
│ 1. Shop chuẩn bị & bàn giao   │   │ 1. Thợ bắt đầu chụp (IN_PROGRESS) │
│    chụp ảnh tình trạng đồ     │   │                                   │
│    (PICKUP_PENDING)           │   │ 2. Thợ nộp ảnh & gửi link Drive   │
│ 2. Khách nhận đồ (PICKED_UP)  │   │    trả sản phẩm (AWAITING_REVIEW) │
│ 3. Khách mặc trả (RETURNED)   │   │                                   │
│ 4. Shop kiểm tra áo nguyên vẹn│   │ 3. Cửa sổ 48h Khách duyệt ảnh     │
│ 5. Tự động hoàn cọc 100%      │   │    hoặc Hệ thống Auto-complete    │
└───────────────┬───────────────┘   └─────────────────┬─────────────────┘
                │                                     │
                └───────────────────┬─────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       🎉 BOOKING HOÀN THÀNH (COMPLETED)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│          📊 QUYẾT TOÁN DOANH THU (Tính Commission & Platform Fee)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             🏦 BANKING PAYOUT CHUYỂN KHOẢN TIỀN CHO PROVIDER           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📑 3. CHI TIẾT SƠ ĐỒ & QUY TRÌNH TỪNG BƯỚC (STEP-BY-STEP DIAGRAMS)

### 🔹 BƯỚC 1 & 2: SƠ ĐỒ LUỒNG ĐẶT LỊCH, THANH TOÁN & HỢP ĐỒNG

```text
[👤 Khách Hàng]          [⚙️ Hệ Thống ATPP]        [💳 Cổng VNPay/PayOS]      [🔒 Ví Escrow]
      │                          │                          │                        │
      ├── 1. Chọn đồ / lịch ───►│                          │                        │
      │                          ├── 2. Khóa lịch 15 min ──►│                        │
      │◄── 3. Trả đếm ngược 15p ─┤                          │                        │
      │                          │                          │                        │
      ├── 4. Bấm Thanh Toán ───────────────────────────────►│                        │
      │                                                     │                        │
      │── (Thanh toán Thành Công) ─────────────────────────►│                        │
      │                          │◄── 5. Gửi Webhook ───────┤                        │
      │                          ├── 6. Chuyển tiền tạm giữ ────────────────────────►│
      │                          ├── 7. Sinh Hợp Đồng ĐT    │                        │
      │                          ├── 8. Đơn -> CONFIRMED    │                        │
      │◄── 9. Thông báo Thành Công ┤                        │                        │
```

---

### 🔹 BƯỚC 3: SƠ ĐỒ LUỒNG THỰC HIỆN DỊCH VỤ (FULFILLMENT DIAGRAMS)

#### 👗 3.1. Sơ đồ Dịch vụ Thuê Áo Dài (`AODAI_RENTAL`):

```text
┌──────────────────────────┐
│  🔒 Đơn hàng CONFIRMED   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  📦 Shop chuẩn bị đồ     │
│  & Chụp ảnh tình trạng   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  🚚 Shop bấm Bàn Giao    │
│  (PICKUP_PENDING)        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  👤 Khách nhận & kiểm đồ │
│  (PICKED_UP)             │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  ↩️ Khách dùng xong & trả │
│  (RETURN_PENDING)        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  🔍 Shop kiểm tra đồ     │
└────────────┬─────────────┘
             │
     ┌───────┴─────────────────────────┐
     │                                 │
     ▼ (Đồ nguyên vẹn)                 ▼ (Áo bị dơ / rách / hỏng)
┌──────────────────────────┐     ┌──────────────────────────┐
│  ✅ Chuyển RETURNED      │     │  🚨 Chuyển DISPUTED      │
│  & Tự động Hoàn cọc 100% │     │  & Lập IncidentReport    │
└──────────────────────────┘     └──────────────────────────┘
```

#### 📸 3.2. Sơ đồ Dịch vụ Chụp Ảnh (`PHOTOGRAPHY`):

```text
┌──────────────────────────┐
│  🔒 Đơn hàng CONFIRMED   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  📸 Bắt đầu buổi chụp    │
│  (IN_PROGRESS)           │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  🖼️ Thợ nộp ảnh demo     │
│  & Gửi link Google Drive │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  📤 Thợ bấm Giao Sản Phẩm│
│  (AWAITING_REVIEW)       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  ⏱️ Đếm ngược 48 giờ     │
└────────────┬─────────────┘
             │
     ┌───────┴─────────────────────────┐
     │                                 │
     ▼ (Khách duyệt / Hết 48h)         ▼ (Khách khiếu nại chất lượng)
┌──────────────────────────┐     ┌──────────────────────────┐
│  🎉 Chuyển COMPLETED     │     │  🛡️ Mở ca Tranh chấp     │
│  & Tính quyết toán       │     │  Dispute với Admin       │
└──────────────────────────┘     └──────────────────────────┘
```

---

### 🔹 BƯỚC 4 & 5: SƠ ĐỒ LUỒNG HOÀN CỌC & QUYẾT TOÁN PAYOUT

```text
┌────────────────────────────────────────────────────────┐
│           🎉 Booking chuyển sang COMPLETED             │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│ 💰 Tạo RefundRequest     │     │ 📊 Engine Quyết toán     │
│ Hoàn Tiền Cọc Đồ cho Khách│     │ tạo bản ghi Settlement   │
└──────────────────────────┘     └───────────┬──────────────┘
                                             │
                                             ▼
                                 ┌──────────────────────────┐
                                 │ 🧮 TÍNH TIỀN THỰC NHẬN   │
                                 ├──────────────────────────┤
                                 │ Gross = Tiền Dịch Vụ     │
                                 │ Commission = Gross x %   │
                                 │ Net = Gross - Commission │
                                 └───────────┬──────────────┘
                                             │
                                             ▼
                                 ┌──────────────────────────┐
                                 │ 📌 Chuyển trạng thái     │
                                 │ READY_TO_SETTLE          │
                                 └───────────┬──────────────┘
                                             │
                                             ▼
                                 ┌──────────────────────────┐
                                 │ 🏦 Chuyển khoản Payout   │
                                 │ Ngân hàng cho Provider   │
                                 │ (Trạng thái -> SETTLED)  │
                                 └──────────────────────────┘
```

---

## 🔀 4. SƠ ĐỒ CÁC LUỒNG RẼ NHÁNH & XỬ LÝ SỰ CỐ (EDGE CASE DIAGRAMS)

### 🛑 Rẽ nhánh A: Sơ đồ Hủy Đơn / Hết Hạn Giữ Lịch

```text
┌───────────────────────────────────┐
│ Đơn PENDING (Chờ thanh toán)      │
└─────────────────┬─────────────────┘
                  │ (Shop từ chối / Hết 15 phút)
                  ▼
┌───────────────────────────────────┐
│     Trạng thái: CANCELLED         │
└─────────────────┬─────────────────┘
                  │
        ┌─────────┴─────────┐
        │  Đã trả tiền chưa?│
        └─────────┬─────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
   [ ĐÃ TRẢ TIỀN ]   [ CHƯA TRẢ TIỀN ]
         │                 │
         ▼                 ▼
┌─────────────────┐ ┌─────────────────┐
│ 🔄 Refund 100%  │ │ 🔓 Mở lịch giữ  │
│ cho Khách       │ │ cho người khác  │
│                 │ │ đặt             │
│ 📉 Trừ điểm     │ └─────────────────┘
│ uy tín của Shop │
└─────────────────┘
```

---

### ❌ Rẽ nhánh B: Sơ đồ Hủy Đơn Theo Chính Sách Hủy (Cancellation Policy)

```text
                  ┌─────────────────────────────────────┐
                  │ 👤 KHÁCH HÀNG BẤM HỦY ĐƠN ĐÃ ĐẶT    │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │ (Trước > 72 giờ)          │ (Trong 24h - 72h)         │ (Dưới 24 giờ / Bùng lịch)
         ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ 💵 HOÀN 100%     │        │ 💵 HOÀN 50%      │        │ ❌ KHÔNG HOÀN    │
│ Tiền thuê + Cọc  │        │ Tiền thuê + Cọc  │        │ Tiền thuê        │
├──────────────────┤        ├──────────────────┤        ├──────────────────┤
│ Phạt hủy: 0 VNĐ  │        │ Phạt 50% tiền    │        │ Phạt 100% tiền   │
│                  │        │ thuê chuyển Shop │        │ thuê chuyển Shop │
└────────┬─────────┘        └────────┬─────────┘        └────────┬─────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ 🔄 Tạo Lệnh Refund Đóng │
                        │  Trạng thái: CANCELLED  │
                        └─────────────────────────┘
```

---

### 🚨 Rẽ nhánh C: Sơ đồ Báo Cáo Áo Lỗi Lúc Nhận Đồ (Pickup Damage Report)

```text
┌─────────────────────────────────┐
│ 🚚 Khách nhận đồ tại Cửa hàng   │
└────────────────┬────────────────┘
                 │
┌────────────────┴────────────────┐
│ ⏱️ Kiểm tra trong vòng 30 phút  │
└────────────────┬────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
  [ 🟢 Bình Thường ]   [ 🔴 Áo Dơ / Rách / Lỗi ]
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────────────────────┐
│ Khách bấm    │   │ 📸 Khách chụp ảnh bằng chứng │
│ Xác Nhận     │   │ và gửi pickupDamageReport    │
│ (PICKED_UP)  │   └──────────────┬───────────────┘
└──────────────┘                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │ Shop kiểm tra báo cáo        │
                   └──────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
         [ Shop chấp nhận ]               [ Shop từ chối ]
                  │                               │
                  ▼                               ▼
       ┌─────────────────────┐         ┌─────────────────────┐
       │ 🔄 Đổi bộ áo khác   │         │ 🛡️ Chuyển Admin làm │
       │ HOẶC Hoàn 100% tiền │         │ Tranh chấp Dispute  │
       └─────────────────────┘         └─────────────────────┘
```

---

### 🀄 Rẽ nhánh D: Sơ đồ Shop Tố Cáo Đồ Hỏng/Dơ Khi Trả (Incident Report)

```text
┌─────────────────────────────────┐
│ ↩️ Shop nhận lại đồ khi Khách trả│
└────────────────┬────────────────┘
                 │
┌────────────────┴────────────────┐
│ 🔍 Kiểm tra vết bẩn / Hư hỏng   │
└────────────────┬────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
  [ 🟢 Đồ Nguyên Vẹn ] [ 🔴 Đồ Hỏng / Dơ ]
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────────────────────┐
│ 1. COMPLETED │   │ 1. Tạo IncidentReport        │
│ 2. Hoàn cọc  │   │    (CLEANING / MAINTENANCE)  │
│    100%      │   │ 2. Khóa Cọc & Đơn -> DISPUTED│
└──────────────┘   └──────────────┬───────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │ ⏱️ Khách phản hồi trong 48h  │
                   └──────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
        [ Khách chấp nhận ]              [ Khách từ chối ]
                  │
                  ▼
       ┌─────────────────────┐         ┌─────────────────────┐
       │ 💸 Trừ cọc đền bù   │         │ 🛡️ Chuyển Admin làm │
       │ Tiền dư hoàn Khách  │         │ Tranh chấp Dispute  │
       └─────────────────────┘         └─────────────────────┘
```

---

### 🛡️ Rẽ nhánh E: Sơ đồ Tranh Chấp & Phán Quyết Admin Theo Giai Đoạn (Lifecycle Stage-Based Dispute Resolution)

> [!IMPORTANT]
> **TẠI SAO CÓ LUỒNG KHIẾU NẠI HẬU HOÀN THÀNH (`COMPLETED`) VÀ GIỚI HẠN THỜI GIAN NHƯ THẾ NÀO?**
>
> 1. **Lý do ra đời luồng khiếu nại sau `COMPLETED`**:
>    * **Dịch vụ Chụp Ảnh**: Hệ thống có cơ chế tự động nghiệm thu sau 48h (`PhotographyAutoCompleteCron`). Nếu Khách quên không duyệt, đơn tự đổi sang `COMPLETED`. Sau đó Khách mở link Drive mới thấy link die/file hỏng ➔ Hệ thống cho phép Khách khiếu nại trong cửa sổ thời gian ngắn để bảo vệ quyền lợi Khách.
>    * **Dịch vụ Thuê Áo Dài**: Shop bấm `RETURNED` ➔ `COMPLETED`. Vài tiếng sau nhân viên soi kĩ bằng đèn chuyên dụng mới phát hiện áo bị tráo đồ giả hoặc thủng lót trong ➔ Shop có quyền báo cáo sự cố trong cửa sổ ngắn.
>
> 2. **Quy tắc Khóa Vĩnh Viễn Sau Hạn (`allowDisputeAfterCompletedHours`)**:
>    * Khiếu nại Hậu hoàn thành **CHỈ ĐƯỢC PHÉP** mở trong khoảng thời gian ngắn cấu hình hệ thống (thường từ 24h - 48h từ mốc `COMPLETED`).
>    * ⚠️ **Quá thời gian quy định trên**: Hệ thống **KHÓA VĨNH VIỄN** tính năng mở khiếu nại và trả về lỗi `BadRequestException('Đã quá thời hạn mở khiếu nại')`. Lúc này giao dịch chính thức đóng vĩnh viễn không thể khiếu nại hay đảo ngược tiền.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      🛡️ ADMIN THẨM ĐỊNH TRANH CHẤP                      │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ GIAI ĐOẠN 1: LÚC NHẬN │ │ GIAI ĐOẠN 2: KHI TRẢ  │ │ GIAI ĐOẠN 3: HẬU HOÀN │
│  (PICKUP_PENDING)     │ │ (RETURN_PENDING)      │ │ THÀNH (Trong 24h-48h) │
├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
│ Áo lỗi/dơ lúc nhận đồ │ │ Shop tố Khách làm     │ │ Link ảnh die / Phát   │
│ (Khách chưa sử dụng)  │ │ rách/hỏng áo sau mặc  │ │ hiện đồ tráo hỏng ẩn  │
└──────────┬────────────┘ └──────────┬────────────┘ └──────────┬────────────┘
           │                         │                         │
           ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ 💵 HOÀN 100% TIỀN     │ │ ❌ KHÔNG HOÀN TIỀN    │ │ ⚖️ ĐIỀU CHỈNH KỲ      │
│  (Tiền Thuê + Cọc)    │ │    THUÊ VÌ ĐÃ MẶC    │ │    QUYẾT TOÁN KẾ TẾP  │
├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
│ Provider bị phạt tiền │ │ Trừ Cọc đền bù cho    │ │ SettlementAdjustment  │
│ do giao sai đồ lỗi    │ │ Shop; Hoàn lại cọc dư │ │ trích quỹ bồi thường  │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

#### 📊 Bảng Quy Tắc Phán Quyết Tranh Chấp Admin Theo Giai Đoạn Đơn Hàng:

| Giai Đoạn Phát Sinh Dispute | Điều Kiện Mở Dispute | Tỷ Lệ Hoàn Tiền Thuê | Tỷ Lệ Hoàn Tiền Cọc Đồ | Quy Tắc Xử Lý Quyết Toán Provider (Settlement) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Lúc Nhận Đồ (`PICKUP_PENDING`)** | Khách phát hiện lỗi trong 30p | 🟢 **Hoàn 100%** | 🟢 **Hoàn 100%** | Shop nhận 0 VNĐ + Phạt uy tín / Phạt phí sàn. Đơn chuyển `CANCELLED`. |
| **2. Khi Trả Đồ (`RETURN_PENDING`)** | Shop kiểm đồ thấy hư hỏng | 🔴 **Hoàn 0%** (Khách đã mặc)| 🟡 Khấu trừ tiền đền bù | Shop nhận 100% Tiền Thuê + Tiền đền bù từ Cọc đồ (`compensationAmount`). |
| **3. Đang Duyệt Ảnh (`AWAITING_REVIEW`)**| Ảnh lỗi/xấu trong 48h đếm | 🟡 **Hoàn 30% - 70%** | N/A (Không có cọc) | Thợ chụp nhận số tiền còn lại tương ứng với công sức đã nộp. |
| **4. Hậu Hoàn Thành (`COMPLETED`)** | **Trong cửa sổ 24h-48h sau `COMPLETED`** | ⚖️ Trích Quỹ Bồi Thường | ⚖️ Trích Quỹ Bồi Thường | Điều chỉnh bản kê `SettlementAdjustment` trừ/cộng vào Kỳ Quyết toán tiếp theo. |
| **5. Đã Quá Hạn Cửa Sổ Hậu Hoàn Thành**| **Quá 24h-48h sau `COMPLETED`** | ❌ **TỪ CHỐI KHIẾU NẠI** | ❌ **TỪ CHỐI KHIẾU NẠI** | **Đơn khóa vĩnh viễn.** Báo lỗi `Đã quá thời hạn mở khiếu nại`. |

---

## 📈 5. SƠ ĐỒ DÒNG TIỀN ESCROW & THEO DÕI LỊCH SỬ (FINANCIAL FLOW)

```text
 👤 KHÁCH HÀNG THANH TOÁN
           │
           ▼
 🔒 VÍ TẠM GIỮ ESCROW SÀN (Giữ 100% tiền thuê + cọc)
           │
           ├───────────────────────────────┬───────────────────────────────┐
           ▼                               ▼                               ▼
  [ 🟢 HOÀN CỌC KHÁCH ]          [ 🏛️ HOA HỒNG SÀN ]            [ 🏬 DOANH THU SHOP ]
  Tự động trả cọc đồ              Trích % Hoa hồng +              (Pending Balance ──►
  khi áo trả nguyên vẹn           Phí cố định nền tảng             Available Balance ──►
                                                                   Banking Payout)
```

---

## 📊 6. MA TRẬN CHUYỂN TRẠNG THÁI BOOKING (STATUS TRANSITION MATRIX)

| Trạng thái ban đầu | Hành động / Sự kiện | Trạng thái tiếp theo | Xử lý Dòng tiền / Escrow |
| :--- | :--- | :--- | :--- |
| `DRAFT` | Khách bấm Đặt lịch | `PENDING_PAYMENT` | Giữ lịch tạm thời 15 phút. |
| `PENDING_PAYMENT` | Thanh toán thành công | `DEPOSIT_PAID` / `CONFIRMED` | Tiền vào Ví tạm giữ Escrow. |
| `PENDING_PAYMENT` | Hết hạn 15p / Khách hủy | `CANCELLED` | Giải phóng lịch, không phát sinh tiền. |
| `CONFIRMED` | Provider bấm Bàn giao đồ | `PICKUP_PENDING` | Giữ nguyên tiền trong Escrow. |
| `PICKUP_PENDING` | Khách nhận đồ & Kiểm tra | `PICKED_UP` | Giữ nguyên tiền trong Escrow. |
| `PICKED_UP` | Khách mang đồ đi trả | `RETURN_PENDING` | Giữ nguyên tiền trong Escrow. |
| `RETURN_PENDING` | Shop nhận lại đồ an toàn | `RETURNED` | Kích hoạt luồng Tự động Hoàn tiền Cọc. |
| `RETURN_PENDING` | Shop phát hiện Đồ hỏng | `DISPUTED` | Tạm khóa Tiền cọc & Tiền thuê. |
| `CONFIRMED` | Thợ chụp bắt đầu shoot | `IN_PROGRESS` | Giữ nguyên tiền trong Escrow. |
| `IN_PROGRESS` | Thợ chụp trả link ảnh | `AWAITING_REVIEW` | Kích hoạt đếm ngược 48 giờ. |
| `AWAITING_REVIEW` | Khách duyệt / Hết 48h | `COMPLETED` | Chuyển trạng thái hoàn tất đơn. |
| `RETURNED` / `AWAITING_REVIEW` | Đơn hàng hoàn thành | `COMPLETED` | **Kích hoạt tạo Bản kê Quyết toán (Settlement)**. |

---

## 🤖 7. ĐẶC TẢ KỸ THUẬT DÀNH CHO AI AGENT & DEVELOPER (AI AGENT IMPLEMENTATION SPEC)

> [!IMPORTANT]
> Phần này cung cấp bảng tham chiếu kỹ thuật chính xác 100% bao gồm Tên Schema MongoDB, Enum Cấu hình, API Endpoint, Quyền Hạn (Roles), Cron Jobs và Tác Vụ Ngầm (Background Tasks) dành riêng cho AI Agent để lập trình không bị sai lệch.

### 🗄️ A. Bảng Ánh Xạ Schemas & Collections MongoDB

| Tên Schema NestJS | Collection MongoDB | Vai Trò Chức Năng |
| :--- | :--- | :--- |
| `Booking` | `bookings` | Lưu trạng thái đơn, giá trị tiền, mốc thời gian Hold, cọc rental và thông tin bồi thường. |
| `BookingItem` | `booking_items` | Chi tiết từng sản phẩm thuê / gói chụp ảnh trong đơn hàng. |
| `Payment` | `payments` | Lưu các giao dịch thanh toán từ Cổng VNPay / PayOS / Ví. |
| `BookingEscrow` | `booking_escrows` | Quản lý số tiền Escrow đang giữ của đơn hàng. |
| `DigitalContract` | `digital_contracts` | Hợp đồng điện tử sinh tự động khi đơn `CONFIRMED`. |
| `IncidentReport` | `incident_reports` | Báo cáo hư hỏng/vết bẩn do Provider lập khi trả đồ. |
| `Dispute` | `disputes` | Ca khiếu nại tranh chấp chuyển cho Admin phân giải. |
| `Settlement` | `settlements` | Bảng kê quyết toán doanh thu, hoa hồng và thực nhận cho Provider. |
| `SettlementTransfer` | `settlement_transfers` | Lịch sử ngân hàng banking Payout tiền cho Provider. |
| `RefundRequest` | `refund_requests` | Yêu cầu hoàn tiền cọc đồ hoặc hoàn tiền hủy đơn cho Khách. |

---

### ⚙️ B. Ma Trận Kỹ Thuật Chuyển Trạng Thái (Deterministic State Machine Registry)

| Sự Kiện / Trigger API | Trạng Thái Cũ | Trạng Thái Mới | Phân Quyền (Role) | Database Mutation & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/v1/bookings/hold` | Không có | `DRAFT` ➔ `PENDING_PAYMENT` | `CUSTOMER` | Khóa `holdExpiresAt` (+15p), lưu `holdIdempotencyKey`. |
| `POST /api/v1/payments/webhook` | `PENDING_PAYMENT` | `CONFIRMED` | `SYSTEM` (Webhook) | Tiền vào `BookingEscrow`, tự động sinh `DigitalContract`. |
| `POST /api/v1/bookings/:id/handover` | `CONFIRMED` | `PICKUP_PENDING` | `PROVIDER` | Upload `handoverPhotos`, lưu `handoverInitiatedAt`. |
| `POST /api/v1/bookings/:id/pickup` | `PICKUP_PENDING` | `PICKED_UP` | `CUSTOMER` / `PROVIDER` | Mở cửa sổ 30p `pickupDamageReport`. |
| `POST /api/v1/bookings/:id/return` | `PICKED_UP` | `RETURN_PENDING` | `CUSTOMER` / `PROVIDER` | Khách trả đồ, chờ Shop kiểm tra trang phục. |
| `POST /api/v1/bookings/:id/confirm-return` | `RETURN_PENDING` | `RETURNED` ➔ `COMPLETED` | `PROVIDER` | Áo nguyên vẹn ➔ Tự động tạo `RefundRequest` hoàn cọc 100%. |
| `POST /api/v1/incidents` | `RETURN_PENDING` / `COMPLETED` | `DISPUTED` | `PROVIDER` | Tạo `IncidentReport` (`CLEANING` / `MAINTENANCE`), kiểm tra mốc `allowDisputeAfterCompletedHours`. |
| `POST /api/v1/incidents/:id/accept` | `DISPUTED` | `COMPLETED` | `CUSTOMER` | Khấu trừ `requestedAmount` từ Cọc, hoàn dư (nếu có). |
| `POST /api/v1/disputes` | `DISPUTED` / `COMPLETED` | `OPEN` ➔ `UNDER_REVIEW` | `CUSTOMER` / `PROVIDER` | Mở ca tranh chấp Admin phân giải (Kiểm tra mốc thời hạn `allowDisputeAfterCompletedHours`). |
| `POST /api/v1/disputes/:id/resolve` | `UNDER_REVIEW` | `RESOLVED` ➔ `COMPLETED` | `ADMIN` | Lưu `DisputeAdminDecision`, cập nhật `SettlementAdjustment` theo Giai đoạn. |
| `POST /api/v1/bookings/:id/start-shoot` | `CONFIRMED` | `IN_PROGRESS` | `PHOTOGRAPHER` | Thợ chụp bắt đầu shoot hình. |
| `POST /api/v1/bookings/:id/deliver-photos` | `IN_PROGRESS` | `AWAITING_REVIEW` | `PHOTOGRAPHER` | Lưu `deliveredPhotos` & `deliveryDriveUrl`, đếm 48h. |
| `POST /api/v1/bookings/:id/approve-photos` | `AWAITING_REVIEW` | `COMPLETED` | `CUSTOMER` | Khách duyệt ảnh ➔ Kích hoạt engine `Settlement`. |

---

### ⏱️ C. Danh Sách Tác Vụ Chạy Ngầm & Cron Jobs (Background Workers)

1. **Cron 1: Sweeper Khóa Lịch Hết Hạn (`HoldScheduleSweeperCron`)**:
   * **Tần suất**: Chạy mỗi 1 phút (`* * * * *`).
   * **Điều kiện**: Quét các đơn `PENDING_PAYMENT` có `holdExpiresAt < NOW()`.
   * **Hành động**: Chuyển `status = CANCELLED`, xóa bản ghi `ProviderScheduleLock`.

2. **Cron 2: Tự Động Nghiệm Thu Ảnh Sau 48 Giờ (`PhotographyAutoCompleteCron`)**:
   * **Tần suất**: Chạy mỗi 15 phút (`*/15 * * * *`).
   * **Điều kiện**: Quét các đơn `AWAITING_REVIEW` có `awaitingReviewSince < (NOW() - 48h)`.
   * **Hành động**: Set `photosApproved = true`, chuyển `status = COMPLETED`, khởi tạo `Settlement`.

3. **Cron 3: Tự Động Giải Ngân Payout (`SettlementPayoutCron`)**:
   * **Tần suất**: Chạy vào 00:00 Hàng ngày (`0 0 * * *`).
   * **Điều kiện**: Quét các bản ghi `Settlement` có `status = READY_TO_SETTLE`.
   * **Hành động**: Gọi cổng Banking Payout ➔ Tạo `SettlementTransfer` ➔ Cập nhật `status = SETTLED`.

---

### 🧮 D. Công Thức Kế Toán & Dòng Tiền (Ledger Accounting Equations)

$$\text{grandTotal} = (\text{subTotal} - \text{discountAmount}) + \text{depositTotal} + \text{travelFee}$$

$$\text{grossAmount} = \text{subTotal} - \text{providerDiscountAmount}$$

$$\text{commissionAmount} = \text{commissionBaseAmount} \times \text{commissionRate}$$

$$\text{payableAmount} = \text{grossAmount} - \text{commissionAmount} - \text{allocatedPlatformFee} - \text{penaltyAmount} + \text{compensationAmount}$$

---

> 💡 *Tài liệu này được tự động cập nhật theo logic nghiệp vụ và mã nguồn kỹ thuật của Hệ thống ATPP / VibeHue365.*
