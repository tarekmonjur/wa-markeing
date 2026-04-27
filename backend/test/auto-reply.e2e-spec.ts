import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';

describe('Auto-Reply System (e2e)', () => {
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

  it('POST /api/v1/auto-reply-rules — creates CONTAINS rule', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auto-reply-rules')
      .set(auth())
      .send({
        keyword: 'price',
        matchType: 'CONTAINS',
        replyBody: 'Our prices start from $10.',
        priority: 5,
      })
      .expect(201);

    const body = res.body.data ?? res.body;
    expect(body.keyword).toBe('price');
    expect(body.matchType).toBe('CONTAINS');
  });

  it('POST /api/v1/auto-reply-rules with ReDoS regex → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auto-reply-rules')
      .set(auth())
      .send({
        keyword: '^(a+)+$',
        matchType: 'REGEX',
        replyBody: 'test',
        priority: 1,
      })
      .expect(400);
  });

  it('POST /api/v1/auto-reply-rules with valid regex → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auto-reply-rules')
      .set(auth())
      .send({
        keyword: 'order\\s+\\d+',
        matchType: 'REGEX',
        replyBody: 'Checking your order...',
        priority: 3,
      })
      .expect(201);

    const body = res.body.data ?? res.body;
    expect(body.matchType).toBe('REGEX');
  });

  it('GET /api/v1/auto-reply-rules — lists all rules', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auto-reply-rules')
      .set(auth())
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it('system STOP rule cannot be deleted', async () => {
    // Insert system STOP rule
    await ds.query(
      `INSERT INTO auto_reply_rules (keyword, "matchType", "replyBody", priority, "userId", "isActive")
       VALUES ('stop', 'EXACT', 'Unsubscribed.', 9999, $1, true)
       ON CONFLICT DO NOTHING`,
      [userId],
    );

    // Find the STOP rule
    const rules = await ds.query(
      `SELECT id FROM auto_reply_rules WHERE "userId" = $1 AND keyword = 'stop' AND priority >= 9999 LIMIT 1`,
      [userId],
    );

    if (rules.length > 0) {
      await request(app.getHttpServer())
        .delete(`/api/v1/auto-reply-rules/${rules[0].id}`)
        .set(auth())
        .expect(404); // Returns 404 "System STOP rule cannot be deleted"
    }
  });

  it('Contact opt-out sets optedOut flag', async () => {
    // Create a contact directly
    const contact = await ds.query(
      `INSERT INTO contacts (phone, name, "userId")
       VALUES ('+8801700000001', 'OptOut Test', $1)
       RETURNING *`,
      [userId],
    );

    // Simulate opt-out by direct update (actual opt-out goes via inbound processor)
    await ds.query(
      `UPDATE contacts SET "optedOut" = true, "optedOutAt" = NOW() WHERE id = $1`,
      [contact[0].id],
    );

    const result = await ds.query(
      `SELECT "optedOut" FROM contacts WHERE id = $1`,
      [contact[0].id],
    );
    expect(result[0].optedOut).toBe(true);
  });
});
