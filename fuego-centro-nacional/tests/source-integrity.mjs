import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const required = [
  'index.html','styles.css','v45.css','v46.css','app.js','v45.js','v46.js','analytics-config.js','sw.js',
  'manifest.webmanifest','favicon.svg',
  'api/situation.js','api/geocode.js','api/reverse-geocode.js','api/health.js','api/fire-danger.js','api/weather.js',
  'playwright.config.mjs','tests/e2e.spec.mjs','tests/fire-danger-contract.mjs','vercel.json'
];
for (const file of required) await access(join(root, file), constants.R_OK);

const [html,app,v45,v46css,v46,health,danger,situation,weather,pkg,lock,manifest,readme,deployment] = await Promise.all([
  readFile(join(root,'index.html'),'utf8'),
  readFile(join(root,'app.js'),'utf8'),
  readFile(join(root,'v45.js'),'utf8'),
  readFile(join(root,'v46.css'),'utf8'),
  readFile(join(root,'v46.js'),'utf8'),
  readFile(join(root,'api/health.js'),'utf8'),
  readFile(join(root,'api/fire-danger.js'),'utf8'),
  readFile(join(root,'api/situation.js'),'utf8'),
  readFile(join(root,'api/weather.js'),'utf8'),
  readFile(join(root,'package.json'),'utf8'),
  readFile(join(root,'package-lock.json'),'utf8'),
  readFile(join(root,'manifest.webmanifest'),'utf8'),
  readFile(join(root,'README.md'),'utf8'),
  readFile(join(root,'DEPLOYMENT.md'),'utf8')
]);

for (const id of ['preventionPanel','recentPlaces','offlineSnapshotNotice']) assert.match(html,new RegExp(`id="${id}"`));
assert.match(html,/v46\.js\?v=/);
assert.match(html,/v46\.css\?v=/);
assert.match(html,/FuegoCerca/);
assert.match(app,/id="smartLocalInsights"/);
assert.match(app,/window\.FC_APP=/);
assert.match(app,/getLocalAssessment/);
assert.match(v45,/report\.querySelector\('#smartLocalInsights'\)\)return/);
assert.match(v46css,/\.preventionStatus/);
assert.match(v46css,/\.v46Tools\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
assert.match(v46css,/\.v46Card\{width:100%;min-width:0/);
assert.match(v46css,/\.historyList/);
assert.match(v46css,/\.shareFeedback/);
assert.match(v46css,/\.smartLocalPanel/);
assert.match(v46css,/\.smartDistances/);
assert.match(v46css,/\.smartTimeline/);
assert.match(v46,/fc_recent_places_v47/);
assert.match(v46,/fc_last_snapshot_v47/);
assert.match(v46,/navigator\.share/);
assert.match(v46,/api\/fire-danger/);
assert.match(v46,/No confirma un incendio/);
assert.match(v46,/ORIENTACIÓN CALCULADA POR FUEGOCERCA/);
assert.match(v46,/No es un nivel oficial/);
assert.match(v46,/Incidente oficial más próximo/);
assert.match(v46,/Señal preliminar más próxima/);
assert.match(v46,/Señal térmica más próxima/);
assert.match(v46,/combinedTimeline/);
assert.match(v46,/Más reciente primero/);
assert.match(v46,/id="shareReportBtn"/);
assert.match(health,/fireDangerEndpoint:true/);
assert.match(health,/smartLocalReport:true/);
assert.match(health,/localAttentionIsUnofficial:true/);
assert.match(health,/combinedIncidentTimeline:true/);
assert.match(health,/version:'4\.7\.0'/);
assert.match(danger,/AEMET/);
assert.match(danger,/version:'4\.7\.0'/);
assert.match(danger,/configured:false/);
assert.match(danger,/api_key/);
assert.match(situation,/data\.version='4\.7\.0'/);
assert.match(weather,/version:'4\.7\.0'/);
assert.equal(JSON.parse(pkg).version,'4.7.0');
assert.equal(JSON.parse(pkg).name,'fuegocerca');
assert.equal(JSON.parse(lock).version,'4.7.0');
assert.equal(JSON.parse(lock).name,'fuegocerca');
assert.equal(JSON.parse(manifest).name,'FuegoCerca');

const oldBrand=/Fuego Centro|Incendios España/;
for(const [name,content] of Object.entries({html,v46,health,manifest,readme,deployment})){
  assert.doesNotMatch(content,oldBrand,`${name} no debe reintroducir una marca anterior`);
}

console.log('Source integrity checks passed for FuegoCerca 4.7.');
