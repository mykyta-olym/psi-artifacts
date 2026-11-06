// Production-safe logger utility
const isDevelopment = import.meta.env.MODE === 'development';

class Logger {
  constructor(namespace) {
    this.namespace = namespace;
  }

  debug(...args) {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.log(`[${this.namespace}]`, ...args);
    }
  }

  info(...args) {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.info(`[${this.namespace}]`, ...args);
    }
  }

  warn(...args) {
    // eslint-disable-next-line no-console
    console.warn(`[${this.namespace}]`, ...args);
  }

  error(...args) {
    // eslint-disable-next-line no-console
    console.error(`[${this.namespace}]`, ...args);
  }
}

export const createLogger = (namespace) => new Logger(namespace);
export default Logger;
