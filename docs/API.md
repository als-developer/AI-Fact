# TruthEngine Ultimate API Documentation

## Base URL
- Production: `https://api.truthengine.ai/v1`
- Staging: `https://staging.truthengine.ai/v1`

## Authentication
- Bearer Token: `Authorization: Bearer <jwt_token>`
- API Key: `X-API-Key: <api_key>`

## Endpoints

### POST /verify/sync - Synchronous verification
**Request:** `{ "text": "string", "engine_mode": "standard|deep|academic", "threshold": 0.75 }`
**Response:** `{ "success": true, "data": { "job_id": "string", "overall_score": 85.5, "verdict": "TRUE", "claims": [...] } }`

### POST /verify/async - Asynchronous verification
**Request:** Same as sync
**Response:** `{ "success": true, "data": { "job_id": "string", "status": "queued" } }`

### GET /jobs/:jobId - Get job status
**Response:** `{ "success": true, "data": { "status": "completed", "overall_score": 85.5 } }`

### POST /documents/upload - Upload PDF for verification
**Request:** multipart/form-data with file field
**Response:** `{ "success": true, "data": { "document_id": "string", "job_id": "string" } }`

### GET /org - Get organization info
**Response:** `{ "success": true, "data": { "name": "string", "plan": "pro", "remaining_credits": 500 } }`

### GET /org/members - List team members
**Response:** `{ "success": true, "data": [{ "email": "string", "role": "admin" }] }`

### POST /org/invite - Invite team member
**Request:** `{ "email": "string", "role": "admin|member" }`

### GET /billing/subscription - Get subscription details
**Response:** `{ "success": true, "data": { "plan": "pro", "status": "active", "remaining": 500 } }`

### GET /users/api-keys - List API keys
### POST /users/api-keys - Create API key
### DELETE /users/api-keys/:keyId - Delete API key

## Rate Limits
| Plan | Requests/Minute | Monthly Verifications |
|------|----------------|----------------------|
| Free | 20 | 100 |
| Pro | 100 | 1,000 |
| Business | 500 | 10,000 |
| Enterprise | Custom | Unlimited |

## Error Codes
| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |
