import { Pool } from 'pg';
import { MigrationError, listMigrations, migrate } from '../server/db/migrate';

// npm run migrate                  apply everything not yet applied
// npm run migrate -- --dry-run     list what would be applied
// npm run migrate -- --baseline    mark every file as applied WITHOUT running it (for a database already set up another way)
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to the database to migrate.');
  process.exit(1);
}
const args = process.argv.slice(2);
const pool = new Pool({ connectionString: url, max: 1 });
try {
  const out = await migrate(pool, listMigrations(), { dryRun: args.includes('--dry-run'), baseline: args.includes('--baseline'), log: console.log });
  if (args.includes('--dry-run')) console.log(out.pending.length ? `Would apply:\n${out.pending.join('\n')}` : 'Nothing to apply.');
  else if (!out.applied.length && !out.baselined.length) console.log('Already up to date.');
} catch (e) {
  console.error(e instanceof MigrationError ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
