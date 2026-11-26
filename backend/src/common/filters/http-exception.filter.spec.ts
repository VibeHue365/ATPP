import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ErrorCode } from '../exceptions/error-code';

describe('HttpExceptionFilter', () => {
  it('formats known auth errors with a stable error code', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = createHost(status, '/auth/verify-email');

    new HttpExceptionFilter().catch(
      new BadRequestException('OTP is incorrect'),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        errorCode: ErrorCode.InvalidOtp,
        message: 'OTP is incorrect',
        path: '/auth/verify-email',
      }),
    );
  });

  it('joins validation messages and marks them as validation errors', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = createHost(status, '/auth/register');

    new HttpExceptionFilter().catch(
      new BadRequestException({
        message: ['email must be an email', 'password must be longer'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        errorCode: ErrorCode.ValidationError,
        message: 'email must be an email; password must be longer',
        path: '/auth/register',
      }),
    );
  });

  it('does not expose unexpected internal exception details', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = createHost(status, '/unexpected-error');
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    try {
      new HttpExceptionFilter().catch(
        new Error('Sensitive implementation detail'),
        host,
      );
    } finally {
      consoleError.mockRestore();
    }

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode.InternalError,
        message: 'Internal server error',
        path: '/unexpected-error',
      }),
    );
  });

  it('preserves safe operational messages for unavailable services', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = createHost(status, '/provider-verifications/id/ocr');

    new HttpExceptionFilter().catch(
      new ServiceUnavailableException(
        'Dịch vụ OCR tạm thời không khả dụng. Vui lòng thử lại sau.',
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Dịch vụ OCR tạm thời không khả dụng. Vui lòng thử lại sau.',
      }),
    );
  });
});

function createHost(status: jest.Mock, originalUrl: string): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ originalUrl }),
    }),
  } as unknown as ArgumentsHost;
}
