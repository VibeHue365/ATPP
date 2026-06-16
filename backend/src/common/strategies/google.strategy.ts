import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleOAuthProfile {
  providerUserId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID =
      configService.get<string>('GOOGLE_CLIENT_ID') || 'demo-google-client-id';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET') ||
      'demo-google-client-secret';
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ||
      'http://localhost:3000/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account has no email'), undefined);
      return;
    }

    done(null, {
      providerUserId: profile.id,
      email,
      fullName: profile.displayName || email,
      avatarUrl: profile.photos?.[0]?.value,
    } satisfies GoogleOAuthProfile);
  }
}
