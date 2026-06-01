#!/bin/bash
set -e

ENVIRONMENT=${1:-production}
echo "🚀 Deploying TruthEngine Ultimate to $ENVIRONMENT..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo "❌ Wrangler CLI required. Install: npm install -g wrangler"; exit 1; }

echo "📦 Installing dependencies..."
npm ci --production=false

echo "🧪 Running tests..."
npm test

echo "🔨 Building TypeScript..."
npm run build

echo "🗄️ Running database migrations..."
npm run db:migrate

echo "🌐 Deploying to Cloudflare Workers..."
if [ "$ENVIRONMENT" = "production" ]; then npm run deploy:prod; else npm run deploy:staging; fi

echo "✅ Deployment complete!"
echo "📊 Dashboard: https://truthengine.ai/dashboard"
echo "📚 API Docs: https://docs.truthengine.ai"
