import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import { Plan } from '../src/database/enums';
import { PlanUsage } from '../src/billing/entities/plan-usage.entity';
import { User } from '../src/users/entities/user.entity';

describe('Plan Limits (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let freeToken: string;
  let freeUserId: string;
  let starterToken: string;
  let starterUserId: string;
  let proToken: string;
  let proUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    // Create users with different plans
    const free = await registerAndLogin(app, { email: `free-${Date.now()}@test.com` });
    freeToken = free.accessToken;
    freeUserId = free.userId;

    const starter = await registerAndLogin(app, { email: `starter-${Date.now()}@test.com` });
    starterToken = starter.accessToken;
    starterUserId = starter.userId;

    const pro = await registerAndLogin(app, { email: `pro-${Date.now()}@test.com` });
    proToken = pro.accessToken;
    proUserId = pro.userId;

    // Update plans
    const userRepo = ds.getRepository(User);
    await userRepo.update(starterUserId, { plan: Plan.STARTER });
    await userRepo.update(proUserId, { plan: Plan.PRO });
  });

  afterAll(async () => {
    await ds?.destroy();
    await app?.close();
  });

  it('FREE user: POST /drip-sequences returns 403 (canUseDrip=false)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/drip-sequences')
      .set({ Authorization: `Bearer ${freeToken}` })
      .send({ name: 'Test', sessionId: '00000000-0000-0000-0000-000000000000' })
      .expect(403);
  });

  it('STARTER user: POST /drip-sequences succeeds (canUseDrip=true)', async () => {
    // May fail with 404 on session but should NOT be 403
    const res = await request(app.getHttpServer())
      .post('/api/v1/drip-sequences')
      .set({ Authorization: `Bearer ${starterToken}` })
      .send({ name: 'Test', sessionId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).not.toBe(403);
  });

  it('PRO user: POST /api-keys succeeds (canUseApi=true)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/api-keys')
      .set({ Authorization: `Bearer ${proToken}` })
      .send({ name: 'Test Key' })
      .expect(201);

    expect(res.body.data).toHaveProperty('key');
    expect(res.body.data.key).toMatch(/^wam_/);
  });

  it('FREE user: POST /api-keys returns 403 (canUseApi=false)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/api-keys')
      .set({ Authorization: `Bearer ${freeToken}` })
      .send({ name: 'Test Key' })
      .expect(403);
  });

  it('FREE user: contact creation beyond limit returns 403 PLAN_LIMIT_EXCEEDED', async () => {
    // Seed usage at the limit (500 contacts for FREE)
    const usageRepo = ds.getRepository(PlanUsage);
    let usage = await usageRepo.findOne({ where: { userId: freeUserId } });
    if (!usage) {
      usage = usageRepo.create({ userId: freeUserId, contactCount: 500 });
    } else {
      usage.contactCount = 500;
    }
    await usageRepo.save(usage);

    const res = await request(app.getHttpServer())
      .post('/api/v1/contacts')
      .set({ Authorization: `Bearer ${freeToken}` })
      .send({ phone: '+8801700000001', name: 'Over Limit' });

    expect(res.status).toBe(403);
  });

  it('FREE user: 6th campaign creation returns 403 PLAN_LIMIT_EXCEEDED', async () => {
    // Seed usage at the limit (5 campaigns for FREE)
    const usageRepo = ds.getRepository(PlanUsage);
    let usage = await usageRepo.findOne({ where: { userId: freeUserId } });
    if (!usage) {
      usage = usageRepo.create({ userId: freeUserId, campaignsThisMonth: 5 });
    } else {
      usage.campaignsThisMonth = 5;
    }
    await usageRepo.save(usage);

    const res = await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set({ Authorization: `Bearer ${freeToken}` })
      .send({
        name: 'Over Limit Campaign',
        sessionId: '00000000-0000-0000-0000-000000000000',
        templateId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(403);
  });
});
