import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  function context(user?: { roles: string[] }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it('allows routes without role metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    expect(
      new RolesGuard(reflector as unknown as Reflector).canActivate(context()),
    ).toBe(true);
  });

  it('allows a user with any required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'PROVIDER']),
    };
    expect(
      new RolesGuard(reflector as unknown as Reflector).canActivate(
        context({ roles: ['CUSTOMER', 'PROVIDER'] }),
      ),
    ).toBe(true);
  });

  it.each([undefined, { roles: [] }, { roles: ['CUSTOMER'] }])(
    'rejects a user without the required role',
    (user) => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
      };
      expect(() =>
        new RolesGuard(reflector as unknown as Reflector).canActivate(
          context(user),
        ),
      ).toThrow(ForbiddenException);
    },
  );
});
