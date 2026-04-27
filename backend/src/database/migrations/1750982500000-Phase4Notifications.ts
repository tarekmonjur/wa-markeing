import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4Notifications1750982500000 implements MigrationInterface {
  name = 'Phase4Notifications1750982500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "campaignCompleted" boolean NOT NULL DEFAULT true,
        "sessionDisconnected" boolean NOT NULL DEFAULT true,
        "tosBlockAlert" boolean NOT NULL DEFAULT true,
        "webhookAbandoned" boolean NOT NULL DEFAULT true,
        "dailySummary" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_preferences_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_preferences_userId"
        ON "notification_preferences" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_preferences_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
  }
}
