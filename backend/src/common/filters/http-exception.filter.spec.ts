import { ArgumentsHost, BadRequestException } from '@nestjs/common';
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
});

function createHost(
  status: jest.Mock,
  originalUrl: string,
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ originalUrl }),
    }),
  } as unknown as ArgumentsHost;
}
