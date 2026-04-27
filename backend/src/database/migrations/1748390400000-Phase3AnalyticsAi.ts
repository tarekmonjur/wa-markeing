import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3AnalyticsAi1748390400000 implements MigrationInterface {
  name = 'Phase3AnalyticsAi1748390400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Campaign Stats (pre-aggregated read model) ──
    await queryRunner.query(`
      CREATE TABLE "campaign_stats" (
        "campaignId" uuid NOT NULL,
        "totalContacts" integer NOT NULL DEFAULT 0,
        "sentCount" integer NOT NULL DEFAULT 0,
        "deliveredCount" integer NOT NULL DEFAULT 0,
        "readCount" integer NOT NULL DEFAULT 0,
        "failedCount" integer NOT NULL DEFAULT 0,
        "repliedCount" integer NOT NULL DEFAULT 0,
        "optedOutCount" integer NOT NULL DEFAULT 0,
        "deliveryRate" float NOT NULL DEFAULT 0,
        "readRate" float NOT NULL DEFAULT 0,
        "replyRate" float NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_stats" PRIMARY KEY ("campaignId"),
        CONSTRAINT "FK_campaign_stats_campaign" FOREIGN KEY ("campaignId")
          REFERENCES "campaigns"("id") ON DELETE CASCADE
      )
    `);

    // ── Daily Stats ──
    await queryRunner.query(`
      CREATE TABLE "daily_stats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "sessionId" uuid,
        "date" date NOT NULL,
        "sentCount" integer NOT NULL DEFAULT 0,
        "deliveredCount" integer NOT NULL DEFAULT 0,
        "readCount" integer NOT NULL DEFAULT 0,
        "failedCount" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_daily_stats" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_daily_stats_user_session_date" UNIQUE ("userId", "sessionId", "date")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_daily_stats_userId_date" ON "daily_stats" ("userId", "date")`);

    // ── Export Jobs ──
    await queryRunner.query(`
      CREATE TYPE "export_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TYPE "export_format_enum" AS ENUM ('CSV', 'PDF')
    `);
    await queryRunner.query(`
      CREATE TABLE "export_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "campaignId" uuid NOT NULL,
        "format" "export_format_enum" NOT NULL,
        "status" "export_status_enum" NOT NULL DEFAULT 'PENDING',
        "downloadUrl" varchar,
        "error" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_export_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_export_jobs_userId" ON "export_jobs" ("userId")`);

    // ── A/B Tests ──
    await queryRunner.query(`
      CREATE TYPE "ab_status_enum" AS ENUM ('RUNNING', 'COMPLETED', 'CANCELLED')
    `);
    await queryRunner.query(`
      CREATE TABLE "ab_tests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "campaignId" uuid NOT NULL,
        "variantA" varchar NOT NULL,
        "variantB" varchar NOT NULL,
        "splitRatio" float NOT NULL DEFAULT 0.5,
        "winnerId" varchar,
        "status" "ab_status_enum" NOT NULL DEFAULT 'RUNNING',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_ab_tests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ab_tests_campaign" FOREIGN KEY ("campaignId")
          REFERENCES "campaigns"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_ab_tests_campaign" UNIQUE ("campaignId")
      )
    `);

    // ── A/B Results ──
    await queryRunner.query(`
      CREATE TABLE "ab_results" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "abTestId" uuid NOT NULL,
        "variant" varchar NOT NULL,
        "sent" integer NOT NULL DEFAULT 0,
        "delivered" integer NOT NULL DEFAULT 0,
        "read" integer NOT NULL DEFAULT 0,
        "replied" integer NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ab_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ab_results_ab_test" FOREIGN KEY ("abTestId")
          REFERENCES "ab_tests"("id") ON DELETE CASCADE
      )
    `);

    // ── WaSession Multi-Account Fields ──
    await queryRunner.query(`ALTER TABLE "wa_sessions" ADD "label" varchar NOT NULL DEFAULT 'Default Account'`);
    await queryRunner.query(`ALTER TABLE "wa_sessions" ADD "isDefault" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "wa_sessions" ADD "dailySendCount" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "wa_sessions" ADD "dailySendDate" date`);

    // ── Campaign autoRotate ──
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "autoRotate" boolean NOT NULL DEFAULT false`);

    // ── Webhook Endpoints ──
    await queryRunner.query(`
      CREATE TABLE "webhook_endpoints" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "url" varchar NOT NULL,
        "secret" varchar NOT NULL,
        "events" text NOT NULL DEFAULT '',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_endpoints" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhook_endpoints_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_endpoints_userId" ON "webhook_endpoints" ("userId")`);

    // ── Webhook Deliveries ──
    await queryRunner.query(`
      CREATE TYPE "delivery_status_enum" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'ABANDONED')
    `);
    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "endpointId" uuid NOT NULL,
        "event" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "delivery_status_enum" NOT NULL DEFAULT 'PENDING',
        "responseCode" integer,
        "responseBody" text,
        "attemptCount" integer NOT NULL DEFAULT 0,
        "nextRetryAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deliveredAt" TIMESTAMP,
        CONSTRAINT "PK_webhook_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhook_deliveries_endpoint" FOREIGN KEY ("endpointId")
          REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_deliveries_endpoint_status" ON "webhook_deliveries" ("endpointId", "status")`);

    // ── Team Members (RBAC) ──
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('ADMIN', 'AGENT', 'VIEWER')
    `);
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "userId" uuid NOT NULL,
        "teamId" uuid NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'AGENT',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("userId", "teamId"),
        CONSTRAINT "FK_team_members_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_team_members_teamId" ON "team_members" ("teamId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_deliveries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "delivery_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_endpoints"`);
    await queryRunner.query(`ALTER TABLE "wa_sessions" DROP COLUMN IF EXISTS "dailySendDate"`);
    await queryRunner.query(`ALTER TABLE "wa_sessions" DROP COLUMN IF EXISTS "dailySendCount"`);
    await queryRunner.query(`ALTER TABLE "wa_sessions" DROP COLUMN IF EXISTS "isDefault"`);
    await queryRunner.query(`ALTER TABLE "wa_sessions" DROP COLUMN IF EXISTS "label"`);
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "autoRotate"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ab_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ab_tests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ab_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "export_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "export_format_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "export_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_stats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "campaign_stats"`);
  }
}
