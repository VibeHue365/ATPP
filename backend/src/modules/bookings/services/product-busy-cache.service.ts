import { Injectable } from '@nestjs/common';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class ProductBusyCacheService {
  private cache = new Map<string, CacheEntry<any>>();

  get<T = any>(productId: string): T | undefined {
    const key = productId.toString();
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T = any>(productId: string, value: T, ttlMs: number = 10_000): void {
    const key = productId.toString();
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(productId?: string): void {
    if (productId) {
      this.cache.delete(productId.toString());
    } else {
      this.cache.clear();
    }
  }

  clear(): void {
    this.cache.clear();
  }

  has(productId: string): boolean {
    const key = productId.toString();
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}
