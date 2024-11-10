// Configure logging based on environment
const configureLogging = (context: 'main' | 'worker' = 'main') => {
  if (process.env.NODE_ENV === 'development') {
    // Enable debug logging in development
    if (context === 'main') {
      localStorage.setItem('debug', '*');
    }
    
    // Set up debug log styling
    const debugStyle = 'color: #666; font-style: italic;';
    const errorStyle = 'color: #ff0000; font-weight: bold;';
    
    // Get the appropriate console object
    const consoleObj = context === 'worker' ? self.console : window.console;
    
    // Store original console methods
    const originalDebug = consoleObj.debug;
    const originalError = consoleObj.error;
    const originalLog = consoleObj.log;
    const originalInfo = consoleObj.info;
    
    // Override console methods to add styling in development
    consoleObj.debug = (...args) => {
      originalDebug.apply(consoleObj, ['%c[DEBUG]', debugStyle, ...args]);
    };
    
    consoleObj.error = (...args) => {
      originalError.apply(consoleObj, ['%c[ERROR]', errorStyle, ...args]);
    };

    // Redirect log and info to debug in development
    consoleObj.log = (...args) => {
      consoleObj.debug(...args);
    };

    consoleObj.info = (...args) => {
      consoleObj.debug(...args);
    };

    // Replace global console with our configured version
    if (context === 'worker') {
      self.console = consoleObj;
    } else {
      window.console = consoleObj;
    }
  }
};

export default configureLogging; 