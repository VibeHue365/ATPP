import { Controller, Get } from '@nestjs/common';

@Controller('docs/auth-users')
export class ApiDocsController {
  @Get('openapi.json')
  openApi(): Record<string, unknown> {
    return {
      openapi: '3.0.0',
      info: {
        title: 'VibeHue Auth and Users API',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      paths: {
        '/auth/register': { post: { summary: 'Register local account' } },
        '/auth/verify-email': { post: { summary: 'Verify email OTP' } },
        '/auth/resend-verification': {
          post: { summary: 'Resend email verification OTP' },
        },
        '/auth/login': { post: { summary: 'Login with email and password' } },
        '/auth/refresh-token': { post: { summary: 'Rotate refresh token' } },
        '/auth/oauth/exchange': {
          post: { summary: 'Exchange Google OAuth code for JWT session' },
        },
        '/auth/logout': {
          post: {
            summary: 'Logout current session',
            security: [{ bearerAuth: [] }],
          },
        },
        '/auth/change-password': {
          post: {
            summary: 'Change current user password',
            security: [{ bearerAuth: [] }],
          },
        },
        '/auth/forgot-password': {
          post: { summary: 'Request password reset link' },
        },
        '/auth/reset-password': { post: { summary: 'Reset password' } },
        '/auth/google': { get: { summary: 'Start Google OAuth login' } },
        '/auth/google/callback': {
          get: { summary: 'Google OAuth callback with state validation' },
        },
        '/auth/me/permissions': {
          get: {
            summary: 'Get current user roles and permissions',
            security: [{ bearerAuth: [] }],
          },
        },
        '/users/me': {
          get: {
            summary: 'Get current user profile',
            security: [{ bearerAuth: [] }],
          },
          patch: {
            summary: 'Update current user profile',
            security: [{ bearerAuth: [] }],
          },
        },
        '/users/me/avatar': {
          patch: {
            summary: 'Upload current user avatar',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/users': {
          get: {
            summary: 'Admin list users, requires ADMIN and user:read',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/users/{id}': {
          get: {
            summary: 'Admin get user detail, requires ADMIN and user:read',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/users/{id}/roles': {
          patch: {
            summary: 'Admin update user roles, requires user:manage and reason',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/users/{id}/status': {
          patch: {
            summary:
              'Admin update user status, requires user:manage and reason',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/users/{id}/lock': {
          patch: {
            summary: 'Admin lock user, requires user:manage and reason',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/users/{id}/unlock': {
          patch: {
            summary: 'Admin unlock user, requires user:manage and reason',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/roles': {
          get: {
            summary: 'Admin list roles, requires role:read',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/permissions': {
          get: {
            summary: 'Admin list permissions, requires permission:read',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/roles/{code}/permissions': {
          patch: {
            summary:
              'Admin update role permissions, requires role:manage, permission:manage and reason',
            security: [{ bearerAuth: [] }],
          },
        },
        '/categories': {
          get: {
            summary:
              'Public list active service categories with optional type, parentId, keyword and includeTree',
          },
        },
        '/categories/{identifier}': {
          get: {
            summary: 'Public get active category by Mongo id or slug',
          },
        },
        '/admin/categories': {
          get: {
            summary: 'Admin list service categories, requires category:read',
            security: [{ bearerAuth: [] }],
          },
          post: {
            summary: 'Admin create service category, requires category:manage',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/categories/reorder': {
          patch: {
            summary:
              'Admin reorder service categories, requires category:manage',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/categories/{id}': {
          get: {
            summary: 'Admin get service category detail, requires category:read',
            security: [{ bearerAuth: [] }],
          },
          patch: {
            summary: 'Admin update service category, requires category:manage',
            security: [{ bearerAuth: [] }],
          },
          delete: {
            summary: 'Admin soft delete service category, requires category:manage',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/categories/{id}/status': {
          patch: {
            summary:
              'Admin update service category status, requires category:manage',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/system/policies': {
          get: {
            summary: 'Admin list system policies, requires system:read',
            security: [{ bearerAuth: [] }],
          },
          post: {
            summary: 'Admin create DRAFT system policy, requires system:manage',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/system/policies/code/{code}': {
          get: {
            summary:
              'Admin list all versions for a policy code, requires system:read',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/system/policies/{id}': {
          get: {
            summary: 'Admin get system policy detail, requires system:read',
            security: [{ bearerAuth: [] }],
          },
          patch: {
            summary:
              'Admin update DRAFT/INACTIVE system policy, requires system:manage',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/system/policies/{id}/activate': {
          patch: {
            summary:
              'Admin activate a policy version, requires system:manage and reason',
            security: [{ bearerAuth: [] }],
          },
        },
        '/admin/system/policies/{id}/deactivate': {
          patch: {
            summary:
              'Admin archive DRAFT policy; ACTIVE required policies cannot be deactivated directly',
            security: [{ bearerAuth: [] }],
          },
        },
      },
    };
  }
}
