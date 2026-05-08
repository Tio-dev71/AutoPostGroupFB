# Hướng Dẫn Deploy Backend AutoPost Lên VPS

## Yêu cầu
- VPS Ubuntu 22.04 (1 vCPU, 1GB RAM trở lên)
- Có IP public (ví dụ: `103.xxx.xxx.xxx`)
- Domain (tùy chọn, để cài HTTPS cho SePay webhook)

---

## Bước 1: SSH vào VPS

Trên máy chính, mở Terminal:

```bash
ssh root@IP_VPS
```

Ví dụ:

```bash
ssh root@103.123.456.789
```

Nhập mật khẩu root.

---

## Bước 2: Cập nhật hệ thống

```bash
apt update && apt upgrade -y
```

---

## Bước 3: Cài Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Kiểm tra:

```bash
node -v
npm -v
```

---

## Bước 4: Cài PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

Kiểm tra:

```bash
systemctl status postgresql
```

---

## Bước 5: Tạo database và user

```bash
sudo -u postgres psql
```

Trong psql:

```sql
CREATE DATABASE autopost;
CREATE USER autopost WITH PASSWORD 'DAT_MAT_KHAU_MANH_O_DAY' CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE autopost TO autopost;
\c autopost
GRANT ALL ON SCHEMA public TO autopost;
ALTER SCHEMA public OWNER TO autopost;
\q
```

> ⚠️ Thay `DAT_MAT_KHAU_MANH_O_DAY` bằng mật khẩu thật, ví dụ: `AutoPost@Secure2026`

---

## Bước 6: Cài PM2 (process manager)

```bash
npm install -g pm2
```

---

## Bước 7: Upload code backend lên VPS

### Cách 1: SCP từ máy chính (mở terminal MỚI trên máy chính)

```bash
scp -r /Users/tiodev/Desktop/ToolAutoPostGroup/backend root@IP_VPS:/root/backend
```

### Cách 2: Git

Nếu code đã push lên GitHub:

```bash
cd /root
git clone https://github.com/your-repo.git
cd your-repo/backend
```

---

## Bước 8: Cài dependencies trên VPS

```bash
cd /root/backend
npm install
```

---

## Bước 9: Tạo file .env trên VPS

```bash
nano /root/backend/.env
```

Dán nội dung sau (sửa các giá trị):

```env
DATABASE_URL="postgresql://autopost:DAT_MAT_KHAU_MANH_O_DAY@localhost:5432/autopost"
JWT_SECRET="tao_chuoi_random_dai_64_ky_tu_o_day"
JWT_EXPIRES_IN="7d"

APP_MONTHLY_PRICE="499000"
APP_SUBSCRIPTION_DAYS="30"
APP_DEVICE_LIMIT="1"

SEPAY_WEBHOOK_TOKEN="tao_chuoi_random_dai_32_ky_tu"
SEPAY_BANK_NAME="MBBank"
SEPAY_ACCOUNT_NUMBER="SO_TAI_KHOAN_CUA_BAN"
SEPAY_ACCOUNT_HOLDER="TEN_CHU_TAI_KHOAN"

FRONTEND_ORIGIN="*"
PORT="8080"
```

Lưu: `Ctrl+O` → `Enter` → `Ctrl+X`

### Tạo JWT_SECRET random:

```bash
openssl rand -hex 32
```

### Tạo SEPAY_WEBHOOK_TOKEN random:

```bash
openssl rand -hex 16
```

---

## Bước 10: Chạy Prisma migration

```bash
cd /root/backend
npx prisma generate
npx prisma migrate deploy
```

Kết quả phải có:

```text
All migrations have been successfully applied.
```

---

## Bước 11: Build TypeScript

```bash
npm run build
```

---

## Bước 12: Chạy backend bằng PM2

```bash
pm2 start dist/server.js --name autopost-backend
pm2 save
pm2 startup
```

Kiểm tra:

```bash
pm2 status
```

Phải thấy `autopost-backend` status `online`.

Test:

```bash
curl http://localhost:8080/health
```

Phải ra:

```json
{"success":true,"service":"autopost-license-backend","time":"..."}
```

---

## Bước 13: Cài Nginx (reverse proxy)

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

Tạo config:

```bash
nano /etc/nginx/sites-available/autopost
```

Dán:

```nginx
server {
    listen 80;
    server_name IP_VPS;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> Thay `IP_VPS` bằng IP thật. Nếu có domain thì thay bằng domain.

Kích hoạt:

```bash
ln -s /etc/nginx/sites-available/autopost /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Test từ máy chính:

```bash
curl http://IP_VPS/health
```

---

## Bước 14: Cài HTTPS (nếu có domain)

Nếu bạn có domain (ví dụ `api.tiodev.com`):

### Trỏ DNS

Vào nhà cung cấp domain, thêm:

```text
A record: api.tiodev.com → IP_VPS
```

### Cài Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.tiodev.com
```

Làm theo hướng dẫn, nó sẽ tự cài SSL.

Sau đó Nginx tự redirect HTTP → HTTPS.

---

## Bước 15: Mở firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

---

## Bước 16: Cấu hình frontend trỏ về VPS

Trên máy chính, sửa file `.env`:

```bash
# Nếu dùng IP trực tiếp:
VITE_API_BASE_URL="http://IP_VPS"

# Nếu có domain + HTTPS:
VITE_API_BASE_URL="https://api.tiodev.com"
```

---

## Bước 17: Cấu hình SePay webhook

Vào SePay dashboard → WebHooks → Thêm mới:

```text
URL: https://api.tiodev.com/webhooks/sepay?token=SEPAY_WEBHOOK_TOKEN_CUA_BAN
```

Hoặc nếu không có domain:

```text
URL: http://IP_VPS/webhooks/sepay?token=SEPAY_WEBHOOK_TOKEN_CUA_BAN
```

> ⚠️ SePay khuyến nghị dùng HTTPS cho webhook production.

---

## Các lệnh PM2 hữu ích

```bash
# Xem log
pm2 logs autopost-backend

# Restart
pm2 restart autopost-backend

# Stop
pm2 stop autopost-backend

# Xem CPU/RAM
pm2 monit
```

---

## Cập nhật code sau này

Khi sửa code trên máy chính, deploy lại:

```bash
# Trên máy chính - upload code mới
scp -r /Users/tiodev/Desktop/ToolAutoPostGroup/backend root@IP_VPS:/root/backend

# SSH vào VPS
ssh root@IP_VPS

# Cài lại và build
cd /root/backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart autopost-backend
```

---

## Tóm tắt kiến trúc

```
┌─────────────────────────────────────────────┐
│                   VPS                        │
│                                             │
│  Nginx (:80/:443)                           │
│    ↓                                        │
│  Node.js Express (:8080)                    │
│    ↓                                        │
│  PostgreSQL (:5432)                         │
│                                             │
│  SePay webhook → /webhooks/sepay            │
└─────────────────────────────────────────────┘
         ↑
    Internet
         ↑
┌─────────────────┐
│ Tauri App       │
│ (máy khách)     │
│ → API calls     │
└─────────────────┘
```
