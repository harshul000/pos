#!/bin/bash
# =============================================================================
# setup.sh — Run this ONCE on a fresh VM to set up the full production stack
# Usage: bash ~/tri/setup.sh
# =============================================================================

set -e
VM_IP="${VM_IP:-34.61.58.139}"

echo "⚙️  One-time VM production setup (IP: $VM_IP)"

# ── System deps ───────────────────────────────────────────────────────────────
echo "[1/6] Installing system packages..."
sudo apt-get update -q
sudo apt-get install -y -q nginx python3-venv python3-pip

# Node.js (if not installed)
if ! command -v node &>/dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - -q
    sudo apt-get install -y -q nodejs
fi

# PM2
sudo npm install -g pm2 --silent

# ── Redis (for POS caching) ──────────────────────────────────────────────────
echo "[2/6] Starting Redis..."
sudo apt-get install -y -q redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# ── Python venvs ─────────────────────────────────────────────────────────────
echo "[3/6] Setting up Python venvs..."

# Hotel PMS
python3 -m venv ~/tri/poss/venv
source ~/tri/poss/venv/bin/activate
pip install -r ~/tri/poss/backend/requirements.txt -q
pip install "bcrypt==4.0.1" -q
deactivate

# POS
python3 -m venv ~/tri/pos/backend/venv
source ~/tri/pos/backend/venv/bin/activate
pip install -r ~/tri/pos/backend/requirements.txt -q
deactivate

# ── .env files ────────────────────────────────────────────────────────────────
echo "[4/6] Creating .env files..."

# Hotel PMS backend
cat > ~/tri/poss/backend/.env << EOF
DATABASE_URL="sqlite+aiosqlite:///./hotel_pms.db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET_KEY="47986ec933cf5b79fc13278101b0436e26e215158e3e65d05b0efe6351153982"
JWT_REFRESH_SECRET_KEY="refresh_secret_vm_production_abcdef1234567890"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
CORS_ORIGINS="*"
HOTEL_SAAS_JWT_SECRET="47986ec933cf5b79fc13278101b0436e26e215158e3e65d05b0efe6351153982"
HOTEL_SAAS_ENABLED="true"
SENDGRID_API_KEY=""
SENDGRID_FROM_EMAIL=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI=""
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
EOF

# POS backend
cat > ~/tri/pos/backend/.env << EOF
DATABASE_URL="sqlite+aiosqlite:///./dh_pos.db"
CORS_ORIGINS="*"
JWT_SECRET="dhpos_secret_key_vm_production"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
SENDGRID_API_KEY=""
FROM_EMAIL="noreply@dhpos.com"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_DB="0"
HOTEL_SAAS_JWT_SECRET="47986ec933cf5b79fc13278101b0436e26e215158e3e65d05b0efe6351153982"
HOTEL_SAAS_ENABLED="true"
EOF

# ── Build frontends ───────────────────────────────────────────────────────────
echo "[5/6] Building frontends..."

cd ~/tri/poss/frontend
cat > .env << EOF
REACT_APP_API_URL=http://${VM_IP}:8000
REACT_APP_BACKEND_URL=http://${VM_IP}:8000
REACT_APP_POS_URL=http://${VM_IP}:3000
EOF
npm install --legacy-peer-deps --silent
npm run build

cd ~/tri/pos/frontend
cat > .env << EOF
REACT_APP_BACKEND_URL=http://${VM_IP}:8001
EOF
npm install --legacy-peer-deps --silent
npm install ajv@^8 --legacy-peer-deps --silent
npm run build

# ── nginx ─────────────────────────────────────────────────────────────────────
echo "[6/6] Configuring nginx..."
sudo tee /etc/nginx/sites-available/tri > /dev/null << EOF
server {
    listen 3001;
    server_name _;
    root /home/smitanihalani0/tri/poss/frontend/build;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
}

server {
    listen 3000;
    server_name _;
    root /home/smitanihalani0/tri/pos/frontend/build;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF

sudo ln -sf /etc/nginx/sites-available/tri /etc/nginx/sites-enabled/tri
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# ── PM2 — keep backends alive ─────────────────────────────────────────────────
echo "Starting backends with PM2..."
pm2 delete hotel-pms 2>/dev/null || true
pm2 delete pos-backend 2>/dev/null || true

pm2 start "~/tri/poss/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000" \
    --name hotel-pms --cwd ~/tri/poss/backend

pm2 start "~/tri/pos/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001" \
    --name pos-backend --cwd ~/tri/pos/backend

pm2 save
pm2 startup | tail -1 | sudo bash || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "   Hotel PMS  → http://${VM_IP}:3001"
echo "   POS        → http://${VM_IP}:3000"
echo "   PM2 status → pm2 status"
echo ""
echo "To redeploy after git pull: bash ~/tri/deploy.sh"
