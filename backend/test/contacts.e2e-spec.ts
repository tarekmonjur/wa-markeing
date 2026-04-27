import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';

describe('Contacts (e2e)', () => {
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

  let contactId: string;

  it('POST /api/v1/contacts — should create a contact', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contacts')
      .set(auth())
      .send({ phone: '+1234567890', name: 'John' })
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.phone).toBe('+1234567890');
    contactId = res.body.data.id;
  });

  it('GET /api/v1/contacts — should list contacts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set(auth())
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/contacts/:id — should return single contact', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/contacts/${contactId}`)
      .set(auth())
      .expect(200);

    expect(res.body.data.id).toBe(contactId);
  });

  it('PATCH /api/v1/contacts/:id — should update contact', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/contacts/${contactId}`)
      .set(auth())
      .send({ name: 'John Doe' })
      .expect(200);

    expect(res.body.data.name).toBe('John Doe');
  });

  it('GET /api/v1/contacts — without token should 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .expect(401);
  });

  it('DELETE /api/v1/contacts/:id — should remove contact', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/contacts/${contactId}`)
      .set(auth())
      .expect(200);
  });
});
