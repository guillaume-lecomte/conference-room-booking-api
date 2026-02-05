import { InMemoryCache } from '../../src/infrastructure/cache/InMemoryCache';

// Disable logging in tests
jest.mock('../../src/infrastructure/logging/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache(60); // 60 seconds default TTL
  });

  afterEach(() => {
    cache.shutdown();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      await cache.set('key1', { data: 'test' });
      const result = await cache.get('key1');
      expect(result).toEqual({ data: 'test' });
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      await cache.set('key2', 'value', 0.001); // 1ms TTL
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await cache.get('key2');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await cache.set('key3', 'value');
      const deleted = await cache.delete('key3');
      expect(deleted).toBe(true);
      expect(await cache.get('key3')).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await cache.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', async () => {
      await cache.set('user:1', 'data1');
      await cache.set('user:2', 'data2');
      await cache.set('other:1', 'data3');

      const count = await cache.deletePattern('user:*');
      
      expect(count).toBe(2);
      expect(await cache.get('user:1')).toBeNull();
      expect(await cache.get('user:2')).toBeNull();
      expect(await cache.get('other:1')).toEqual('data3');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await cache.set('key4', 'value');
      expect(await cache.exists('key4')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await cache.exists('non-existent')).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should return remaining TTL', async () => {
      await cache.set('key5', 'value', 60);
      const ttl = await cache.ttl('key5');
      expect(ttl).toBeGreaterThan(50);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should return -2 for non-existent key', async () => {
      const ttl = await cache.ttl('non-existent');
      expect(ttl).toBe(-2);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await cache.set('key6', 'value1');
      await cache.set('key7', 'value2');
      
      await cache.clear();
      
      expect(await cache.get('key6')).toBeNull();
      expect(await cache.get('key7')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await cache.set('key8', 'value1');
      await cache.set('key9', 'value2');

      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key8');
      expect(stats.keys).toContain('key9');
    });
  });
});
