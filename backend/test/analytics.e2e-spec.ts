import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource);

    // Register + login to get token
    const email = `analytics-e2e-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Test@1234', name: 'Analytics E2E' });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Test@1234' });
    accessToken = loginRes.body.data?.accessToken;
  });

  afterAll(async () => {
    await ds?.destroy();
    await app?.close();
  });

  it('GET /api/v1/analytics/overview — returns 30 days of DailyStats', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/overview?days=30')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('dailyStats');
    expect(res.body).toHaveProperty('totals');
    expect(res.body).toHaveProperty('period');
    expect(res.body.period.days).toBe(30);
  });

  it('GET /api/v1/analytics/campaigns — returns list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data || res.body)).toBe(true);
  });

  it('GET /api/v1/analytics/campaigns/:id — 404 for invalid campaign', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/campaigns/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('POST /api/v1/analytics/campaigns/:id/export — 404 for invalid campaign', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/analytics/campaigns/00000000-0000-0000-0000-000000000000/export?format=csv')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('GET /api/v1/analytics/exports/:jobId — 404 for invalid job', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/exports/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('requires auth token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/overview')
      .expect(401);
  });
});
