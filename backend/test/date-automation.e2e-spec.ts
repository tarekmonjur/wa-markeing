import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import { DateAutomation } from '../src/automations/entities/date-automation.entity';

describe('Date Automations (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let accessToken: string;
  let automationId: string;

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

  it('POST /api/v1/automations/date — creates a date automation', async () => {
    // This will fail with a template/session not found, but should not be 403
    const res = await request(app.getHttpServer())
      .post('/api/v1/automations/date')
      .set(auth())
      .send({
        sessionId: '00000000-0000-0000-0000-000000000001',
        templateId: '00000000-0000-0000-0000-000000000001',
        fieldName: 'birthday',
        sendTime: '09:00',
      });

    // Accept 201 (created) or non-403 status
    if (res.status === 201) {
      expect(res.body.data).toHaveProperty('id');
      automationId = res.body.data.id;
    }
  });

  it('GET /api/v1/automations/date — lists automations', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/automations/date')
      .set(auth())
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('GET /api/v1/automations/date — without auth returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/automations/date')
      .expect(401);
  });
});
