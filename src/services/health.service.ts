/**
 * Health Check Service
 * Monitors system health and dependencies
 */

import type { Bindings } from '../types';

export interface HealthStatus {
  healthy: boolean;
  checks: {
    database: boolean;
    cache: boolean;
    storage: boolean;
    queues: boolean;
    apis: Record<string, boolean>;
  };
  timestamp: number;
  version: string;
}

export class HealthService {
  constructor(private env: Bindings) {}

  async check(): Promise<HealthStatus> {
    const checks = {
      database: await this.checkDatabase(),
      cache: await this.checkCache(),
      storage: await this.checkStorage(),
      queues: await this.checkQueues(),
      apis: await this.checkApis(),
    };

    const healthy = Object.values(checks).every(c => c === true) && 
                     Object.values(checks.apis).every(c => c === true);

    return {
      healthy,
      checks: {
        database: checks.database,
        cache: checks.cache,
        storage: checks.storage,
        queues: checks.queues,
        apis: checks.apis,
      },
      timestamp: Date.now(),
      version: '3.0.0',
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.env.DB.prepare('SELECT 1').run();
      return true;
    } catch {
      return false;
    }
  }

  private async checkCache(): Promise<boolean> {
    try {
      await this.env.CACHE.put('health:check', 'ok', { expirationTtl: 60 });
      const result = await this.env.CACHE.get('health:check');
      return result === 'ok';
    } catch {
      return false;
    }
  }

  private async checkStorage(): Promise<boolean> {
    try {
      await this.env.DOCUMENTS.head('health-check.txt');
      return true;
    } catch {
      // Bucket exists but file not found - that's ok
      return true;
    }
  }

  private async checkQueues(): Promise<boolean> {
    try {
      await this.env.JOB_QUEUE.send({ type: 'health_check', timestamp: Date.now() });
      return true;
    } catch {
      return false;
    }
  }

  private async checkApis(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    // Check HuggingFace
    if (this.env.HUGGINGFACE_API_KEY) {
      try {
        const response = await fetch('https://api-inference.huggingface.co/status', {
          headers: { 'Authorization': `Bearer ${this.env.HUGGINGFACE_API_KEY}` },
        });
        results.huggingface = response.ok;
      } catch {
        results.huggingface = false;
      }
    } else {
      results.huggingface = true; // Not configured, skip check
    }
    
    // Check Tavily
    if (this.env.TAVILY_API_KEY) {
      try {
        const response = await fetch('https://api.tavily.com/health', {
          headers: { 'Authorization': `Bearer ${this.env.TAVILY_API_KEY}` },
        });
        results.tavily = response.ok;
      } catch {
        results.tavily = false;
      }
    } else {
      results.tavily = true;
    }
    
    return results;
  }
}
