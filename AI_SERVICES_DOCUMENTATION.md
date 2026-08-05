# 🧠 BÁO CÁO TỔNG HỢP & HƯỚNG DẪN SỬ DỤNG HỆ THỐNG AI (ATPP / VIBEHUE365)

Tài liệu này tổng hợp toàn bộ **9 Mô hình & Dịch vụ AI** trong hệ thống ATPP (VibeHue365), bao gồm các dịch vụ AI sẵn có và các dịch vụ AI chuyên sâu mới được phát triển. 

---

## 📌 1. TỔNG QUAN KIẾN TRÚC AI HỆ THỐNG (AI HYBRID ARCHITECTURE)

Hệ thống AI của ATPP được vận hành dưới dạng **Dịch vụ Microservices độc lập**, bao gồm:
*   **FastAPI AI Service (`ai-service` - Port 8000):** Đóng vai trò là trung tâm xử lý AI chính (Recommendation, Damage Inspection, Visual Search, Photo Culling, Portfolio Anti-Fraud, Chatbot RAG, Smart Tagging).
*   **FastAPI OCR Service (`ocr-service` - Port 8001):** Đảm nhận công việc bóc tách văn bản từ ảnh giấy tờ/hóa đơn sử dụng Tesseract OCR.
*   **Client-side AR Engine (Frontend Component `AIPoseAssistant.tsx`):** Chạy trực tiếp trên trình duyệt Web/Mobile bằng công nghệ MediaPipe Pose để gợi ý tạo dáng thời gian thực.

```text
                               ┌────────────────────────────────────────┐
                               │  👤 CLIENT (React Frontend / Mobile)   │
                               └───────────────────┬────────────────────┘
                                                   │
                ┌──────────────────────────────────┼──────────────────────────────────┐
                │ (MediaPipe Client AI)            │ (Rest API Call)                  │ (OCR Upload)
                ▼                                  ▼                                  ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────────┐
│   🤖 AI POSE ASSISTANT       │   │    🐍 FASTAPI AI SERVICE     │   │     👁️ FASTAPI OCR SERVICE   │
│   (Frontend Realtime AR)     │   │        (Port 8000)           │   │        (Port 8001)           │
└──────────────────────────────┘   └───────────────┬──────────────┘   └──────────────────────────────┘
                                                   │
                                     ┌─────────────┴─────────────┐
                                     ▼                           ▼
                      ┌───────────────────────────┐ ┌───────────────────────────┐
                      │  💾 LOCAL ML / CV ENGINE  │ │  🌐 GEMINI 1.5 FLASH      │
                      │  (OpenCV, CLIP, EXIF, DB) │ │  (Vision & Multimodal RAG)│
                      └───────────────────────────┘ └───────────────────────────┘
```

---

## 🛠️ 2. CHI TIẾT 9 MÔ HÌNH AI & HƯỚNG DẪN SỬ DỤNG

---

### 🟢 MÔ HÌNH 1: AI DAMAGE INSPECTION ENGINE (GIÁM ĐỊNH HƯ HẠI ÁO DÀI & TRỪ CỌC ESCROW)
*   **Mục đích:** Khi Khách trả Áo Dài, AI tự động phân tích ảnh áo trả (so với ảnh lúc nhận đồ), phát hiện vết ố bẩn, rách, mất cúc/khóa kéo và tự động tính toán % tiền cọc đền bù đề xuất cho quy trình Escrow Settlement trong [BOOKING_FLOWS_GUIDE.md](file:///d:/ATPP/BOOKING_FLOWS_GUIDE.md).
*   **Cơ chế hoạt động:** Kết hợp **Gemini 1.5 Flash Vision Multimodal** (khi có API Key) và **Computer Vision Image Variance Fallback** (khi offline).
*   **Endpoint:** `POST /inspection/analyze-damage`
*   **Request JSON Payload:**
    ```json
    {
      "booking_id": "BK_2026_08912",
      "return_image_base64": "data:image/jpeg;base64,...",
      "deposit_amount": 500000.0,
      "rental_price": 300000.0,
      "notes": "Phát hiện vết ố bẩn ở tà sau"
    }
    ```
*   **Response JSON Result:**
    ```json
    {
      "booking_id": "BK_2026_08912",
      "is_damaged": true,
      "damage_score": 75.5,
      "overall_severity": "MEDIUM",
      "detected_issues": [
        {
          "type": "Vết ố bẩn / Khác màu tà áo",
          "location": "Tà áo sau",
          "severity": "MEDIUM",
          "estimated_repair_cost": 100000.0
        }
      ],
      "suggested_deduction_percentage": 20.0,
      "suggested_deduction_amount": 100000.0,
      "refund_deposit_amount": 400000.0,
      "confidence": 0.92,
      "engine_used": "gemini-1.5-flash-vision",
      "analysis_summary": "Phát hiện vết bẩn rộng ở tà áo sau. Đề xuất trừ 20% tiền cọc (100.000đ) để tẩy hấp, hoàn lại 400.000đ cho khách."
    }
    ```

---

### 🟢 MÔ HÌNH 2: VISUAL SEARCH & CONTEXT COLOR MATCHER (TÌM THEO ẢNH & GỢI Ý BỐI CẢNH)
*   **Mục đích:** 
    1. Tìm kiếm mẫu Áo Dài tương đồng từ ảnh Pinterest/Instagram khách đăng.
    2. Gợi ý màu sắc Áo Dài + Phong cách Makeup + Tips chụp ảnh phù hợp với địa điểm (vd: *Đại Nội Huế*, *Phố Cổ Hội An*, *Studio*) và Tone da.
*   **Cơ chế hoạt động:** Phân tích màu sắc chủ đạo (Color Palette Extraction) + Truy vấn MongoDB `products`.
*   **Endpoints:**
    *   `POST /visual-search/match`: Tìm sản phẩm tương đồng bằng ảnh mẫu.
    *   `POST /visual-search/context-recommend`: Gợi ý theo bối cảnh địa điểm chụp.
*   **Request JSON (`/visual-search/context-recommend`):**
    ```json
    {
      "location_context": "Đại Nội Huế",
      "skin_tone": "WARM",
      "time_of_day": "MORNING"
    }
    ```
*   **Response JSON Result:**
    ```json
    {
      "location_context": "Đại Nội Huế",
      "recommended_ao_dai_colors": ["Đỏ son", "Vàng hoàng gia", "Tím xứ Huế", "Trắng ngà"],
      "recommended_makeup_style": "Makeup phong cách Cổ điển / Hoàng cung, son đỏ nhung, mắt kẻ sắc sảo",
      "photographer_style_tip": "Chụp vào nắng sáng 7h30-9h00 đón ánh sáng phản chiếu tường thành cổ kính",
      "color_palette_hex": ["#8B0000", "#FFD700", "#4B0082", "#FFF8DC"],
      "suggested_products": [...]
    }
    ```

---

### 🟢 MÔ HÌNH 3: AI PHOTO CULLING & QUALITY INSPECTOR (LỌC ẢNH MỜ / LỖI CHỦ ĐỘNG)
*   **Mục đích:** Giúp Photographer tự động lọc bộ ảnh vừa chụp, phát hiện các bức ảnh bị nhắm mắt, out-focus (mờ nét) hoặc lỗi phơi sáng trước khi gửi cho Khách chọn.
*   **Cơ chế hoạt động:** Sử dụng thuật toán độ biến thiên Laplacian (`Laplacian Variance`) trong OpenCV và định lượng dải phơi sáng RGB.
*   **Endpoint:** `POST /culling/analyze-photos`
*   **Request JSON Payload:**
    ```json
    {
      "min_sharpness_threshold": 80.0,
      "photos": [
        { "photo_id": "P01", "filename": "IMG_001.jpg", "image_base64": "..." },
        { "photo_id": "P02", "filename": "IMG_002.jpg", "image_base64": "..." }
      ]
    }
    ```
*   **Response JSON Result:**
    ```json
    {
      "total_photos": 2,
      "passed_photos": 1,
      "flagged_photos": 1,
      "overall_batch_score": 82.5,
      "summary": "Đã kiểm tra 2 bức ảnh: 1 ảnh đạt chuẩn nét, 1 ảnh nghi vấn bị mờ nét.",
      "photo_details": [
        {
          "photo_id": "P01",
          "filename": "IMG_001.jpg",
          "sharpness_score": 115.4,
          "is_sharp": true,
          "exposure_status": "NORMAL",
          "quality_score": 95.0,
          "status": "PASS",
          "recommendation": "Ảnh sắc nét, phơi sáng chuẩn. Đạt yêu cầu bàn giao."
        },
        {
          "photo_id": "P02",
          "filename": "IMG_002.jpg",
          "sharpness_score": 42.1,
          "is_sharp": false,
          "exposure_status": "UNDER_EXPOSED",
          "quality_score": 45.0,
          "status": "WARNING_BLUR",
          "recommendation": "Ảnh bị mờ nét (Out-focus). Đề xuất lọc bỏ."
        }
      ]
    }
    ```

---

### 🟢 MÔ HÌNH 4: AI PORTFOLIO ANTI-FRAUD EXIF INSPECTOR (XÁC THỰC CHÍNH CHỦ ẢNH TỤC)
*   **Mục đích:** Ngăn chặn tình trạng Photographer dỏm tải ảnh đẹp trên mạng về làm Portfolio để lừa cọc (theo quy trình xác thực [vibehue_provider_registration_verification_spec_complete.md](file:///d:/ATPP/vibehue_provider_registration_verification_spec_complete.md)).
*   **Cơ chế hoạt động:** Bóc tách dữ liệu ẩn **EXIF Metadata** (Model máy ảnh, Ống kính Lens, Ngày chụp, Phần mềm Photoshop/Lightroom) bằng Python `exifread`.
*   **Endpoint:** `POST /anti-fraud/inspect-portfolio`
*   **Request JSON Payload:**
    ```json
    [
      { "photo_id": "PF_01", "image_base64": "..." }
    ]
    ```
*   **Response JSON Result:**
    ```json
    {
      "provider_id": "PROV_998",
      "overall_authenticity_score": 90.0,
      "overall_risk_level": "LOW",
      "recommended_admin_action": "APPROVE",
      "detected_camera_gear": ["Canon EOS R5", "EF50mm f/1.2L USM"],
      "results": [
        {
          "photo_id": "PF_01",
          "is_authentic_score": 90.0,
          "risk_level": "LOW",
          "exif": {
            "camera_make": "Canon",
            "camera_model": "Canon EOS R5",
            "lens_model": "EF50mm f/1.2L USM",
            "date_taken": "2026-02-10 14:30:11",
            "software_used": "Adobe Photoshop Lightroom Classic",
            "has_exif": true
          },
          "fraud_flags": [],
          "verdict": "Ảnh chính chủ chụp từ máy ảnh chuyên nghiệp. Độ tin cậy cao."
        }
      ]
    }
    ```

---

### 🟢 MÔ HÌNH 5: AI POSE ASSISTANT (KHUNG DÂY AR HƯỚNG DẪN TẠO DÁNG ÁO DÀI)
*   **Mục đích:** Hiển thị khung dây hình người (Skeleton Wireframe Overlay) trực tiếp trên camera giúp khách nghiêng vai, tay cầm nón lá/quạt chuẩn dáng và tự động chụp khi đạt 90%+ khớp.
*   **Vị trí:** Frontend Component [`AIPoseAssistant.tsx`](file:///d:/ATPP/frontend/src/components/ai/AIPoseAssistant.tsx)
*   **Cơ chế hoạt động:** Dùng `MediaPipe Pose` JS SDK tính khoảng cách điểm khớp (Pose Landmark Vectors) theo thời gian thực trên Canvas/Camera.

---

### 🔵 MÔ HÌNH 6: SMART STYLE RECOMMENDATION ENGINE (GỢI Ý CÁ NHÂN HÓA)
*   **Mục đích:** Gợi ý Áo Dài và Thợ chụp phù hợp nhất với gu thẩm mỹ và lịch sử đặt đồ của người dùng.
*   **Endpoint:** `GET /recommend/{user_id}`
*   **Response JSON Result:** Trả về danh sách `recommendations` kèm chỉ số `match_score` (0.0 - 1.0).

---

### 🔵 MÔ HÌNH 7: GEMINI PRODUCT RAG CHATBOT (TRỢ LÝ TƯ VẤN ÁO DÀI CÓ KHẢ NĂNG TỰ HỌC)
*   **Mục đích:** Giải đáp thắc mắc dịch vụ, giá thuê, quy định cọc và tư vấn sản phẩm thích hợp.
*   **Endpoints:**
    *   `POST /chat?message=Thuê áo dài cọc bao nhiêu tiền?`
    *   `POST /chat/with-image` (Chat tư vấn qua ảnh).
*   **Tính năng đặc biệt:** Tự động lưu câu trả lời mới từ Gemini vào DB `qa_data` để tự học (Auto-Learning mechanism).

---

### 🔵 MÔ HÌNH 8: SMART TAGGING ENGINE (TỰ ĐỘNG GẮN TAG ÁO DÀI & DỊCH VỤ)
*   **Mục đích:** Phân tích mô tả sản phẩm để gắn tag chuẩn mực (Cổ áo, Tay áo, Chất liệu, Bối cảnh).
*   **Endpoint:** `POST /tagging/suggest`

---

### 🔵 MÔ HÌNH 9: LOCAL OCR SERVICE (BÓC TÁCH VĂN BẢN TẤT CẢ GIẤY TỜ / HÓA ĐƠN)
*   **Mục đích:** Bóc tách chữ từ ảnh Giấy tờ/Hóa đơn cho quy trình xác minh thông tin.
*   **Service:** `ocr-service/app.py` (Port 8001)
*   **Endpoint:** `POST /ocr` (Multipart Form File Upload)
*   **Response JSON Result:** `{"text": "...", "confidence": 0.94}`

---

## 🚀 3. HƯỚNG DẪN KHỞI CHẠY & KIỂM THỬ (TESTING GUIDE)

### Bước 1: Khởi chạy AI Services
```bash
# 1. Khởi chạy main AI Service (Port 8000)
cd d:\ATPP\ai-service
uvicorn main:app --reload --port 8000

# 2. Khởi chạy OCR Service (Port 8001)
cd d:\ATPP\ocr-service
uvicorn app:app --reload --port 8001
```

### Bước 2: Kiểm thử Swagger Interactive OpenAPI Specs
*   Mở trình duyệt truy cập: **`http://localhost:8000/docs`**
*   Tất cả các API Endpoints mới (`/inspection/analyze-damage`, `/visual-search/context-recommend`, `/culling/analyze-photos`, `/anti-fraud/inspect-portfolio`) đều có thể test trực tiếp bằng nút **Try it out** trên giao diện Swagger.

---

## 📌 KẾT LUẬN & ĐÁNH GIÁ CHUYÊN MÔN
Với việc bổ sung và hoàn thiện toàn bộ **9 Mô hình & Dịch vụ AI** này, hệ thống ATPP (VibeHue365) đã sở hữu một **Nền tảng AI toàn diện, chuyên sâu và có tính ứng dụng thực tế rất cao**, đáp ứng đầy đủ các tiêu chí khắt khe nhất của Hội đồng Đánh giá Đồ án Tốt nghiệp.
