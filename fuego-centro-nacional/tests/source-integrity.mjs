import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const required = [
  'index.html','styles.css','v45.css','v46.css','app.js','v45.js','v46.js','analytics-config.js','sw.js',
  'manifest.webmanifest','favicon.svg',
  'api/situation.js','api/geocode.js','api/reverse-geocode.js','api/health.js','api/fire-danger.js','api/fire-danger-map.js','api/air-quality.js','api/fire-perimeters.js','api/road-incidents.js','api/weather.js',
  'playwright.config.mjs','tests/e2e.spec.mjs','tests/fire-danger-contract.mjs','tests/air-quality-contract.mjs','tests/fire-perimeters-contract.mjs','tests/road-incidents-contract.mjs','vercel.json'
];
for (const file of required) await access(join(root, file), constants.R_OK);

const [html,app,v45,v46css,v46,health,danger,dangerMap,airQuality,perimeters,roads,situation,weather,pkg,lock,manifest,readme,deployment,vercelConfig] = await Promise.all([
  readFile(join(root,'index.html'),'utf8'),
  readFile(join(root,'app.js'),'utf8'),
  readFile(join(root,'v45.js'),'utf8'),
  readFile(join(root,'v46.css'),'utf8'),
  readFile(join(root,'v46.js'),'utf8'),
  readFile(join(root,'api/health.js'),'utf8'),
  readFile(join(root,'api/fire-danger.js'),'utf8'),
  readFile(join(root,'api/fire-danger-map.js'),'utf8'),
  readFile(join(root,'api/air-quality.js'),'utf8'),
  readFile(join(root,'api/fire-perimeters.js'),'utf8'),
  readFile(join(root,'api/road-incidents.js'),'utf8'),
  readFile(join(root,'api/situation.js'),'utf8'),
  readFile(join(root,'api/weather.js'),'utf8'),
  readFile(join(root,'package.json'),'utf8'),
  readFile(join(root,'package-lock.json'),'utf8'),
  readFile(join(root,'manifest.webmanifest'),'utf8'),
  readFile(join(root,'README.md'),'utf8'),
  readFile(join(root,'DEPLOYMENT.md'),'utf8'),
  readFile(join(root,'vercel.json'),'utf8')
]);

for (const id of ['preventionPanel','recentPlaces','offlineSnapshotNotice']) assert.match(html,new RegExp(`id="${id}"`));
assert.match(html,/id="perimeterToggle"/);
assert.match(html,/Área quemada EFFIS/);
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
assert.match(v46css,/\.dangerProducts/);
assert.match(v46css,/\.airPanel/);
assert.match(v46css,/\.airLevel\.unfavourable/);
assert.match(v46css,/\.roadPanel/);
assert.match(v46css,/\.roadIncident/);
assert.match(v46css,/\.perimeterPanel/);
assert.match(v46css,/\.perimeterAge/);
assert.match(v46css,/\.perimeterLegend/);
assert.match(v46css,/\.roadIncidentList\.is-collapsed/);
assert.match(v46,/fc_recent_places_v47/);
assert.match(v46,/fc_last_snapshot_v47/);
assert.match(v46,/navigator\.share/);
assert.match(v46,/api\/fire-danger/);
assert.match(v46,/api\/air-quality/);
assert.match(v46,/api\/road-incidents/);
assert.match(v46,/api\/fire-perimeters/);
assert.match(v46,/getPerimeterLayerCount/);
assert.match(v46,/isPerimeterLayerVisible/);
assert.match(v46,/prewarmPerimeters/);
assert.match(v46,/Añadiendo las áreas EFFIS en segundo plano/);
assert.match(v46,/EFFIS se está actualizando en segundo plano/);
assert.match(v46,/No es un incendio activo ni el frente de llama/);
assert.match(v46,/No se vincula automáticamente/i);
assert.match(v46,/Ver las \$\{incidents\.length\} incidencias priorizadas/);
assert.match(v46,/sampleDangerProduct/);
assert.match(v46,/No es una alerta/);
assert.match(v46,/relationshipNote/);
assert.match(v46,/No confirma un incendio/);
assert.match(v46,/No confirma humo de un incendio/);
assert.match(v46,/no es una medición exacta/);
assert.match(v46,/ORIENTACIÓN CALCULADA POR FUEGOCERCA/);
assert.match(v46,/No es un nivel oficial/);
assert.match(v46,/Incidente oficial más próximo/);
assert.match(v46,/Señal preliminar más próxima/);
assert.match(v46,/Señal térmica más próxima/);
assert.match(v46,/combinedTimeline/);
assert.match(v46,/Más reciente primero/);
assert.match(v46,/id="shareReportBtn"/);
assert.match(health,/fireDangerEndpoint:true/);
assert.match(health,/airQualityEndpoint:true/);
assert.match(health,/airQualityOfficialDataset:true/);
assert.match(health,/airQualityFireAttribution:false/);
assert.match(health,/smartLocalReport:true/);
assert.match(health,/localAttentionIsUnofficial:true/);
assert.match(health,/combinedIncidentTimeline:true/);
assert.match(health,/fireDangerOfficialRaster:true/);
assert.match(health,/roadIncidentsEndpoint:true/);
assert.match(health,/firePerimetersEndpoint:true/);
assert.match(health,/effisPerimeterDistance:true/);
assert.match(health,/effisMapLayerToggle:true/);
assert.match(health,/effisAgeClassification:true/);
assert.match(health,/effisSharedDatasetCacheMinutes:60/);
assert.match(health,/effisRuntimeCache:true/);
assert.match(health,/effisFunctionRuntime:'nodejs'/);
assert.match(health,/effisMaxDurationSeconds:60/);
assert.match(health,/effisRuntimeCacheTtlHours:24/);
assert.match(health,/effisBackgroundRefresh:true/);
assert.match(health,/effisAutomaticPrewarm:true/);
assert.match(health,/effisServerTiming:true/);
assert.match(health,/effisStaleFallbackHours:24/);
assert.match(health,/effisAutoAssociation:false/);
assert.match(health,/version:'4\.10\.1'/);
assert.match(danger,/AEMET/);
assert.match(danger,/version:'4\.10\.1'/);
assert.match(danger,/exactLocalLevel:true/);
assert.match(danger,/timeline\/riesgo/);
assert.match(dangerMap,/imagen\/RIESGO/);
assert.match(airQuality,/ica-ultima-hora\.csv/);
assert.match(airQuality,/runtime:'nodejs'/);
assert.match(airQuality,/maxDuration:20/);
assert.match(airQuality,/version:'4\.10\.1'/);
assert.match(airQuality,/new URL\(request\.url,'https:\/\/fuegocerca\.local'\)/);
assert.match(airQuality,/if\(!response\)return webResponse/);
assert.match(airQuality,/Datos horarios provisionales y no validados/);
assert.match(airQuality,/no atribuye su resultado al humo/i);
assert.match(roads,/DATEX II 3\.7/);
assert.match(roads,/datex2_v37\.xml/);
assert.match(perimeters,/api\.effis\.emergency\.copernicus\.eu/);
assert.match(perimeters,/distanceToEdgeKm/);
assert.match(perimeters,/CACHE_TTL_MS/);
assert.match(perimeters,/FETCH_TIMEOUT_MS/);
assert.match(perimeters,/getCache/);
assert.match(perimeters,/waitUntil/);
assert.match(perimeters,/maxDuration:60/);
assert.equal(JSON.parse(vercelConfig).functions['api/fire-perimeters.js'].maxDuration,60);
assert.match(perimeters,/response\.statusCode=webResponse\.status/);
assert.match(perimeters,/response\.end\(await webResponse\.text\(\)\)/);
assert.match(perimeters,/RUNTIME_CACHE_KEY/);
assert.match(perimeters,/runtime-stale/);
assert.match(perimeters,/server-timing/);
assert.match(perimeters,/ageCategory/);
assert.match(perimeters,/associationStatus:'not-linked'/);
assert.match(perimeters,/No representa el frente de llama/);
assert.match(situation,/data\.version='4\.10\.1'/);
assert.match(weather,/version:'4\.10\.1'/);
assert.equal(JSON.parse(pkg).version,'4.10.1');
assert.equal(JSON.parse(pkg).name,'fuegocerca');
assert.equal(JSON.parse(pkg).dependencies['@vercel/functions'],'^3.7.6');
assert.equal(JSON.parse(lock).version,'4.10.1');
assert.equal(JSON.parse(lock).name,'fuegocerca');
assert.equal(JSON.parse(manifest).name,'FuegoCerca');

const oldBrand=/Fuego Centro|Incendios España/;
for(const [name,content] of Object.entries({html,v46,health,manifest,readme,deployment})){
  assert.doesNotMatch(content,oldBrand,`${name} no debe reintroducir una marca anterior`);
}

assert.match(health,/effisNodeRelativeUrlCompatible:true/);
console.log('Source integrity checks passed for FuegoCerca 4.10.1.');
