#!/bin/bash
# =============================================================================
# deploy.sh — Run this on the VM after every git pull
# Usage: bash ~/tri/deploy.sh
# =============================================================================

set -e

VM_IP="${VM_IP:-34.61.58.139}"
echo "🚀 Deploying to VM ($VM_IP)..."

# ── Hotel PMS Backend ─────────────────────────────────────────────────────────
echo ""
echo "📦 [1/4] Hotel PMS backend..."
cd ~/tri/poss/backend
source ~/tri/poss/venv/bin/activate
pip install -r requirements.txt -q
deactivate

# ── POS Backend ───────────────────────────────────────────────────────────────
echo "📦 [2/4] POS backend..."
cd ~/tri/pos/backend
source ~/tri/pos/backend/venv/bin/activate
pip install -r requirements.txt -q
deactivate

# ── Hotel PMS Frontend ────────────────────────────────────────────────────────
echo "🏗️  [3/4] Building Hotel PMS frontend..."
cd ~/tri/poss/frontend
cat > .env << EOF
REACT_APP_API_URL=http://${VM_IP}:8000
REACT_APP_BACKEND_URL=http://${VM_IP}:8000
REACT_APP_POS_URL=http://${VM_IP}:3000
EOF
npm install --legacy-peer-deps --silent
npm run build --silent
echo "✅ Hotel PMS frontend built"

# ── POS Frontend ──────────────────────────────────────────────────────────────
echo "🏗️  [4/4] Building POS frontend..."
cd ~/tri/pos/frontend
cat > .env << EOF
REACT_APP_BACKEND_URL=http://${VM_IP}:8001
EOF
npm install --legacy-peer-deps --silent
npm run build --silent
echo "✅ POS frontend built"

# ── Restart backends via PM2 ──────────────────────────────────────────────────
echo ""
echo "🔄 Restarting backends..."
pm2 restart hotel-pms 2>/dev/null || echo "  (hotel-pms not in PM2 yet — run setup.sh first)"
pm2 restart pos-backend 2>/dev/null || echo "  (pos-backend not in PM2 yet — run setup.sh first)"

echo ""
echo "✅ Deploy complete!"
echo "   Hotel PMS  → http://${VM_IP}:3001"
echo "   POS        → http://${VM_IP}:3000"
