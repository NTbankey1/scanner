export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

const LOG_LEVEL_KEY = 'dss:loglevel';

class Logger {
  private level: LogLevel = LogLevel.Info;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Debug) {
      console.debug(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  info(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Info) {
      console.info(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  warn(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Warn) {
      console.warn(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  error(tag: string, message: string, data?: Record<string, unknown>): void {
    if (this.level <= LogLevel.Error) {
      console.error(`[DSS:${tag}]`, message, data ?? '');
    }
  }

  async persistLevel(): Promise<void> {
    try {
      await chrome.storage.local.set({ [LOG_LEVEL_KEY]: this.level });
    } catch {
      // Storage not available in test environment
    }
  }

  async loadLevel(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(LOG_LEVEL_KEY);
      if (result[LOG_LEVEL_KEY] !== undefined) {
        this.level = result[LOG_LEVEL_KEY] as LogLevel;
      }
    } catch {
      // Storage not available in test environment
    }
  }
}

export const logger = new Logger();
