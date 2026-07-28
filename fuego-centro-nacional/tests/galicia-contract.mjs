import {strict as assert} from 'node:assert';
import galiciaHandler from '../api/galicia.js';
import situationHandler from '../api/situation.js';
import {
  __resetGaliciaCacheForTests,
  __setGaliciaRuntimeCacheForTests,
  __setGaliciaSourceForTests,
  buildCartociudadCandidatesUrl,
  buildCartociudadFindUrl,
  fetchGalicia,
  parseGaliciaBulletin,
  parseGaliciaListing
} from '../api/galicia-source.js';

const now=Date.parse('2026-07-28T12:00:00.000Z');
const bulletinUrl='https://mediorural.xunta.gal/es/recursos/noticias/medio-rural-informa-de-la-situacion-de-los-incendios-forestales-con-datos-99';
const listing=`
<article><a href="/es/recursos/noticias/otro-asunto">28/07/2026 - Otra noticia</a></article>
<article><a href="${bulletinUrl}">28/07/2026 - Medio Rural informa de la situación de los incendios forestales con datos recogidos hasta las 13.30 horas de hoy</a></article>`;
const bulletin=`
<div><strong>Santiago de Compostela, 28 de julio de 2026</strong></div>
<p>Datos recogidos hasta las 13.30 horas de hoy.</p>
<h2><strong>Activo A Capela-Capela</strong></h2>
<p>El fuego afecta al ayuntamiento coruñés de A Capela y supera las 28,5 hectáreas.</p>
<h2><strong>Controlado Ribeira-Oleiros</strong></h2>
<p>El incendio permanece controlado y afecta a una superficie provisional de 21 hectáreas.</p>`;

const candidates=parseGaliciaListing(listing);
assert.equal(candidates.length,1);
assert.equal(candidates[0].url,bulletinUrl);
assert.equal(candidates[0].listedAt,'2026-07-28T10:00:00.000Z');

const parsed=parseGaliciaBulletin(bulletin);
assert.equal(parsed.publishedAt,'2026-07-28T11:30:00.000Z');
assert.deepEqual(parsed.entries.map(item=>[item.municipality,item.parish,item.status,item.officialAreaHa]),[
  ['A Capela','Capela','ACTIVO',28.5],
  ['Ribeira','Oleiros','CONTROLADO',21]
]);

assert.equal(buildCartociudadCandidatesUrl('A Capela').searchParams.get('q'),'A Capela');
assert.equal(buildCartociudadFindUrl('A Capela','A Coruña').searchParams.get('q'),'A Capela, A Coruña');

const places={
  'A Capela':{province:'A Coruña',id:'15018',lat:43.444947,lon:-8.041097},
  Ribeira:{province:'A Coruña',id:'15073',lat:42.5567,lon:-8.9908}
};
const mockFetch=async url=>{
  const value=String(url);
  if(value.includes('/recursos/noticias?')||value.endsWith('/recursos/noticias')){
    return new Response(listing,{status:200,headers:{'content-type':'text/html'}});
  }
  if(value===bulletinUrl)return new Response(bulletin,{status:200,headers:{'content-type':'text/html'}});
  if(value.includes('/geocoder/candidates')){
    const name=new URL(value).searchParams.get('q');
    const place=places[name];
    return new Response(JSON.stringify(place?[{
      id:place.id,muni:name,type:'Municipio',province:place.province,
      comunidadAutonoma:'Galicia',muniCode:place.id,lat:0,lng:0
    }]:[]),{status:200,headers:{'content-type':'application/json'}});
  }
  if(value.includes('/geocoder/find')){
    const query=new URL(value).searchParams.get('q');
    const name=Object.keys(places).find(candidate=>query.startsWith(candidate+','));
    const place=places[name];
    return new Response(JSON.stringify(place?[{
      id:place.id,muni:name,type:'Municipio',province:place.province,
      comunidadAutonoma:'Galicia',lat:place.lat,lng:place.lon
    }]:[]),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error(`Unexpected URL ${url}`);
};

const result=await fetchGalicia({fetchImpl:mockFetch,now,useCache:false});
assert.equal(result.ok,true);
assert.equal(result.currentBulletin,true);
assert.equal(result.incidents.length,1);
assert.equal(result.archive.length,1);
assert.equal(result.unlocated.length,0);
assert.equal(result.coverageComplete,false);
assert.equal(result.confidenceForAbsence,false);
assert.equal(result.reportingThresholdHectares,20);
assert.equal(result.incidents[0].region,'Galicia');
assert.equal(result.incidents[0].status,'ACTIVO');
assert.equal(result.incidents[0].locationApproximate,true);
assert.equal(result.incidents[0].locationConfidence,'municipality');
assert.equal(result.incidents[0].officialAreaHa,28.5);
assert.match(result.incidents[0].summary,/no el origen, frente ni perímetro/);
assert.match(result.summary,/No constituye un inventario completo/);

const noCurrent=await fetchGalicia({
  fetchImpl:async url=>{
    if(String(url).includes('/recursos/noticias'))return new Response('<a href="/noticia">28/07/2026 - Otra noticia</a>',{status:200});
    throw new Error(`Unexpected URL ${url}`);
  },
  now,
  useCache:false
});
assert.equal(noCurrent.ok,true);
assert.equal(noCurrent.currentBulletin,false);
assert.equal(noCurrent.incidents.length,0);
assert.equal(noCurrent.confidenceForAbsence,false);
assert.match(noCurrent.summary,/no confirma la ausencia/i);

await assert.rejects(
  fetchGalicia({
    fetchImpl:async url=>{
      const value=String(url);
      if(value.includes('/recursos/noticias?')||value.endsWith('/recursos/noticias'))return new Response(listing,{status:200});
      if(value===bulletinUrl)return new Response(`
        <strong>Santiago de Compostela, 28 de julio de 2026</strong>
        <p>Datos recogidos hasta las 13.30 horas de hoy.</p>
        <h2>Formato nuevo no interpretable</h2><p>Texto.</p>
      `,{status:200});
      throw new Error(`Unexpected URL ${url}`);
    },
    now,
    useCache:false
  }),
  /no contiene bloques de incendios interpretables/
);

const cacheStore=new Map();
__setGaliciaRuntimeCacheForTests({
  get:async key=>cacheStore.get(key),
  set:async(key,value)=>{cacheStore.set(key,value)}
});
const cachedLive=await fetchGalicia({fetchImpl:mockFetch,now,useCache:true});
assert.equal(cachedLive.fallback,false);
const cachedFallback=await fetchGalicia({
  fetchImpl:async()=>new Response('fallo temporal',{status:503}),
  now:now+11*60*1000,
  useCache:true
});
assert.equal(cachedFallback.ok,true);
assert.equal(cachedFallback.fallback,true);
assert.equal(cachedFallback.degraded,true);
assert.match(cachedFallback.summary,/última copia válida/);
__resetGaliciaCacheForTests();

__setGaliciaSourceForTests(result);
try{
  const response=await galiciaHandler(new Request('https://fuegocerca.local/api/galicia'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.15.0');
  assert.equal(data.official,true);
  assert.equal(data.locationSource,'IGN · CartoCiudad');
  assert.equal(data.incidents[0].name,'A Capela');

  const nodeResponse={
    headers:{},
    setHeader(key,value){this.headers[key]=value},
    end(body){this.body=body}
  };
  await galiciaHandler({url:'/api/galicia'},nodeResponse);
  assert.equal(nodeResponse.statusCode,200);
  assert.equal(JSON.parse(nodeResponse.body).confidenceForAbsence,false);
}finally{
  __resetGaliciaCacheForTests();
}

const upstream={
  version:'4.15.0',
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
__setGaliciaSourceForTests(result);
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
  assert.equal(data.version,'4.15.0');
  assert.equal(data.incidents.filter(item=>item.region==='Galicia').length,1);
  assert.equal(data.archive.filter(item=>item.region==='Galicia').length,1);
  assert.equal(data.coverage.find(item=>item.id==='xunta-galicia')?.ok,true);
  assert.equal(data.coverage.find(item=>item.id==='xunta-galicia')?.confidenceForAbsence,false);
  assert.equal(data.regionalCoverage.find(item=>item.region==='Galicia')?.mode,'integrated');
  assert.equal(data.regionalCoverage.find(item=>item.region==='Galicia')?.confidenceForAbsence,false);
  assert.match(data.regionalCoverage.find(item=>item.region==='Galicia')?.description,/20 hectáreas/);
}finally{
  globalThis.fetch=originalFetch;
  __resetGaliciaCacheForTests();
}

console.log('Xunta Galicia contract checks passed.');
