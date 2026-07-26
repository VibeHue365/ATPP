import { Injectable } from '@nestjs/common';
import { PolicyCode } from '../constants/policy-code.enum';

@Injectable()
export class PolicyActivationLockService {
  private readonly locks = new Map<PolicyCode, string>();

  acquire(code: PolicyCode, actorId: string): boolean {
    if (this.locks.has(code)) {
      return false;
    }

    this.locks.set(code, actorId);
    return true;
  }

  release(code: PolicyCode, actorId: string): void {
    if (this.locks.get(code) === actorId) {
      this.locks.delete(code);
    }
  }

  async runWithLock<T>(
    code: PolicyCode,
    actorId: string,
    callback: () => Promise<T>,
  ): Promise<T | null> {
    if (!this.acquire(code, actorId)) {
      return null;
    }

    try {
      return await callback();
    } finally {
      this.release(code, actorId);
    }
  }
}
