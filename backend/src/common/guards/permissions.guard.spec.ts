import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

const createContext = (permissions: string[]): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { permissions } }),
    }),
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  it('allows a read-only admin to access a read route', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['user:read']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(createContext(['user:read']))).toBe(true);
  });

  it('blocks a read-only admin from a manage route', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['user:manage']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(createContext(['user:read']))).toThrow(
      ForbiddenException,
    );
  });
});
