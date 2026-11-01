import { runExportCli } from '../server/moderation/export';

await runExportCli(process.argv.slice(2));
