import {strict as assert} from 'node:assert';
import bombersHandler from '../api/bombers.js';
import situationHandler from '../api/situation.js';
import {__resetBombersCacheForTests,__setBombersRuntimeCacheForTests,buildBombersQueryUrl,fetchBombers,normalizeBombersFeature} from '../api/bombers-source.js';

const now=Date.parse('2026-07-28T12:00:00.000Z');
const at=hours=>now-hours*60*60*1000;
const feature=(id,municipality,type,phase,hours,coordinates=[2.17,41.38])=>({
  attributes:{
    ESRI_OID:id,
    GlobalID:`{00000000-0000-0000-0000-${String(id).padStart(12,'0')}}`,
    TAL_COD_ALARMA1:'IV',
    TAL_DESC_ALARMA1:'incendi vegetació',
    TAL_COD_ALARMA2:type,
    TAL_DESC_ALARMA2:type==='VF'?'Incendi vegetació forestal':type==='VA'?'Incendi vegetació agrícola':'Incendi vegetació urbana',
    ACT_DAT_ACTUACIO:at(hours),
    ACT_DAT_INICI:at(hours),
    ACT_DAT_ACTUAL:at(hours),
    MUNICIPI_DPX:municipality,
    MUNICIPI_SIG:municipality,
    ACT_NUM_VEH:3,
    COM_FASE:phase
  },
  geometry:{x:coordinates[0],y:coordinates[1]}
});

const features=[
  feature(1,'Aiguamúrcia','VF','Actiu',2),
  feature(2,'Santa Coloma de Queralt','VF','Estabilitzat',3,[1.39,41.55]),
  feature(3,'Cubelles','VF','Controlat',24,[1.64,41.24]),
  feature(4,'Artés','VF','Extingit',48,[1.95,41.79]),
  feature(5,'Queralbs','VF','',1,[2.17,42.42]),
  feature(6,'Farrera','VF','',30,[1.29,42.45]),
  feature(7,'Garcia','VA','Actiu',2,[.65,41.14]),
  feature(8,'el Prat de Llobregat','VU','Actiu',2,[2.10,41.34]),
  feature(9,'Coordenada inválida','VF','Actiu',1,[-1.48,0])
];

const query=buildBombersQueryUrl();
assert.equal(query.searchParams.get('f'),'json');
assert.equal(query.searchParams.get('outSR'),'4326');
assert.equal(query.searchParams.get('cacheHint'),'true');
assert.match(query.searchParams.get('where'),/TAL_COD_ALARMA1/);
assert.match(query.searchParams.get('outFields'),/COM_FASE/);

const active=normalizeBombersFeature(features[0],{now,receivedAt:'2026-07-28T12:00:00.000Z'});
assert.equal(active.name,'Aiguamúrcia');
assert.equal(active.region,'Cataluña');
assert.equal(active.status,'ACTIVO');
assert.equal(active.statusClass,'active');
assert.equal(active.forest,true);
assert.equal(active.directSources,1);
assert.equal(active.confidence,'alta');
assert.equal(active.officialResources.vehicles,3);
assert.equal(active.evidence[0].sourceType,'direct');

const unphased=normalizeBombersFeature(features[4],{now,receivedAt:'2026-07-28T12:00:00.000Z'});
assert.equal(unphased.status,'FASE NO PUBLICADA');
assert.equal(unphased.statusClass,'unconfirmed');
assert.equal(unphased.confidence,'media');
assert.match(unphased.summary,/no publica todavía una fase/i);

assert.equal(normalizeBombersFeature(features[5],{now}),null,'an unphased record older than 24 hours must expire');
assert.equal(normalizeBombersFeature(features[8],{now}),null,'coordinates outside Catalunya must be rejected');

const mockBombersFetch=async url=>{
  assert.match(String(url),/ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW/);
  return new Response(JSON.stringify({features}),{status:200,headers:{'content-type':'application/json'}});
};
const result=await fetchBombers({fetchImpl:mockBombersFetch,now});
assert.equal(result.ok,true);
assert.equal(result.incidents.length,3);
assert.equal(result.archive.length,2);
assert.equal(result.otherVegetation.length,2);
assert.match(result.summary,/3 incendios forestales vigentes/);
assert.match(result.summary,/2 actuaciones agrícolas o urbanas separadas/);

const cacheStore=new Map();
__setBombersRuntimeCacheForTests({
  get:async key=>cacheStore.get(key),
  set:async(key,value)=>{cacheStore.set(key,value)}
});
const cachedLive=await fetchBombers({fetchImpl:mockBombersFetch,now,useCache:true});
assert.equal(cachedLive.fallback,false);
const cachedFallback=await fetchBombers({
  fetchImpl:async()=>new Response(JSON.stringify({error:{code:429,message:'Too many requests'}}),{status:200}),
  now:now+2*60*1000,
  useCache:true
});
assert.equal(cachedFallback.ok,true);
assert.equal(cachedFallback.fallback,true);
assert.equal(cachedFallback.degraded,true);
assert.match(cachedFallback.summary,/última copia válida/);
assert.match(cachedFallback.error,/429/);
__resetBombersCacheForTests();

const originalFetch=globalThis.fetch;
globalThis.fetch=mockBombersFetch;
try{
  const response=await bombersHandler(new Request('https://fuegocerca.local/api/bombers'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.13.0');
  assert.equal(data.official,true);
  assert.equal(data.incidents[0].evidence[0].source,'Bombers de la Generalitat de Catalunya');
}finally{
  globalThis.fetch=originalFetch;
}

await assert.rejects(
  fetchBombers({fetchImpl:async()=>new Response('error',{status:503}),now}),
  /Bombers HTTP 503/
);

const upstream={
  version:'4.13.0',
  dataEngineVersion:'4.3.1',
  generatedAt:'2026-07-28T12:00:00.000Z',
  degraded:false,
  incidents:[],
  archive:[],
  alerts:[],
  thermalSignals:[],
  news:[],
  coverage:[],
  regionalCoverage:[]
};
globalThis.fetch=async url=>{
  const value=String(url);
  if(value.includes('ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW'))return new Response(JSON.stringify({features}),{status:200});
  if(value.includes('AN_INCIDENTES_PRO/FeatureServer/2/query'))return new Response(JSON.stringify({features:[]}),{status:200});
  if(value.includes('fuego-centro-panel.vercel.app/api/situation'))return new Response(JSON.stringify(upstream),{status:200});
  throw new Error(`Unexpected URL ${url}`);
};
try{
  const response=await situationHandler(new Request('https://fuegocerca.local/api/situation'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.13.0');
  assert.equal(data.incidents.filter(item=>item.region==='Cataluña').length,3);
  assert.equal(data.archive.filter(item=>item.region==='Cataluña').length,2);
  assert.equal(data.coverage.find(item=>item.id==='bombers-catalunya')?.ok,true);
  assert.equal(data.regionalCoverage.find(item=>item.region==='Cataluña')?.mode,'integrated');
  assert.equal(data.regionalCoverage.find(item=>item.region==='Cataluña')?.ok,true);
  assert.match(data.regionalCoverage.find(item=>item.region==='Cataluña')?.description,/agrícolas y urbanas se mantienen separadas/);
}finally{
  globalThis.fetch=originalFetch;
}

console.log('Bombers Catalunya contract checks passed.');
