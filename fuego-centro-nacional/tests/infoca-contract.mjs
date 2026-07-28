import {strict as assert} from 'node:assert';
import infocaHandler from '../api/infoca.js';
import situationHandler from '../api/situation.js';
import {buildInfocaQueryUrl,fetchInfoca,normalizeInfocaFeature,observedAtFromFeature} from '../api/infoca-source.js';

const now=Date.parse('2026-07-28T10:00:00.000Z');
const date=Date.parse('2026-07-28T00:00:00.000Z');
const features=[
  {
    attributes:{OID_ENTERO:1,TERMINO_MUNICIPAL:'Cazalla de la Sierra',PROVINCIA:'SEVILLA',TIPO_INCIDENTE:'IIFF INCENDIOS FORESTALES',ESTADO:'ACTIVO',FECHA:date,HORA:'08:15:00',MEDIOS_AEREOS:2,BRICAS:1,GRUPOS_ESPECIALISTAS:3,VEHICULOS:2,TECNICOS:1,GRUPOS_APOYO:1},
    geometry:{x:-5.759,y:37.931}
  },
  {
    attributes:{OID_ENTERO:2,TERMINO_MUNICIPAL:'Lepe',PROVINCIA:'HUELVA',TIPO_INCIDENTE:'IIFF INCENDIOS FORESTALES',ESTADO:'CONTROLADO',FECHA:date,HORA:'07:00:00'},
    geometry:{x:-7.223,y:37.218}
  },
  {
    attributes:{OID_ENTERO:3,TERMINO_MUNICIPAL:'Madrid',PROVINCIA:'MADRID',ESTADO:'ACTIVO',FECHA:date,HORA:'06:00:00'},
    geometry:{x:-3.7,y:40.4}
  },
  {
    attributes:{OID_ENTERO:4,TERMINO_MUNICIPAL:'Mijas',PROVINCIA:'MÁLAGA',ESTADO:'EXTINGUIDO',FECHA:date,HORA:'05:00:00'},
    geometry:{x:-4.64,y:36.59}
  },
  {
    attributes:{OID_ENTERO:5,TERMINO_MUNICIPAL:'Écija',PROVINCIA:'SEVILLA',ESTADO:'SIN CLASIFICAR',FECHA:date,HORA:'04:00:00'},
    geometry:{x:-5.08,y:37.54}
  }
];

const query=buildInfocaQueryUrl();
assert.equal(query.searchParams.get('f'),'json');
assert.match(query.searchParams.get('where'),/EXTINGUIDO/);
assert.equal(query.searchParams.get('outSR'),'4326');

const observed=observedAtFromFeature(features[0].attributes);
assert.match(observed,/^2026-07-28T06:15:00\.000Z$/);

const normalized=normalizeInfocaFeature(features[0],{now,receivedAt:'2026-07-28T10:00:00.000Z'});
assert.equal(normalized.name,'Cazalla de la Sierra');
assert.equal(normalized.region,'Andalucía');
assert.equal(normalized.statusClass,'active');
assert.equal(normalized.directSources,1);
assert.equal(normalized.confidence,'alta');
assert.equal(normalized.officialResources.aircraft,2);
assert.equal(normalized.evidence[0].sourceType,'direct');

assert.equal(normalizeInfocaFeature(features[2],{now}),null,'must reject records outside Andalusia');
assert.equal(normalizeInfocaFeature(features[3],{now}),null,'must reject extinguished records');
assert.equal(normalizeInfocaFeature(features[4],{now}),null,'must reject unknown states');

const mockFetch=async url=>{
  assert.match(String(url),/FeatureServer\/2\/query/);
  return new Response(JSON.stringify({features}),{status:200,headers:{'content-type':'application/json'}});
};
const result=await fetchInfoca({fetchImpl:mockFetch,now});
assert.equal(result.ok,true);
assert.equal(result.incidents.length,1);
assert.equal(result.archive.length,1);
assert.match(result.summary,/1 vigentes y 1 controlados/);

const originalFetch=globalThis.fetch;
globalThis.fetch=mockFetch;
try{
  const response=await infocaHandler(new Request('https://fuegocerca.local/api/infoca'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.17.1');
  assert.equal(data.official,true);
  assert.equal(data.incidents[0].name,'Cazalla de la Sierra');
}finally{
  globalThis.fetch=originalFetch;
}

await assert.rejects(
  fetchInfoca({fetchImpl:async()=>new Response('error',{status:503}),now}),
  /INFOCA HTTP 503/
);

const upstreamSituation={
  version:'4.10.1',
  dataEngineVersion:'4.3.1',
  degraded:false,
  incidents:[{
    id:'preliminary-cazalla',
    name:'Cazalla de la Sierra',
    area:'Sevilla',
    status:'SIN CONFIRMAR',
    statusClass:'unconfirmed',
    risk:'watch',
    riskLabel:'VIGILANCIA',
    riskScore:20,
    confidence:'baja',
    lat:37.931,
    lon:-5.759,
    directSources:0,
    evidence:[{source:'Agregador',sourceType:'preliminary',status:'SIN CONFIRMAR',publishedAt:'2026-07-28T05:00:00.000Z'}],
    timeline:[],
    alerts:[],
    thermalCount:2,
    thermalClusterCount:1
  }],
  archive:[],
  alerts:[],
  thermalSignals:[],
  news:[],
  coverage:[],
  regionalCoverage:[]
};
globalThis.fetch=async url=>{
  if(String(url).includes('FeatureServer/2/query'))return new Response(JSON.stringify({features}),{status:200});
  if(String(url).includes('ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW'))return new Response(JSON.stringify({features:[]}),{status:200});
  if(String(url).includes('fuego-centro-panel.vercel.app/api/situation'))return new Response(JSON.stringify(upstreamSituation),{status:200});
  throw new Error(`Unexpected URL ${url}`);
};
try{
  const response=await situationHandler(new Request('https://fuegocerca.local/api/situation'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.17.1');
  assert.equal(data.incidents.length,1,'must consolidate the preliminary and official record');
  assert.equal(data.incidents[0].status,'ACTIVO');
  assert.equal(data.incidents[0].directSources,1);
  assert.equal(data.incidents[0].confidence,'alta');
  assert.equal(data.incidents[0].thermalCount,2,'must preserve associated thermal context');
  assert.equal(data.archive.length,1);
  assert.equal(data.coverage.find(item=>item.id==='infoca')?.ok,true);
  assert.equal(data.coverage.find(item=>item.id==='bombers-catalunya')?.ok,true);
  assert.equal(data.regionalCoverage.find(item=>item.region==='Andalucía')?.mode,'integrated');
  assert.equal(data.regionalCoverage.find(item=>item.region==='Andalucía')?.ok,true);
  assert.equal(data.regionalCoverage.find(item=>item.region==='Cataluña')?.mode,'integrated');
  assert.equal(data.regionalCoverage.find(item=>item.region==='Cataluña')?.ok,true);
  assert.match(data.regionalCoverage.find(item=>item.region==='Castilla-La Mancha')?.description,/no oficial/);
  assert.match(data.regionalCoverage.find(item=>item.region==='Extremadura')?.description,/feed operativo georreferenciado/);
}finally{
  globalThis.fetch=originalFetch;
}

globalThis.fetch=async url=>{
  if(String(url).includes('FeatureServer/2/query'))return new Response('fallo temporal',{status:503});
  if(String(url).includes('ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW'))return new Response(JSON.stringify({features:[]}),{status:200});
  if(String(url).includes('fuego-centro-panel.vercel.app/api/situation'))return new Response(JSON.stringify({
    ...upstreamSituation,
    incidents:[],
    archive:[]
  }),{status:200});
  throw new Error(`Unexpected URL ${url}`);
};
try{
  const response=await situationHandler(new Request('https://fuegocerca.local/api/situation'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.degraded,true,'INFOCA failure must be visible');
  assert.equal(data.coverage.find(item=>item.id==='infoca')?.ok,false);
  assert.equal(data.regionalCoverage.find(item=>item.region==='Andalucía')?.ok,false);
}finally{
  globalThis.fetch=originalFetch;
}

console.log('INFOCA contract checks passed.');
