export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthorizationContext {
  roles: string[];
  permissions: string[];
}

export interface AuthSession extends IssuedTokens, AuthorizationContext {
  user: Record<string, unknown>;
}

export interface OAuthLoginCode {
  code: string;
}
