import {strict as assert} from 'node:assert';
import {
  __resetMurciaCacheForTests,
  __setMurciaRuntimeCacheForTests,
  buildMurciaCandidatesUrl,
  buildMurciaFindUrl,
  buildMurciaPostsUrl,
  fetchMurcia,
  MURCIA_API_URL,
  parseMurciaPosts
} from '../sources/murcia-source.js';

const now=Date.parse('2026-07-28T13:00:00.000Z');
const post=(id,date,title,content,modified=date)=>({
  id,date,modified,
  link:`https://noticias.112rmurcia.es/incidente-${id}/`,
  title:{rendered:title},
  content:{rendered:`<p>${content}</p>`}
});

const posts=[
  post(101,'2026-07-28T12:30:00','Extinguido el incendio forestal en La Pinilla (Fuente Álamo)','El incendio fue declarado activo y posteriormente CONTROLADO. A las 12:30 horas se declara EXTINGUIDO.'),
  post(100,'2026-07-27T18:00:00','Controlado el incendio forestal en La Pinilla (Fuente Álamo)','Servicios adscritos al Plan INFOMUR declaran CONTROLADO el incendio forestal.'),
  post(99,'2026-07-27T13:00:00','Servicios de emergencia trabajan en un incendio forestal en La Pinilla (Fuente Álamo)','Medios adscritos al Plan INFOMUR trabajan en el incendio ACTIVO.'),
  post(201,'2026-07-28T11:00:00','Servicios de emergencia adscritos al Plan INFOMUR trabajan en un incendio forestal en Moratalla','Bomberos y agentes medioambientales se encuentran movilizados.'),
  post(301,'2026-07-27T15:00:00','Controlado un incendio de vegetación en Molina de Segura','El Plan INFOMUR da por CONTROLADO el incendio de vegetación. Afectó a 2,5 hectáreas.'),
  post(401,'2026-07-28T10:00:00','Incendio en una planta de tratamiento de Ulea','Interviene el Plan INFOMUR en un incendio de residuos sólidos sin que llegue a afectar al terreno forestal.'),
  post(501,'2026-07-28T09:00:00','Nivel de peligro extremo de incendio forestal en la Región de Murcia','Campaña de prevención del Plan INFOMUR.'),
  post(601,'2026-07-28T08:00:00','Plan INFOMUR trabaja en un incendio forestal','Medios movilizados en un paraje sin municipio publicado.')
];

const parsed=parseMurciaPosts(posts);
assert.equal(parsed.records.length,5);
assert.equal(parsed.excluded.length,2);
assert.equal(parsed.unlocated.length,1);
assert.equal(parsed.records.find(item=>item.postId==='101')?.municipality,'Fuente Álamo de Murcia');
assert.equal(parsed.records.find(item=>item.postId==='101')?.site,'La Pinilla');
assert.equal(parsed.records.find(item=>item.postId==='101')?.status,'EXTINGUIDO');
assert.equal(parsed.records.find(item=>item.postId==='201')?.status,'EN INTERVENCIÓN');
assert.equal(parsed.records.find(item=>item.postId==='301')?.hectares,2.5);
assert.ok(parsed.excluded.some(item=>item.reason==='non-forest'));
assert.ok(parsed.excluded.some(item=>item.reason==='non-operational'));

assert.equal(buildMurciaPostsUrl().origin,new URL(MURCIA_API_URL).origin);
assert.equal(buildMurciaPostsUrl().searchParams.get('search'),'incendio');
assert.equal(buildMurciaCandidatesUrl('Moratalla').searchParams.get('q'),'Moratalla');
assert.equal(buildMurciaFindUrl('Moratalla','Murcia').searchParams.get('q'),'Moratalla, Murcia');

const places={
  'Fuente Álamo de Murcia':{id:'30021',lat:37.7237,lon:-1.1697},
  Moratalla:{id:'30028',lat:38.1898,lon:-1.8916},
  'Molina de Segura':{id:'30027',lat:38.0546,lon:-1.2110}
};
const mockFetch=async url=>{
  const value=String(url);
  if(value.startsWith(MURCIA_API_URL))return new Response(JSON.stringify(posts),{status:200,headers:{'content-type':'application/json'}});
  if(value.includes('/geocoder/candidates')){
    const name=new URL(value).searchParams.get('q');
    const place=places[name];
    return new Response(JSON.stringify(place?[{
      id:place.id,muni:name,type:'Municipio',province:'Murcia',
      comunidadAutonoma:'Región de Murcia',muniCode:place.id
    }]:[]),{status:200,headers:{'content-type':'application/json'}});
  }
  if(value.includes('/geocoder/find')){
    const query=new URL(value).searchParams.get('q');
    const name=Object.keys(places).find(candidate=>query.startsWith(`${candidate},`));
    const place=places[name];
    return new Response(JSON.stringify(place?[{
      id:place.id,muni:name,type:'Municipio',province:'Murcia',
      comunidadAutonoma:'Región de Murcia',lat:place.lat,lng:place.lon
    }]:[]),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error(`Unexpected URL ${url}`);
};

const result=await fetchMurcia({fetchImpl:mockFetch,now,useCache:false});
assert.equal(result.ok,true);
assert.equal(result.coverageComplete,false);
assert.equal(result.confidenceForAbsence,false);
assert.equal(result.incidents.length,1);
assert.equal(result.archive.length,2);
assert.equal(result.incidents[0].municipality,'Moratalla');
assert.equal(result.incidents[0].status,'EN INTERVENCIÓN');
assert.equal(result.incidents[0].locationApproximate,true);
assert.equal(result.incidents[0].locationConfidence,'municipality');
assert.match(result.incidents[0].summary,/no el origen, frente ni perímetro/);
const pinilla=result.archive.find(item=>item.site==='La Pinilla');
assert.ok(pinilla);
assert.equal(pinilla.status,'EXTINGUIDO');
assert.equal(pinilla.timeline.length,3);
assert.deepEqual(pinilla.timeline.map(item=>item.status),['EXTINGUIDO','CONTROLADO','ACTIVO']);
assert.equal(result.archive.find(item=>item.municipality==='Molina de Segura')?.hectares,2.5);
assert.equal(result.unlocated.length,1);
assert.match(result.summary,/fuente selectiva, no un inventario completo/i);

const expired=await fetchMurcia({
  fetchImpl:mockFetch,
  now:now+8*24*60*60*1000,
  useCache:false
});
assert.equal(expired.ok,true);
assert.equal(expired.incidents.length,0);
assert.equal(expired.archive.length,0);
assert.equal(expired.confidenceForAbsence,false);
assert.match(expired.summary,/no confirma la ausencia/i);

const cacheStore=new Map();
__setMurciaRuntimeCacheForTests({
  get:async key=>cacheStore.get(key),
  set:async(key,value)=>{cacheStore.set(key,value)}
});
const cachedLive=await fetchMurcia({fetchImpl:mockFetch,now,useCache:true});
assert.equal(cachedLive.fallback,false);
const cachedFallback=await fetchMurcia({
  fetchImpl:async()=>new Response('fallo temporal',{status:503}),
  now:now+11*60*1000,
  useCache:true
});
assert.equal(cachedFallback.ok,true);
assert.equal(cachedFallback.fallback,true);
assert.equal(cachedFallback.degraded,true);
assert.match(cachedFallback.summary,/última copia válida/);
__resetMurciaCacheForTests();

console.log('INFOMUR Murcia parser contract checks passed; runtime integration remains disabled.');
