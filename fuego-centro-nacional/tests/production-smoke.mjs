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
assert.equal(situation.version,'4.18.0');
assert.ok(Array.isArray(situation.incidents), 'incidents must be an array');
assert.ok(Array.isArray(situation.alerts), 'alerts must be an array');
assert.ok(Array.isArray(situation.coverage), 'coverage must be an array');
assert.ok(Array.isArray(situation.regionalCoverage), 'regionalCoverage must be an array');
assert.equal(situation.sourceMonitor?.version,'4.18.0','situation must expose the production source monitor');
assert.ok(Array.isArray(situation.sourceMonitor?.entries),'source monitor entries must be an array');
assert.ok(Array.isArray(situation.sourceMonitor?.issues),'source monitor issues must be an array');
assert.equal(situation.regionalCoverage.length, 19, 'national coverage directory must include 19 territories');
function assertAdmissionGate(region,label){
  assert.equal(region?.declaredMode,'integrated',`${label} must remain configured as a direct integration`);
  assert.equal(typeof region?.productionAdmitted,'boolean',`${label} must expose production admission`);
  assert.equal(typeof region?.sourceStatus,'string',`${label} must expose monitor status`);
  assert.equal(region?.mode,region?.productionAdmitted?'integrated':'limited',`${label} effective mode must follow the production gate`);
  if(!region?.productionAdmitted)assert.equal(region?.confidenceForAbsence,false,`${label} failure must not confirm absence`);
}
const andalusia=situation.regionalCoverage.find(item=>item.region==='Andalucía');
assertAdmissionGate(andalusia,'Andalusia');
assert.ok(situation.coverage.some(item=>item.id==='infoca'),'situation must expose INFOCA source coverage');
const catalonia=situation.regionalCoverage.find(item=>item.region==='Cataluña');
assertAdmissionGate(catalonia,'Catalonia');
assert.ok(situation.coverage.some(item=>item.id==='bombers-catalunya'),'situation must expose Bombers source coverage');
const aragon=situation.regionalCoverage.find(item=>item.region==='Aragón');
assertAdmissionGate(aragon,'Aragon');
assert.match(aragon?.description||'',/centro del término municipal/);
assert.ok(situation.coverage.some(item=>item.id==='infoar-aragon'),'situation must expose INFOAR source coverage');
const galicia=situation.regionalCoverage.find(item=>item.region==='Galicia');
assertAdmissionGate(galicia,'Galicia');
assert.equal(galicia?.confidenceForAbsence,false,'Galicia bulletins must not prove the absence of fires');
assert.match(galicia?.description||'',/20 hectáreas/);
assert.ok(situation.coverage.some(item=>item.id==='xunta-galicia'),'situation must expose Galicia source coverage');
const asturias=situation.regionalCoverage.find(item=>item.region==='Principado de Asturias');
assertAdmissionGate(asturias,'Asturias');
assert.equal(asturias?.confidenceForAbsence,false,'SEPA bulletins must not prove the absence of fires');
assert.match(asturias?.description||'',/parte vigente no confirma/);
assert.ok(situation.coverage.some(item=>item.id==='sepa-asturias'),'situation must expose Asturias source coverage');
const murcia=situation.regionalCoverage.find(item=>item.region==='Región de Murcia');
assert.equal(murcia?.mode,'updates','Murcia must remain official-updates-only while the runtime feed is blocked');
assert.equal(murcia?.ok,false,'Murcia must not be presented as directly integrated');
assert.equal(murcia?.confidenceForAbsence,false,'INFOMUR silence must not prove the absence of fires');
assert.match(murcia?.description||'',/no se usan para confirmar incendios/);
assert.ok(!situation.coverage.some(item=>item.id==='infomur-murcia'),'a blocked INFOMUR feed must not appear as live source coverage');
const valenciana=situation.regionalCoverage.find(item=>item.region==='Comunitat Valenciana');
assert.equal(valenciana?.mode,'viewer','Valencian active incidents must remain viewer-only');
assert.match(valenciana?.description||'',/PREVIFOC/);
assert.match(valenciana?.description||'',/no se usa para confirmar incendios activos/);

const monitorHealth=await (await get('/api/health',/application\/json/)).json();
assert.equal(monitorHealth.version,'4.18.0');
assert.equal(monitorHealth.situationVersion,'4.18.0');
assert.ok(['ok','degraded'].includes(monitorHealth.status));
assert.equal(monitorHealth.sourceMonitorInHealth,true);
assert.equal(monitorHealth.sourceMonitor?.configuredDirectSources,7);
assert.equal(monitorHealth.sourceMonitor?.admittedDirectSources+monitorHealth.sourceMonitor?.limitedDirectSources,monitorHealth.sourceMonitor?.configuredDirectSources);
assert.equal(monitorHealth.sourceMonitor?.alerting?.externalNotifications,false);
assert.equal(monitorHealth.sourceMonitor?.persistence?.storage,'Vercel Runtime Cache');
assert.equal(monitorHealth.sourceMonitor?.persistence?.durableDatabase,false);

const previfoc=await (await get('/api/previfoc?lat=39.4699&lon=-0.3763',/application\/json/)).json();
assert.equal(previfoc.version,'4.18.0');
assert.equal(previfoc.source,'112 Comunitat Valenciana · PREVIFOC');
assert.equal(previfoc.official,true);
assert.equal(typeof previfoc.current,'boolean');
if(previfoc.current){
  assert.ok([1,2,3].includes(previfoc.level?.value),'current PREVIFOC must expose an official level');
}
assert.match(previfoc.incidentCoverageNote||'',/subconjunto/);

const bombers=await (await get('/api/bombers',/application\/json/)).json();
assert.equal(bombers.version,'4.18.0');
assert.equal(bombers.official,true);
assert.equal(bombers.source,'Bombers de la Generalitat de Catalunya');
assert.ok(Array.isArray(bombers.incidents));
assert.ok(Array.isArray(bombers.archive));
assert.ok(Array.isArray(bombers.otherVegetation));

const infoar=await (await get('/api/infoar',/application\/json/)).json();
assert.equal(infoar.version,'4.18.0');
assert.equal(infoar.official,true);
assert.equal(infoar.source,'Gobierno de Aragón · INFOAR');
assert.ok(Array.isArray(infoar.incidents));
assert.ok(Array.isArray(infoar.archive));
assert.ok(Array.isArray(infoar.unlocated));

const geocode = await (await get('/api/geocode?q=Madrid', /application\/json/)).json();
assert.ok(Array.isArray(geocode.results) && geocode.results.length > 0, 'Madrid geocode must return results');
assert.ok(geocode.results.some(x => Math.abs(x.lat - 40.4167) < 0.2), 'Madrid coordinates look incorrect');

const health = await (await get('/api/health', /application\/json/)).json();
assert.ok(['ok','degraded'].includes(health.status));
assert.deepEqual(health.mapCenter, [40.4167, -3.7033]);
assert.equal(health.mapZoom, 6);
assert.equal(health.staticLocalitySearch, true);
assert.equal(health.initialAutoFit, false);
assert.equal(health.nationalCoverageDirectory, 19);
assert.equal(health.integratedRegionalTerritories, 7);
assert.equal(health.situationFunctionRegion, 'fra1');
assert.equal(health.sourceMonitorInHealth,true);
assert.equal(health.sourceAdmissionGate,true);
assert.equal(health.sourceFreshnessChecks,true);
assert.equal(health.sourceSchemaChecks,true);
assert.equal(health.sourceRuntimeLogging,true);
assert.equal(health.sourceExternalNotifications,false);
assert.equal(health.situationLastValidCache,true);
assert.equal(health.situationLastValidCacheStorage,'Vercel Runtime Cache');
assert.equal(health.situationCacheDurableDatabase,false);
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
assert.equal(health.asturiasOfficialBulletins, true);
assert.equal(health.asturiasDirectIntegration, true);
assert.equal(health.asturiasCoverageComplete, false);
assert.equal(health.asturiasAbsenceConfirmsSafety, false);
assert.equal(health.asturiasLocationApproximate, true);
assert.equal(health.asturiasLocationSource, 'IGN · CartoCiudad');
assert.equal(health.asturiasRuntimeCache, true);
assert.equal(health.asturiasRuntimeCacheTtlHours, 24);
assert.equal(health.asturiasReportMaxAgeHours, 36);
assert.equal(health.infomurOfficialUpdates, true);
assert.equal(health.infomurDirectIntegration, false);
assert.equal(health.infomurRuntimeBlocked, true);
assert.equal(health.infomurAbsenceConfirmsSafety, false);
assert.equal(health.infomurSourceUrl, 'https://noticias.112rmurcia.es/');
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
