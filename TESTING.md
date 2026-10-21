# ATPP Testing Guide

## Test projects

- `backend`: Jest unit tests and opt-in NestJS/Supertest integration tests.
- `frontend`: Vitest and React Testing Library for the web application.
- `mobile`: Jest Expo and React Native Testing Library for the Expo application.

Test files must not use production credentials or production databases. Copy the
relevant `.env*.example` file when a local test environment is required.

## Commands

Run each project independently from the repository root:

```text
npm run test:backend
npm run test:frontend
npm run test:mobile
```

Run all unit/component suites:

```text
npm test
```

Generate coverage per project:

```text
npm run test:cov --prefix backend
npm run test:cov --prefix frontend
npm run test:cov --prefix mobile
```

Validate compilation and Mobile TypeScript types:

```text
npm run test:types
```

Run the isolated Backend HTTP smoke and contract suite:

```text
npm run test:e2e --prefix backend
```

Run the Web Provider Dashboard browser smoke test. It starts a local Vite
server and intercepts every API request, so no real account or database is used:

```text
npm run test:provider:browser --prefix frontend
```

The photography concurrency suite is separate and opt-in because it requires a
disposable MongoDB replica set configured with `MONGODB_HOLD_TEST_URI`:

```text
npm run test:photography-holds:e2e --prefix backend
```
