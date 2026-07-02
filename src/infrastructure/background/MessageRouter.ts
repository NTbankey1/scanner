import { CrawlScheduler } from './CrawlScheduler';
import { logger } from '../../shared/logger';

type MessageHandler = (message: any, sender: chrome.runtime.MessageSender) => Promise<any>;

export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();

  constructor(
    private scheduler: CrawlScheduler,
  ) {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    this.register('start-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'START', jobId: msg.jobId, config: msg.config });
      return { success: true };
    });
    this.register('pause-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'PAUSE', jobId: msg.jobId });
      return { success: true };
    });
    this.register('resume-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'RESUME', jobId: msg.jobId });
      return { success: true };
    });
    this.register('cancel-crawl', async (msg) => {
      await this.scheduler.handleCommand({ type: 'CANCEL', jobId: msg.jobId });
      return { success: true };
    });
    this.register('get-status', async () => {
      const job = this.scheduler.getCurrentJob();
      return { job: job ? job.toJSON() : null };
    });
  }

  register(action: string, handler: MessageHandler): void {
    this.handlers.set(action, handler);
  }

  async route(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const handler = this.handlers.get(message.action);
    if (!handler) {
      logger.warn('MessageRouter', `No handler for action: ${message.action}`);
      return { error: `Unknown action: ${message.action}` };
    }
    try {
      return await handler(message, sender);
    } catch (err) {
      logger.error('MessageRouter', `Handler error for ${message.action}`, { error: String(err) });
      return { error: String(err) };
    }
  }
}
