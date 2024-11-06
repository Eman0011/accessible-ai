import { LRUCache } from 'lru-cache';

const options = {
  max: 100, // Maximum number of items
  maxSize: 500 * 1024 * 1024, // 500MB total size limit
  sizeCalculation: (value: any) => {
    // Rough estimation of object size in bytes
    return JSON.stringify(value).length;
  },
  ttl: 1000 * 60 * 10, // Items expire in 10 minutes
};

// Create a single instance of the LRU cache
export const globalS3Cache = new LRUCache(options);

// Export consistent interface
export const getFromCache = (key: string): any => {
  const value = globalS3Cache.get(key);
  if (value !== undefined) {
    console.debug('Cache hit for:', key);
    return value;
  }
  console.debug('Cache miss for:', key);
  return null;
};

export const setInCache = (key: string, value: any): void => {
  globalS3Cache.set(key, value);
  console.debug('Cached data for:', key);
};