import {strict as assert} from 'node:assert';
import situationHandler from '../api/situation.js';
import {
  __resetAsturiasCacheForTests,
  __setAsturiasRuntimeCacheForTests,
  __setAsturiasSourceForTests,
  ASTURIAS_SOURCE_URL,
  buildAsturiasCandidatesUrl,
  buildAsturiasFindUrl,
  fetchAsturias,
  parseAsturiasBulletin
} from '../sources/asturias-source.js';

const now=Date.parse('2026-07-28T13:00:00.000Z');
const bulletin=`
<h1>Datos incendios forestales en Asturias</h1>
<p>La Morgal.- 2026/07/28</p>
<p>Hora: 13:40</p>
<p>Estado de los incendios forestales de Asturias:</p>
<p>- Allande: incendio forestal Pico Hospital. Estabilizado. Se mantiene vigilancia.</p>
<p>- Aller: incendio forestal en Río Aller/Puerto de Vegarada. Activo en zona alta.</p>
<p>- Nava: incendio forestal en el Monte de Casielles. Activo durante la mañana. Incendio controlado.</p>
<p>- Quirós (zona limítrofe con Lena): efectivos del SEPA revisarán puntos calientes.</p>
<p>- Incendio Villablino (León) sector Asturias (Leitariegos): colaboración con la comunidad vecina.</p>
<p>NOTA DE PRENSA</p>
<h2>DATOS INCENDIOS FORESTALES EN ASTURIAS</h2>
<p>La Morgal.- 2026/07/27</p>
<p>Hora: 19:22</p>
<p>- Caso: incendio forestal en La Gayera. Activo.</p>`;

const parsed=parseAsturiasBulletin(bulletin);
assert.equal(parsed.publishedAt,'2026-07-28T11:40:00.000Z');
assert.deepEqual(parsed.entries.map(item=>[item.municipality,item.site,item.status]),[
  ['Allande','Pico Hospital','ESTABILIZADO'],
  ['Aller','Río Aller/Puerto de Vegarada','ACTIVO'],
  ['Nava','el Monte de Casielles','CONTROLADO'],
  ['Quirós',null,'EN SEGUIMIENTO']
]);
assert.equal(parsed.excluded.length,1);
assert.equal(parsed.excluded[0].reason,'cross-border');

assert.equal(buildAsturiasCandidatesUrl('Aller').searchParams.get('q'),'Aller');
assert.equal(buildAsturiasFindUrl('Aller','Asturias').searchParams.get('q'),'Aller, Asturias');

const places={
  Allande:{id:'33001',lat:43.2704,lon:-6.6117},
  Aller:{id:'33002',lat:43.1561,lon:-5.7748},
  Nava:{id:'33040',lat:43.3586,lon:-5.5054},
  Quirós:{id:'33053',lat:43.1537,lon:-5.9732}
};
const mockFetch=async url=>{
  const value=String(url);
  if(value===ASTURIAS_SOURCE_URL)return new Response(bulletin,{status:200,headers:{'content-type':'text/html'}});
  if(value.includes('/geocoder/candidates')){
    const name=new URL(value).searchParams.get('q');
    const place=places[name];
    return new Response(JSON.stringify(place?[{
      id:place.id,muni:name,type:'Municipio',province:'Asturias',
      comunidadAutonoma:'Principado de Asturias',muniCode:place.id
    }]:[]),{status:200,headers:{'content-type':'application/json'}});
  }
  if(value.includes('/geocoder/find')){
    const query=new URL(value).searchParams.get('q');
    const name=Object.keys(places).find(candidate=>query.startsWith(`${candidate},`));
    const place=places[name];
    return new Response(JSON.stringify(place?[{
      id:place.id,muni:name,type:'Municipio',province:'Asturias',
      comunidadAutonoma:'Principado de Asturias',lat:place.lat,lng:place.lon
    }]:[]),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error(`Unexpected URL ${url}`);
};

const result=await fetchAsturias({fetchImpl:mockFetch,now,useCache:false});
assert.equal(result.ok,true);
assert.equal(result.currentBulletin,true);
assert.equal(result.incidents.length,3);
assert.equal(result.archive.length,1);
assert.equal(result.excluded.length,1);
assert.equal(result.unlocated.length,0);
assert.equal(result.coverageComplete,false);
assert.equal(result.confidenceForAbsence,false);
assert.equal(result.incidents[0].region,'Principado de Asturias');
assert.equal(result.incidents[0].locationApproximate,true);
assert.equal(result.incidents[0].locationConfidence,'municipality');
assert.match(result.incidents[0].summary,/no el origen, frente ni perímetro/);
assert.match(result.summary,/no un inventario completo/);
assert.equal(result.archive[0].status,'CONTROLADO');

const noCurrent=await fetchAsturias({
  fetchImpl:async()=>new Response(bulletin,{status:200}),
  now:now+48*60*60*1000,
  useCache:false
});
assert.equal(noCurrent.ok,true);
assert.equal(noCurrent.currentBulletin,false);
assert.equal(noCurrent.incidents.length,0);
assert.equal(noCurrent.confidenceForAbsence,false);
assert.match(noCurrent.summary,/no confirma la ausencia/i);

await assert.rejects(
  fetchAsturias({
    fetchImpl:async()=>new Response('<h1>Formato nuevo sin fecha operativa</h1>',{status:200}),
    now,
    useCache:false
  }),
  /no contiene un parte/
);

const cacheStore=new Map();
__setAsturiasRuntimeCacheForTests({
  get:async key=>cacheStore.get(key),
  set:async(key,value)=>{cacheStore.set(key,value)}
});
const cachedLive=await fetchAsturias({fetchImpl:mockFetch,now,useCache:true});
assert.equal(cachedLive.fallback,false);
const cachedFallback=await fetchAsturias({
  fetchImpl:async()=>new Response('fallo temporal',{status:503}),
  now:now+11*60*1000,
  useCache:true
});
assert.equal(cachedFallback.ok,true);
assert.equal(cachedFallback.fallback,true);
assert.equal(cachedFallback.degraded,true);
assert.match(cachedFallback.summary,/última copia válida/);
__resetAsturiasCacheForTests();

const upstream={
  version:'4.17.0',
  dataEngineVersion:'4.3.1',
  degraded:false,
  incidents:[],
  archive:[],
  alerts:[],
  thermalSignals:[],
  news:[],
  coverage:[],
  regionalCoverage:[]
};
__setAsturiasSourceForTests(result);
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{
  const value=String(url);
  if(value.includes('AN_INCIDENTES_PRO/FeatureServer/2/query'))return new Response(JSON.stringify({features:[]}),{status:200});
  if(value.includes('ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW'))return new Response(JSON.stringify({features:[]}),{status:200});
  if(value.includes('fuego-centro-panel.vercel.app/api/situation'))return new Response(JSON.stringify(upstream),{status:200});
  throw new Error(`Unexpected URL ${url}`);
};
try{
  const response=await situationHandler(new Request('https://fuegocerca.local/api/situation'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.17.0');
  assert.equal(data.incidents.filter(item=>item.region==='Principado de Asturias').length,3);
  assert.equal(data.archive.filter(item=>item.region==='Principado de Asturias').length,1);
  assert.equal(data.coverage.find(item=>item.id==='sepa-asturias')?.ok,true);
  assert.equal(data.coverage.find(item=>item.id==='sepa-asturias')?.confidenceForAbsence,false);
  assert.equal(data.regionalCoverage.find(item=>item.region==='Principado de Asturias')?.mode,'integrated');
  assert.equal(data.regionalCoverage.find(item=>item.region==='Principado de Asturias')?.confidenceForAbsence,false);
  assert.match(data.regionalCoverage.find(item=>item.region==='Principado de Asturias')?.description,/parte vigente no confirma/);
}finally{
  globalThis.fetch=originalFetch;
  __resetAsturiasCacheForTests();
}

console.log('SEPA Asturias contract checks passed.');
