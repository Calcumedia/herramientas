import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const required = [
  'index.html','styles.css','v45.css','v46.css','app.js','v45.js','v46.js','analytics-config.js','sw.js',
  'api/situation.js','api/geocode.js','api/reverse-geocode.js','api/health.js','api/fire-danger.js',
  'playwright.config.mjs','tests/e2e.spec.mjs','vercel.json'
];
for (const file of required) await access(join(root, file), constants.R_OK);

const [html,v46css,v46,health,danger] = await Promise.all([
  readFile(join(root,'index.html'),'utf8'),
  readFile(join(root,'v46.css'),'utf8'),
  readFile(join(root,'v46.js'),'utf8'),
  readFile(join(root,'api/health.js'),'utf8'),
  readFile(join(root,'api/fire-danger.js'),'utf8')
]);

for (const id of ['preventionPanel','shareReportBtn','recentPlaces','offlineSnapshotNotice']) assert.match(html,new RegExp(`id="${id}"`));
assert.match(html,/v46\.js\?v=/);
assert.match(html,/v46\.css\?v=/);
assert.match(v46css,/\.preventionStatus/);
assert.match(v46css,/\.historyList/);
assert.match(v46css,/\.shareFeedback/);
assert.match(v46,/fc_recent_places_v46/);
assert.match(v46,/fc_last_snapshot_v46/);
assert.match(v46,/navigator\.share/);
assert.match(v46,/api\/fire-danger/);
assert.match(v46,/No confirma un incendio/);
assert.match(health,/fireDangerEndpoint:true/);
assert.match(health,/version:'4\.6\.0'/);
assert.match(danger,/AEMET/);
assert.match(danger,/configured:false/);
assert.match(danger,/api_key/);

console.log('Source integrity checks passed for Fuego Centro 4.6.');
