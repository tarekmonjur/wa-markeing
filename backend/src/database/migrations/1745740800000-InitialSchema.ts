import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1745740800000 implements MigrationInterface {
  name = 'InitialSchema1745740800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension (needed for uuid_generate_v4)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --- Enums ---
    await queryRunner.query(`
      CREATE TYPE "users_plan_enum" AS ENUM ('FREE','STARTER','PRO','AGENCY')
    `);
    await queryRunner.query(`
      CREATE TYPE "wa_sessions_status_enum" AS ENUM ('DISCONNECTED','CONNECTING','QR_READY','CONNECTED','TOS_BLOCK','BANNED')
    `);
    await queryRunner.query(`
      CREATE TYPE "campaigns_status_enum" AS ENUM ('DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','FAILED')
    `);
    await queryRunner.query(`
      CREATE TYPE "templates_mediatype_enum" AS ENUM ('IMAGE','VIDEO','AUDIO','DOCUMENT')
    `);
    await queryRunner.query(`
      CREATE TYPE "message_logs_direction_enum" AS ENUM ('INBOUND','OUTBOUND')
    `);
    await queryRunner.query(`
      CREATE TYPE "message_logs_status_enum" AS ENUM ('PENDING','SENT','DELIVERED','READ','FAILED')
    `);

    // --- users ---
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                uuid DEFAULT uuid_generate_v4() NOT NULL,
        "email"             character varying NOT NULL,
        "passwordHash"      character varying NOT NULL,
        "name"              character varying NOT NULL,
        "isEmailVerified"   boolean NOT NULL DEFAULT false,
        "plan"              "users_plan_enum" NOT NULL DEFAULT 'FREE',
        "refreshTokenHash"  character varying,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"         TIMESTAMP,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);

    // --- wa_sessions ---
    await queryRunner.query(`
      CREATE TABLE "wa_sessions" (
        "id"            uuid DEFAULT uuid_generate_v4() NOT NULL,
        "userId"        uuid NOT NULL,
        "phoneNumber"   character varying,
        "displayName"   character varying,
        "status"        "wa_sessions_status_enum" NOT NULL DEFAULT 'DISCONNECTED',
        "sessionData"   jsonb,
        "lastSeenAt"    TIMESTAMP,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wa_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wa_sessions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wa_sessions_userId" ON "wa_sessions" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_wa_sessions_status" ON "wa_sessions" ("status")`);

    // --- contact_groups ---
    await queryRunner.query(`
      CREATE TABLE "contact_groups" (
        "id"        uuid DEFAULT uuid_generate_v4() NOT NULL,
        "userId"    uuid NOT NULL,
        "name"      character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_contact_groups_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_contact_groups_userId" ON "contact_groups" ("userId")`);

    // --- contacts ---
    await queryRunner.query(`
      CREATE TABLE "contacts" (
        "id"            uuid DEFAULT uuid_generate_v4() NOT NULL,
        "userId"        uuid NOT NULL,
        "phone"         character varying NOT NULL,
        "name"          character varying,
        "email"         character varying,
        "customFields"  jsonb NOT NULL DEFAULT '{}',
        "optedOut"      boolean NOT NULL DEFAULT false,
        "optedOutAt"    TIMESTAMP,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"     TIMESTAMP,
        CONSTRAINT "PK_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contacts_userId_phone" UNIQUE ("userId", "phone"),
        CONSTRAINT "FK_contacts_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_userId" ON "contacts" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_phone" ON "contacts" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_userId_optedOut" ON "contacts" ("userId", "optedOut")`);

    // --- contact_group_members (join table) ---
    await queryRunner.query(`
      CREATE TABLE "contact_group_members" (
        "contactId" uuid NOT NULL,
        "groupId"   uuid NOT NULL,
        CONSTRAINT "PK_contact_group_members" PRIMARY KEY ("contactId", "groupId"),
        CONSTRAINT "FK_cgm_contactId" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_cgm_groupId" FOREIGN KEY ("groupId") REFERENCES "contact_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_cgm_contactId" ON "contact_group_members" ("contactId")`);
    await queryRunner.query(`CREATE INDEX "IDX_cgm_groupId" ON "contact_group_members" ("groupId")`);

    // --- templates ---
    await queryRunner.query(`
      CREATE TABLE "templates" (
        "id"        uuid DEFAULT uuid_generate_v4() NOT NULL,
        "userId"    uuid NOT NULL,
        "name"      character varying NOT NULL,
        "body"      text NOT NULL,
        "mediaUrl"  character varying,
        "mediaType" "templates_mediatype_enum",
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_templates_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_templates_userId" ON "templates" ("userId")`);

    // --- campaigns ---
    await queryRunner.query(`
      CREATE TABLE "campaigns" (
        "id"              uuid DEFAULT uuid_generate_v4() NOT NULL,
        "userId"          uuid NOT NULL,
        "sessionId"       uuid NOT NULL,
        "templateId"      uuid,
        "groupId"         uuid,
        "name"            character varying NOT NULL,
        "status"          "campaigns_status_enum" NOT NULL DEFAULT 'DRAFT',
        "scheduledAt"     TIMESTAMP,
        "startedAt"       TIMESTAMP,
        "completedAt"     TIMESTAMP,
        "totalContacts"   integer NOT NULL DEFAULT 0,
        "sentCount"       integer NOT NULL DEFAULT 0,
        "deliveredCount"  integer NOT NULL DEFAULT 0,
        "failedCount"     integer NOT NULL DEFAULT 0,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaigns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_campaigns_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_campaigns_sessionId" FOREIGN KEY ("sessionId") REFERENCES "wa_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_campaigns_templateId" FOREIGN KEY ("templateId") REFERENCES "templates"("id"),
        CONSTRAINT "FK_campaigns_groupId" FOREIGN KEY ("groupId") REFERENCES "contact_groups"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_campaigns_userId" ON "campaigns" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_campaigns_status" ON "campaigns" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_campaigns_scheduledAt" ON "campaigns" ("scheduledAt")`);

    // --- message_logs ---
    await queryRunner.query(`
      CREATE TABLE "message_logs" (
        "id"            uuid DEFAULT uuid_generate_v4() NOT NULL,
        "userId"        uuid NOT NULL,
        "campaignId"    uuid,
        "contactId"     uuid NOT NULL,
        "waMessageId"   character varying,
        "direction"     "message_logs_direction_enum" NOT NULL DEFAULT 'OUTBOUND',
        "body"          text,
        "mediaUrl"      character varying,
        "status"        "message_logs_status_enum" NOT NULL DEFAULT 'PENDING',
        "sentAt"        TIMESTAMP,
        "deliveredAt"   TIMESTAMP,
        "readAt"        TIMESTAMP,
        "failReason"    character varying,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_message_logs_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_message_logs_campaignId" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_message_logs_contactId" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_message_logs_userId" ON "message_logs" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_message_logs_campaignId" ON "message_logs" ("campaignId")`);
    await queryRunner.query(`CREATE INDEX "IDX_message_logs_contactId" ON "message_logs" ("contactId")`);
    await queryRunner.query(`CREATE INDEX "IDX_message_logs_status" ON "message_logs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_message_logs_waMessageId" ON "message_logs" ("waMessageId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "campaigns" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_group_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contacts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_groups" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wa_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS "message_logs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "message_logs_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "templates_mediatype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "campaigns_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wa_sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_plan_enum"`);
  }
}
