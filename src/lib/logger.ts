/**
 * Logger utility for consistent logging across services
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Set minimum log level from environment or default to 'info'
const MIN_LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';
const minLevel = LOG_LEVELS[MIN_LOG_LEVEL];

// ANSI color codes for console output
const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m'  // Red
};

/**
 * Format a log message with timestamp and service name
 */
function formatMessage(level: LogLevel, message: string, service?: string): string {
  const timestamp = new Date().toISOString();
  const serviceStr = service ? `[${service}] ` : '';
  return `${timestamp} ${level.toUpperCase()} ${serviceStr}${message}`;
}

/**
 * Log to console with color based on level
 */
function logToConsole(level: LogLevel, message: string, service?: string): void {
  if (LOG_LEVELS[level] >= minLevel) {
    const formattedMessage = formatMessage(level, message, service);
    console.log(`${COLORS[level]}${formattedMessage}${COLORS.reset}`);
  }
}

/**
 * Logger instance
 */
export const logger = {
  debug: (message: string, ...args: any[]) => {
    logToConsole('debug', `${message} ${args.length ? JSON.stringify(args) : ''}`);
  },
  
  info: (message: string, ...args: any[]) => {
    logToConsole('info', `${message} ${args.length ? JSON.stringify(args) : ''}`);
  },
  
  warn: (message: string, ...args: any[]) => {
    logToConsole('warn', `${message} ${args.length ? JSON.stringify(args) : ''}`);
  },
  
  error: (message: string, error?: any) => {
    let errorStr = '';
    if (error) {
      if (error instanceof Error) {
        errorStr = ` ${error.message}\n${error.stack}`;
      } else {
        errorStr = ` ${JSON.stringify(error)}`;
      }
    }
    logToConsole('error', `${message}${errorStr}`);
  },
  
  /**
   * Create a logger with a specific service name
   */
  forService: (serviceName: string) => ({
    debug: (message: string, ...args: any[]) => {
      logToConsole('debug', `${message} ${args.length ? JSON.stringify(args) : ''}`, serviceName);
    },
    
    info: (message: string, ...args: any[]) => {
      logToConsole('info', `${message} ${args.length ? JSON.stringify(args) : ''}`, serviceName);
    },
    
    warn: (message: string, ...args: any[]) => {
      logToConsole('warn', `${message} ${args.length ? JSON.stringify(args) : ''}`, serviceName);
    },
    
    error: (message: string, error?: any) => {
      let errorStr = '';
      if (error) {
        if (error instanceof Error) {
          errorStr = ` ${error.message}\n${error.stack}`;
        } else {
          errorStr = ` ${JSON.stringify(error)}`;
        }
      }
      logToConsole('error', `${message}${errorStr}`, serviceName);
    }
  })
};
