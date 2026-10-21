// Safe defaults for automated tests. Explicit environment values still win,
// which allows opt-in integration tests to provide their own isolated services.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/vibehue_test';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-not-for-production';
process.env.BCRYPT_SALT_ROUNDS ??= '10';
process.env.POLICY_ACTIVATION_MODE ??= 'COMPENSATION';
process.env.DISABLE_AUTO_CREATE_INVENTORY ??= 'true';
process.env.SMART_TAG_AI_ENABLED ??= 'false';
