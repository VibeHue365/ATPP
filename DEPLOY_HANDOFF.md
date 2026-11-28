# Tài liệu Bàn giao Triển khai Production (Handoff Guide — TàGo / VibeHue)

> **Dành cho:** Thành viên phụ trách triển khai tiếp **và AI Agent hỗ trợ** đọc để nắm trọn bối cảnh, những phần **đã làm xong**, các **ràng buộc kỹ thuật bắt buộc không được phá vỡ**, và chạy nốt phần **Server Backend + AI/OCR + Mobile APK** mà không phải mò lại từ đầu.

---

## 1. Thông tin Dự án & Hiện trạng Triển khai

| Hạng mục | Giá trị / Trạng thái |
| :--- | :--- |
| **GitHub Repository** | `https://github.com/VibeHue365/ATPP.git` |
| **Nhánh Production đang dùng** | `deploy/production` *(tách từ `feature/transaction-new`; giữ nguyên sạch `main` và `feature/transaction-new` — KHÔNG push thẳng đè lên nhánh dev của người khác)* |
| **Tên miền chính (Web Frontend)** | `https://tagohue.app` *(đã mua miễn phí 1 năm qua Name.com GitHub Student, hết hạn `27/11/2027`, đã tắt Auto-Renew)* |
| **Tên miền API & Socket.IO** | `https://api.tagohue.app` *(chưa trỏ DNS — sẽ trỏ record `A` ngay khi có IP tĩnh của Server)* |
| **DNS Provider** | **Cloudflare** (`serena.ns.cloudflare.com`, `tate.ns.cloudflare.com`) — **ĐÃ KẾT NỐI XONG** |
| **Web Frontend Hosting** | **Vercel** — **ĐÃ DEPLOY LIVE** từ nhánh `deploy/production`, Root Directory = `frontend`, đã gắn `https://tagohue.app` (CNAME `DNS only` mây xám) |
| **Biến môi trường đang cấu hình trên Vercel** | `VITE_API_BASE_URL=https://api.tagohue.app`, `VITE_SOCKET_URL=https://api.tagohue.app`, `VITE_CONTRACTS_V2_ENABLED=true`, `VITE_CONTRACTS_TIERED_ENABLED=false` |
| **Google OAuth (Web)** | **ĐÃ TẠO & PUBLISH (`In production`)** trên Google Auth Platform:<br>• Origins: `https://tagohue.app`, `https://www.tagohue.app`<br>• Redirect URI: `https://api.tagohue.app/auth/google/callback`<br>• Client ID & Secret lưu riêng (xin trực tiếp từ Huy qua tin nhắn riêng, KHÔNG đưa lên Git) |
| **Public Media (Cloudinary)** | **ĐÃ CÓ SẴN KEY** (lấy từ `backend/.env` local của nhóm) |
| **Email SMTP & Gemini API Key** | **ĐÃ CÓ SẴN KEY** (lấy từ `backend/.env` và `ai-service/.env` local của nhóm) |
| **Backend + MongoDB + Redis + MinIO + AI + OCR Server** | ⏳ **CHƯA DỰNG — ĐÂY LÀ VIỆC CẦN LÀM TIẾP** |
| **Mobile Android APK + OTA (Expo EAS)** | ⏳ **LÀM SAU KHI `https://api.tagohue.app/health` TRẢ `200 OK`** |

---

## 2. Kiến trúc Hệ thống & Quy tắc Kỹ thuật BẮT BUỘC (Đọc kỹ trước khi thao tác!)

```text
Người dùng (Web / Mobile APK)
   ├── https://tagohue.app ────────► Vercel CDN (React 19 + Vite 8 SPA — ĐÃ LIVE)
   ├── Ảnh công khai ──────────────► Cloudinary CDN (ĐÃ CÓ)
   └── https://api.tagohue.app ────► Cloudflare DNS ──► Linux Ubuntu 24.04 VPS/VM (24/7, không ngủ)
                                                         ├── Caddy (Auto HTTPS Let's Encrypt + WebSocket/Socket.IO)
                                                         ├── Backend NestJS 11 (ĐÚNG 1 CONTAINER DUY NHẤT)
                                                         ├── MongoDB 7 (Replica Set rs0 + Auth + keyFile)
                                                         ├── Redis 7 (AOF, nội bộ)
                                                         ├── MinIO (Private KYC / CCCD mã hóa / Hợp đồng PDF, nội bộ)
                                                         ├── AI Service (Python FastAPI + PyTorch E5 + CLIP + Gemini)
                                                         └── OCR Service (Python FastAPI + Tesseract vie+eng)
```

### 8 Ràng buộc Kỹ thuật CỐT LÕI (Agent & Dev tuyệt đối tuân thủ)
1. **KHÔNG dùng PaaS có chế độ ngủ (Render Free, Railway Free, Serverless):** Hệ thống có Socket.IO stateful, 13 NestJS `@Cron` job chạy 24/7 và AI service PyTorch/CLIP (~2–3 GB RAM). Bắt buộc dùng **Linux VPS/VM chạy 24/7**.
2. **CHỈ chạy đúng 1 container `backend`:** `backend/src/modules/chat/chat.gateway.ts` lưu `activeConnections` in-memory và có 13 cron job (`bookings-scheduler.service.ts`, `rental-evidence-cleanup.service.ts`). Scale >1 replica sẽ bị nhân đôi cron và lỗi routing WebSocket.
3. **MongoDB BẮT BUỘC chạy Replica Set `rs0`:** Các service booking dùng MongoDB multi-document transaction (`startSession()`). Các file `deploy/docker-compose.*.yml` đã cấu hình sẵn `mongo-init-rs` tự khởi tạo `rs0` và `deploy/init-core.sh` tự sinh `deploy/secrets/mongo-keyfile` (`chmod 400`, `chown 999:999`).
4. **Múi giờ `TZ=Asia/Ho_Chi_Minh`:** Bắt buộc áp dụng cho toàn bộ container (và đã cài `tzdata` trong `backend/Dockerfile`) để cron quá hạn/Domino và giờ check-in/check-out khớp giờ Việt Nam.
5. **Runtime assets của Backend:** `backend/Dockerfile` sử dụng `node:22-slim` (glibc cho `sharp`), **đã copy `assets/fonts/NotoSans-*.ttf`** cho xuất PDF hợp đồng tiếng Việt, chạy non-root `node` và healthcheck tại `GET /health` (`@SkipThrottle()`).
6. **Đồng bộ cờ tính năng giữa Backend & Vercel Frontend:**
   - Hiện trên Vercel đã bật `VITE_CONTRACTS_V2_ENABLED=true`, `VITE_CONTRACTS_TIERED_ENABLED=false`.
   - Do đó trong `backend/.env` phải đặt khớp `CONTRACTS_V2_ENABLED=true`, `CONTRACTS_TIERED_ENABLED=false`, `PRIVATE_STORAGE_PROVIDER=minio`, `MINIO_OCR_TEMP_BUCKET=ocr-temp-files`, `SERVE_LEGACY_UPLOADS=false`.
7. **Cloudflare DNS & SSL cho `api.tagohue.app`:**
   - Lúc trỏ DNS lần đầu **BẮT BUỘC để Proxy status = `DNS only` (Mây xám)** để Caddy tự cấp chứng chỉ Let's Encrypt HTTPS thành công.
   - Có thể giữ luôn Mây xám (tối ưu độ trễ cho Socket.IO). Nếu sau này muốn bật Mây cam thì **BẮT BUỘC đặt Cloudflare SSL/TLS = `Full (strict)`** — **TUYỆT ĐỐI KHÔNG chọn `Flexible`** (sẽ gây lỗi `ERR_TOO_MANY_REDIRECTS`).
8. **Bảo toàn dữ liệu & Secrets:**
   - **TUYỆT ĐỐI KHÔNG** chạy `docker compose down -v` trên server production (sẽ xóa sạch volume MongoDB, Redis, MinIO, SSL Caddy).
   - **TUYỆT ĐỐI KHÔNG** commit `.env`, `deploy/.env.core`, `deploy/secrets/` lên Git (đã khai báo trong `.gitignore`).

---

## 3. Các bản vá Pre-deploy & File Hạ tầng ĐÃ CÓ SẴN trong Repo

### Bản vá code đã được tích hợp sẵn trong nhánh `deploy/production`
- `backend/src/modules/payments/controllers/payments.controller.ts`: CSP riêng cho PayOS Simulator HTML (`/payments/checkout/:code`) + escape `JSON.stringify`.
- `backend/src/modules/auth/controllers/auth.controller.ts`: CSP nonce cryptographic cho trang redirect Mobile Google OAuth deep link dưới `NODE_ENV=production`.
- `backend/src/app.controller.ts`: Endpoint `GET /health` (`@SkipThrottle()`, kiểm tra trạng thái kết nối MongoDB, trả `200` hoặc `503`).
- `backend/src/main.ts`: Bind `0.0.0.0` cho Docker container.
- `backend/src/modules/bookings/services/rental-overdue-domino.service.ts`: Cho phép bật/tắt giả lập quá hạn trên production qua cờ `ALLOW_OVERDUE_SIMULATION=true` (mặc định `false`).
- `frontend/src/utils/downloadUtils.ts`: Dùng `API_BASE_URL` chuẩn thay vì `VITE_API_URL`.
- `ai-service/db/connection.py`: Tự nhận diện `NESTJS_DB_NAME` từ path của `MONGO_URL`.

### Bộ file hạ tầng trong repo
- `backend/Dockerfile` & `backend/.dockerignore` — Multi-stage Node 22 slim, cache layer rebuild ~30s.
- `ai-service/Dockerfile` & `ocr-service/Dockerfile` — Bake sẵn `intfloat/multilingual-e5-small`, `clip-ViT-B-32` và `tesseract-ocr-vie`.
- `deploy/Caddyfile` — Reverse proxy HTTPS + WebSocket/Socket.IO, upload `25MB`, timeout `120s`.
- `deploy/.env.core.example` — Mẫu biến hạ tầng (`API_DOMAIN=api.tagohue.app`, MongoDB, MinIO).
- `deploy/docker-compose.all-in-one.yml` & `deploy/update-all.sh` — **Cho mô hình 1 VPS duy nhất (8 GB+ RAM)**.
- `deploy/docker-compose.core.yml`, `deploy/docker-compose.ai.yml`, `deploy/update-core.sh`, `deploy/update-ai.sh` — **Cho mô hình 2 VM tách biệt**.
- `deploy/init-core.sh` — Sinh `deploy/secrets/mongo-keyfile` (`400`, `999:999`) một lần duy nhất.
- `deploy/backup-mongo.sh` — Sao lưu `mongodump --archive --gzip` hàng đêm, tự xóa bản cũ > 7 ngày.
- `frontend/vercel.json` — SPA rewrite + cache asset + `Permissions-Policy: camera=(self), geolocation=(self)`.
- `mobile/eas.json` — Cấu hình sẵn `https://api.tagohue.app` cho profile `preview` (APK + OTA) & `production` (AAB).

---

## 4. Chọn 1 trong 2 Phương án Server & Lệnh Triển khai Chi tiết

### PHƯƠNG ÁN 1 (KHUYÊN DÙNG — Gọn nhất, nhanh nhất): 1 VPS duy nhất (All-in-One)
Phù hợp nhất khi thuê **1 VPS Việt Nam** (CloudFly / Vietnix / DataOnline) hoặc **1 Cloud VM** cấu hình:
- **Hệ điều hành:** `Ubuntu 24.04 LTS (64-bit x86_64)`
- **Cấu hình tối thiểu:** `4 vCPU` / **`8 GB RAM`** *(12–16 GB RAM càng tốt)* / **`>= 60 GB SSD/NVMe`** (khuyên 80–120 GB)
- **Ưu điểm:** Chỉ mở duy nhất port `22, 80, 443`; toàn bộ MongoDB/Redis/MinIO/Backend/AI/OCR chạy chung 1 mạng Docker nội bộ `tago-net`, không cần cấu hình nối chéo 2 máy!

#### Bước 1.1: Chuẩn bị VPS (Swap 4 GB + UFW Firewall + Docker + Múi giờ VN)
SSH vào VPS (`ssh root@<VPS_IP>` hoặc user `sudo`):
```bash
# 1. Đặt múi giờ Việt Nam
sudo timedatectl set-timezone Asia/Ho_Chi_Minh

# 2. Tạo 4 GB Swap (rất quan trọng trên VPS 8 GB RAM khi build Docker & chạy CLIP)
if [ ! -f /swapfile ]; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
free -h

# 3. Cài đặt Firewall UFW (chỉ mở 22, 80, 443)
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable
sudo ufw status

# 4. Cài Docker Engine + Docker Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version && docker compose version
```

#### Bước 1.2: Clone repo & chuyển sang nhánh `deploy/production`
```bash
git clone https://github.com/VibeHue365/ATPP.git ~/VibeHue
cd ~/VibeHue
git checkout deploy/production
```
*(Nếu repo là Private trên GitHub: dùng GitHub Personal Access Token hoặc SSH deploy key để clone).*

#### Bước 1.3: Trỏ DNS trên Cloudflare cho `api.tagohue.app`
Vào Cloudflare (`tagohue.app` → **DNS → Records** → **Add record**):
- **Type:** `A`
- **Name:** `api`
- **IPv4 address:** `<VPS_PUBLIC_IP>`
- **Proxy status:** **TẮT sang Mây xám (`DNS only`)**
- Bấm **Save** (đợi 1 phút, kiểm tra bằng `dig +short api.tagohue.app` thấy ra đúng `<VPS_PUBLIC_IP>`).

#### Bước 1.4: Tạo 3 file `.env` (theo mẫu ở Mục 5 bên dưới)
```bash
cp deploy/.env.core.example deploy/.env.core && nano deploy/.env.core
cp backend/.env.example backend/.env && nano backend/.env
cp ai-service/.env.example ai-service/.env && nano ai-service/.env
```
> **Lưu ý riêng cho Phương án 1 (All-in-One 1 VPS):**
> - Trong `backend/.env`: đặt `AI_SERVICE_URL=http://ai-service:8000` và `OCR_SERVICE_URL=http://ocr-service:8010`.
> - Trong `ai-service/.env`: đặt `MONGO_URL=mongodb://tago_admin:<MONGO_ROOT_PASSWORD>@mongodb:27017/vibehue?authSource=admin&replicaSet=rs0` và `BACKEND_URL=http://backend:3000`.

#### Bước 1.5: Khởi tạo `mongo-keyfile` & Chạy toàn bộ hệ thống!
```bash
cd ~/VibeHue
bash deploy/init-core.sh
docker compose --env-file deploy/.env.core -f deploy/docker-compose.all-in-one.yml up -d --build
```
*(Lần đầu build `ai-service` sẽ tải PyTorch CPU + E5 + CLIP mất khoảng 5–8 phút; những lần update sau chỉ mất 30 giây).*

#### Bước 1.6: Kiểm tra kết quả
```bash
docker compose --env-file deploy/.env.core -f deploy/docker-compose.all-in-one.yml ps
curl -i https://api.tagohue.app/health
```
Chuẩn khi `tago-mongodb`, `tago-redis`, `tago-minio`, `tago-ai-service`, `tago-ocr-service`, `tago-backend`, `tago-caddy` đều `Up (healthy)`, `tago-mongo-init-rs` là `Exited (0)`, và `https://api.tagohue.app/health` trả HTTP **`200 OK`** kèm `{"status":"ok","db":"connected",...}`!

---

### PHƯƠNG ÁN 2 (Mạnh tối đa): 2 VM tách biệt (GCP / AWS / Azure)
Dùng khi có Cloud Credit (GCP \$300, AWS \$200, Azure \$100):
- **VM 1 (`tago-core` — 2–4 vCPU, 4–8 GB RAM, 40–50 GB SSD + IP Public tĩnh):** chạy `deploy/docker-compose.core.yml`.
- **VM 2 (`tago-ai` — 2–4 vCPU, 8–16 GB RAM, 40–50 GB SSD):** chạy `deploy/docker-compose.ai.yml`.
- **Firewall giữa 2 VM:**
  - VM 1 mở công khai: `22, 80, 443` (TCP + UDP 443). Mở nội bộ **CHỈ từ VM 2**: TCP `27017`.
  - VM 2 mở `22`. Mở nội bộ **CHỈ từ VM 1**: TCP `8000, 8010` (tuyệt đối không mở 8000/8010/27017 ra `0.0.0.0/0`).
- **Khác biệt duy nhất trong `.env` so với Phương án 1:**
  - Trên VM 1 (`backend/.env`): `AI_SERVICE_URL=http://<VM2_INTERNAL_IP>:8000`, `OCR_SERVICE_URL=http://<VM2_INTERNAL_IP>:8010`.
  - Trên VM 2 (`ai-service/.env`): **BẮT BUỘC dùng `&directConnection=true`**:
    `MONGO_URL=mongodb://tago_admin:<MONGO_ROOT_PASSWORD>@<VM1_INTERNAL_IP>:27017/vibehue?authSource=admin&directConnection=true`
    `BACKEND_URL=https://api.tagohue.app`
- **Lệnh chạy:**
  - Trên VM 1: `bash deploy/init-core.sh && docker compose --env-file deploy/.env.core -f deploy/docker-compose.core.yml up -d --build`
  - Trên VM 2: `docker compose -f deploy/docker-compose.ai.yml up -d --build`
- *(Chi tiết câu lệnh tạo VM GCP xem thêm trong file `DEPLOY.md` cùng thư mục gốc).*

---

## 5. Mẫu đầy đủ 3 File `.env` Production (Điền giá trị thật trực tiếp trên Server)

> **Các khóa bí mật cần lấy từ Huy qua kênh riêng (KHÔNG lưu trên Git):**
> 1. Google OAuth Production: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (từ Google Auth Platform `TàGo Auth` vừa tạo) + `GOOGLE_ANDROID_CLIENT_ID` (lấy sau khi build APK / SHA-1).
> 2. Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
> 3. SMTP Email: `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`.
> 4. Gemini: `GEMINI_API_KEY`.
> 5. Sinh mới 2 chuỗi ngẫu nhiên 64 ký tự ngay trên server bằng `openssl rand -hex 32` cho `JWT_SECRET` và `IDENTITY_FINGERPRINT_SECRET`.

### 5.1. `deploy/.env.core`
*(Mật khẩu MongoDB & MinIO chỉ dùng chữ và số — KHÔNG dùng `@ : / ? # %`)*
```dotenv
API_DOMAIN=api.tagohue.app
MONGO_ROOT_USER=tago_admin
MONGO_ROOT_PASSWORD=<MAT_KHAU_MONGO_CHU_VA_SO>
MONGO_DB_NAME=vibehue
MINIO_ROOT_USER=tago_minio_admin
MINIO_ROOT_PASSWORD=<MAT_KHAU_MINIO_CHU_VA_SO>
```

### 5.2. `backend/.env`
```dotenv
NODE_ENV=production
PORT=3000
TZ=Asia/Ho_Chi_Minh

MONGODB_URI=mongodb://tago_admin:<MAT_KHAU_MONGO_CHU_VA_SO>@mongodb:27017/vibehue?authSource=admin&replicaSet=rs0
REDIS_URL=redis://redis:6379

FRONTEND_URL=https://tagohue.app,https://www.tagohue.app
API_PUBLIC_URL=https://api.tagohue.app
BACKEND_URL=https://api.tagohue.app
BODY_LIMIT=10mb
POLICY_ACTIVATION_MODE=COMPENSATION

# Rate limit cao cho Wi-Fi chung / buoi bao ve do an
THROTTLE_DEFAULT_LIMIT=600
THROTTLE_AUTH_LIMIT=300

JWT_SECRET=<OPENSSL_RAND_HEX_32_SO_1>
IDENTITY_FINGERPRINT_SECRET=<OPENSSL_RAND_HEX_32_SO_2>
IDENTITY_FINGERPRINT_KEY_ID=v1
BCRYPT_SALT_ROUNDS=12

GOOGLE_CLIENT_ID=<GOOGLE_WEB_CLIENT_ID>
GOOGLE_ANDROID_CLIENT_ID=<GOOGLE_ANDROID_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<GOOGLE_WEB_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=https://api.tagohue.app/auth/google/callback

MAIL_HOST=<SMTP_HOST>
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<SMTP_USER>
MAIL_PASSWORD=<SMTP_APP_PASSWORD>
MAIL_FROM=TàGo <no-reply@tagohue.app>

CLOUDINARY_CLOUD_NAME=<CLOUDINARY_CLOUD_NAME>
CLOUDINARY_API_KEY=<CLOUDINARY_API_KEY>
CLOUDINARY_API_SECRET=<CLOUDINARY_API_SECRET>

PRIVATE_STORAGE_PROVIDER=minio
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=tago_minio_admin
MINIO_SECRET_KEY=<MAT_KHAU_MINIO_CHU_VA_SO>
MINIO_PROVIDER_DOCUMENT_BUCKET=provider-documents
MINIO_OCR_TEMP_BUCKET=ocr-temp-files
MINIO_AUTO_CREATE_BUCKETS=true
SERVE_LEGACY_UPLOADS=false

BOOTSTRAP_ADMIN_EMAIL=admin@tagohue.app
BOOTSTRAP_ADMIN_PASSWORD=<MAT_KHAU_ADMIN_MANH>
BOOTSTRAP_ADMIN_NAME=TàGo Admin

DISABLE_AUTO_CREATE_INVENTORY=true

# Phuong an 1 (All-in-One 1 VPS): giu nguyen http://ai-service:8000 & http://ocr-service:8010
# Phuong an 2 (2 VM): doi thanh http://<VM2_INTERNAL_IP>:8000 & http://<VM2_INTERNAL_IP>:8010
AI_SERVICE_URL=http://ai-service:8000
OCR_SERVICE_URL=http://ocr-service:8010
SMART_TAG_AI_ENABLED=true
SMART_TAG_AI_TIMEOUT_MS=15000
OCR_V2_ENABLED=false
OCR_V2_WORKER_ENABLED=false
AUTH_EMAIL_QUEUE_ENABLED=false

ENABLE_PAYMENT_SIMULATOR=true
PAYOS_REFUND_MOCK=true
ALLOW_EARLY_RENTAL_PICKUP=true
ALLOW_OVERDUE_SIMULATION=false
CONTRACTS_V2_ENABLED=true
CONTRACTS_TIERED_ENABLED=false
```

### 5.3. `ai-service/.env`
```dotenv
GEMINI_API_KEY=<GEMINI_API_KEY>
TZ=Asia/Ho_Chi_Minh

# Phuong an 1 (All-in-One 1 VPS):
MONGO_URL=mongodb://tago_admin:<MAT_KHAU_MONGO_CHU_VA_SO>@mongodb:27017/vibehue?authSource=admin&replicaSet=rs0
BACKEND_URL=http://backend:3000

# (Neu dung Phuong an 2 - 2 VM tach biet, doi 2 dong tren thanh:)
# MONGO_URL=mongodb://tago_admin:<MAT_KHAU_MONGO_CHU_VA_SO>@<VM1_INTERNAL_IP>:27017/vibehue?authSource=admin&directConnection=true
# BACKEND_URL=https://api.tagohue.app

DB_NAME=aodai_platform
NESTJS_DB_NAME=vibehue
FRONTEND_URL=https://tagohue.app

VISUAL_SEARCH_ENABLED=true
PRODUCT_DRAFT_ENABLED=true
PRODUCT_DRAFT_GEMINI_ENABLED=true
PRODUCT_DRAFT_GEMINI_MODEL=gemini-3.1-flash-lite
SIZE_CHART_GEMINI_MODEL=gemini-3.1-flash-lite
SIZE_CHART_GEMINI_FALLBACK_MODEL=gemini-3.6-flash
```

---

## 6. Build Mobile Android APK + OTA Update (Sau khi `https://api.tagohue.app/health` OK)

Chạy trên máy dev trong thư mục `mobile/`:
```bash
cd mobile
npm install -g eas-cli
eas login
npx expo install expo-updates
eas init
eas update:configure
```
1. Mở `mobile/eas.json`, cập nhật `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Web Client ID từ `TàGo Auth`) và `EXPO_PUBLIC_EAS_PROJECT_ID` (lấy từ `eas init`). Các biến `EXPO_PUBLIC_API_URL` & `EXPO_PUBLIC_SOCKET_URL` đã điền sẵn `https://api.tagohue.app`.
2. Build file cài đặt APK:
   ```bash
   eas build --platform android --profile preview
   ```
3. Lấy **SHA-1 Fingerprint** cho Google Sign-In trên Android:
   ```bash
   eas credentials --platform android
   # Chon: preview -> Keystore -> Copy dong SHA1 Fingerprint
   ```
4. Vào **Google Auth Platform → Clients → Create client → Android**:
   - Package name: `com.vibehue.mobile`
   - SHA-1: dán SHA-1 vừa lấy
   - Copy **Android Client ID** mới tạo cập nhật vào `GOOGLE_ANDROID_CLIENT_ID` trong `backend/.env` trên server rồi restart container backend (`docker restart tago-backend`).

---

## 7. Backup Tự động, Giám sát & Quy trình Cập nhật Code Hằng ngày

### 7.1. Backup MongoDB tự động 03:00 sáng mỗi ngày trên Server
```bash
mkdir -p ~/backups/mongo
crontab -e
```
Thêm dòng (thay `<USER>` bằng kết quả lệnh `whoami`):
```cron
0 3 * * * /bin/bash /home/<USER>/VibeHue/deploy/backup-mongo.sh >> /home/<USER>/backups/mongo-backup.log 2>&1
```

### 7.2. Giám sát miễn phí (UptimeRobot)
Tạo HTTP(s) Monitor trên [uptimerobot.com](https://uptimerobot.com) ping `https://api.tagohue.app/health` mỗi 5 phút.

### 7.3. Cập nhật khi nhóm có code mới (không mất dữ liệu DB!)
1. Trên máy dev, merge code mới vào nhánh `deploy/production` rồi push:
   ```bash
   git checkout deploy/production
   git fetch origin
   git merge origin/<NHANH_TINH_NANG_HOAC_MAIN>
   git push origin deploy/production
   ```
2. Cập nhật từng thành phần vừa sửa:
   - **Frontend (`frontend/`):** Vercel **tự động build & deploy** trong ~1 phút.
   - **Backend/AI (Phương án 1 — All-in-One 1 VPS):** SSH vào VPS chạy:
     - Chỉ sửa backend: `bash ~/VibeHue/deploy/update-all.sh` *(~35 giây, không restart DB)*
     - Sửa cả AI/OCR: `bash ~/VibeHue/deploy/update-all.sh all`
   - **Backend/AI (Phương án 2 — 2 VM):**
     - VM 1: `bash ~/VibeHue/deploy/update-core.sh`
     - VM 2: `bash ~/VibeHue/deploy/update-ai.sh`
   - **Mobile JS/UI:** `cd mobile && eas update --channel preview --message "Mo ta cap nhat"` *(~1 phút, người dùng mở lại app tự nhận bản mới)*.

---

## 8. Checklist Nghiệm thu 8 Luồng Chính sau khi Deploy xong

- [ ] **1. Health & SSL:** `https://api.tagohue.app/health` trả `200 OK` (`db: connected`), `https://tagohue.app` có ổ khóa HTTPS hợp lệ, không lỗi CORS trên DevTools.
- [ ] **2. Auth Web & Mobile:** Đăng nhập Email/Password + Google OAuth trên Web và Android APK (`tago://` deep link redirect mượt).
- [ ] **3. Upload Media & PDF:** Upload ảnh sản phẩm/avatar lên Cloudinary; upload hồ sơ KYC & tải hợp đồng PDF có dấu tiếng Việt chuẩn (`NotoSans`) từ MinIO.
- [ ] **4. Booking & PayOS Simulator:** Tạo booking áo dài + chụp ảnh (kiểm tra MongoDB `rs0` transaction), mở `/payments/checkout/:code` bấm xác nhận thanh toán thành công.
- [ ] **5. Realtime Chat & Push Notification:** Chat 2 chiều Web ↔ Mobile qua Socket.IO WSS.
- [ ] **6. Staff Check-in / Check-out:** Bật Camera trên Web HTTPS & Mobile chụp ảnh check-in tại điểm hẹn, thực hiện check-out.
- [ ] **7. AI & OCR:** Test Chatbot tư vấn, Visual Search (CLIP), gợi ý mô tả sản phẩm, đọc bảng size (Gemini), OCR CCCD (Tesseract tiếng Việt).
- [ ] **8. Quá hạn / Domino:** Kiểm tra log cron trên `docker logs tago-backend`; chỉ bật `ALLOW_OVERDUE_SIMULATION=true` khi cần demo kịch bản giả lập quá hạn.
