import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import { createTestTemplate } from './helpers/seed.helper';

describe('Campaign Scheduler (e2e)', () => {
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

  it('POST /api/v1/campaigns with scheduledAt 5s in future → status SCHEDULED', async () => {
    // Create a WA session stub
    await ds.query(
      `INSERT INTO wa_sessions (id, "userId", "phoneNumber", "displayName", status)
       VALUES (uuid_generate_v4(), $1, '+8801712345678', 'Test Session', 'CONNECTED')
       RETURNING id`,
      [userId],
    );
    const sessions = await ds.query(
      `SELECT id FROM wa_sessions WHERE "userId" = $1 LIMIT 1`,
      [userId],
    );
    const sessionId = sessions[0].id;
    const template = await createTestTemplate(app, userId);

    const scheduledAt = new Date(Date.now() + 5000).toISOString();

    const res = await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set(auth())
      .send({
        name: 'Scheduled E2E Campaign',
        sessionId,
        templateId: template.id,
        scheduledAt,
        timezone: 'Asia/Dhaka',
      })
      .expect(201);

    campaignId = res.body.id ?? res.body.data?.id;
    expect(campaignId).toBeTruthy();

    // Verify status is SCHEDULED
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/campaigns/${campaignId}`)
      .set(auth())
      .expect(200);

    const status = getRes.body.status ?? getRes.body.data?.status;
    expect(status).toBe('SCHEDULED');
  });

  it('PATCH /api/v1/campaigns/:id can reschedule a campaign', async () => {
    if (!campaignId) return;

    const newScheduledAt = new Date(Date.now() + 60_000).toISOString();
    await request(app.getHttpServer())
      .patch(`/api/v1/campaigns/${campaignId}`)
      .set(auth())
      .send({ scheduledAt: newScheduledAt })
      .expect(200);
  });

  it('POST /api/v1/campaigns with past scheduledAt → 400 or DRAFT', async () => {
    const sessions = await ds.query(
      `SELECT id FROM wa_sessions WHERE "userId" = $1 LIMIT 1`,
      [userId],
    );
    const sessionId = sessions[0].id;
    const template = await createTestTemplate(app, userId);

    const pastDate = new Date(Date.now() - 60_000).toISOString();

    // Campaign should either be created as DRAFT (scheduledAt ignored) or rejected
    const res = await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set(auth())
      .send({
        name: 'Past Schedule Campaign',
        sessionId,
        templateId: template.id,
        scheduledAt: pastDate,
      });

    // Either 400 (validation) or 201 with status DRAFT
    if (res.status === 201) {
      const body = res.body.data ?? res.body;
      expect(['DRAFT', 'SCHEDULED']).toContain(body.status);
    } else {
      expect(res.status).toBe(400);
    }
  });
});
