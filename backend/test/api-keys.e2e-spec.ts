import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import { Plan } from '../src/database/enums';
import { User } from '../src/users/entities/user.entity';
import { ApiKey } from '../src/api-keys/entities/api-key.entity';

describe('API Key Auth (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let proToken: string;
  let proUserId: string;
  let apiKey: string;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    const pro = await registerAndLogin(app, { email: `pro-api-${Date.now()}@test.com` });
    proToken = pro.accessToken;
    proUserId = pro.userId;

    await ds.getRepository(User).update(proUserId, { plan: Plan.PRO });

    // Create an API key
    const res = await request(app.getHttpServer())
      .post('/api/v1/api-keys')
      .set({ Authorization: `Bearer ${proToken}` })
      .send({ name: 'E2E Test Key' })
      .expect(201);

    apiKey = res.body.data.key;
  });

  afterAll(async () => {
    await ds?.destroy();
    await app?.close();
  });

  it('GET /api/v1/contacts with valid API key via X-API-Key returns 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set({ 'X-API-Key': apiKey })
      .expect(200);

    expect(res.body).toHaveProperty('data');
  });

  it('GET /api/v1/contacts with valid API key via Bearer returns 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set({ Authorization: `Bearer ${apiKey}` })
      .expect(200);

    expect(res.body).toHaveProperty('data');
  });

  it('GET /api/v1/contacts with invalid key returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set({ 'X-API-Key': 'wam_invalid_key_12345' })
      .expect(401);
  });

  it('Key shown only in create response — subsequent GET returns keyPrefix only', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/api-keys')
      .set({ Authorization: `Bearer ${proToken}` })
      .expect(200);

    const keys = res.body.data;
    expect(keys.length).toBeGreaterThan(0);
    // Verify no full key is exposed
    for (const key of keys) {
      expect(key).toHaveProperty('keyPrefix');
      expect(key).not.toHaveProperty('key');
      expect(key).not.toHaveProperty('keyHash');
    }
  });

  it('GET /api/v1/contacts with expired key returns 401', async () => {
    // Create a key with past expiry
    const res = await request(app.getHttpServer())
      .post('/api/v1/api-keys')
      .set({ Authorization: `Bearer ${proToken}` })
      .send({ name: 'Expired Key', expiresAt: '2020-01-01T00:00:00Z' })
      .expect(201);

    const expiredKey = res.body.data.key;

    await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set({ 'X-API-Key': expiredKey })
      .expect(401);
  });
});
