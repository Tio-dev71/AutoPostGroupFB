#!/bin/bash
set -e

echo "=========================================="
echo "  AutoPost Backend - VPS Auto Setup"
echo "=========================================="

# --- Config ---
DB_NAME="autopost"
DB_USER="autopost"
DB_PASS="AutoPost_Secure_2026"
JWT_SECRET=$(openssl rand -hex 32)
WEBHOOK_TOKEN=$(openssl rand -hex 16)

# --- Step 1: Update system ---
echo "[1/9] Updating system..."
apt update -y && apt upgrade -y

# --- Step 2: Install Node.js 20 ---
echo "[2/9] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node: $(node -v)"

# --- Step 3: Install PostgreSQL ---
echo "[3/9] Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# --- Step 4: Create database & user ---
echo "[4/9] Creating database & user..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "DB already exists"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS' CREATEDB;" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "ALTER SCHEMA public OWNER TO $DB_USER;"

# --- Step 5: Install PM2 ---
echo "[5/9] Installing PM2..."
npm install -g pm2

# --- Step 6: Setup backend ---
echo "[6/9] Setting up backend..."
cd /root/backend
npm install

# --- Step 7: Create .env ---
echo "[7/9] Creating .env..."
cat > /root/backend/.env << ENVEOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN="7d"

APP_MONTHLY_PRICE="499000"
APP_SUBSCRIPTION_DAYS="30"
APP_DEVICE_LIMIT="1"

SEPAY_WEBHOOK_TOKEN="${WEBHOOK_TOKEN}"
SEPAY_BANK_NAME="YOUR_BANK"
SEPAY_ACCOUNT_NUMBER="YOUR_ACCOUNT_NUMBER"
SEPAY_ACCOUNT_HOLDER="YOUR_ACCOUNT_HOLDER"

FRONTEND_ORIGIN="*"
PORT="8080"
ENVEOF

echo ""
echo "============ GHI NHO CAC GIA TRI NAY ============"
echo "JWT_SECRET: ${JWT_SECRET}"
echo "SEPAY_WEBHOOK_TOKEN: ${WEBHOOK_TOKEN}"
echo "DB_PASS: ${DB_PASS}"
echo "================================================="
echo ""

# --- Step 8: Prisma migrate & build ---
echo "[8/9] Running Prisma & Build..."
npx prisma generate
npx prisma migrate deploy
npm run build

# --- Step 9: Start with PM2 ---
echo "[9/9] Starting backend with PM2..."
pm2 delete autopost-backend 2>/dev/null || true
pm2 start dist/server.js --name autopost-backend
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# --- Install & configure Nginx ---
echo "[BONUS] Setting up Nginx..."
apt install -y nginx

cat > /etc/nginx/sites-available/autopost << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/autopost /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# --- Firewall ---
ufw allow 22
ufw allow 80
ufw allow 443
echo "y" | ufw enable 2>/dev/null || true

echo ""
echo "=========================================="
echo "  DEPLOY THANH CONG!"
echo "=========================================="
echo ""
echo "  Backend: http://161.248.146.74/health"
echo "  Webhook: http://161.248.146.74/webhooks/sepay?token=${WEBHOOK_TOKEN}"
echo ""
echo "  Nhớ sửa SEPAY_BANK_NAME, ACCOUNT_NUMBER, ACCOUNT_HOLDER trong:"
echo "  /root/backend/.env"
echo ""
echo "=========================================="
