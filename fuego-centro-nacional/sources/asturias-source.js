import {getCache} from '@vercel/functions';

export const ASTURIAS_SOURCE_URL='https://www.112asturias.es/datos-incendios-forestales-asturias';
export const ASTURIAS_GEOCODER_URL='https://www.cartociudad.es/geocoder/';

const SOURCE='112 Asturias · SEPA';
const MAX_REPORT_AGE_MS=36*60*60*1000;
const CACHE_FRESH_MS=10*60*1000;
const CACHE_STALE_MS=24*60*60*1000;
const CACHE_TTL_SECONDS=24*60*60;
const CACHE_KEY='sepa-asturias-bulletins-v416';
const STATUSES={
  ACTIVO:{statusClass:'active',risk:'high',riskLabel:'ALTO',riskScore:610,archive:false},
  ESTABILIZADO:{statusClass:'stabilized',risk:'medium',riskLabel:'MEDIO',riskScore:340,archive:false},
  CONTROLADO:{statusClass:'controlled',risk:'watch',riskLabel:'VIGILANCIA',riskScore:90,archive:true},
  EXTINGUIDO:{statusClass:'controlled',risk:'clear',riskLabel:'ARCHIVO',riskScore:20,archive:true},
  'EN SEGUIMIENTO':{statusClass:'unconfirmed',risk:'watch',riskLabel:'VIGILANCIA',riskScore:140,archive:false}
};

let memoryCache=null;
let runtimeCacheOverride;
let sourceOverride;

export function __resetAsturiasCacheForTests(){
  memoryCache=null;
  runtimeCacheOverride=undefined;
  sourceOverride=undefined;
}

export function __setAsturiasRuntimeCacheForTests(cache){
  runtimeCacheOverride=cache;
}

export function __setAsturiasSourceForTests(value){
  sourceOverride=value;
}

function runtimeCache(){
  if(runtimeCacheOverride!==undefined)return runtimeCacheOverride;
  try{return getCache({namespace:'fuegocerca-asturias'})}catch{return null}
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
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#0*39;|&apos;/gi,"'")
    .replace(/&aacute;/gi,'á').replace(/&eacute;/gi,'é')
    .replace(/&iacute;/gi,'í').replace(/&oacute;/gi,'ó')
    .replace(/&uacute;/gi,'ú').replace(/&ntilde;/gi,'ñ')
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)));
}

function textLines(value=''){
  return decodeHtml(String(value)
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(?:p|li|h[1-6]|div|article|section)>/gi,'\n')
    .replace(/<[^>]+>/g,' '))
    .split(/\r?\n/)
    .map(line=>line.replace(/\s+/g,' ').trim())
    .filter(Boolean)
    .join('\n');
}

function lastSunday(year,monthIndex){
  const date=new Date(Date.UTC(year,monthIndex+1,0));
  return date.getUTCDate()-date.getUTCDay();
}

function madridOffset(year,month,day){
  if(month<3||month>10)return '+01:00';
  if(month>3&&month<10)return '+02:00';
  const boundary=lastSunday(year,month-1);
  if(month===3)return day>=boundary?'+02:00':'+01:00';
  return day<boundary?'+02:00':'+01:00';
}

function localIso(year,month,day,hour=12,minute=0){
  const pad=value=>String(value).padStart(2,'0');
  const date=new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${madridOffset(year,month,day)}`);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

function explicitStatus(value=''){
  const matches=[...String(value).matchAll(/\b(extinguido|controlado|estabilizado|activo)\b/gi)];
  return matches.length?normalize(matches.at(-1)[1]).toUpperCase():'EN SEGUIMIENTO';
}

function parseEntry(value=''){
  const clean=String(value).replace(/\s+/g,' ').trim();
  const separator=clean.indexOf(':');
  if(separator<1)return null;
  const label=clean.slice(0,separator).replace(/^incendio\s+/i,'').trim();
  const detail=clean.slice(separator+1).trim();
  if(!label||!detail)return null;
  if(/\bVillablino\s*\(Le[oó]n\)/i.test(label)){
    return {excluded:true,reason:'cross-border',label,detail};
  }
  const municipality=label
    .replace(/\s*\([^)]*(?:lim[ií]trofe|l[ií]mite)[^)]*\)\s*/gi,' ')
    .replace(/\s*\([^)]*\)\s*$/,'')
    .trim();
  if(!municipality)return null;
  const siteMatch=detail.match(/incendio\s+forestal(?:\s+en)?\s+([^.;]+?)(?=\.|;|$)/i);
  const status=explicitStatus(clean);
  return {
    excluded:false,
    municipality,
    site:siteMatch?.[1]?.trim()||null,
    status,
    detail
  };
}

function reportSegments(plain=''){
  const starts=[...plain.matchAll(/La Morgal\.-\s*(\d{4})\/(\d{2})\/(\d{2})[\s\S]{0,120}?Hora:\s*(\d{1,2}):(\d{2})/gi)];
  return starts.map((match,index)=>{
    const publishedAt=localIso(
      Number(match[1]),Number(match[2]),Number(match[3]),Number(match[4]),Number(match[5])
    );
    return {
      publishedAt,
      body:plain.slice(match.index,starts[index+1]?.index??plain.length)
    };
  }).filter(item=>item.publishedAt).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
}

function extractEntries(body=''){
  const lines=String(body).split('\n');
  const entries=[];
  let current='';
  for(const line of lines){
    if(/^(?:NOTA DE PRENSA|DATOS INCENDIOS FORESTALES EN ASTURIAS)$/i.test(line)){
      if(current)entries.push(current);
      break;
    }
    if(/^[-–—•]\s*/.test(line)){
      if(current)entries.push(current);
      current=line.replace(/^[-–—•]\s*/,'').trim();
    }else if(current){
      current+=` ${line}`;
    }
  }
  if(current&&!entries.includes(current))entries.push(current);
  return entries.map(parseEntry).filter(Boolean);
}

export function parseAsturiasBulletin(html=''){
  const reports=reportSegments(textLines(html));
  if(!reports.length)return {publishedAt:null,entries:[],excluded:[]};
  const latest=reports[0];
  const parsed=extractEntries(latest.body);
  return {
    publishedAt:latest.publishedAt,
    entries:parsed.filter(item=>!item.excluded),
    excluded:parsed.filter(item=>item.excluded)
  };
}

export function buildAsturiasCandidatesUrl(municipality){
  const url=new URL('https://www.cartociudad.es/geocoder/api/geocoder/candidates');
  url.searchParams.set('q',municipality);
  url.searchParams.set('limit','50');
  return url;
}

export function buildAsturiasFindUrl(municipality,province){
  const url=new URL('https://www.cartociudad.es/geocoder/api/geocoder/find');
  url.searchParams.set('q',`${municipality}, ${province}`);
  return url;
}

async function locateMunicipality(municipality,{fetchImpl,signal}){
  const headers={accept:'application/json','user-agent':'FuegoCerca/4.16'};
  const candidatesResponse=await fetchImpl(buildAsturiasCandidatesUrl(municipality),{headers,cache:'no-store',signal});
  if(!candidatesResponse.ok)throw Error(`CartoCiudad candidatos HTTP ${candidatesResponse.status}`);
  const candidates=await candidatesResponse.json();
  const exact=(Array.isArray(candidates)?candidates:[]).find(item=>
    normalize(item?.muni)===normalize(municipality)
    &&normalize(item?.type)==='municipio'
    &&normalize(item?.comunidadAutonoma||'').includes('asturias')
  );
  if(!exact?.province)return null;
  const findResponse=await fetchImpl(buildAsturiasFindUrl(exact.muni,exact.province),{headers,cache:'no-store',signal});
  if(!findResponse.ok)throw Error(`CartoCiudad localización HTTP ${findResponse.status}`);
  const result=await findResponse.json();
  const match=(Array.isArray(result)?result:[result]).find(item=>
    normalize(item?.muni)===normalize(exact.muni)
    &&normalize(item?.type)==='municipio'
    &&normalize(item?.comunidadAutonoma||'').includes('asturias')
  );
  const lat=Number(match?.lat);
  const lon=Number(match?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<42.8||lat>43.8||lon<-7.4||lon>-4.4)return null;
  return {
    lat,lon,
    province:match.province||exact.province||'Asturias',
    municipalityCode:String(match.id||exact.muniCode||exact.id||'')||null
  };
}

function normalizeIncident(entry,location,{receivedAt,publishedAt}){
  if(!location)return null;
  const priority=STATUSES[entry.status]||STATUSES['EN SEGUIMIENTO'];
  const name=entry.site?`${entry.municipality} · ${entry.site}`:entry.municipality;
  return {
    id:`sepa-asturias-${slug(entry.municipality)}-${publishedAt.slice(0,10)}`,
    name,
    municipality:entry.municipality,
    site:entry.site,
    area:'Asturias, Principado de Asturias',
    region:'Principado de Asturias',
    status:entry.status,
    lat:location.lat,
    lon:location.lon,
    level:null,
    evidence:[{
      source:SOURCE,
      sourceType:'direct',
      status:entry.status,
      publishedAt,
      url:ASTURIAS_SOURCE_URL
    }],
    alerts:[],
    timeline:[{status:entry.status,at:publishedAt,source:'SEPA · parte de incendios forestales'}],
    primaryUrl:ASTURIAS_SOURCE_URL,
    observedAt:publishedAt,
    publishedAt,
    receivedAt,
    directSources:1,
    confidence:entry.status==='EN SEGUIMIENTO'?'media':'alta',
    sourceConfidence:'alta',
    locationConfidence:'municipality',
    locationApproximate:true,
    municipalityCode:location.municipalityCode,
    officialDetail:entry.detail,
    coverageScope:'published-bulletin',
    summary:`${entry.status}${entry.site?` en ${entry.site}`:''}. Parte oficial del SEPA. La posición representa el concejo, no el origen, frente ni perímetro del incendio.`,
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
      tags:['sepa-asturias','regional-incidents'],
      name:'SEPA Asturias forest fire bulletins'
    });
  }catch{}
}

function withoutExpiredRecords(data,now){
  const current=Boolean(data.publishedAt)&&now-new Date(data.publishedAt).getTime()<=MAX_REPORT_AGE_MS;
  return current?data:{...data,currentBulletin:false,incidents:[],archive:[],unlocated:[]};
}

function cachedResult(entry,{now,receivedAt,fallback,error}){
  const safe=withoutExpiredRecords(entry.data,now);
  const ageMinutes=Math.max(0,Math.round((now-entry.fetchedAt)/60000));
  return {
    ...safe,
    receivedAt,
    fallback,
    degraded:fallback,
    cacheStatus:entry.cacheStatus||'memory',
    cacheAgeMinutes:ageMinutes,
    error:error||null,
    summary:fallback
      ?`Se muestra la última copia válida del SEPA (${ageMinutes} min). La fuente no responde temporalmente y la ausencia de registros no confirma que no haya incendios.`
      :safe.summary
  };
}

function emptyResult({receivedAt,publishedAt=null,summary}){
  return {
    ok:true,
    source:SOURCE,
    sourceUrl:ASTURIAS_SOURCE_URL,
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
    coverageNote:'El SEPA publica partes de situación durante episodios de incendios. No encontrar un parte vigente no confirma que no existan incendios forestales en Asturias.',
    summary
  };
}

export async function fetchAsturias({
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
    const response=await fetchImpl(ASTURIAS_SOURCE_URL,{
      headers:{accept:'text/html','user-agent':'FuegoCerca/4.16'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response.ok)throw Error(`SEPA Asturias HTTP ${response.status}`);
    const parsed=parseAsturiasBulletin(await response.text());
    if(!parsed.publishedAt){
      throw Error('La página del SEPA no contiene un parte de incendios interpretable');
    }
    const age=now-new Date(parsed.publishedAt).getTime();
    if(age<0||age>MAX_REPORT_AGE_MS){
      const data=emptyResult({
        receivedAt,
        publishedAt:parsed.publishedAt,
        summary:'El último parte de incendios del SEPA no está vigente. Esto no confirma la ausencia de incendios en Asturias.'
      });
      if(useCache)await writeCache({fetchedAt:now,data});
      return data;
    }
    if(!parsed.entries.length){
      throw Error('El parte vigente del SEPA no contiene incendios interpretables');
    }
    const located=await Promise.all(parsed.entries.map(async entry=>{
      try{return {entry,location:await locateMunicipality(entry.municipality,{fetchImpl,signal:controller.signal})}}
      catch{return {entry,location:null}}
    }));
    const records=located
      .map(({entry,location})=>normalizeIncident(entry,location,{receivedAt,publishedAt:parsed.publishedAt}))
      .filter(Boolean);
    const incidents=records.filter(item=>!item.archive);
    const archive=records.filter(item=>item.archive);
    const unlocated=located.filter(item=>!item.location).map(item=>item.entry.municipality);
    const data={
      ...emptyResult({receivedAt,publishedAt:parsed.publishedAt,summary:''}),
      currentBulletin:true,
      incidents,
      archive,
      unlocated,
      excluded:parsed.excluded,
      degraded:Boolean(unlocated.length),
      summary:`${incidents.length} incendios vigentes o en seguimiento y ${archive.length} controlados en el último parte del SEPA${unlocated.length?`; ${unlocated.length} sin ubicación municipal verificable`:''}. Es un parte episódico, no un inventario completo.`
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
