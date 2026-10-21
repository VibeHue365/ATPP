import { AuthController } from './auth.controller';

describe('AuthController direct use-case contracts', () => {
  const request = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };
  const user = { sub: 'user-1', sessionId: 'session-1', roles: ['CUSTOMER'] } as any;
  const create = () => {
    const service = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      exchangeOAuthCode: jest.fn(),
      handleGoogleLogin: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      getPermissions: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue('http://localhost:5173') };
    return { controller: new AuthController(service as any, config as any), service };
  };

  it('UC-01 logs in with email and password and preserves request metadata', async () => {
    const { controller, service } = create();
    const dto = { email: 'customer@example.com', password: 'Strong123' };
    service.login.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token' });

    await expect(controller.login(dto, request)).resolves.toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(service.login).toHaveBeenCalledWith(dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-01 refreshes an authenticated session using the submitted refresh token', async () => {
    const { controller, service } = create();
    const dto = { refreshToken: 'refresh-token' };
    service.refreshToken.mockResolvedValue({ accessToken: 'new-access-token' });

    await expect(controller.refreshToken(dto, request)).resolves.toEqual({ accessToken: 'new-access-token' });
    expect(service.refreshToken).toHaveBeenCalledWith(dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-03 registers a customer and forwards verification context', async () => {
    const { controller, service } = create();
    const dto = {
      email: 'customer@example.com',
      password: 'Strong123',
      fullName: 'Bùi Lê Long Đại',
      phone: '056344433',
    } as any;
    service.register.mockResolvedValue({ message: 'Register success. Please verify your email.' });

    await expect(controller.register(dto, request)).resolves.toEqual({ message: 'Register success. Please verify your email.' });
    expect(service.register).toHaveBeenCalledWith(dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-01 returns the current account permission snapshot', async () => {
    const { controller, service } = create();
    service.getPermissions.mockResolvedValue({ roles: ['CUSTOMER'], permissions: [] });

    await expect(controller.getMePermissions(user)).resolves.toEqual({ roles: ['CUSTOMER'], permissions: [] });
    expect(service.getPermissions).toHaveBeenCalledWith('user-1');
  });

  it('UC-02 exchanges a one-time Google OAuth code', async () => {
    const { controller, service } = create();
    service.exchangeOAuthCode.mockResolvedValue({ accessToken: 'token' });
    await expect(controller.exchangeOAuthCode({ code: 'oauth-code' }, request)).resolves.toEqual({ accessToken: 'token' });
    expect(service.exchangeOAuthCode).toHaveBeenCalledWith({ code: 'oauth-code' }, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-02 redirects the Google callback with the generated exchange code', async () => {
    const { controller, service } = create();
    service.handleGoogleLogin.mockResolvedValue({ code: 'one-time-code' });
    const response = { redirect: jest.fn() } as any;
    await controller.googleCallback({ ...request, user: { googleId: 'g-1', email: 'user@example.com' } as any }, response);
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/oauth/callback?code=one-time-code');
  });

  it('UC-04 starts forgot-password recovery without exposing account existence', async () => {
    const { controller, service } = create();
    service.forgotPassword.mockResolvedValue({ message: 'If the email exists, reset instructions were sent' });
    await controller.forgotPassword({ email: 'user@example.com' }, request);
    expect(service.forgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' }, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-04 resets a password with the supplied recovery token', async () => {
    const { controller, service } = create();
    service.resetPassword.mockResolvedValue({ message: 'Password reset successful' });
    await controller.resetPassword({ token: 'reset-token', newPassword: 'Strong123' }, request);
    expect(service.resetPassword).toHaveBeenCalledWith({ token: 'reset-token', newPassword: 'Strong123' }, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-05 verifies email using the submitted OTP', async () => {
    const { controller, service } = create();
    service.verifyEmail.mockResolvedValue({ message: 'Email verified' });
    await controller.verifyEmail({ email: 'user@example.com', otp: '123456' }, request);
    expect(service.verifyEmail).toHaveBeenCalledWith({ email: 'user@example.com', otp: '123456' }, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-05 resends verification OTP to the normalized account email', async () => {
    const { controller, service } = create();
    service.resendVerification.mockResolvedValue({ message: 'OTP sent' });
    await controller.resendVerification({ email: 'user@example.com' });
    expect(service.resendVerification).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  it('UC-06 changes password for the authenticated account', async () => {
    const { controller, service } = create();
    service.changePassword.mockResolvedValue({ message: 'Password changed' });
    await controller.changePassword(user, { currentPassword: 'Old12345', newPassword: 'New12345' }, request);
    expect(service.changePassword).toHaveBeenCalledWith('user-1', { currentPassword: 'Old12345', newPassword: 'New12345' }, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-07 logs out the current authenticated session', async () => {
    const { controller, service } = create();
    service.logout.mockResolvedValue({ message: 'Logged out' });
    await controller.logout(user);
    expect(service.logout).toHaveBeenCalledWith('user-1', 'session-1');
  });
});
