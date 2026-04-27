import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import { createTestContact, createTestTemplate } from './helpers/seed.helper';

describe('Campaigns (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    const auth = await registerAndLogin(app);
    accessToken = auth.accessToken;
    userId = auth.userId;
  });

  afterAll(async () => {
    await ds?.destroy();
    await app?.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  let campaignId: string;

  it('POST /api/v1/campaigns — should create draft campaign', async () => {
    const template = await createTestTemplate(app, userId);
    const contact = await createTestContact(app, userId);

    const res = await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set(auth())
      .send({
        name: 'E2E Campaign',
        templateId: template.id,
        groupTag: 'test',
      })
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('DRAFT');
    campaignId = res.body.data.id;
  });

  it('GET /api/v1/campaigns — should list campaigns', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .set(auth())
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/campaigns/:id — should return campaign', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/campaigns/${campaignId}`)
      .set(auth())
      .expect(200);

    expect(res.body.data.id).toBe(campaignId);
    expect(res.body.data.name).toBe('E2E Campaign');
  });

  it('GET /api/v1/campaigns — without token should 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .expect(401);
  });
});
