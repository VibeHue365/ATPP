import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

interface RequestLogSink {
  log(message: string): void;
}

/** Log route metadata only. Untrusted URL/query/header values may contain credentials. */
export function requestLogger(logger: RequestLogSink) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const user: unknown = request.user;
      const userId =
        user !== null &&
        typeof user === 'object' &&
        'sub' in user &&
        typeof user.sub === 'string'
          ? user.sub
          : null;
      const route = request.route as { path?: unknown } | undefined;
      logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          route: typeof route?.path === 'string' ? route.path : '<unmatched>',
          statusCode: response.statusCode,
          responseTime: Date.now() - startedAt,
          userId,
        }),
      );
    });

    next();
  };
}
