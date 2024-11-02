class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      console.log('Cache miss for:', key);
      return undefined;
    }
    
    // Remove & re-add to put it at the end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value!);
    return value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove the first item (least recently used)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Create a global instance with a capacity of 50 items
export const globalS3Cache = new LRUCache<string, any>(20); 