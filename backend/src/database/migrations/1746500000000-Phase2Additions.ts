import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2Additions1746500000000 implements MigrationInterface {
  name = 'Phase2Additions1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add recurrence JSONB column to campaigns
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "recurrence" jsonb`,
    );

    // Add timezone column to users
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" character varying NOT NULL DEFAULT 'UTC'`,
    );

    // Add opt-out audit trail columns to message_logs
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "optOutSource" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "triggeredBy" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP COLUMN IF EXISTS "triggeredBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP COLUMN IF EXISTS "optOutSource"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "timezone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "recurrence"`,
    );
  }
}
