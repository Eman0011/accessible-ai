import LRUCache from 'lru-cache';
import Papa from 'papaparse';

interface CacheOptions {
  max: number;
  maxSize: number;
  ttl: number;
}

interface ParsedCSVData {
  data: any[];
  meta: Papa.ParseMeta;
  preview?: boolean;
}

const defaultOptions: CacheOptions = {
  max: 100, // Maximum number of items
  maxSize: 500 * 1024 * 1024, // 500MB total size limit
  ttl: 1000 * 60 * 10, // Items expire in 10 minutes
};

class DataCache {
  private cache: LRUCache<string, any>;
  
  constructor(options: Partial<CacheOptions> = {}) {
    const mergedOptions = { ...defaultOptions, ...options };
    
    this.cache = new LRUCache({
      max: mergedOptions.max,
      maxSize: mergedOptions.maxSize,
      ttl: mergedOptions.ttl,
      sizeCalculation: (value: any) => {
        return JSON.stringify(value).length;
      },
    });
  }

  private generateKey(path: string, options?: { preview?: boolean }): string {
    return options?.preview ? `preview:${path}` : path;
  }

  get<T>(path: string, options?: { preview?: boolean }): T | null {
    const key = this.generateKey(path, options);
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      console.debug('Cache hit for:', key);
      return value as T;
    }
    
    console.debug('Cache miss for:', key);
    return null;
  }

  set(path: string, value: any, options?: { preview?: boolean }): void {
    const key = this.generateKey(path, options);
    this.cache.set(key, value);
    console.debug('Cached data for:', key);
  }

  async getCSV(path: string, options?: { 
    preview?: boolean, 
    previewRows?: number,
    skipRows?: number 
  }): Promise<ParsedCSVData | null> {
    const key = this.generateKey(path, options);
    const cachedData = this.cache.get(key);

    if (cachedData) {
      console.debug('Cache hit for CSV:', key);
      return cachedData as ParsedCSVData;
    }

    console.debug('Cache miss for CSV:', key);
    return null;
  }

  setCSV(path: string, data: ParsedCSVData, options?: { preview?: boolean }): void {
    const key = this.generateKey(path, options);
    this.cache.set(key, data);
    console.debug('Cached CSV data for:', key);
  }

  clear(): void {
    this.cache.clear();
    console.debug('Cache cleared');
  }

  delete(path: string, options?: { preview?: boolean }): void {
    const key = this.generateKey(path, options);
    this.cache.delete(key);
    console.debug('Deleted from cache:', key);
  }
}

// Create and export a single instance
export const globalCache = new DataCache();

// Export consistent interface
export const getFromCache = <T>(path: string, options?: { preview?: boolean }): T | null => {
  return globalCache.get<T>(path, options);
};

export const setInCache = (path: string, value: any, options?: { preview?: boolean }): void => {
  globalCache.set(path, value, options);
};

export const getCSVFromCache = async (
  path: string, 
  options?: { preview?: boolean; previewRows?: number; skipRows?: number }
): Promise<ParsedCSVData | null> => {
  return globalCache.getCSV(path, options);
};

export const setCSVInCache = (
  path: string, 
  data: ParsedCSVData, 
  options?: { preview?: boolean }
): void => {
  globalCache.setCSV(path, data, options);
};

export const clearCache = (): void => {
  globalCache.clear();
};

export const deleteFromCache = (path: string, options?: { preview?: boolean }): void => {
  globalCache.delete(path, options);
};