import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  sub: string;
  email: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
