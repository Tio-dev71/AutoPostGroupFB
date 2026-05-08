# AutoPost License Backend

Node.js + Express + PostgreSQL backend for monthly AutoPost subscriptions using SePay bank-transfer webhooks.

## Local Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:dev
npm run dev
```

## Environment

Edit `.env`:

```env
DATABASE_URL="postgresql://autopost:password@localhost:5432/autopost"
JWT_SECRET="long_random_secret"
APP_MONTHLY_PRICE="499000"
APP_SUBSCRIPTION_DAYS="30"
SEPAY_WEBHOOK_TOKEN="long_random_token"
SEPAY_BANK_NAME="MBBank"
SEPAY_ACCOUNT_NUMBER="123456789"
SEPAY_ACCOUNT_HOLDER="NGUYEN VAN A"
FRONTEND_ORIGIN="http://localhost:1420"
PORT="8080"
```

## API Flow

### 1. Register

```http
POST /auth/register
Content-Type: application/json

{
  "name": "Customer",
  "email": "customer@example.com",
  "password": "123456"
}
```

### 2. Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "123456"
}
```

Use the returned token:

```http
Authorization: Bearer <token>
```

### 3. Create SePay Payment Order

```http
POST /payments/sepay/create
Authorization: Bearer <token>
```

The response contains:

- `amount`
- `transferCode`
- bank info
- `qrUrl`

Customer must transfer exactly with the generated content, for example:

```text
AUTO123456ABCDEF
```

### 4. Configure SePay Webhook

In SePay dashboard, configure webhook URL:

```text
https://your-domain.com/webhooks/sepay?token=YOUR_SEPAY_WEBHOOK_TOKEN
```

SePay webhook docs show these IPs for allowlisting:

```text
172.236.138.20
172.233.83.68
171.244.35.2
151.158.108.68
151.158.109.79
103.255.238.139
```

### 5. Payment Matching

When SePay sends an incoming transaction:

1. Backend stores raw transaction.
2. Backend extracts `AUTO...` code from content/description/code.
3. Backend finds matching pending order.
4. Backend verifies transfer amount.
5. Backend marks order paid.
6. Backend extends subscription by `APP_SUBSCRIPTION_DAYS`.

## VPS Deployment

### Install dependencies

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql nginx
sudo npm i -g pm2
```

### PostgreSQL

```bash
sudo -u postgres psql
CREATE DATABASE autopost;
CREATE USER autopost WITH PASSWORD 'change_me';
GRANT ALL PRIVILEGES ON DATABASE autopost TO autopost;
\q
```

### Run backend

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
pm2 start dist/server.js --name autopost-backend
pm2 save
```

### Nginx reverse proxy

```nginx
server {
  server_name api.your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Use Certbot to add HTTPS before configuring SePay production webhook.
