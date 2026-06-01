import { Hono } from 'hono';
import { verifyHandler } from './verify.handler';
import { documentHandler } from './document.handler';
import { userHandler } from './user.handler';
import { orgHandler } from './org.handler';
import { billingHandler } from './billing.handler';
import { webhookHandler } from './webhook.handler';
import type { Bindings, Variables } from '../../types';

export const v1Router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

v1Router.route('/verify', verifyHandler);
v1Router.route('/documents', documentHandler);
v1Router.route('/users', userHandler);
v1Router.route('/org', orgHandler);
v1Router.route('/billing', billingHandler);
v1Router.route('/webhooks', webhookHandler);

v1Router.get('/', (c) => c.json({
  name: 'TruthEngine API v1',
  version: '1.0.0',
  endpoints: {
    verify: { sync: 'POST /v1/verify/sync', async: 'POST /v1/verify/async', batch: 'POST /v1/verify/batch' },
    documents: { upload: 'POST /v1/documents/upload', list: 'GET /v1/documents', get: 'GET /v1/documents/:id' },
    users: { me: 'GET /v1/users/me', apiKeys: 'GET/POST/DELETE /v1/users/api-keys' },
    org: { info: 'GET /v1/org', update: 'PATCH /v1/org', members: 'GET /v1/org/members', invite: 'POST /v1/org/invite' },
    billing: { subscription: 'GET /v1/billing/subscription', invoices: 'GET /v1/billing/invoices' },
    webhooks: { configure: 'POST /v1/webhooks', list: 'GET /v1/webhooks', delete: 'DELETE /v1/webhooks/:id' }
  }
}));
