import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode } from '../exceptions/error-code';

interface ErrorResponseBody {
  statusCode?: number;
  errorCode?: ErrorCode;
  message?: string | string[];
  error?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.getExceptionBody(exception);
    const message = this.normalizeMessage(body);

    response.status(statusCode).json({
      statusCode,
      errorCode:
        body.errorCode ?? this.inferErrorCode(statusCode, message, body.error),
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    });
  }

  private getExceptionBody(exception: unknown): ErrorResponseBody {
    if (!(exception instanceof HttpException)) {
      return { message: 'Internal server error' };
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { message: response };
    }

    return response as ErrorResponseBody;
  }

  private normalizeMessage(body: ErrorResponseBody): string {
    if (Array.isArray(body.message)) {
      return body.message.join('; ');
    }

    return body.message ?? body.error ?? 'Internal server error';
  }

  private inferErrorCode(
    statusCode: number,
    message: string,
    error?: string,
  ): ErrorCode {
    const normalized = `${message} ${error ?? ''}`.toLowerCase();

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return ErrorCode.RateLimitExceeded;
    }
    if (statusCode === HttpStatus.NOT_FOUND) {
      return ErrorCode.NotFound;
    }
    if (normalized.includes('email already exists')) {
      return ErrorCode.EmailAlreadyExists;
    }
    if (normalized.includes('phone already exists')) {
      return ErrorCode.PhoneAlreadyExists;
    }
    if (
      normalized.includes('invalid email or password') ||
      normalized.includes('email hoặc mật khẩu không chính xác')
    ) {
      return ErrorCode.InvalidCredentials;
    }
    if (normalized.includes('email is not verified')) {
      return ErrorCode.EmailNotVerified;
    }
    if (
      normalized.includes('account is not active') ||
      normalized.includes('user is not active')
    ) {
      return ErrorCode.AccountDisabled;
    }
    if (normalized.includes('otp attempt limit exceeded')) {
      return ErrorCode.OtpMaxAttemptsExceeded;
    }
    if (normalized.includes('otp is expired')) {
      return ErrorCode.OtpExpired;
    }
    if (
      normalized.includes('otp is incorrect') ||
      normalized.includes('invalid verification request')
    ) {
      return ErrorCode.InvalidOtp;
    }
    if (normalized.includes('refresh token is invalid')) {
      return ErrorCode.InvalidRefreshToken;
    }
    if (normalized.includes('session is expired or revoked')) {
      return ErrorCode.SessionRevoked;
    }
    if (normalized.includes('oauth state')) {
      return ErrorCode.InvalidOAuthState;
    }
    if (normalized.includes('oauth code')) {
      return ErrorCode.InvalidOAuthCode;
    }
    if (
      normalized.includes('last admin') ||
      normalized.includes('last admin role') ||
      normalized.includes('last admin account')
    ) {
      return ErrorCode.LastActiveAdminProtected;
    }
    if (statusCode === HttpStatus.FORBIDDEN) {
      return ErrorCode.PermissionDenied;
    }
    if (statusCode === HttpStatus.BAD_REQUEST) {
      return ErrorCode.ValidationError;
    }

    return ErrorCode.InternalError;
  }
}
