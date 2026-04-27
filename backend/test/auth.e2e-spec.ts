import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

/**
 * E2E test for Auth flow: register → login → refresh → logout
 *
 * Requires running Postgres and Redis (use docker-compose).
 * Run with: npm run test:e2e
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await ds?.destroy();
    await app?.close();
  });

  const testUser = {
    email: `e2e-${Date.now()}@test.com`,
    password: 'E2eTest@1234',
    name: 'E2E User',
  };

  let accessToken: string;
  let refreshToken: string;

  it('POST /api/v1/auth/register — should register', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(testUser.email);
  });

  it('POST /api/v1/auth/register — duplicate should 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(409);
  });

  it('POST /api/v1/auth/login — should return tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(201);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/refresh — should rotate token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    expect(res.body.data).toHaveProperty('accessToken');
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/logout — should clear refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  });

  it('GET /api/v1/health — should be public', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
});
