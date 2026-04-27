import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';

describe('Send Window / Settings (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    const auth = await registerAndLogin(app);
    accessToken = auth.accessToken;
  });

  afterAll(async () => {
    await ds?.destroy();
    await app?.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('GET /api/v1/settings — returns default settings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set(auth())
      .expect(200);

    expect(res.body.data).toHaveProperty('timezone');
    expect(res.body.data).toHaveProperty('sendWindowStart');
    expect(res.body.data).toHaveProperty('sendWindowEnd');
    expect(res.body.data).toHaveProperty('smartSendEnabled');
  });

  it('PATCH /api/v1/settings — updates send window', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set(auth())
      .send({
        timezone: 'Asia/Dhaka',
        sendWindowStart: 9,
        sendWindowEnd: 21,
        smartSendEnabled: true,
        sendDaysOfWeek: [7, 1, 2, 3, 4],
      })
      .expect(200);

    expect(res.body.data.timezone).toBe('Asia/Dhaka');
    expect(res.body.data.sendWindowStart).toBe(9);
    expect(res.body.data.sendWindowEnd).toBe(21);
    expect(res.body.data.smartSendEnabled).toBe(true);
  });

  it('GET /api/v1/billing/usage — returns plan usage', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/billing/usage')
      .set(auth())
      .expect(200);

    expect(res.body.data).toHaveProperty('plan');
    expect(res.body.data).toHaveProperty('limits');
    expect(res.body.data).toHaveProperty('usage');
  });

  it('GET /api/v1/settings — without auth returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/settings')
      .expect(401);
  });
});
