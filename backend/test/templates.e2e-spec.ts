import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';

describe('Templates (e2e)', () => {
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

  let templateId: string;

  it('POST /api/v1/templates — should create template', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/templates')
      .set(auth())
      .send({ name: 'Welcome', body: 'Hello {{name}}, welcome!' })
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Welcome');
    templateId = res.body.data.id;
  });

  it('GET /api/v1/templates — should list templates', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/templates')
      .set(auth())
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/templates/:id — should return template', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/templates/${templateId}`)
      .set(auth())
      .expect(200);

    expect(res.body.data.id).toBe(templateId);
    expect(res.body.data.body).toContain('{{name}}');
  });

  it('PATCH /api/v1/templates/:id — should update template', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/templates/${templateId}`)
      .set(auth())
      .send({ body: 'Hi {{name}}, updated!' })
      .expect(200);

    expect(res.body.data.body).toContain('updated');
  });

  it('DELETE /api/v1/templates/:id — should remove template', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/templates/${templateId}`)
      .set(auth())
      .expect(200);
  });
});
