export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession extends IssuedTokens {
  user: Record<string, unknown>;
}

export interface OAuthLoginCode {
  code: string;
}
