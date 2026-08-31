import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { MailService } from './mail.service';

export interface EmailVerificationJobData {
  userId: string;
  verificationTokenId: string;
  email: string;
  otp: string;
}

export const AUTH_EMAIL_QUEUE = 'auth-email';

@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name);
  private queue?: Queue<EmailVerificationJobData>;
  private worker?: Worker<EmailVerificationJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.enabled()) return;

    const connection = this.connection();
    this.queue = new Queue(AUTH_EMAIL_QUEUE, { connection });

    if (
      this.config.get<string>('AUTH_EMAIL_WORKER_ENABLED', 'true') !== 'true'
    ) {
      return;
    }

    this.worker = new Worker(
      AUTH_EMAIL_QUEUE,
      async (job) => {
        await this.mailService.sendEmailVerificationOtp(
          job.data.email,
          job.data.otp,
        );
      },
      {
        connection,
        concurrency: this.number('AUTH_EMAIL_WORKER_CONCURRENCY', 2),
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Email verification job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Email queue error: ${error.message}`);
    });
    await this.worker.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueVerificationOtp(
    data: EmailVerificationJobData,
  ): Promise<string> {
    if (!this.queue) {
      throw new Error('Email queue is disabled');
    }

    const job = await this.queue.add('send-verification-otp', data, {
      jobId: this.jobId(data),
      attempts: this.number('AUTH_EMAIL_MAX_RETRIES', 3) + 1,
      backoff: {
        type: 'exponential',
        delay: this.number('AUTH_EMAIL_RETRY_DELAY_MS', 3000),
      },
      removeOnComplete: true,
      removeOnFail: true,
    });

    return String(job.id);
  }

  jobId(data: EmailVerificationJobData): string {
    return `verification-${data.userId}-${data.verificationTokenId}`;
  }

  private enabled(): boolean {
    return (
      this.config.get<string>('AUTH_EMAIL_QUEUE_ENABLED', 'true') === 'true'
    );
  }

  private connection() {
    const url = new URL(
      this.config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379'),
    );
    return {
      host: url.hostname,
      port: Number(url.port || '6379'),
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  }

  private number(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
}
