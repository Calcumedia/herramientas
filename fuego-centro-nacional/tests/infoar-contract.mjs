import {strict as assert} from 'node:assert';
import infoarHandler from '../api/infoar.js';
import situationHandler from '../api/situation.js';
import {
  __resetInfoarCacheForTests,
  __setInfoarRuntimeCacheForTests,
  __setInfoarSourceForTests,
  approximateMunicipalityCenter,
  buildMunicipalityUrl,
  fetchInfoar,
  parseInfoarEntries
} from '../api/infoar-source.js';

const now=Date.parse('2026-07-28T12:00:00.000Z');
const reportText=`
Nivel de Alerta de Peligro de Incendios Forestales en Aragón
28 de julio de 2026
Incendios acaecidos en las últimas horas (datos provisionales)
Plan (H) (17/07/26): activo. Detección: llamada particular. Medios del Gobierno de Aragón: 2 helicópteros.
La Cerollera (T) (23/07/26): estabilizado. Medios del Gobierno de Aragón: 4 autobombas.
Gistaín (H) (27/07/26): extinguido. Detección: llamada particular.
`;

const parsed=parseInfoarEntries(reportText);
assert.deepEqual(parsed.map(item=>[item.name,item.province,item.status]),[
  ['Plan','Huesca','ACTIVO'],
  ['La Cerollera','Teruel','ESTABILIZADO'],
  ['Gistaín','Huesca','EXTINGUIDO']
]);
assert.match(parsed[0].detail,/2 helicópteros/);

const municipalityUrl=buildMunicipalityUrl('Plan','Huesca');
assert.equal(municipalityUrl.searchParams.get('service'),'WFS');
assert.equal(municipalityUrl.searchParams.get('typeName'),'Municipio');
assert.equal(municipalityUrl.searchParams.get('srsName'),'EPSG:4326');
assert.match(municipalityUrl.searchParams.get('CQL_FILTER'),/Plan/);
assert.match(municipalityUrl.searchParams.get('CQL_FILTER'),/Huesca/);

const center=approximateMunicipalityCenter({
  type:'Polygon',
  coordinates:[[[.2,42.5],[.4,42.5],[.4,42.7],[.2,42.7],[.2,42.5]]]
});
assert.ok(Math.abs(center.lat-42.6)<1e-9);
assert.ok(Math.abs(center.lon-.3)<1e-9);
assert.equal(approximateMunicipalityCenter({coordinates:[[[-5,10],[-4,11]]]}),null);

const centers={
  Plan:{lat:42.55,lon:.31,code:'22182'},
  'La Cerollera':{lat:40.82,lon:-.08,code:'44077'},
  Gistaín:{lat:42.59,lon:.34,code:'22114'}
};
const featureFor=name=>{
  const item=centers[name];
  return {
    type:'Feature',
    properties:{d_muni_ine:name,cmunine:item.code},
    geometry:{type:'Polygon',coordinates:[[
      [item.lon-.01,item.lat-.01],[item.lon+.01,item.lat-.01],
      [item.lon+.01,item.lat+.01],[item.lon-.01,item.lat+.01],
      [item.lon-.01,item.lat-.01]
    ]]}
  };
};
const mockFetch=async url=>{
  const value=String(url);
  if(value.includes('napif-pdf/download'))return new Response(new Uint8Array([37,80,68,70]),{
    status:200,headers:{'content-type':'application/pdf'}
  });
  if(value.includes('idearagon.aragon.es/Visor2D')){
    const cql=new URL(value).searchParams.get('CQL_FILTER')||'';
    const name=Object.keys(centers).find(candidate=>cql.includes(candidate));
    return new Response(JSON.stringify({type:'FeatureCollection',features:name?[featureFor(name)]:[]}),{
      status:200,headers:{'content-type':'application/json'}
    });
  }
  throw new Error(`Unexpected URL ${url}`);
};
const extractPdfImpl=async()=>({
  text:reportText,
  creationDate:"D:20260728094853+02'00'"
});
const result=await fetchInfoar({fetchImpl:mockFetch,extractPdfImpl,now,useCache:false});
assert.equal(result.ok,true);
assert.equal(result.incidents.length,2);
assert.equal(result.archive.length,1);
assert.equal(result.unlocated.length,0);
assert.equal(result.incidents[0].region,'Aragón');
assert.equal(result.incidents[0].status,'ACTIVO');
assert.equal(result.incidents[0].sourceConfidence,'alta');
assert.equal(result.incidents[0].confidence,'media');
assert.equal(result.incidents[0].locationApproximate,true);
assert.match(result.incidents[0].summary,/centro del término municipal/);
assert.equal(result.incidents[0].evidence[0].sourceType,'direct');
assert.match(result.summary,/2 incendios vigentes y 1 en archivo/);

const emptyResult=await fetchInfoar({
  fetchImpl:mockFetch,
  extractPdfImpl:async()=>({
    text:`Nivel de Alerta de Peligro de Incendios Forestales en Aragón
${'Incendios acaecidos en las últimas horas (datos provisionales)'}
No se relacionan incendios en el parte actual.`,
    creationDate:"D:20260728094853+02'00'"
  }),
  now,
  useCache:false
});
assert.equal(emptyResult.ok,true);
assert.equal(emptyResult.incidents.length,0);
assert.equal(emptyResult.archive.length,0);
assert.match(emptyResult.summary,/0 incendios vigentes/);

await assert.rejects(
  fetchInfoar({
    fetchImpl:mockFetch,
    extractPdfImpl:async()=>({text:'Documento sin la sección esperada',creationDate:"D:20260728094853+02'00'"}),
    now,
    useCache:false
  }),
  /sección de incendios interpretable/
);

await assert.rejects(
  fetchInfoar({
    fetchImpl:mockFetch,
    extractPdfImpl:async()=>({text:reportText,creationDate:"D:20260725094853+02'00'"}),
    now,
    useCache:false
  }),
  /no está vigente/
);

const cacheStore=new Map();
__setInfoarRuntimeCacheForTests({
  get:async key=>cacheStore.get(key),
  set:async(key,value)=>{cacheStore.set(key,value)}
});
const cachedLive=await fetchInfoar({fetchImpl:mockFetch,extractPdfImpl,now,useCache:true});
assert.equal(cachedLive.fallback,false);
const cachedFallback=await fetchInfoar({
  fetchImpl:async()=>new Response('fallo temporal',{status:503}),
  extractPdfImpl,
  now:now+11*60*1000,
  useCache:true
});
assert.equal(cachedFallback.ok,true);
assert.equal(cachedFallback.fallback,true);
assert.equal(cachedFallback.degraded,true);
assert.match(cachedFallback.summary,/última copia válida/);
__resetInfoarCacheForTests();

__setInfoarSourceForTests(result);
try{
  const response=await infoarHandler(new Request('https://fuegocerca.local/api/infoar'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.16.0');
  assert.equal(data.official,true);
  assert.equal(data.incidents[0].name,'Plan');

  const nodeResponse={
    headers:{},
    setHeader(key,value){this.headers[key]=value},
    end(body){this.body=body}
  };
  await infoarHandler({url:'/api/infoar'},nodeResponse);
  assert.equal(nodeResponse.statusCode,200);
  assert.equal(JSON.parse(nodeResponse.body).incidents[0].name,'Plan');
}finally{
  __resetInfoarCacheForTests();
}

const upstream={
  version:'4.16.0',
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
__setInfoarSourceForTests(result);
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
  assert.equal(data.version,'4.16.0');
  assert.equal(data.incidents.filter(item=>item.region==='Aragón').length,2);
  assert.equal(data.archive.filter(item=>item.region==='Aragón').length,1);
  assert.equal(data.coverage.find(item=>item.id==='infoar-aragon')?.ok,true);
  assert.equal(data.regionalCoverage.find(item=>item.region==='Aragón')?.mode,'integrated');
  assert.equal(data.regionalCoverage.find(item=>item.region==='Aragón')?.ok,true);
  assert.match(data.regionalCoverage.find(item=>item.region==='Aragón')?.description,/centro del término municipal/);

  const nodeResponse={
    headers:{},
    setHeader(key,value){this.headers[key]=value},
    end(body){this.body=body}
  };
  await situationHandler({url:'/api/situation'},nodeResponse);
  assert.equal(nodeResponse.statusCode,200);
  assert.equal(JSON.parse(nodeResponse.body).coverage.find(item=>item.id==='infoar-aragon')?.ok,true);
}finally{
  globalThis.fetch=originalFetch;
  __resetInfoarCacheForTests();
}

console.log('INFOAR Aragón contract checks passed.');
