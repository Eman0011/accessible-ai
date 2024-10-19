console.log('Row counter worker script loaded');

import Papa from 'papaparse';

self.onmessage = (event) => {
  if (event.data.type === 'countRows') {
    const file = event.data.file;
    let rowCount = 0;

    console.log('Worker: Starting row count', { fileName: file.name, fileSize: file.size });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      step: () => {
        rowCount++;
        if (rowCount % 1000 === 0) {
          console.log(`Worker: Counted ${rowCount} rows`);
          self.postMessage({ type: 'progress', count: rowCount });
        }
      },
      complete: () => {
        console.log(`Worker: Finished counting. Total rows: ${rowCount}`);
        self.postMessage({ type: 'rowCount', count: rowCount });
      },
      error: (error) => {
        console.error('Worker: Error counting rows:', error);
        self.postMessage({ type: 'error', message: error.message });
      },
    });
  } else {
    console.error('Worker: Unknown message type', event.data.type);
  }
};

// Add error handling for the worker itself
self.onerror = (error) => {
  console.error('Worker: Uncaught error', error);
  self.postMessage({ type: 'error', message: 'Uncaught error in worker' });
};
