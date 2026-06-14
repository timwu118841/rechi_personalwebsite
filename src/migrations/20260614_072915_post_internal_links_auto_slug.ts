import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_locales" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "_posts_v_locales" ADD COLUMN "version_generate_slug" boolean DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_locales" DROP COLUMN "generate_slug";
  ALTER TABLE "_posts_v_locales" DROP COLUMN "version_generate_slug";`)
}
