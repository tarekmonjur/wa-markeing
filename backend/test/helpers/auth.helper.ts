import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

/**
 * Registers a new user, logs in, and returns the access token.
 */
export async function registerAndLogin(
  app: INestApplication,
  overrides: { email?: string; password?: string; name?: string } = {},
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const user = {
    email: overrides.email ?? `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: overrides.password ?? 'E2eTest@1234',
    name: overrides.name ?? 'E2E Tester',
  };

  const regRes = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(user)
    .expect(201);

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(201);

  return {
    accessToken: loginRes.body.data.accessToken,
    refreshToken: loginRes.body.data.refreshToken,
    userId: regRes.body.data.id,
  };
}
