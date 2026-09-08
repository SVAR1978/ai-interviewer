import Redis from 'ioredis';
import { config } from '../config/env';

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const url = config.redisURL?.trim();
    if (!url) {
      console.log('[RedisService] No REDIS_URL configured. Operating in direct MongoDB mode.');
      return;
    }

    try {
      const isTLS = url.startsWith('rediss://');
      this.client = new Redis(url, {
        connectTimeout: 10000,
        keepAlive: 10000, // Send TCP keepalive every 10s to prevent Upstash idle drops
        family: 4, // Use IPv4
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false, // Immediately fallback to MongoDB if Redis is momentarily reconnecting
        retryStrategy: (times) => {
          // Keep reconnecting with exponential backoff (max 3s)
          return Math.min(times * 200, 3000);
        },
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
        tls: isTLS ? { rejectUnauthorized: false } : undefined,
      });

      let hasLoggedSuccess = false;

      this.client.on('connect', () => {
        if (!hasLoggedSuccess) {
          console.log('[RedisService] Connected to Upstash Redis!');
          hasLoggedSuccess = true;
        }
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        // Log cleanly without crashing
        console.warn('[RedisService] Redis notice:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('[RedisService] Failed to initialize Redis client:', err?.message);
      this.client = null;
      this.isConnected = false;
    }
  }

  public isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  // --- Session Q&A Transcript Caching (TTL: 2 hours by default) ---

  public async getSessionQA(username: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.get(`interview:qa:${username}`);
    } catch (err) {
      console.warn('[RedisService] Error getting session QA:', err);
      return null;
    }
  }

  public async setSessionQA(username: string, qa: string, ttlSeconds: number = 7200): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.set(`interview:qa:${username}`, qa, 'EX', ttlSeconds);
    } catch (err) {
      console.warn('[RedisService] Error setting session QA:', err);
    }
  }

  public async appendSessionAnswer(username: string, qIndex: number, answer: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      const key = `interview:qa:${username}`;
      const toAppend = `\nA${qIndex}: ${answer}`;
      // Append string in Redis memory with O(1) complexity
      await this.client!.append(key, toAppend);
      // Refresh TTL to 2 hours
      await this.client!.expire(key, 7200);
      return await this.client!.get(key);
    } catch (err) {
      console.warn('[RedisService] Error appending answer to Redis:', err);
      return null;
    }
  }

  // --- Session Question Number Caching ---

  public async getQuestionNo(username: string): Promise<number | null> {
    if (!this.isAvailable()) return null;
    try {
      const val = await this.client!.get(`interview:qno:${username}`);
      return val !== null ? parseInt(val, 10) : null;
    } catch (err) {
      console.warn('[RedisService] Error getting question number from Redis:', err);
      return null;
    }
  }

  public async setQuestionNo(username: string, qno: number, ttlSeconds: number = 7200): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.set(`interview:qno:${username}`, qno.toString(), 'EX', ttlSeconds);
    } catch (err) {
      console.warn('[RedisService] Error setting question number in Redis:', err);
    }
  }

  public async clearInterviewSession(username: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.del(`interview:qa:${username}`, `interview:qno:${username}`);
    } catch (err) {
      console.warn('[RedisService] Error clearing interview session from Redis:', err);
    }
  }

  // --- Score History Caching (TTL: 10 minutes) ---

  public async getScoreHistoryCache(username: string): Promise<any | null> {
    if (!this.isAvailable()) return null;
    try {
      const cached = await this.client!.get(`score:history:${username}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.warn('[RedisService] Error reading score history cache:', err);
      return null;
    }
  }

  public async setScoreHistoryCache(username: string, data: any, ttlSeconds: number = 600): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.set(`score:history:${username}`, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (err) {
      console.warn('[RedisService] Error writing score history cache:', err);
    }
  }

  public async invalidateScoreHistory(username: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.del(`score:history:${username}`);
    } catch (err) {
      console.warn('[RedisService] Error invalidating score history cache:', err);
    }
  }
}

export const redisService = new RedisService();
