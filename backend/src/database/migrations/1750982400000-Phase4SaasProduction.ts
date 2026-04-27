import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4SaasProduction1750982400000 implements MigrationInterface {
  name = 'Phase4SaasProduction1750982400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Plan Usage tracking table
    await queryRunner.query(`
      CREATE TABLE "plan_usages" (
        "userId" uuid NOT NULL,
        "contactCount" integer NOT NULL DEFAULT 0,
        "sessionsCount" integer NOT NULL DEFAULT 0,
        "campaignsThisMonth" integer NOT NULL DEFAULT 0,
        "messagesToday" integer NOT NULL DEFAULT 0,
        "aiGenerationsToday" integer NOT NULL DEFAULT 0,
        "lastDailyResetAt" date NOT NULL DEFAULT CURRENT_DATE,
        "lastMonthlyResetAt" date NOT NULL DEFAULT CURRENT_DATE,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plan_usages" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_plan_usages_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 2. User Settings table (smart send window)
    await queryRunner.query(`
      CREATE TABLE "user_settings" (
        "userId" uuid NOT NULL,
        "timezone" character varying NOT NULL DEFAULT 'UTC',
        "sendWindowStart" integer NOT NULL DEFAULT 9,
        "sendWindowEnd" integer NOT NULL DEFAULT 18,
        "sendDaysOfWeek" text NOT NULL DEFAULT '1,2,3,4,5',
        "smartSendEnabled" boolean NOT NULL DEFAULT false,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_settings" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_user_settings_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 3. Date Automations table
    await queryRunner.query(`
      CREATE TABLE "date_automations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "templateId" uuid NOT NULL,
        "fieldName" character varying NOT NULL,
        "sendTime" character varying NOT NULL DEFAULT '09:00',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_date_automations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_date_automations_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_date_automations_template" FOREIGN KEY ("templateId")
          REFERENCES "templates"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_date_automations_user_active"
        ON "date_automations" ("userId", "isActive")
    `);

    // 4. API Keys table
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "keyHash" character varying NOT NULL,
        "keyPrefix" character varying NOT NULL,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_api_keys_keyHash" UNIQUE ("keyHash"),
        CONSTRAINT "FK_api_keys_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_api_keys_userId" ON "api_keys" ("userId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_api_keys_keyHash" ON "api_keys" ("keyHash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_api_keys_keyHash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_api_keys_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_date_automations_user_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "date_automations"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "user_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_usages"`);
  }
}
