import {getCache} from '@vercel/functions';

export const MURCIA_SOURCE_URL='https://noticias.112rmurcia.es/';
export const MURCIA_API_URL='https://noticias.112rmurcia.es/wp-json/wp/v2/posts';
export const MURCIA_GEOCODER_URL='https://www.cartociudad.es/geocoder/';

const SOURCE='112 Región de Murcia · INFOMUR';
const CURRENT_MAX_AGE_MS=36*60*60*1000;
const ARCHIVE_MAX_AGE_MS=7*24*60*60*1000;
const CACHE_FRESH_MS=10*60*1000;
const CACHE_STALE_MS=24*60*60*1000;
const CACHE_TTL_SECONDS=24*60*60;
const CACHE_KEY='infomur-murcia-posts-v417';
const STATUSES={
  ACTIVO:{statusClass:'active',risk:'high',riskLabel:'ALTO',riskScore:610,archive:false},
  'EN INTERVENCIÓN':{statusClass:'active',risk:'high',riskLabel:'ALTO',riskScore:560,archive:false},
  ESTABILIZADO:{statusClass:'stabilized',risk:'medium',riskLabel:'MEDIO',riskScore:340,archive:false},
  CONTROLADO:{statusClass:'controlled',risk:'watch',riskLabel:'VIGILANCIA',riskScore:90,archive:true},
  EXTINGUIDO:{statusClass:'controlled',risk:'clear',riskLabel:'ARCHIVO',riskScore:20,archive:true}
};

const MUNICIPALITIES=[
  ['Fuente Álamo de Murcia',['fuente alamo de murcia','fuente alamo']],
  ['Villanueva del Río Segura',['villanueva del rio segura']],
  ['Caravaca de la Cruz',['caravaca de la cruz','caravaca']],
  ['Las Torres de Cotillas',['las torres de cotillas','torres de cotillas']],
  ['San Pedro del Pinatar',['san pedro del pinatar']],
  ['Alhama de Murcia',['alhama de murcia','alhama']],
  ['Molina de Segura',['molina de segura']],
  ['Puerto Lumbreras',['puerto lumbreras']],
  ['Los Alcázares',['los alcazares']],
  ['Campos del Río',['campos del rio']],
  ['Torre-Pacheco',['torre pacheco']],
  ['La Unión',['la union']],
  ['San Javier',['san javier']],
  ['Abanilla',['abanilla']],['Abarán',['abaran']],['Águilas',['aguilas']],
  ['Albudeite',['albudeite']],['Alcantarilla',['alcantarilla']],['Aledo',['aledo']],
  ['Alguazas',['alguazas']],['Archena',['archena']],['Beniel',['beniel']],
  ['Blanca',['blanca']],['Bullas',['bullas']],['Calasparra',['calasparra']],
  ['Cartagena',['cartagena']],['Cehegín',['cehegin']],['Ceutí',['ceuti']],
  ['Cieza',['cieza']],['Fortuna',['fortuna']],['Jumilla',['jumilla']],
  ['Librilla',['librilla']],['Lorca',['lorca']],['Lorquí',['lorqui']],
  ['Mazarrón',['mazarron']],['Moratalla',['moratalla']],['Mula',['mula']],
  ['Ojós',['ojos']],['Pliego',['pliego']],['Ricote',['ricote']],
  ['Santomera',['santomera']],['Totana',['totana']],['Ulea',['ulea']],
  ['Yecla',['yecla']]
].sort((a,b)=>Math.max(...b[1].map(x=>x.length))-Math.max(...a[1].map(x=>x.length)));

let memoryCache=null;
let runtimeCacheOverride;
let sourceOverride;

export function __resetMurciaCacheForTests(){
  memoryCache=null;
  runtimeCacheOverride=undefined;
  sourceOverride=undefined;
}

export function __setMurciaRuntimeCacheForTests(cache){
  runtimeCacheOverride=cache;
}

export function __setMurciaSourceForTests(value){
  sourceOverride=value;
}

function runtimeCache(){
  if(runtimeCacheOverride!==undefined)return runtimeCacheOverride;
  try{return getCache({namespace:'fuegocerca-murcia'})}catch{return null}
}

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function slug(value=''){
  return normalize(value).replace(/\s+/g,'-').replace(/^-|-$/g,'');
}

function decodeHtml(value=''){
  return String(value)
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#0*39;|&apos;/gi,"'")
    .replace(/&aacute;/gi,'á').replace(/&eacute;/gi,'é')
    .replace(/&iacute;/gi,'í').replace(/&oacute;/gi,'ó')
    .replace(/&uacute;/gi,'ú').replace(/&ntilde;/gi,'ñ')
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)));
}

function plainText(value=''){
  return decodeHtml(String(value)
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(?:p|li|h[1-6]|div|article|section)>/gi,'\n')
    .replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ')
    .trim();
}

function madridOffset(year,month){
  return month>=4&&month<=10?'+02:00':'+01:00';
}

function wpIso(value){
  if(!value)return null;
  const raw=String(value).trim();
  if(/[zZ]$|[+-]\d\d:\d\d$/.test(raw)){
    const date=new Date(raw);
    return Number.isNaN(date.getTime())?null:date.toISOString();
  }
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if(!match)return null;
  const date=new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]||'00'}${madridOffset(Number(match[1]),Number(match[2]))}`);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

function containsPhrase(haystack,needle){
  return new RegExp(`(?:^| )${needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?: |$)`).test(haystack);
}

function municipalityFrom(text,title=''){
  const normalized=normalize(text);
  for(const [municipality,aliases] of MUNICIPALITIES){
    if(aliases.some(alias=>containsPhrase(normalized,alias)))return municipality;
  }
  const normalizedTitle=normalize(title);
  const explicitMurcia=/\(\s*Murcia\s*\)|(?:municipio|t[eé]rmino municipal|pedan[ií]a)\s+de\s+Murcia\b/i.test(`${title} ${text}`)
    ||/(?:incendio|fuego)[^.!?]{0,100}\ben Murcia\b/i.test(title);
  if(explicitMurcia&&!normalizedTitle.includes('region de murcia'))return 'Murcia';
  return null;
}

function lastExplicitStatus(value=''){
  const matches=[...normalize(value).matchAll(/\b(extinguido|controlado|estabilizado|activo|apagado|sofocado)\b/g)];
  if(matches.length){
    const status=matches.at(-1)[1].toUpperCase();
    return ['APAGADO','SOFOCADO'].includes(status)?'EXTINGUIDO':status;
  }
  return /\b(trabajan|intervienen|movilizados|movilizadas|atienden|desplazados|desplazadas)\b/i.test(value)
    ?'EN INTERVENCIÓN'
    :null;
}

function excludedPost(text){
  const value=normalize(text);
  if(/\b(nivel de peligro|prevencion|prevenir|campana|simulacro|balance|estadistica|consejos|prohibicion|epoca de peligro)\b/.test(value))return 'non-operational';
  if(/\b(interviene|intervinieron|actuo|actuaron)\b.{0,80}\bincendios\b.{0,80}\b(semana|mes|ano)\b/.test(value))return 'summary';
  if(/\b(industrial|nave|vivienda|vehiculo|contenedor|vertedero|planta de tratamiento|residuos solidos)\b/.test(value)
    &&!/\b(incendio forestal|plan infomur|terreno forestal afectado)\b/.test(value))return 'non-forest';
  if(/\bsin (?:que )?(?:llegue a )?afectar (?:a la vegetacion|al terreno forestal|a la masa forestal|terreno forestal|masa forestal)\b/.test(value))return 'non-forest';
  return null;
}

function siteFrom(title,municipality){
  const clean=plainText(title);
  const direct=clean.match(/incendio(?:\s+forestal|\s+de\s+vegetaci[oó]n)?(?:\s+(?:declarado|originado))?\s+(?:en|de)\s+(?:el\s+paraje\s+|la\s+pedan[ií]a\s+)?([^(),.;:]+?)(?=\s*\(|,|\.|$)/i);
  const parenthetical=clean.match(/incendio(?:\s+forestal|\s+de\s+vegetaci[oó]n)?[^.;:]{0,80}?\ben\s+(?:el\s+paraje\s+|la\s+pedan[ií]a\s+)?([^(),.;:]+?)\s*\(([^)]+)\)/i)
    ||[...clean.matchAll(/\ben\s+(?:el\s+paraje\s+|la\s+pedan[ií]a\s+)?([^(),.;:]+?)\s*\(([^)]+)\)/gi)].at(-1);
  let site=direct?.[1]?.trim()||parenthetical?.[1]?.trim()||null;
  if(!site){
    const match=clean.match(/incendio(?:\s+forestal|\s+de\s+vegetaci[oó]n)?[^.;:]{0,80}?\ben\s+(?:el\s+paraje\s+|la\s+pedan[ií]a\s+)?([^,.;:()]+?)(?=\s+(?:del|de la)\s+t[eé]rmino|\s*\(|,|\.|$)/i);
    site=match?.[1]?.trim()||null;
  }
  if(site&&normalize(site)===normalize(municipality))site=null;
  if(site&&/^(?:un|el|la)\s+incendio/i.test(site))site=null;
  return site;
}

function hectaresFrom(text){
  const matches=[...String(text).matchAll(/(\d+(?:[.,]\d+)?)\s*(?:hect[aá]reas?|ha)\b/gi)];
  if(!matches.length)return null;
  const value=Number(matches.at(-1)[1].replace(',','.'));
  return Number.isFinite(value)?value:null;
}

export function parseMurciaPosts(posts=[]){
  const records=[];
  const excluded=[];
  const unlocated=[];
  for(const raw of Array.isArray(posts)?posts:[]){
    const title=plainText(raw?.title?.rendered||raw?.title||'');
    const content=plainText(raw?.content?.rendered||raw?.content||'');
    const combined=`${title}. ${content}`.trim();
    const reason=excludedPost(combined);
    const operational=/\b(incendio forestal|incendio de vegetacion|plan infomur)\b/i.test(normalize(combined));
    if(reason||!operational){
      excluded.push({id:raw?.id||null,title,reason:reason||'not-confirmed-operational'});
      continue;
    }
    const municipality=municipalityFrom(combined,title);
    const status=lastExplicitStatus(combined);
    const publishedAt=wpIso(raw?.date);
    const modifiedAt=wpIso(raw?.modified)||publishedAt;
    if(!municipality||!status||!modifiedAt){
      unlocated.push({id:raw?.id||null,title,municipality,status,publishedAt:modifiedAt});
      continue;
    }
    records.push({
      postId:String(raw.id),
      title,
      detail:content,
      municipality,
      site:siteFrom(title,municipality),
      status,
      observedAt:publishedAt||modifiedAt,
      publishedAt:modifiedAt,
      url:raw.link||MURCIA_SOURCE_URL,
      hectares:hectaresFrom(combined)
    });
  }
  return {records,excluded,unlocated};
}

export function buildMurciaPostsUrl(){
  const url=new URL(MURCIA_API_URL);
  url.searchParams.set('search','incendio');
  url.searchParams.set('per_page','50');
  url.searchParams.set('orderby','modified');
  url.searchParams.set('order','desc');
  url.searchParams.set('_fields','id,date,modified,link,title,content');
  return url;
}

export function buildMurciaCandidatesUrl(municipality){
  const url=new URL('https://www.cartociudad.es/geocoder/api/geocoder/candidates');
  url.searchParams.set('q',municipality);
  url.searchParams.set('limit','50');
  return url;
}

export function buildMurciaFindUrl(municipality,province){
  const url=new URL('https://www.cartociudad.es/geocoder/api/geocoder/find');
  url.searchParams.set('q',`${municipality}, ${province}`);
  return url;
}

async function locateMunicipality(municipality,{fetchImpl,signal}){
  const headers={accept:'application/json','user-agent':'FuegoCerca/4.17'};
  const candidatesResponse=await fetchImpl(buildMurciaCandidatesUrl(municipality),{headers,cache:'no-store',signal});
  if(!candidatesResponse.ok)throw Error(`CartoCiudad candidatos HTTP ${candidatesResponse.status}`);
  const candidates=await candidatesResponse.json();
  const exact=(Array.isArray(candidates)?candidates:[]).find(item=>
    normalize(item?.muni)===normalize(municipality)
    &&normalize(item?.type)==='municipio'
    &&normalize(item?.comunidadAutonoma||'').includes('murcia')
  );
  if(!exact?.province)return null;
  const findResponse=await fetchImpl(buildMurciaFindUrl(exact.muni,exact.province),{headers,cache:'no-store',signal});
  if(!findResponse.ok)throw Error(`CartoCiudad localización HTTP ${findResponse.status}`);
  const result=await findResponse.json();
  const match=(Array.isArray(result)?result:[result]).find(item=>
    normalize(item?.muni)===normalize(exact.muni)
    &&['municipio','poblacion'].includes(normalize(item?.type))
    &&normalize(item?.comunidadAutonoma||'').includes('murcia')
  );
  const candidateFallback=(Array.isArray(candidates)?candidates:[]).find(item=>{
    const lat=Number(item?.lat);
    const lon=Number(item?.lng);
    return normalize(item?.muni)===normalize(exact.muni)
      &&normalize(item?.comunidadAutonoma||'').includes('murcia')
      &&Number.isFinite(lat)&&Number.isFinite(lon)&&lat!==0&&lon!==0;
  });
  const selected=match||candidateFallback;
  const lat=Number(selected?.lat);
  const lon=Number(selected?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<37.35||lat>38.85||lon<-2.4||lon>-0.65)return null;
  return {
    lat,lon,
    province:selected.province||exact.province||'Murcia',
    municipalityCode:String(selected.muniCode||selected.id||exact.muniCode||exact.id||'')||null
  };
}

function groupRecords(records){
  const groups=new Map();
  for(const record of records){
    const key=`${slug(record.municipality)}|${slug(record.site||record.municipality)}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(record);
  }
  return [...groups.values()].map(items=>items.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)));
}

function normalizeIncident(records,location,{receivedAt}){
  if(!location||!records.length)return null;
  const latest=records[0];
  const priority=STATUSES[latest.status]||STATUSES['EN INTERVENCIÓN'];
  const name=latest.site?`${latest.municipality} · ${latest.site}`:latest.municipality;
  const timeline=records.map(item=>({
    status:item.status,
    at:item.publishedAt,
    source:'112 Región de Murcia · INFOMUR',
    url:item.url
  }));
  return {
    id:`infomur-murcia-${slug(latest.municipality)}-${slug(latest.site||latest.municipality)}`,
    name,
    municipality:latest.municipality,
    site:latest.site,
    area:`Murcia, Región de Murcia`,
    region:'Región de Murcia',
    status:latest.status,
    lat:location.lat,
    lon:location.lon,
    level:null,
    hectares:latest.hectares??records.find(item=>item.hectares!=null)?.hectares??null,
    evidence:records.map(item=>({
      source:SOURCE,
      sourceType:'direct',
      status:item.status,
      publishedAt:item.publishedAt,
      url:item.url
    })),
    alerts:[],
    timeline,
    primaryUrl:latest.url,
    observedAt:records.at(-1).observedAt,
    publishedAt:latest.publishedAt,
    receivedAt,
    directSources:1,
    confidence:'alta',
    sourceConfidence:'alta',
    locationConfidence:'municipality',
    locationApproximate:true,
    municipalityCode:location.municipalityCode,
    officialDetail:latest.detail,
    coverageScope:'selective-official-posts',
    summary:`${latest.status}${latest.site?` en ${latest.site}`:''}. Actualización oficial de 112 Región de Murcia/INFOMUR. La posición representa el municipio, no el origen, frente ni perímetro del incendio.`,
    ...priority
  };
}

function validCacheEntry(entry,now){
  return entry&&Number.isFinite(entry.fetchedAt)&&now-entry.fetchedAt>=0
    &&now-entry.fetchedAt<=CACHE_STALE_MS&&entry.data?.ok===true;
}

async function readCache(now){
  if(validCacheEntry(memoryCache,now))return {...memoryCache,cacheStatus:'memory'};
  try{
    const cache=runtimeCache();
    const entry=cache?await cache.get(CACHE_KEY):null;
    if(validCacheEntry(entry,now)){
      memoryCache=entry;
      return {...entry,cacheStatus:'runtime'};
    }
  }catch{}
  return null;
}

async function writeCache(entry){
  memoryCache=entry;
  try{
    const cache=runtimeCache();
    if(cache)await cache.set(CACHE_KEY,entry,{
      ttl:CACHE_TTL_SECONDS,
      tags:['infomur-murcia','regional-incidents'],
      name:'INFOMUR Murcia official incident posts'
    });
  }catch{}
}

function expireRecords(data,now){
  const keep=item=>{
    const age=now-new Date(item.publishedAt).getTime();
    const max=item.archive?ARCHIVE_MAX_AGE_MS:CURRENT_MAX_AGE_MS;
    return age>=0&&age<=max;
  };
  return {
    ...data,
    incidents:(data.incidents||[]).filter(keep),
    archive:(data.archive||[]).filter(keep)
  };
}

function cachedResult(entry,{now,receivedAt,fallback,error}){
  const safe=expireRecords(entry.data,now);
  const ageMinutes=Math.max(0,Math.round((now-entry.fetchedAt)/60000));
  return {
    ...safe,
    receivedAt,
    fallback,
    degraded:fallback||safe.degraded,
    cacheStatus:entry.cacheStatus||'memory',
    cacheAgeMinutes:ageMinutes,
    error:error||null,
    summary:fallback
      ?`Se muestra la última copia válida de INFOMUR (${ageMinutes} min). La fuente no responde temporalmente y la ausencia de registros no confirma que no haya incendios.`
      :safe.summary
  };
}

function baseResult({receivedAt,publishedAt=null,summary=''}) {
  return {
    ok:true,
    source:SOURCE,
    sourceUrl:MURCIA_SOURCE_URL,
    receivedAt,
    lastSuccessAt:receivedAt,
    publishedAt,
    currentBulletin:false,
    incidents:[],
    archive:[],
    unlocated:[],
    excluded:[],
    fallback:false,
    degraded:false,
    cacheStatus:'live',
    cacheAgeMinutes:0,
    coverageComplete:false,
    confidenceForAbsence:false,
    coverageNote:'112 Región de Murcia publica actualizaciones operativas selectivas. No encontrar una publicación vigente no confirma la ausencia de incendios forestales en la Región de Murcia.',
    summary
  };
}

export async function fetchMurcia({
  fetchImpl=fetch,
  now=Date.now(),
  timeoutMs=20_000,
  useCache=fetchImpl===globalThis.fetch
}={}){
  if(sourceOverride!==undefined)return typeof sourceOverride==='function'?sourceOverride():sourceOverride;
  const receivedAt=new Date(now).toISOString();
  const cached=useCache?await readCache(now):null;
  if(cached&&now-cached.fetchedAt<=CACHE_FRESH_MS)return cachedResult(cached,{now,receivedAt,fallback:false,error:null});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(buildMurciaPostsUrl(),{
      headers:{accept:'application/json','user-agent':'FuegoCerca/4.17'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response.ok)throw Error(`INFOMUR Murcia HTTP ${response.status}`);
    const posts=await response.json();
    if(!Array.isArray(posts))throw Error('INFOMUR no ha devuelto una lista de publicaciones');
    const parsed=parseMurciaPosts(posts);
    const eligibleGroups=groupRecords(parsed.records).filter(records=>{
      const latest=records[0];
      const age=now-new Date(latest.publishedAt).getTime();
      const max=STATUSES[latest.status]?.archive?ARCHIVE_MAX_AGE_MS:CURRENT_MAX_AGE_MS;
      return age>=0&&age<=max;
    });
    const located=await Promise.all(eligibleGroups.map(async records=>{
      try{return {records,location:await locateMunicipality(records[0].municipality,{fetchImpl,signal:controller.signal})}}
      catch{return {records,location:null}}
    }));
    const normalized=located.map(({records,location})=>normalizeIncident(records,location,{receivedAt})).filter(Boolean);
    const incidents=normalized.filter(item=>!item.archive);
    const archive=normalized.filter(item=>item.archive);
    const recentUnlocated=parsed.unlocated.filter(item=>{
      const age=now-new Date(item.publishedAt||0).getTime();
      const max=STATUSES[item.status]?.archive?ARCHIVE_MAX_AGE_MS:CURRENT_MAX_AGE_MS;
      return age>=0&&age<=max;
    });
    const unlocated=[
      ...recentUnlocated,
      ...located.filter(item=>!item.location).map(item=>({
        municipality:item.records[0].municipality,
        title:item.records[0].title,
        publishedAt:item.records[0].publishedAt
      }))
    ];
    const publishedAt=parsed.records.map(item=>item.publishedAt).sort().at(-1)||null;
    const data={
      ...baseResult({receivedAt,publishedAt}),
      currentBulletin:Boolean(incidents.length),
      incidents,
      archive,
      unlocated,
      excluded:parsed.excluded,
      degraded:Boolean(unlocated.length),
      summary:normalized.length
        ?`${incidents.length} incendios vigentes o en intervención y ${archive.length} controlados o extinguidos en publicaciones recientes de INFOMUR${unlocated.length?`; ${unlocated.length} registros sin ubicación municipal verificable`:''}. Es una fuente selectiva, no un inventario completo.`
        :'No hay publicaciones operativas recientes interpretables de INFOMUR. Esto no confirma la ausencia de incendios en la Región de Murcia.'
    };
    if(useCache)await writeCache({fetchedAt:now,data});
    return data;
  }catch(error){
    if(cached)return cachedResult(cached,{now,receivedAt,fallback:true,error:String(error?.message||error)});
    throw error;
  }finally{
    clearTimeout(timer);
  }
}
