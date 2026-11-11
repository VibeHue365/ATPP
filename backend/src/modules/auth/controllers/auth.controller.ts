import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { GoogleAuthGuard } from '../../../common/guards/google-auth.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { GoogleOAuthProfile } from '../../../common/strategies/google.strategy';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { GoogleMobileLoginDto } from '../dto/google-mobile-login.dto';
import { LoginDto } from '../dto/login.dto';
import { OAuthExchangeDto } from '../dto/oauth-exchange.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { getPrimaryFrontendUrl } from '../../../common/config/frontend-url.util';
import { AuthService } from '../services/auth.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: GoogleOAuthProfile;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.register(dto, this.context(request));
  }

  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.verifyEmail(dto, this.context(request));
  }

  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  @Post('resend-verification')
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<Record<string, unknown>> {
    return this.authService.resendVerification(dto);
  }

  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() request: RequestMeta,
  ): Promise<object> {
    return this.authService.login(dto, this.context(request));
  }

  @Post('refresh-token')
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() request: RequestMeta,
  ): Promise<object> {
    return this.authService.refreshToken(dto, this.context(request));
  }

  @Post('oauth/exchange')
  exchangeOAuthCode(
    @Body() dto: OAuthExchangeDto,
    @Req() request: RequestMeta,
  ): Promise<object> {
    return this.authService.exchangeOAuthCode(dto, this.context(request));
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('google/mobile')
  loginGoogleMobile(
    @Body() dto: GoogleMobileLoginDto,
    @Req() request: RequestMeta,
  ): Promise<object> {
    return this.authService.loginGoogleMobile(dto.idToken, this.context(request));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.authService.logout(user.sub, user.sessionId);
  }

  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  getMePermissions(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.authService.getPermissions(user.sub);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.changePassword(user.sub, dto, this.context(request));
  }

  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.forgotPassword(dto, this.context(request));
  }

  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.resetPassword(dto, this.context(request));
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(
    @Req() request: RequestMeta,
    @Res() response: Response,
  ): Promise<void> {
    return this.redirectGoogleLogin(request, response);
  }

  private async redirectGoogleLogin(
    request: RequestMeta & { oauthStateDoc?: any },
    response: Response,
  ): Promise<void> {
    const redirectUri = request.oauthStateDoc?.redirectUri;
    const result = await this.authService.handleGoogleLogin(
      request.user as GoogleOAuthProfile,
      this.context(request),
    );
    if (redirectUri) {
      const sep = redirectUri.includes('?') ? '&' : '?';
      const finalUrl = `${redirectUri}${sep}code=${encodeURIComponent(result.code)}`;

      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.send(`<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TàGo</title>
  </head>
  <body style="background:#FAF7F2;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;box-sizing:border-box;">
    <div style="background:#fff;padding:32px 24px;border-radius:18px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,0.06);max-width:340px;width:100%;">
      <h2 style="color:#BA0049;margin:0 0 12px;font-family:serif;font-size:26px;letter-spacing:1px;">TàGo</h2>
      <p style="color:#2D2D2D;font-weight:600;font-size:15px;margin:0 0 8px;">Đăng nhập Google thành công!</p>
      <p style="color:#777;font-size:13px;margin:0 0 20px;line-height:1.5;">Đang quay lại ứng dụng TàGo...</p>
      <a href="${finalUrl}" style="display:block;background:#BA0049;color:#fff;text-decoration:none;padding:12px;border-radius:10px;font-weight:600;font-size:14px;">Mở ứng dụng TàGo</a>
    </div>
    <script>
      window.location.href = ${JSON.stringify(finalUrl)};
    </script>
  </body>
</html>`);
      return;
    }

    const rawFrontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const frontendUrl = getPrimaryFrontendUrl(rawFrontendUrl);
    const redirectUrl = new URL('/oauth/callback', frontendUrl);
    redirectUrl.searchParams.set('code', result.code);

    response.redirect(redirectUrl.toString());
  }

  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  getPermissions(
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return this.authService.getPermissions(user.sub);
  }

  private context(request: RequestMeta): {
    ipAddress?: string;
    userAgent?: string;
  } {
    const userAgent = request.headers['user-agent'];

    return {
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
