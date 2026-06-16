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
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
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

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<Record<string, unknown>> {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<Record<string, unknown>> {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<Record<string, unknown>> {
    return this.authService.resendVerification(dto);
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.login(dto, this.context(request));
  }

  @Post('refresh-token')
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() request: RequestMeta,
  ): Promise<object> {
    return this.authService.refreshToken(dto, this.context(request));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(
    @CurrentUser() user: AuthUser,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.logout(
      user.sub,
      user.sessionId,
      this.context(request),
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.authService.changePassword(
      user.sub,
      dto,
      this.context(request),
    );
  }

  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<Record<string, unknown>> {
    return this.authService.forgotPassword(dto);
  }

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
    request: RequestMeta,
    response: Response,
  ): Promise<void> {
    const result = await this.authService.handleGoogleLogin(
      request.user as GoogleOAuthProfile,
      this.context(request),
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const redirectUrl = new URL('/oauth/callback', frontendUrl);
    redirectUrl.searchParams.set('accessToken', String(result.accessToken));
    redirectUrl.searchParams.set('refreshToken', String(result.refreshToken));

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
