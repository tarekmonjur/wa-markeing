import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import { createTestContact, createTestTemplate } from './helpers/seed.helper';

describe('Drip Sequences (e2e)', () => {
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

  let sequenceId: string;
  let templateId: string;
  let sessionId: string;

  it('setup: create session, template, and contacts', async () => {
    // Create session
    const sess = await ds.query(
      `INSERT INTO wa_sessions (id, "userId", "phoneNumber", "displayName", status)
       VALUES (uuid_generate_v4(), $1, '+8801712345678', 'Drip Session', 'CONNECTED')
       RETURNING id`,
      [userId],
    );
    sessionId = sess[0].id;

    const template = await createTestTemplate(app, userId, {
      name: 'Drip Step 1',
      body: 'Hello {{name}}! Welcome to our service.',
    });
    templateId = template.id;
  });

  it('POST /api/v1/drip-sequences — creates 3-step sequence', async () => {
    const template2 = await createTestTemplate(app, userId, {
      name: 'Drip Step 2',
      body: 'Special discount for you, {{name}}!',
    });
    const template3 = await createTestTemplate(app, userId, {
      name: 'Drip Step 3',
      body: 'Last chance offer for {{name}}!',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/drip-sequences')
      .set(auth())
      .send({
        name: 'New Customer Onboarding',
        steps: [
          { stepNumber: 1, templateId, delayHours: 0, condition: 'ALWAYS' },
          { stepNumber: 2, templateId: template2.id, delayHours: 24, condition: 'NO_REPLY' },
          { stepNumber: 3, templateId: template3.id, delayHours: 72, condition: 'ALWAYS' },
        ],
      })
      .expect(201);

    const body = res.body.data ?? res.body;
    sequenceId = body.id;
    expect(sequenceId).toBeTruthy();
    expect(body.name).toBe('New Customer Onboarding');
  });

  it('GET /api/v1/drip-sequences — lists sequences', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/drip-sequences')
      .set(auth())
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/drip-sequences/:id/enroll — enrolls BD contacts', async () => {
    // Create 5 contacts
    const contactIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const c = await createTestContact(app, userId, {
        phone: `+88017120000${i.toString().padStart(2, '0')}`,
        name: `BD Contact ${i + 1}`,
      });
      contactIds.push(c.id);
    }

    const res = await request(app.getHttpServer())
      .post(`/api/v1/drip-sequences/${sequenceId}/enroll`)
      .set(auth())
      .send({ contactIds, sessionId })
      .expect(201);

    const body = res.body.data ?? res.body;
    expect(body.enrolled).toBe(5);
    expect(body.skipped).toBe(0);
  });

  it('Opted-out contact in enroll list is skipped', async () => {
    // Create an opted-out contact
    const optedOut = await createTestContact(app, userId, {
      phone: '+8801700999999',
      name: 'Opted Out BD',
    });
    await ds.query(
      `UPDATE contacts SET "optedOut" = true, "optedOutAt" = NOW() WHERE id = $1`,
      [optedOut.id],
    );

    // Create a new sequence to test with
    const newSeq = await request(app.getHttpServer())
      .post('/api/v1/drip-sequences')
      .set(auth())
      .send({
        name: 'Opt-out Test Sequence',
        steps: [{ stepNumber: 1, templateId, delayHours: 0, condition: 'ALWAYS' }],
      })
      .expect(201);

    const newSeqId = (newSeq.body.data ?? newSeq.body).id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/drip-sequences/${newSeqId}/enroll`)
      .set(auth())
      .send({ contactIds: [optedOut.id], sessionId })
      .expect(201);

    const body = res.body.data ?? res.body;
    expect(body.enrolled).toBe(0);
    expect(body.skipped).toBe(1);
  });

  it('GET /api/v1/drip-sequences/:id — shows enrollment count', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/drip-sequences/${sequenceId}`)
      .set(auth())
      .expect(200);

    const body = res.body.data ?? res.body;
    expect(body.enrollments).toBeTruthy();
    expect(body.enrollments.length).toBe(5);
  });
});
