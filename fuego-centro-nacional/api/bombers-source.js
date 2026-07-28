import {getCache} from '@vercel/functions';

const ARCGIS_QUERY_URL='https://services7.arcgis.com/ZCqVt1fRXwwK6GF4/arcgis/rest/services/ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW/FeatureServer/0/query';
export const BOMBERS_SOURCE_URL='https://interior.gencat.cat/es/arees_dactuacio/bombers/actuacions-de-bombers/';
export const BOMBERS_VIEWER_URL='https://experience.arcgis.com/experience/f6172fd2d6974bc0a8c51e3a6bc2a735';

const FOREST_TYPE='VF';
const PHASES=new Map([
  ['ACTIU',{status:'ACTIVO',statusClass:'active',risk:'high',riskLabel:'ALTO',riskScore:620,archive:false}],
  ['ESTABILITZAT',{status:'ESTABILIZADO',statusClass:'stabilized',risk:'medium',riskLabel:'MEDIO',riskScore:350,archive:false}],
  ['CONTROLAT',{status:'CONTROLADO',statusClass:'controlled',risk:'watch',riskLabel:'VIGILANCIA',riskScore:90,archive:true}],
  ['EXTINGIT',{status:'EXTINGUIDO',statusClass:'controlled',risk:'clear',riskLabel:'ARCHIVO',riskScore:20,archive:true}]
]);
const MAX_ACTIVE_AGE_MS=7*24*60*60*1000;
const MAX_UNPHASED_AGE_MS=24*60*60*1000;
const MAX_ARCHIVE_AGE_MS=14*24*60*60*1000;
const CACHE_FRESH_MS=60*1000;
const CACHE_STALE_MS=6*60*60*1000;
const RUNTIME_CACHE_TTL_SECONDS=6*60*60;
const RUNTIME_CACHE_KEY='bombers-catalunya-forest-v413';
const CATALONIA_BOUNDS={minLat:40.45,maxLat:42.95,minLon:.05,maxLon:3.45};
let memoryCache=null;
let runtimeCacheOverride;

export function __resetBombersCacheForTests(){
  memoryCache=null;
  runtimeCacheOverride=undefined;
}

export function __setBombersRuntimeCacheForTests(cache){
  runtimeCacheOverride=cache;
}

function runtimeCache(){
  if(runtimeCacheOverride!==undefined)return runtimeCacheOverride;
  try{return getCache({namespace:'fuegocerca-bombers'})}catch{return null}
}

function validCacheEntry(entry,now){
  return entry&&Number.isFinite(entry.fetchedAt)&&now-entry.fetchedAt>=0&&now-entry.fetchedAt<=CACHE_STALE_MS&&entry.data?.ok===true;
}

async function readCache(now){
  if(validCacheEntry(memoryCache,now))return {...memoryCache,cacheStatus:'memory'};
  try{
    const cache=runtimeCache();
    const entry=cache?await cache.get(RUNTIME_CACHE_KEY):null;
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
    if(cache)await cache.set(RUNTIME_CACHE_KEY,entry,{
      ttl:RUNTIME_CACHE_TTL_SECONDS,
      tags:['bombers-catalunya','regional-incidents'],
      name:'Bombers Catalunya forest interventions'
    });
  }catch{}
}

function recordStillValid(item,now){
  const age=now-new Date(item.observedAt||0).getTime();
  if(!Number.isFinite(age)||age<0)return false;
  if(item.archive)return age<=MAX_ARCHIVE_AGE_MS;
  return age<=(item.statusClass==='unconfirmed'?MAX_UNPHASED_AGE_MS:MAX_ACTIVE_AGE_MS);
}

function cachedResult(entry,{now,receivedAt,fallback,error}){
  const data=entry.data;
  const incidents=(data.incidents||[]).filter(item=>recordStillValid(item,now));
  const archive=(data.archive||[]).filter(item=>recordStillValid(item,now));
  const otherVegetation=(data.otherVegetation||[]).filter(item=>recordStillValid(item,now));
  const ageMinutes=Math.max(0,Math.round((now-entry.fetchedAt)/60000));
  return {
    ...data,
    incidents,
    archive,
    otherVegetation,
    receivedAt,
    lastSuccessAt:data.lastSuccessAt||data.receivedAt||null,
    fallback,
    degraded:fallback,
    cacheStatus:entry.cacheStatus||'memory',
    cacheAgeMinutes:ageMinutes,
    error:error||null,
    summary:fallback
      ?`${incidents.length} incendios forestales vigentes desde la última copia válida (${ageMinutes} min); la fuente limita temporalmente las consultas`
      :data.summary
  };
}

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
}

function isoDate(value){
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  const date=new Date(number);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)
    &&lat>=CATALONIA_BOUNDS.minLat&&lat<=CATALONIA_BOUNDS.maxLat
    &&lon>=CATALONIA_BOUNDS.minLon&&lon<=CATALONIA_BOUNDS.maxLon;
}

function phaseFor(value){
  const normalized=normalize(value);
  return PHASES.get(normalized)||{
    status:'FASE NO PUBLICADA',
    statusClass:'unconfirmed',
    risk:'watch',
    riskLabel:'VIGILANCIA',
    riskScore:170,
    archive:false
  };
}

export function normalizeBombersFeature(feature,{receivedAt=new Date().toISOString(),now=Date.now()}={}){
  const attributes=feature?.attributes||feature?.properties||{};
  const municipality=String(attributes.MUNICIPI_DPX||attributes.MUNICIPI_SIG||'').trim();
  const vegetationCode=normalize(attributes.TAL_COD_ALARMA2);
  const vegetationType=String(attributes.TAL_DESC_ALARMA2||'Incendio de vegetación').trim();
  const phase=phaseFor(attributes.COM_FASE);
  const startedAt=isoDate(attributes.ACT_DAT_INICI||attributes.ACT_DAT_ACTUACIO);
  const recordAt=isoDate(attributes.ACT_DAT_ACTUAL||attributes.ACT_DAT_ACTUACIO)||startedAt;
  const lat=Number(feature?.geometry?.y??feature?.geometry?.coordinates?.[1]);
  const lon=Number(feature?.geometry?.x??feature?.geometry?.coordinates?.[0]);
  if(!municipality||!startedAt||!validCoordinates(lat,lon))return null;
  const age=now-new Date(startedAt).getTime();
  const maxAge=phase.archive?MAX_ARCHIVE_AGE_MS:phase.statusClass==='unconfirmed'?MAX_UNPHASED_AGE_MS:MAX_ACTIVE_AGE_MS;
  if(age<0||age>maxAge)return null;
  const identifier=String(attributes.GlobalID||attributes.ESRI_OID||attributes.OBJECTID||`${municipality}-${startedAt}`)
    .replace(/[{}]/g,'').toLowerCase();
  const forest=vegetationCode===FOREST_TYPE;
  const phasePublished=Boolean(normalize(attributes.COM_FASE));
  return {
    id:`bombers-${identifier}`,
    name:municipality,
    area:'Catalunya',
    region:'Cataluña',
    status:phase.status,
    lat,
    lon,
    level:null,
    evidence:[{
      source:'Bombers de la Generalitat de Catalunya',
      sourceType:'direct',
      status:phase.status,
      publishedAt:phasePublished?receivedAt:recordAt,
      url:BOMBERS_SOURCE_URL
    }],
    alerts:[],
    timeline:[
      {status:'AVISO RECIBIDO',at:startedAt,source:'Bombers'},
      ...(phasePublished?[{status:phase.status,at:receivedAt,source:'Bombers · fase consultada'}]:[])
    ],
    primaryUrl:BOMBERS_SOURCE_URL,
    observedAt:startedAt,
    publishedAt:recordAt,
    receivedAt,
    directSources:1,
    confidence:phasePublished?'alta':'media',
    summary:phasePublished
      ?`${vegetationType}. Fase oficial: ${phase.status}.`
      :`${vegetationType}. Actuación oficial reciente; Bombers no publica todavía una fase para este registro.`,
    officialResources:{vehicles:Number(attributes.ACT_NUM_VEH)||0},
    vegetationType,
    vegetationCode,
    forest,
    phasePublished,
    ...phase
  };
}

export function buildBombersQueryUrl(){
  const url=new URL(ARCGIS_QUERY_URL);
  url.searchParams.set('where',"TAL_COD_ALARMA1 = 'IV'");
  url.searchParams.set('outFields','ACT_DAT_ACTUACIO,TAL_COD_ALARMA1,TAL_DESC_ALARMA1,TAL_COD_ALARMA2,TAL_DESC_ALARMA2,ACT_DAT_ACTUAL,ACT_DAT_INICI,MUNICIPI_DPX,MUNICIPI_SIG,ACT_NUM_VEH,ESRI_OID,OBJECTID,GlobalID,COM_FASE');
  url.searchParams.set('returnGeometry','true');
  url.searchParams.set('outSR','4326');
  url.searchParams.set('orderByFields','ACT_DAT_INICI DESC');
  url.searchParams.set('resultRecordCount','500');
  url.searchParams.set('cacheHint','true');
  url.searchParams.set('f','json');
  return url;
}

export async function fetchBombers({fetchImpl=fetch,now=Date.now(),timeoutMs=10000,useCache=fetchImpl===globalThis.fetch}={}){
  const receivedAt=new Date(now).toISOString();
  const cached=useCache?await readCache(now):null;
  if(cached&&now-cached.fetchedAt<=CACHE_FRESH_MS)return cachedResult(cached,{now,receivedAt,fallback:false,error:null});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(buildBombersQueryUrl(),{
      headers:{accept:'application/json'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response.ok)throw new Error(`Bombers HTTP ${response.status}`);
    const payload=await response.json();
    if(payload?.error)throw new Error(`Bombers ArcGIS ${payload.error.code||'error'}`);
    if(!Array.isArray(payload?.features))throw new Error('Bombers no devolvió una colección de entidades');
    const records=payload.features.map(feature=>normalizeBombersFeature(feature,{receivedAt,now})).filter(Boolean);
    const forest=records.filter(item=>item.forest);
    const incidents=forest.filter(item=>!item.archive);
    const archive=forest.filter(item=>item.archive);
    const otherVegetation=records.filter(item=>!item.forest);
    const latest=records.map(item=>item.publishedAt).filter(Boolean).sort().at(-1)||null;
    const data={
      ok:true,
      source:'Bombers de la Generalitat de Catalunya',
      sourceUrl:BOMBERS_SOURCE_URL,
      viewerUrl:BOMBERS_VIEWER_URL,
      receivedAt,
      lastSuccessAt:receivedAt,
      publishedAt:latest,
      incidents,
      archive,
      otherVegetation,
      fallback:false,
      degraded:false,
      cacheStatus:'live',
      cacheAgeMinutes:0,
      summary:`${incidents.length} incendios forestales vigentes, ${archive.length} en archivo reciente y ${otherVegetation.length} actuaciones agrícolas o urbanas separadas`
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
