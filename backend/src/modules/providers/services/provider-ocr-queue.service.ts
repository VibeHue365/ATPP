import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { ProviderDocumentOcrService } from './provider-document-ocr.service';

export interface ProviderOcrJobData { verificationId: string; documentType: string; versionNo: number; attemptId: string; operationId: string; }
export const PROVIDER_OCR_QUEUE = 'provider-document-ocr';

@Injectable()
export class ProviderOcrQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderOcrQueueService.name);
  private queue?: Queue<ProviderOcrJobData>;
  private worker?: Worker<ProviderOcrJobData>;
  constructor(private readonly config: ConfigService, private readonly processor: ProviderDocumentOcrService) {}
  async onModuleInit(): Promise<void> {
    if (!this.enabled()) return;
    const connection = this.connection();
    this.queue = new Queue(PROVIDER_OCR_QUEUE, { connection });
    if (this.config.get<string>('OCR_V2_WORKER_ENABLED', 'false') !== 'true') return;
    this.worker = new Worker(PROVIDER_OCR_QUEUE, async (job) => this.processor.process(job.data, job.attemptsMade + 1 < (job.opts.attempts ?? 1)), { connection, concurrency: this.number('OCR_WORKER_CONCURRENCY', 1) });
    this.worker.on('failed', (job, error) => this.logger.error(`OCR job ${job?.id ?? 'unknown'} failed: ${error.message}`));
    await this.worker.waitUntilReady();
  }
  async onModuleDestroy(): Promise<void> { await this.worker?.close(); await this.queue?.close(); }
  async enqueue(data: ProviderOcrJobData): Promise<string> {
    if (!this.queue) throw new Error('OCR queue is disabled');
    const job = await this.queue.add('recognize', data, { jobId: this.jobId(data), attempts: this.number('OCR_MAX_RETRIES', 2) + 1, backoff: { type: 'exponential', delay: this.number('OCR_RETRY_DELAY_MS', 2000) }, removeOnComplete: 500, removeOnFail: 1000 });
    return String(job.id);
  }
  jobId(data: ProviderOcrJobData): string { return `ocr-${data.verificationId}-${data.documentType}-${data.versionNo}-${data.attemptId}`; }
  private enabled(): boolean { return this.config.get<string>('OCR_V2_ENABLED', 'false') === 'true'; }
  private connection() { const url = new URL(this.config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379')); return { host: url.hostname, port: Number(url.port || '6379'), username: url.username || undefined, password: url.password || undefined, maxRetriesPerRequest: null }; }
  private number(key: string, fallback: number): number { const value = Number(this.config.get<string>(key, String(fallback))); return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback; }
}