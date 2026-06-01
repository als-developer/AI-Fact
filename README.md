# AI-Fact
truth-engine



# TruthEngine Ultimate - Sovereign AI Fact-Checking Platform

## 🚀 Overview
TruthEngine Ultimate is an enterprise-grade AI fact-checking platform that verifies claims from ChatGPT, Claude, Gemini, and other LLMs against real-time web sources.

## ✨ Features
- ✅ Real-time fact checking with semantic similarity
- ✅ Multi-engine verification (standard, deep, academic, compliance)
- ✅ Chrome Extension for ChatGPT/Claude/Gemini
- ✅ PDF document verification
- ✅ Audio deepfake detection
- ✅ Compliance shield (PII/PHI detection)
- ✅ Team management & multi-tenancy
- ✅ REST API with API keys
- ✅ Webhook support
- ✅ Enterprise dashboard

## 🛠️ Tech Stack
- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **Cache:** Cloudflare KV
- **Queues:** Cloudflare Queues
- **Frontend:** Tailwind CSS + Vanilla JS
- **Chrome Extension:** Manifest V3
- **AI Models:** HuggingFace (LaBSE, BGE, E5)
- **Search:** Tavily API
- **Billing:** Lemon Squeezy

## 📦 Installation

```bash
git clone https://github.com/your-repo/truth-engine-ultimate.git
cd truth-engine-ultimate
npm install
npx wrangler login
npx wrangler d1 create truth-engine-db
npx wrangler kv:namespace create CACHE
# Update wrangler.toml with your IDs
npm run db:migrate
npm run dev
