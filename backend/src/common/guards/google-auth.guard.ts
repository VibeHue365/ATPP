import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../../modules/auth/services/auth.service';
import { RateLimitService } from '../../modules/auth/services/rate-limit.service';

interface GoogleOAuthRequest {
  path?: string;
  originalUrl?: string;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  oauthState?: string;
  route?: {
    path?: string;
  };
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimitService: RateLimitService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GoogleOAuthRequest>();

    if (this.isCallbackRequest(request)) {
      await this.rateLimitService.assertRateLimit(
        `auth:google:callback:ip:${this.rateLimitService.ipKey(request.ip)}`,
        30,
        5 * 60,
      );
      const state = this.getQueryString(request.query.state);
      if (!state) {
        throw new UnauthorizedException('OAuth state is expired or invalid');
      }

      await this.authService.validateGoogleOAuthState(state);
    } else {
      await this.rateLimitService.assertRateLimit(
        `auth:google:redirect:ip:${this.rateLimitService.ipKey(request.ip)}`,
        20,
        5 * 60,
      );
      request.oauthState = await this.authService.createGoogleOAuthState({
        ipAddress: request.ip,
        userAgent: this.getHeaderString(request.headers['user-agent']),
      });
    }

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext): Record<string, string> {
    const request = context.switchToHttp().getRequest<GoogleOAuthRequest>();

    return request.oauthState ? { state: request.oauthState } : {};
  }

  private isCallbackRequest(request: GoogleOAuthRequest): boolean {
    return Boolean(
      request.route?.path === 'google/callback' ||
        request.path?.endsWith('/auth/google/callback') ||
        request.originalUrl?.startsWith('/auth/google/callback'),
    );
  }

  private getQueryString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    return undefined;
  }

  private getHeaderString(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
