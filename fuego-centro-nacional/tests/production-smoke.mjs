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
assert.equal(situation.version,'4.15.0');
assert.ok(Array.isArray(situation.incidents), 'incidents must be an array');
assert.ok(Array.isArray(situation.alerts), 'alerts must be an array');
assert.ok(Array.isArray(situation.coverage), 'coverage must be an array');
assert.ok(Array.isArray(situation.regionalCoverage), 'regionalCoverage must be an array');
assert.equal(situation.regionalCoverage.length, 19, 'national coverage directory must include 19 territories');
const andalusia=situation.regionalCoverage.find(item=>item.region==='Andalucía');
assert.equal(andalusia?.mode,'integrated','Andalusia must use the direct INFOCA integration');
assert.equal(typeof andalusia?.ok,'boolean','Andalusia coverage must expose source health');
assert.ok(situation.coverage.some(item=>item.id==='infoca'),'situation must expose INFOCA source coverage');
const catalonia=situation.regionalCoverage.find(item=>item.region==='Cataluña');
assert.equal(catalonia?.mode,'integrated','Catalonia must use the direct Bombers integration');
assert.equal(typeof catalonia?.ok,'boolean','Catalonia coverage must expose source health');
assert.ok(situation.coverage.some(item=>item.id==='bombers-catalunya'),'situation must expose Bombers source coverage');
const aragon=situation.regionalCoverage.find(item=>item.region==='Aragón');
assert.equal(aragon?.mode,'integrated','Aragon must use the direct INFOAR integration');
assert.equal(typeof aragon?.ok,'boolean','Aragon coverage must expose source health');
assert.match(aragon?.description||'',/centro del término municipal/);
assert.ok(situation.coverage.some(item=>item.id==='infoar-aragon'),'situation must expose INFOAR source coverage');
const galicia=situation.regionalCoverage.find(item=>item.region==='Galicia');
assert.equal(galicia?.mode,'integrated','Galicia must integrate the direct Medio Rural bulletins');
assert.equal(typeof galicia?.ok,'boolean','Galicia coverage must expose source health');
assert.equal(galicia?.confidenceForAbsence,false,'Galicia bulletins must not prove the absence of fires');
assert.match(galicia?.description||'',/20 hectáreas/);
assert.ok(situation.coverage.some(item=>item.id==='xunta-galicia'),'situation must expose Galicia source coverage');
const valenciana=situation.regionalCoverage.find(item=>item.region==='Comunitat Valenciana');
assert.equal(valenciana?.mode,'viewer','Valencian active incidents must remain viewer-only');
assert.match(valenciana?.description||'',/PREVIFOC/);
assert.match(valenciana?.description||'',/no se usa para confirmar incendios activos/);

const previfoc=await (await get('/api/previfoc?lat=39.4699&lon=-0.3763',/application\/json/)).json();
assert.equal(previfoc.version,'4.15.0');
assert.equal(previfoc.source,'112 Comunitat Valenciana · PREVIFOC');
assert.equal(previfoc.official,true);
assert.equal(typeof previfoc.current,'boolean');
if(previfoc.current){
  assert.ok([1,2,3].includes(previfoc.level?.value),'current PREVIFOC must expose an official level');
}
assert.match(previfoc.incidentCoverageNote||'',/subconjunto/);

const bombers=await (await get('/api/bombers',/application\/json/)).json();
assert.equal(bombers.version,'4.15.0');
assert.equal(bombers.official,true);
assert.equal(bombers.source,'Bombers de la Generalitat de Catalunya');
assert.ok(Array.isArray(bombers.incidents));
assert.ok(Array.isArray(bombers.archive));
assert.ok(Array.isArray(bombers.otherVegetation));

const infoar=await (await get('/api/infoar',/application\/json/)).json();
assert.equal(infoar.version,'4.15.0');
assert.equal(infoar.official,true);
assert.equal(infoar.source,'Gobierno de Aragón · INFOAR');
assert.ok(Array.isArray(infoar.incidents));
assert.ok(Array.isArray(infoar.archive));
assert.ok(Array.isArray(infoar.unlocated));

const galiciaBulletins=await (await get('/api/galicia',/application\/json/)).json();
assert.equal(galiciaBulletins.version,'4.15.0');
assert.equal(galiciaBulletins.official,true);
assert.equal(galiciaBulletins.source,'Xunta de Galicia · Medio Rural');
assert.equal(galiciaBulletins.locationSource,'IGN · CartoCiudad');
assert.equal(typeof galiciaBulletins.currentBulletin,'boolean');
assert.equal(galiciaBulletins.coverageComplete,false);
assert.equal(galiciaBulletins.confidenceForAbsence,false);
assert.equal(galiciaBulletins.reportingThresholdHectares,20);
assert.ok(Array.isArray(galiciaBulletins.incidents));
assert.ok(Array.isArray(galiciaBulletins.archive));
assert.ok(Array.isArray(galiciaBulletins.unlocated));

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
assert.equal(health.integratedRegionalTerritories, 6);
assert.equal(health.infocaEndpoint, true);
assert.equal(health.infocaOfficialSource, true);
assert.equal(health.infocaGeoreferenced, true);
assert.equal(health.infocaDirectIntegration, true);
assert.equal(health.bombersEndpoint, true);
assert.equal(health.bombersOfficialSource, true);
assert.equal(health.bombersGeoreferenced, true);
assert.equal(health.bombersDirectIntegration, true);
assert.equal(health.bombersForestOnlyInSituation, true);
assert.equal(health.bombersUnpublishedPhaseIsNotActive, true);
assert.equal(health.bombersRuntimeCache, true);
assert.equal(health.bombersRuntimeCacheTtlHours, 6);
assert.equal(health.bombersFreshCacheSeconds, 60);
assert.equal(health.infoarEndpoint, true);
assert.equal(health.infoarOfficialPdf, true);
assert.equal(health.infoarDirectIntegration, true);
assert.equal(health.infoarStatusOfficial, true);
assert.equal(health.infoarLocationApproximate, true);
assert.equal(health.infoarRuntimeCache, true);
assert.equal(health.infoarRuntimeCacheTtlHours, 24);
assert.equal(health.infoarReportMaxAgeHours, 36);
assert.equal(health.galiciaEndpoint, true);
assert.equal(health.galiciaOfficialBulletins, true);
assert.equal(health.galiciaDirectIntegration, true);
assert.equal(health.galiciaCoverageComplete, false);
assert.equal(health.galiciaAbsenceConfirmsSafety, false);
assert.equal(health.galiciaReportingThresholdHectares, 20);
assert.equal(health.galiciaLocationApproximate, true);
assert.equal(health.galiciaLocationSource, 'IGN · CartoCiudad');
assert.equal(health.galiciaRuntimeCache, true);
assert.equal(health.galiciaRuntimeCacheTtlHours, 24);
assert.equal(health.galiciaReportMaxAgeHours, 36);
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
