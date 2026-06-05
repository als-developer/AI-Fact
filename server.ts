// server.ts - Heroku Compatible Express Server

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://chat.openai.com', 'https://chatgpt.com', 'https://claude.ai'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'TruthEngine Ultimate',
    version: '1.0.0',
    description: 'AI Fact-Checking Platform',
    status: 'operational'
  });
});

// Verification endpoint
app.post('/api/v1/verify', async (req, res) => {
  try {
    const { text, engine_mode = 'standard' } = req.body;
    
    if (!text || text.length < 10) {
      return res.status(400).json({
        error: { code: 'INVALID_TEXT', message: 'Text must be at least 10 characters' }
      });
    }
    
    // Mock verification response (inyoueza kubadilishwa na real logic)
    const result = {
      job_id: `job_${Date.now()}`,
      status: 'completed',
      overall_score: 85.5,
      verdict: 'TRUE',
      claims: [
        {
          claim: text.substring(0, 100),
          verdict: 'TRUE',
          confidence: 0.85,
          color: 'green',
          sources: [{ url: 'https://example.com/source', title: 'Verification Source' }]
        }
      ],
      summary: {
        total_claims: 1,
        verified_count: 1,
        suspicious_count: 0,
        false_count: 0,
        risk_level: 'LOW'
      },
      processing_time_ms: 500
    };
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Verification failed' } });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TruthEngine Ultimate running on port ${PORT}`);
});
