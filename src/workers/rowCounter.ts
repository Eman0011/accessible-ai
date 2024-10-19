console.log('Row counter worker script loaded');

import Papa from 'papaparse';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

self.onmessage = (event) => {
  if (event.data.type === 'countRows') {
    const file = event.data.file;
    let rowCount = 0;
    let offset = 0;

    console.log('Worker: Starting row count', { fileName: file.name, fileSize: file.size });

    function parseChunk() {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      
      Papa.parse(chunk, {
        header: true,
        skipEmptyLines: true,
        chunk: (results) => {
          rowCount += results.data.length;
          if (rowCount % 10000 === 0) {
            console.log(`Worker: Counted ${rowCount} rows`);
            self.postMessage({ type: 'progress', count: rowCount });
          }
        },
        complete: () => {
          offset += CHUNK_SIZE;
          if (offset < file.size) {
            // Schedule the next chunk parsing
            setTimeout(parseChunk, 0);
          } else {
            console.log(`Worker: Finished counting. Total rows: ${rowCount}`);
            self.postMessage({ type: 'rowCount', count: rowCount });
          }
        },
        error: (error) => {
          console.error('Worker: Error counting rows:', error);
          self.postMessage({ type: 'error', message: error.message });
        },
      });
    }

    parseChunk();
  } else {
    console.error('Worker: Unknown message type', event.data.type);
  }
};

// Add error handling for the worker itself
self.onerror = (error) => {
  console.error('Worker: Uncaught error', error);
  self.postMessage({ type: 'error', message: 'Uncaught error in worker' });
};
