# Hướng dẫn Deploy Production — TàGo / VibeHue (Phương án A: 2 VM GCP + Vercel + Expo EAS)

Tài liệu này hướng dẫn từng bước triển khai trọn bộ hệ thống **TàGo** (Web, Mobile APK, NestJS Backend, MongoDB Replica Set, Redis, MinIO, AI Service PyTorch/CLIP/Gemini, OCR Tesseract) theo **Phương án A** — tối ưu độ ổn định, chịu tải tốt trong 1–3 tháng vận hành thực tế và tận dụng tối đa Google Cloud Free Trial (\$300 / 90 ngày).

> Trong suốt tài liệu, thay `tago.id.vn` và `api.tago.id.vn` bằng tên miền thật của bạn.

---

## 1. Kiến trúc tổng thể

```text
Người dùng (Web / Mobile APK)
   │
   ├── https://tago.id.vn ──────────────► Vercel CDN (React 19 + Vite SPA)
   │
   ├── Ảnh công khai ───────────────────► Cloudinary CDN
   │
   └── https://api.tago.id.vn ──────────► Cloudflare DNS ──► VM 1: tago-core (GCP Singapore)
                                                              ├── Caddy (Auto HTTPS + WebSocket/Socket.IO)
                                                              ├── Backend NestJS (1 container duy nhất, UTC+7)
                                                              ├── MongoDB 7 (Replica Set rs0 + Auth)
                                                              ├── Redis 7 (AOF, nội bộ)
                                                              └── MinIO (KYC & PDF hợp đồng, nội bộ)
                                                                      │
                                                                      │ Internal VPC Firewall (chỉ nội bộ)
                                                                      ▼
                                                             VM 2: tago-ai (GCP Singapore)
                                                              ├── ai-service (:8000 — E5 + CLIP + Gemini)
                                                              └── ocr-service (:8010 — Tesseract vie+eng)
```

### Nguyên tắc bắt buộc của hệ thống
1. **Chỉ chạy đúng 1 container `backend`**: `ChatGateway` lưu `activeConnections` trong RAM và có 13 NestJS `@Cron` job chạy định kỳ (quá hạn/Domino, nhắc lịch, dọn ảnh evidence). Không scale nhiều bản sao backend nếu chưa tách Redis Socket.IO adapter và distributed cron lock.
2. **MongoDB bắt buộc chạy Replica Set `rs0`**: Các luồng tạo booking, dời lịch và cập nhật trạng thái dùng MongoDB multi-document transaction (`startSession()`). File [deploy/docker-compose.core.yml](deploy/docker-compose.core.yml) đã cấu hình container `mongo-init-rs` tự động khởi tạo `rs0`.
3. **Múi giờ `TZ=Asia/Ho_Chi_Minh`**: Áp dụng đồng bộ cho toàn bộ container để lịch thuê, giờ check-in/check-out và cron job quá hạn khớp giờ Việt Nam.
4. **VM 2 kết nối MongoDB VM 1 bằng `directConnection=true`**: Giúp PyMongo/Motor nối thẳng tới node primary của `rs0` qua Internal IP mà không bị lỗi phân giải hostname Docker `mongodb:27017`.

---

## 2. Checklist chuẩn bị trước khi triển khai

- [ ] **Google Cloud Platform**: Đã kích hoạt Free Trial (\$300 / 90 ngày) hoặc Billing Account.
- [ ] **Tên miền + Cloudflare**: 1 tên miền (ví dụ `.id.vn` hoặc `.com`) đã chuyển Nameserver sang Cloudflare.
- [ ] **Cloudinary**: Đã lấy `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- [ ] **SMTP Email**: Gmail App Password (16 ký tự) hoặc Resend/Brevo SMTP để gửi OTP & thông báo booking.
- [ ] **Gemini API Key**: Lấy tại Google AI Studio cho chatbot, đọc bảng size và gợi ý mô tả sản phẩm.
- [ ] **Google Cloud OAuth Credentials**: Chuẩn bị tạo 1 Web Client ID và 1 Android Client ID.
- [ ] **Tài khoản Vercel** (kết nối GitHub repo) và **tài khoản Expo** (`eas-cli`) để build APK.

---

## 3. Tạo hạ tầng 2 VM & Firewall trên GCP (Region `asia-southeast1` — Singapore)

Khuyến nghị thông số:
- **VM 1 (`tago-core`)**: `e2-standard-2` (2 vCPU, 8 GB RAM, 50 GB Balanced SSD, Ubuntu 24.04 LTS), gắn **1 External IP tĩnh** (`tago-core-ip`) và network tag `tago-core`.
- **VM 2 (`tago-ai`)**: `e2-standard-4` (4 vCPU, 16 GB RAM, 50 GB Balanced SSD, Ubuntu 24.04 LTS — nếu cần tiết kiệm hơn có thể dùng `e2-standard-2` 8 GB RAM), gắn network tag `tago-ai`.

### Tạo nhanh bằng `gcloud CLI` (hoặc tạo tương ứng trên GCP Console)

```bash
# 1. Cấp 1 IP tĩnh cho VM 1 (tránh đổi IP khi restart máy)
gcloud compute addresses create tago-core-ip --region=asia-southeast1

# 2. Tạo VM 1 (tago-core)
gcloud compute instances create tago-core \
  --zone=asia-southeast1-a \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-balanced \
  --address=tago-core-ip \
  --tags=tago-core,http-server,https-server

# 3. Tạo VM 2 (tago-ai)
gcloud compute instances create tago-ai \
  --zone=asia-southeast1-a \
  --machine-type=e2-standard-4 \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-balanced \
  --tags=tago-ai

# 4. Mở port 80 & 443 công khai cho VM 1 (Caddy HTTPS)
gcloud compute firewall-rules create allow-tago-web-https \
  --allow=tcp:80,tcp:443,udp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=tago-core

# 5. Mở port 8000 & 8010 NỘI BỘ: chỉ cho VM 1 gọi sang VM 2
gcloud compute firewall-rules create allow-tago-core-to-ai \
  --allow=tcp:8000,tcp:8010 \
  --source-tags=tago-core \
  --target-tags=tago-ai

# 6. Mở port 27017 NỘI BỘ: chỉ cho VM 2 đọc/ghi MongoDB trên VM 1
gcloud compute firewall-rules create allow-tago-ai-to-mongo \
  --allow=tcp:27017 \
  --source-tags=tago-ai \
  --target-tags=tago-core
```

Ghi lại **3 địa chỉ IP** từ bảng VM Instances:
- `CORE_PUBLIC_IP`: External IP tĩnh của `tago-core`
- `CORE_INTERNAL_IP`: Internal IP của `tago-core` (ví dụ `10.148.0.2`)
- `AI_INTERNAL_IP`: Internal IP của `tago-ai` (ví dụ `10.148.0.3`)

---

## 4. Trỏ DNS trên Cloudflare

Vào Cloudflare → **DNS → Records** của tên miền:
1. Thêm record `A`:
   - Name: `api`
   - IPv4 address: `<CORE_PUBLIC_IP>`
   - Proxy status: **DNS only (Mây xám)** trước khi cấp chứng chỉ SSL lần đầu.
2. Sau khi Caddy cấp chứng chỉ HTTPS thành công và `https://api.tago.id.vn/health` trả về `200 OK`:
   - Bạn có thể giữ **Mây xám** (tối ưu nhất cho WebSocket/Socket.IO), hoặc bật **Mây cam** nhưng bắt buộc vào **SSL/TLS → Overview** chọn chế độ **Full (strict)**.
   - **Tuyệt đối KHÔNG chọn Flexible** (sẽ gây vòng lặp redirect 308/521 với Caddy).

---

## 5. Cài Docker & Deploy VM 1 (`tago-core`) trước

> Khởi chạy VM 1 trước để MongoDB `rs0` sẵn sàng đón kết nối từ VM 2 (hoặc chạy song song đều được).

SSH vào **VM 1 (`tago-core`)**:

### 5.1. Cài Docker Engine & Docker Compose plugin + thiết lập múi giờ
```bash
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version && docker compose version
```

### 5.2. Clone mã nguồn
```bash
git clone <GIT_REPO_URL> ~/VibeHue
cd ~/VibeHue
git checkout <BRANCH_DEPLOY>   # ví dụ: main hoặc feature/transaction-new
```

### 5.3. Tạo file cấu hình hạ tầng `deploy/.env.core`
```bash
cp deploy/.env.core.example deploy/.env.core
nano deploy/.env.core
```
Điền đầy đủ `API_DOMAIN`, `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (dùng mật khẩu mạnh chỉ gồm chữ và số để tránh lỗi URL-encode).

### 5.4. Tạo file cấu hình Backend `backend/.env`
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Các biến **bắt buộc** phải chỉnh đúng trên Production:
```dotenv
NODE_ENV=production
PORT=3000
TZ=Asia/Ho_Chi_Minh

# Khớp chính xác MONGO_ROOT_USER / MONGO_ROOT_PASSWORD trong deploy/.env.core
MONGODB_URI=mongodb://<MONGO_ROOT_USER>:<MONGO_ROOT_PASSWORD>@mongodb:27017/vibehue?authSource=admin&replicaSet=rs0
REDIS_URL=redis://redis:6379

# Khai báo đầy đủ domain web (ngăn cách bằng dấu phẩy, không có dấu / ở cuối)
FRONTEND_URL=https://tago.id.vn,https://www.tago.id.vn
API_PUBLIC_URL=https://api.tago.id.vn
BACKEND_URL=https://api.tago.id.vn
BODY_LIMIT=10mb
POLICY_ACTIVATION_MODE=COMPENSATION

# Rate limit cao hơn cho Wi-Fi công cộng / buổi bảo vệ
THROTTLE_DEFAULT_LIMIT=600
THROTTLE_AUTH_LIMIT=300

# Sinh chuỗi ngẫu nhiên 64 ký tự bằng: openssl rand -hex 32
JWT_SECRET=<CHUOI_NGAU_NHIEN_64_KY_TU_1>
IDENTITY_FINGERPRINT_SECRET=<CHUOI_NGAU_NHIEN_64_KY_TU_2>
BCRYPT_SALT_ROUNDS=12

# Google OAuth
GOOGLE_CLIENT_ID=<WEB_CLIENT_ID>.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=<ANDROID_CLIENT_ID>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<WEB_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=https://api.tago.id.vn/auth/google/callback

# Email SMTP
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<EMAIL_GUI_THU>
MAIL_PASSWORD=<GMAIL_APP_PASSWORD_16_KY_TU>
MAIL_FROM=TàGo <no-reply@tago.id.vn>

# Cloudinary (ảnh công khai)
CLOUDINARY_CLOUD_NAME=<CLOUD_NAME>
CLOUDINARY_API_KEY=<API_KEY>
CLOUDINARY_API_SECRET=<API_SECRET>

# MinIO nội bộ (khớp deploy/.env.core)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=<MINIO_ROOT_USER>
MINIO_SECRET_KEY=<MINIO_ROOT_PASSWORD>
MINIO_PROVIDER_DOCUMENT_BUCKET=provider-documents
MINIO_AUTO_CREATE_BUCKETS=true

# Tài khoản Admin khởi tạo
BOOTSTRAP_ADMIN_EMAIL=admin@tago.id.vn
BOOTSTRAP_ADMIN_PASSWORD=<MAT_KHAU_ADMIN_MANH>
BOOTSTRAP_ADMIN_NAME=TàGo Admin

DISABLE_AUTO_CREATE_INVENTORY=true

# Trỏ sang Internal IP của VM 2 (tago-ai)
AI_SERVICE_URL=http://<AI_INTERNAL_IP>:8000
OCR_SERVICE_URL=http://<AI_INTERNAL_IP>:8010
SMART_TAG_AI_ENABLED=true
SMART_TAG_AI_TIMEOUT_MS=15000

# Chế độ demo thanh toán / nghiệp vụ (tùy chọn bật/tắt)
ENABLE_PAYMENT_SIMULATOR=true
PAYOS_REFUND_MOCK=true
ALLOW_EARLY_RENTAL_PICKUP=true
ALLOW_OVERDUE_SIMULATION=false
CONTRACTS_V2_ENABLED=false
CONTRACTS_TIERED_ENABLED=false
```

### 5.5. Khởi tạo MongoDB keyFile & chạy stack VM 1
```bash
bash deploy/init-core.sh
docker compose --env-file deploy/.env.core -f deploy/docker-compose.core.yml up -d --build
```

Kiểm tra trạng thái (tất cả container `mongodb`, `redis`, `minio`, `backend`, `caddy` phải là `Up (healthy)` và `mongo-init-rs` là `Exited (0)`):
```bash
docker compose --env-file deploy/.env.core -f deploy/docker-compose.core.yml ps
curl -i https://api.tago.id.vn/health
```
Kết quả chuẩn trả về HTTP `200`:
```json
{"status":"ok","db":"connected","uptimeSeconds":...,"timestamp":"..."}
```

---

## 6. Cài Docker & Deploy VM 2 (`tago-ai`: AI + OCR)

SSH vào **VM 2 (`tago-ai`)**:

### 6.1. Cài Docker Engine + clone repo
```bash
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker

git clone <GIT_REPO_URL> ~/VibeHue
cd ~/VibeHue
git checkout <BRANCH_DEPLOY>
```

### 6.2. Tạo file `ai-service/.env`
```bash
cp ai-service/.env.example ai-service/.env
nano ai-service/.env
```
Cấu hình mẫu cho Production (chú ý `&directConnection=true`):
```dotenv
GEMINI_API_KEY=<GEMINI_API_KEY>
TZ=Asia/Ho_Chi_Minh

MONGO_URL=mongodb://<MONGO_ROOT_USER>:<MONGO_ROOT_PASSWORD>@<CORE_INTERNAL_IP>:27017/vibehue?authSource=admin&directConnection=true
DB_NAME=aodai_platform
NESTJS_DB_NAME=vibehue

BACKEND_URL=https://api.tago.id.vn
FRONTEND_URL=https://tago.id.vn

VISUAL_SEARCH_ENABLED=true
PRODUCT_DRAFT_ENABLED=true
PRODUCT_DRAFT_GEMINI_ENABLED=true
PRODUCT_DRAFT_GEMINI_MODEL=gemini-3.1-flash-lite
SIZE_CHART_GEMINI_MODEL=gemini-3.1-flash-lite
SIZE_CHART_GEMINI_FALLBACK_MODEL=gemini-3.6-flash
```

### 6.3. Build & khởi chạy AI + OCR
> Lần build đầu tiên sẽ tải PyTorch CPU, `intfloat/multilingual-e5-small` và `clip-ViT-B-32` vào Docker layer cache (mất khoảng 5–8 phút). Những lần cập nhật code Python về sau chỉ mất ~10–20 giây.

```bash
docker compose -f deploy/docker-compose.ai.yml up -d --build
docker compose -f deploy/docker-compose.ai.yml ps
```

Kiểm tra health trực tiếp trên VM 2 và kiểm tra chéo từ VM 1:
```bash
# Trên VM 2
curl http://127.0.0.1:8000/
curl http://127.0.0.1:8010/health

# Quay lại VM 1 test kết nối nội bộ qua VPC Firewall
curl http://<AI_INTERNAL_IP>:8000/
curl http://<AI_INTERNAL_IP>:8010/health
```

---

## 7. Deploy Web Frontend lên Vercel

1. Truy cập [vercel.com](https://vercel.com) → **Add New Project** → chọn GitHub repository.
2. Cấu hình Build:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite` (tự nhận diện)
   - File [frontend/vercel.json](frontend/vercel.json) đã cấu hình sẵn SPA rewrite và `Permissions-Policy` cho Camera + Geolocation trên HTTPS.
3. Khai báo **Environment Variables** trên Vercel:
   - `VITE_API_BASE_URL` = `https://api.tago.id.vn`
   - `VITE_SOCKET_URL` = `https://api.tago.id.vn`
   - `VITE_CONTRACTS_V2_ENABLED` = `false` (đồng bộ với backend)
   - `VITE_CONTRACTS_TIERED_ENABLED` = `false`
4. Nhấn **Deploy**.
5. Vào **Project Settings → Domains** để gắn tên miền chính (`tago.id.vn`, `www.tago.id.vn`) và thêm record DNS mà Vercel yêu cầu trên Cloudflare.

---

## 8. Cấu hình Google OAuth & Build Mobile Android APK (Expo EAS)

### 8.1. Google Cloud Console (APIs & Services → Credentials)
1. **Web Application OAuth Client**:
   - **Authorized JavaScript origins**:
     - `https://tago.id.vn`
     - `https://www.tago.id.vn`
   - **Authorized redirect URIs**:
     - `https://api.tago.id.vn/auth/google/callback`
2. **Android OAuth Client**:
   - **Package name**: `com.vibehue.mobile`
   - **SHA-1 certificate fingerprint**: Lấy từ `eas credentials` ở bước 8.3 bên dưới.

### 8.2. Khởi tạo EAS & bật OTA Update (`expo-updates`)
Chạy trên máy cá nhân trong thư mục `mobile/`:
```bash
cd mobile
npm install -g eas-cli
eas login

# (Khuyến nghị) Cài expo-updates để đẩy bản sửa JS/UI OTA trong 1 phút không cần build lại APK
npx expo install expo-updates
eas init
eas update:configure
```
Mở [mobile/eas.json](mobile/eas.json) và điền đúng các giá trị thật trong profile `preview` (và `production`):
- `EXPO_PUBLIC_API_URL`: `https://api.tago.id.vn`
- `EXPO_PUBLIC_SOCKET_URL`: `https://api.tago.id.vn`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: `<WEB_CLIENT_ID>.apps.googleusercontent.com`
- `EXPO_PUBLIC_EAS_PROJECT_ID`: `<PROJECT_ID_TU_EAS_INIT>`

### 8.3. Build APK & lấy SHA-1 cho Google Sign-In
```bash
eas build --platform android --profile preview
```
Sau khi build xong, lấy **SHA-1** của Android Keystore do EAS quản lý:
```bash
eas credentials --platform android
# Chọn profile: preview -> Keystore -> Copy dòng "SHA1 Fingerprint"
```
Dán SHA-1 đó vào **Android OAuth Client** trên Google Cloud Console và cập nhật `GOOGLE_ANDROID_CLIENT_ID` trong `backend/.env` trên VM 1 (nếu đổi Client ID) rồi restart backend (`docker compose --env-file deploy/.env.core -f deploy/docker-compose.core.yml restart backend`).

---

## 9. Sao lưu tự động (Backup) & Giám sát (Monitoring)

### 9.1. Tự động backup MongoDB lúc 03:00 sáng mỗi ngày trên VM 1
```bash
mkdir -p ~/backups/mongo
crontab -e
```
Thêm dòng sau (thay `<USER>` bằng username Linux của bạn, xem bằng lệnh `whoami`):
```cron
0 3 * * * /bin/bash /home/<USER>/VibeHue/deploy/backup-mongo.sh >> /home/<USER>/backups/mongo-backup.log 2>&1
```
Chạy thử ngay để xác nhận backup hoạt động:
```bash
bash ~/VibeHue/deploy/backup-mongo.sh
ls -lh ~/backups/mongo/
```

**Khôi phục dữ liệu (Restore) khi cần:**
```bash
source ~/VibeHue/deploy/.env.core
docker exec -i tago-mongodb mongorestore \
  --username "$MONGO_ROOT_USER" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --drop --archive --gzip < ~/backups/mongo/<TEN_FILE_BACKUP>.archive.gz
```

### 9.2. Giám sát uptime miễn phí (UptimeRobot)
- Tạo monitor kiểu **HTTP(s)** trên [uptimerobot.com](https://uptimerobot.com) kiểm tra `https://api.tago.id.vn/health` mỗi **5 phút** (endpoint này đã được gắn `@SkipThrottle()` nên không bao giờ bị rate-limit).

---

## 10. Quy trình đẩy code & cập nhật hằng ngày

Mỗi khi team merge code mới lên Git:

| Thành phần thay đổi | Cách cập nhật | Thời gian |
| :--- | :--- | :--- |
| **Web Frontend** (`frontend/`) | Chỉ cần `git push` → **Vercel tự động build & deploy** | ~1–2 phút |
| **Backend** (`backend/`) | SSH VM 1 chạy: `bash ~/VibeHue/deploy/update-core.sh` | ~30–45 giây (không restart DB) |
| **AI / OCR** (`ai-service/`, `ocr-service/`) | SSH VM 2 chạy: `bash ~/VibeHue/deploy/update-ai.sh` | ~20–60 giây |
| **Mobile JS / UI** (`mobile/`) | Máy dev chạy: `cd mobile && eas update --channel preview --message "Mô tả bản cập nhật"` | ~1 phút (app tự tải bản mới) |
| **Mobile Native** (đổi plugin/`app.json`) | Máy dev chạy: `cd mobile && eas build -p android --profile preview` | ~10–15 phút |

> **Lưu ý sống còn**: TUYỆT ĐỐI KHÔNG chạy `docker compose down -v` trên VM 1 vì cờ `-v` sẽ xóa sạch volume MongoDB, Redis, MinIO và chứng chỉ SSL của Caddy.

---

## 11. Checklist nghiệm thu 8 luồng chính sau khi deploy

1. **Health & SSL**: `https://api.tago.id.vn/health` trả `200 OK`, chứng chỉ ổ khóa HTTPS hợp lệ, không còn lỗi mixed content.
2. **Auth Web & Mobile**: Đăng nhập Email/Password + Google OAuth trên Web và Mobile APK (kiểm tra redirect về app `tago://` không bị chặn CSP).
3. **Upload Media**: Upload ảnh sản phẩm / avatar (Cloudinary) và upload hồ sơ KYC / tạo hợp đồng PDF có dấu tiếng Việt chuẩn (`NotoSans` trên MinIO).
4. **Booking & Thanh toán**: Đặt thuê áo dài + chụp ảnh (kiểm tra MongoDB transaction), mở trang PayOS Simulator (`/payments/checkout/:code`) bấm xác nhận thành công.
5. **Realtime Chat & Thông báo**: Nhắn tin 2 chiều Web ↔ Mobile qua Socket.IO WSS, kiểm tra nhận Push Notification trên Android.
6. **Staff Check-in / Check-out**: Mở Camera trên Web HTTPS & Mobile chụp ảnh xác nhận có mặt tại điểm hẹn và thực hiện check-out.
7. **AI & OCR**: Test Chatbot tư vấn, Tìm kiếm bằng ảnh (CLIP), Gợi ý mô tả sản phẩm, Đọc bảng size (Gemini) và OCR CCCD (Tesseract tiếng Việt).
8. **Quá hạn / Domino (nếu cần demo)**: Kiểm tra log cron trên `docker logs tago-backend`; chỉ bật `ALLOW_OVERDUE_SIMULATION=true` khi cần demo kịch bản giả lập quá hạn rồi tắt lại sau demo.

---

## 12. Xử lý nhanh các sự cố thường gặp

- **Lỗi `ERR_TOO_MANY_REDIRECTS` khi mở `https://api.tago.id.vn`**: Kiểm tra Cloudflare SSL/TLS đang để `Flexible` → đổi sang **Full (strict)** hoặc tắt proxy (Mây xám).
- **Lỗi `CORS` trên Web**: Kiểm tra `FRONTEND_URL` trong `backend/.env` đã có đúng `https://tago.id.vn` (không có `/` cuối) và đã restart backend.
- **Google OAuth Mobile bị lỗi `DEVELOPER_ERROR` (code 10)**: SHA-1 trong Google Cloud Android OAuth Client chưa khớp SHA-1 từ `eas credentials --platform android`, hoặc `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` điền nhầm Android Client ID thay vì Web Client ID.
- **AI Service không đọc được danh sách sản phẩm**: Kiểm tra `MONGO_URL` trong `ai-service/.env` đã có `&directConnection=true` và rule firewall `allow-tago-ai-to-mongo` đã gắn đúng tag `tago-ai` / `tago-core`.
- **Lỗi MongoDB `Transaction numbers are only allowed on a replica set member`**: Kiểm tra `docker logs tago-mongo-init-rs` và đảm bảo `MONGODB_URI` có `&replicaSet=rs0`.
