import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Seed helpers for E2E tests.
 * Uses the app's DataSource to insert test data directly.
 */

export async function createTestContact(
  app: INestApplication,
  userId: string,
  overrides: Partial<{ phone: string; name: string }> = {},
) {
  const ds = app.get(DataSource);
  const result = await ds.query(
    `INSERT INTO contacts (phone, name, "customFields", "userId")
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      overrides.phone ?? `+1${Date.now().toString().slice(-10)}`,
      overrides.name ?? 'Test Contact',
      JSON.stringify({}),
      userId,
    ],
  );
  return result[0];
}

export async function createTestTemplate(
  app: INestApplication,
  userId: string,
  overrides: Partial<{ name: string; body: string }> = {},
) {
  const ds = app.get(DataSource);
  const result = await ds.query(
    `INSERT INTO message_templates (name, body, "userId")
     VALUES ($1, $2, $3)
     RETURNING *`,
    [
      overrides.name ?? `tpl-${Date.now()}`,
      overrides.body ?? 'Hello {{name}}!',
      userId,
    ],
  );
  return result[0];
}
