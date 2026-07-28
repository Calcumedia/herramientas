import { strict as assert } from 'node:assert';

const origin = process.env.FUEGOCERCA_URL || 'https://fuego-centro-nacional.vercel.app';

async function get(path, expectedType) {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'user-agent': 'FuegoCerca-CI/1.0' },
    redirect: 'follow',
  });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  const type = response.headers.get('content-type') || '';
  assert.match(type, expectedType, `${path} has unexpected content-type: ${type}`);
  return response;
}

const index = await (await get('/', /text\/html/)).text();
assert.match(index, /id="placeSearchForm"/);
assert.match(index, /id="placeQuery"/);
assert.match(index, /app\.js\?v=/);
assert.match(index, /styles\.css\?v=/);

const css = await (await get('/styles.css', /text\/css/)).text();
assert.match(css, /\.persistentSearch/);
assert.match(css, /pointer-events:auto/);

const app = await (await get('/app.js', /javascript/)).text();
assert.match(app, /setView\(\[40\.4167,-3\.7033\],6\)/);
assert.match(app, /placeSearchForm/);
assert.match(app, /initialAutoFit|renderMap\(false\)/);

const situation = await (await get('/api/situation', /application\/json/)).json();
assert.equal(situation.version,'4.12.0');
assert.ok(Array.isArray(situation.incidents), 'incidents must be an array');
assert.ok(Array.isArray(situation.alerts), 'alerts must be an array');
assert.ok(Array.isArray(situation.coverage), 'coverage must be an array');
assert.ok(Array.isArray(situation.regionalCoverage), 'regionalCoverage must be an array');
assert.equal(situation.regionalCoverage.length, 19, 'national coverage directory must include 19 territories');
const andalusia=situation.regionalCoverage.find(item=>item.region==='Andalucía');
assert.equal(andalusia?.mode,'integrated','Andalusia must use the direct INFOCA integration');
assert.equal(typeof andalusia?.ok,'boolean','Andalusia coverage must expose source health');
assert.ok(situation.coverage.some(item=>item.id==='infoca'),'situation must expose INFOCA source coverage');
const valenciana=situation.regionalCoverage.find(item=>item.region==='Comunitat Valenciana');
assert.equal(valenciana?.mode,'viewer','Valencian active incidents must remain viewer-only');
assert.match(valenciana?.description||'',/PREVIFOC/);
assert.match(valenciana?.description||'',/no se usa para confirmar incendios activos/);

const previfoc=await (await get('/api/previfoc?lat=39.4699&lon=-0.3763',/application\/json/)).json();
assert.equal(previfoc.version,'4.12.0');
assert.equal(previfoc.source,'112 Comunitat Valenciana · PREVIFOC');
assert.equal(previfoc.official,true);
assert.equal(typeof previfoc.current,'boolean');
if(previfoc.current){
  assert.ok([1,2,3].includes(previfoc.level?.value),'current PREVIFOC must expose an official level');
}
assert.match(previfoc.incidentCoverageNote||'',/subconjunto/);

const geocode = await (await get('/api/geocode?q=Madrid', /application\/json/)).json();
assert.ok(Array.isArray(geocode.results) && geocode.results.length > 0, 'Madrid geocode must return results');
assert.ok(geocode.results.some(x => Math.abs(x.lat - 40.4167) < 0.2), 'Madrid coordinates look incorrect');

const health = await (await get('/api/health', /application\/json/)).json();
assert.equal(health.status, 'ok');
assert.deepEqual(health.mapCenter, [40.4167, -3.7033]);
assert.equal(health.mapZoom, 6);
assert.equal(health.staticLocalitySearch, true);
assert.equal(health.initialAutoFit, false);
assert.equal(health.nationalCoverageDirectory, 19);
assert.equal(health.integratedRegionalTerritories, 3);
assert.equal(health.infocaEndpoint, true);
assert.equal(health.infocaOfficialSource, true);
assert.equal(health.infocaGeoreferenced, true);
assert.equal(health.infocaDirectIntegration, true);
assert.equal(health.infocamProvisionalNotOfficial, true);
assert.equal(health.infoexGeoreferencedFeed, false);
assert.equal(health.previfocEndpoint,true);
assert.equal(health.previfocOfficialPdf,true);
assert.equal(health.previfocLocalLevel,true);
assert.equal(health.previfocPreventiveOnly,true);
assert.equal(health.previfocIncidentFeedIntegrated,false);
assert.equal(health.valencianIncidentViewerSubset,true);
assert.equal(health.fireDangerOfficialRaster, true);
assert.equal(health.airQualityEndpoint, true);
assert.equal(health.airQualityOfficialDataset, true);
assert.equal(health.airQualityFireAttribution, false);
assert.equal(health.airQualityFunctionRuntime, 'nodejs');
assert.equal(health.airQualityMaxDurationSeconds, 20);
assert.equal(health.roadIncidentsEndpoint, true);
assert.ok(Array.isArray(health.failedSources));

console.log(`Production smoke checks passed for ${origin}.`);
