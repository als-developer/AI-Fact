// ============================================
// TRUTHENGINE ULTIMATE - HEROKU SERVER
// Enterprise AI Fact-Checking Platform
// Version: 3.0.0
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
    origin: [
        'https://chat.openai.com',
        'https://chatgpt.com',
        'https://claude.ai',
        'https://gemini.google.com',
        'https://ai-fact.herokuapp.com',
        'http://localhost:3000',
        'http://localhost:5500'
    ],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// IN-MEMORY STORAGE (Kwa ajili ya demo)
// ============================================
const verificationCache = new Map();
const verifiedFacts = new Map();

// ============================================
// SENTENCE SPLITTER (Kuvunja maandishi kwa sentensi)
// ============================================
function splitIntoSentences(text) {
    // Regex ya kisasa ya kutambua sentensi
    const sentenceRegex = /(?<![A-Z][a-z]\.)(?<![Dk]t\.)(?<![Mh]r\.)(?<![Ms]\.)(?<![Dr]\.)(?<=\.|\?|\!)\s+(?=[A-Z])/g;
    let sentences = text.split(sentenceRegex);
    sentences = sentences.filter(s => s.trim().length > 15);
    
    // Kama sentensi ndefu sana (>300 chars), vunja zaidi
    const finalSentences = [];
    for (const sentence of sentences) {
        if (sentence.length > 300) {
            const clauses = sentence.split(/[,;:]| however | therefore /);
            finalSentences.push(...clauses);
        } else {
            finalSentences.push(sentence);
        }
    }
    return finalSentences;
}

// ============================================
// SIMILARITY CALCULATION (Cosine Similarity)
// ============================================
function calculateSimilarity(text1, text2) {
    // Simple word-based similarity kwa demo
    const words1 = new Set(text1.toLowerCase().split(/\W+/));
    const words2 = new Set(text2.toLowerCase().split(/\W+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}

// ============================================
// FAKE SOURCES GENERATION (Kwa ajili ya demo)
// ============================================
function generateSources(claim) {
    const domains = [
        { name: 'Wikipedia', domain: 'wikipedia.org', authority: 0.95 },
        { name: 'Britannica', domain: 'britannica.com', authority: 0.92 },
        { name: 'Reuters', domain: 'reuters.com', authority: 0.88 },
        { name: 'BBC', domain: 'bbc.com', authority: 0.85 },
        { name: 'Associated Press', domain: 'ap.org', authority: 0.87 }
    ];
    
    const keywords = claim.substring(0, 50).replace(/\s+/g, '-').toLowerCase();
    return domains.map(d => ({
        url: `https://${d.domain}/article/${keywords}-${Math.floor(Math.random() * 10000)}`,
        title: `${d.name}: ${claim.substring(0, 60)}...`,
        snippet: `According to ${d.name}, this claim is verified through multiple sources...`,
        domain_authority: d.authority,
        site_name: d.name,
        favicon: `https://www.google.com/s2/favicons?domain=${d.domain}`
    }));
}

// ============================================
// CORE VERIFICATION FUNCTION
// ============================================
async function verifyClaim(claim, engineMode = 'standard') {
    // Check cache first
    const cacheKey = claim.toLowerCase().trim();
    if (verificationCache.has(cacheKey)) {
        const cached = verificationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
            return cached.result;
        }
    }
    
    // Check verified facts database
    if (verifiedFacts.has(cacheKey)) {
        const fact = verifiedFacts.get(cacheKey);
        return fact;
    }
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Calculate similarity with mock data
    const randomFactor = Math.random();
    let verdict, confidence, color;
    
    if (engineMode === 'deep') {
        // Deep verification - higher accuracy
        if (randomFactor > 0.85) {
            verdict = 'TRUE'; confidence = 0.92 + (Math.random() * 0.07); color = 'green';
        } else if (randomFactor > 0.65) {
            verdict = 'SUSPICIOUS'; confidence = 0.55 + (Math.random() * 0.15); color = 'yellow';
        } else {
            verdict = 'FALSE'; confidence = 0.25 + (Math.random() * 0.2); color = 'red';
        }
    } else if (engineMode === 'academic') {
        // Academic verification - strict
        if (randomFactor > 0.9) {
            verdict = 'TRUE'; confidence = 0.95 + (Math.random() * 0.04); color = 'green';
        } else if (randomFactor > 0.75) {
            verdict = 'SUSPICIOUS'; confidence = 0.6 + (Math.random() * 0.15); color = 'yellow';
        } else {
            verdict = 'FALSE'; confidence = 0.3 + (Math.random() * 0.25); color = 'red';
        }
    } else {
        // Standard verification
        if (randomFactor > 0.7) {
            verdict = 'TRUE'; confidence = 0.85 + (Math.random() * 0.1); color = 'green';
        } else if (randomFactor > 0.45) {
            verdict = 'SUSPICIOUS'; confidence = 0.5 + (Math.random() * 0.2); color = 'yellow';
        } else {
            verdict = 'FALSE'; confidence = 0.2 + (Math.random() * 0.25); color = 'red';
        }
    }
    
    const result = {
        claim: claim,
        verdict: verdict,
        confidence: parseFloat(confidence.toFixed(3)),
        color: color,
        sources: generateSources(claim),
        semantic_similarity: confidence,
        claim_type: detectClaimType(claim)
    };
    
    // Store in cache
    verificationCache.set(cacheKey, { result, timestamp: Date.now() });
    
    return result;
}

// ============================================
// DETECT CLAIM TYPE
// ============================================
function detectClaimType(claim) {
    const lowerClaim = claim.toLowerCase();
    if (lowerClaim.includes('is defined as') || lowerClaim.includes('refers to')) return 'definition';
    if (lowerClaim.includes('will') || lowerClaim.includes('would') || lowerClaim.includes('forecast')) return 'prediction';
    if (lowerClaim.includes('think') || lowerClaim.includes('believe') || lowerClaim.includes('feel')) return 'opinion';
    return 'factual';
}

// ============================================
// CALCULATE SUMMARY STATISTICS
// ============================================
function calculateSummary(results) {
    const total = results.length;
    const verified = results.filter(r => r.verdict === 'TRUE').length;
    const suspicious = results.filter(r => r.verdict === 'SUSPICIOUS').length;
    const falseClaims = results.filter(r => r.verdict === 'FALSE').length;
    
    let riskLevel = 'LOW';
    const falsePercentage = falseClaims / total;
    if (falsePercentage >= 0.5) riskLevel = 'CRITICAL';
    else if (falsePercentage >= 0.3) riskLevel = 'HIGH';
    else if (falsePercentage >= 0.1) riskLevel = 'MEDIUM';
    
    const highConfidence = results.filter(r => r.confidence >= 0.8).length;
    const mediumConfidence = results.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length;
    const lowConfidence = results.filter(r => r.confidence < 0.6).length;
    
    return {
        total_claims: total,
        verified_count: verified,
        suspicious_count: suspicious,
        false_count: falseClaims,
        risk_level: riskLevel,
        confidence_distribution: { high: highConfidence, medium: mediumConfidence, low: lowConfidence },
        top_domains: [
            { domain: 'wikipedia.org', count: Math.floor(total * 0.4) },
            { domain: 'britannica.com', count: Math.floor(total * 0.3) },
            { domain: 'reuters.com', count: Math.floor(total * 0.2) }
        ]
    };
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        version: '3.0.0',
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'TruthEngine Ultimate',
        version: '3.0.0',
        description: 'Enterprise AI Fact-Checking Platform',
        status: 'operational',
        endpoints: {
            health: 'GET /health',
            verify: 'POST /api/v1/verify',
            sync: 'POST /api/v1/verify/sync',
            async: 'POST /api/v1/verify/async',
            status: 'GET /api/v1/jobs/:jobId',
            stats: 'GET /api/v1/stats',
            cache: 'DELETE /api/v1/cache'
        }
    });
});

// Synchronous verification endpoint
app.post('/api/v1/verify', async (req, res) => {
    const startTime = Date.now();
    try {
        const { text, engine_mode = 'standard', user_id = 'anonymous' } = req.body;
        
        if (!text || text.length < 10) {
            return res.status(400).json({
                error: { code: 'INVALID_TEXT', message: 'Text must be at least 10 characters' }
            });
        }
        
        // Split text into claims
        const claims = splitIntoSentences(text);
        
        if (claims.length === 0) {
            return res.json({
                success: true,
                data: {
                    job_id: `job_${Date.now()}`,
                    status: 'completed',
                    overall_score: 100,
                    verdict: 'TRUE',
                    claims: [],
                    summary: {
                        total_claims: 0,
                        verified_count: 0,
                        suspicious_count: 0,
                        false_count: 0,
                        risk_level: 'LOW',
                        confidence_distribution: { high: 0, medium: 0, low: 0 },
                        top_domains: []
                    },
                    processing_time_ms: Date.now() - startTime
                }
            });
        }
        
        // Verify each claim
        const verificationPromises = claims.map(claim => verifyClaim(claim, engine_mode));
        const results = await Promise.all(verificationPromises);
        
        // Calculate overall score
        const overallScore = (results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100;
        
        let verdict = 'TRUE';
        if (overallScore >= 85) verdict = 'TRUE';
        else if (overallScore >= 60) verdict = 'PARTIAL';
        else if (overallScore >= 30) verdict = 'SUSPICIOUS';
        else verdict = 'FALSE';
        
        const summary = calculateSummary(results);
        
        res.json({
            success: true,
            data: {
                job_id: `job_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                status: 'completed',
                overall_score: Math.round(overallScore * 10) / 10,
                verdict: verdict,
                claims: results,
                summary: summary,
                processing_time_ms: Date.now() - startTime,
                credits_used: claims.length,
                remaining_credits: 100 - (verificationCache.size % 100)
            }
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Verification failed: ' + error.message }
        });
    }
});

// Alias for /verify
app.post('/api/v1/verify/sync', async (req, res) => {
    const startTime = Date.now();
    try {
        const { text, engine_mode = 'standard' } = req.body;
        
        if (!text || text.length < 10) {
            return res.status(400).json({
                error: { code: 'INVALID_TEXT', message: 'Text must be at least 10 characters' }
            });
        }
        
        const claims = splitIntoSentences(text);
        
        if (claims.length === 0) {
            return res.json({
                success: true,
                data: {
                    job_id: `job_${Date.now()}`,
                    status: 'completed',
                    overall_score: 100,
                    verdict: 'TRUE',
                    claims: [],
                    summary: {
                        total_claims: 0,
                        verified_count: 0,
                        suspicious_count: 0,
                        false_count: 0,
                        risk_level: 'LOW',
                        confidence_distribution: { high: 0, medium: 0, low: 0 },
                        top_domains: []
                    },
                    processing_time_ms: Date.now() - startTime
                }
            });
        }
        
        const verificationPromises = claims.map(claim => verifyClaim(claim, engine_mode));
        const results = await Promise.all(verificationPromises);
        
        const overallScore = (results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100;
        
        let verdict = 'TRUE';
        if (overallScore >= 85) verdict = 'TRUE';
        else if (overallScore >= 60) verdict = 'PARTIAL';
        else if (overallScore >= 30) verdict = 'SUSPICIOUS';
        else verdict = 'FALSE';
        
        const summary = calculateSummary(results);
        
        res.json({
            success: true,
            data: {
                job_id: `job_${Date.now()}`,
                status: 'completed',
                overall_score: Math.round(overallScore * 10) / 10,
                verdict: verdict,
                claims: results,
                summary: summary,
                processing_time_ms: Date.now() - startTime
            }
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Verification failed' }
        });
    }
});

// Asynchronous verification
app.post('/api/v1/verify/async', async (req, res) => {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Store job in memory
    const job = {
        id: jobId,
        status: 'queued',
        created_at: Date.now(),
        request: req.body
    };
    
    // Process in background (simplified for demo)
    setTimeout(async () => {
        try {
            const { text, engine_mode = 'standard' } = req.body;
            const claims = splitIntoSentences(text);
            const verificationPromises = claims.map(claim => verifyClaim(claim, engine_mode));
            const results = await Promise.all(verificationPromises);
            const overallScore = (results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100;
            
            let verdict = 'TRUE';
            if (overallScore >= 85) verdict = 'TRUE';
            else if (overallScore >= 60) verdict = 'PARTIAL';
            else if (overallScore >= 30) verdict = 'SUSPICIOUS';
            else verdict = 'FALSE';
            
            const summary = calculateSummary(results);
            
            // Store result
            jobsStore.set(jobId, {
                ...job,
                status: 'completed',
                overall_score: Math.round(overallScore * 10) / 10,
                verdict: verdict,
                claims: results,
                summary: summary,
                completed_at: Date.now()
            });
        } catch (error) {
            jobsStore.set(jobId, {
                ...job,
                status: 'failed',
                error: error.message,
                completed_at: Date.now()
            });
        }
    }, 100);
    
    jobsStore.set(jobId, job);
    
    res.json({
        success: true,
        data: {
            job_id: jobId,
            status: 'queued',
            message: 'Verification job queued',
            check_url: `/api/v1/jobs/${jobId}`
        }
    });
});

// Job status endpoint
const jobsStore = new Map();

app.get('/api/v1/jobs/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const job = jobsStore.get(jobId);
    
    if (!job) {
        return res.status(404).json({
            error: { code: 'JOB_NOT_FOUND', message: 'Job not found' }
        });
    }
    
    res.json({ success: true, data: job });
});

// Stats endpoint
app.get('/api/v1/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            total_verifications: verificationCache.size,
            cached_facts: verifiedFacts.size,
            uptime_seconds: process.uptime(),
            memory_usage: process.memoryUsage(),
            node_version: process.version
        }
    });
});

// Clear cache endpoint
app.delete('/api/v1/cache', (req, res) => {
    verificationCache.clear();
    res.json({ success: true, message: 'Cache cleared successfully' });
});

// Document verification endpoint (PDF/Text)
app.post('/api/v1/documents/upload', async (req, res) => {
    try {
        const { text, filename } = req.body;
        
        if (!text) {
            return res.status(400).json({
                error: { code: 'NO_TEXT', message: 'No text content provided' }
            });
        }
        
        const claims = splitIntoSentences(text);
        const verificationPromises = claims.slice(0, 50).map(claim => verifyClaim(claim, 'standard'));
        const results = await Promise.all(verificationPromises);
        
        const overallScore = (results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100;
        
        let verdict = 'TRUE';
        if (overallScore >= 85) verdict = 'TRUE';
        else if (overallScore >= 60) verdict = 'PARTIAL';
        else if (overallScore >= 30) verdict = 'SUSPICIOUS';
        else verdict = 'FALSE';
        
        const summary = calculateSummary(results);
        
        res.json({
            success: true,
            data: {
                document_id: `doc_${Date.now()}`,
                filename: filename || 'document.pdf',
                total_pages: 1,
                job_id: `job_${Date.now()}`,
                overall_score: Math.round(overallScore * 10) / 10,
                verdict: verdict,
                claims: results,
                summary: summary,
                processing_time_ms: Date.now() - startTime
            }
        });
    } catch (error) {
        res.status(500).json({ error: { code: 'PROCESSING_ERROR', message: error.message } });
    }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res) => {
    res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Endpoint ${req.method} ${req.url} not found` }
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
    });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, () => {
    console.log(`🚀 TruthEngine Ultimate is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 Verify endpoint: POST http://localhost:${PORT}/api/v1/verify`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
