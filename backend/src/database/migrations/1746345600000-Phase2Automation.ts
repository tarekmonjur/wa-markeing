import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2Automation1746345600000 implements MigrationInterface {
  name = 'Phase2Automation1746345600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create MatchType enum
    await queryRunner.query(`
      CREATE TYPE "match_type_enum" AS ENUM('EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX')
    `);

    // Create auto_reply_rules table
    await queryRunner.query(`
      CREATE TABLE "auto_reply_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sessionId" uuid,
        "keyword" character varying NOT NULL,
        "matchType" "match_type_enum" NOT NULL DEFAULT 'CONTAINS',
        "replyBody" text NOT NULL,
        "mediaUrl" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auto_reply_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auto_reply_rules_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_auto_reply_rules_user_active" ON "auto_reply_rules" ("userId", "isActive")`);

    // Create StepCondition enum
    await queryRunner.query(`
      CREATE TYPE "step_condition_enum" AS ENUM('ALWAYS', 'NO_REPLY', 'REPLIED')
    `);

    // Create EnrollStatus enum
    await queryRunner.query(`
      CREATE TYPE "enroll_status_enum" AS ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'UNSUBSCRIBED')
    `);

    // Create drip_sequences table
    await queryRunner.query(`
      CREATE TABLE "drip_sequences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_drip_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_drip_sequences_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_drip_sequences_user" ON "drip_sequences" ("userId")`);

    // Create drip_steps table
    await queryRunner.query(`
      CREATE TABLE "drip_steps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sequenceId" uuid NOT NULL,
        "stepNumber" integer NOT NULL,
        "templateId" uuid NOT NULL,
        "delayHours" integer NOT NULL,
        "condition" "step_condition_enum" NOT NULL DEFAULT 'ALWAYS',
        CONSTRAINT "PK_drip_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_drip_steps_sequence" FOREIGN KEY ("sequenceId") REFERENCES "drip_sequences"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_drip_steps_template" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_drip_steps_sequence_step" ON "drip_steps" ("sequenceId", "stepNumber")`);

    // Create drip_enrollments table
    await queryRunner.query(`
      CREATE TABLE "drip_enrollments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sequenceId" uuid NOT NULL,
        "contactId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "currentStep" integer NOT NULL DEFAULT 1,
        "status" "enroll_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "enrolledAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_drip_enrollments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_drip_enrollments_sequence_contact" UNIQUE ("sequenceId", "contactId"),
        CONSTRAINT "FK_drip_enrollments_sequence" FOREIGN KEY ("sequenceId") REFERENCES "drip_sequences"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_drip_enrollments_contact" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_drip_enrollments_sequence_status" ON "drip_enrollments" ("sequenceId", "status")`);

    // Add inbox indexes to message_logs
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_message_logs_contact_created" ON "message_logs" ("contactId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_message_logs_user_direction_created" ON "message_logs" ("userId", "direction", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_logs_user_direction_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_logs_contact_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drip_enrollments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drip_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drip_sequences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auto_reply_rules"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "enroll_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "step_condition_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "match_type_enum"`);
  }
}
