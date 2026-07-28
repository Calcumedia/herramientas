import {getCache} from '@vercel/functions';
import {request as httpsRequest} from 'node:https';
import {rootCertificates} from 'node:tls';
import {GLOBALSIGN_RSA_OV_SSL_CA_2018} from './globalsign-ca.js';

export const GALICIA_SOURCE_URL='https://mediorural.xunta.gal/es/recursos/noticias';
export const CARTOCIUDAD_SOURCE_URL='https://www.cartociudad.es/geocoder/';

const SOURCE='Xunta de Galicia · Medio Rural';
const REPORTING_THRESHOLD_HECTARES=20;
const MAX_REPORT_AGE_MS=36*60*60*1000;
const CANDIDATE_WINDOW_MS=3*24*60*60*1000;
const CACHE_FRESH_MS=10*60*1000;
const CACHE_STALE_MS=24*60*60*1000;
const CACHE_TTL_SECONDS=24*60*60;
const CACHE_KEY='xunta-galicia-bulletins-v415';
const LISTING_PAGES=3;
const STATUSES={
  ACTIVO:{statusClass:'active',risk:'high',riskLabel:'ALTO',riskScore:620,archive:false},
  ESTABILIZADO:{statusClass:'stabilized',risk:'medium',riskLabel:'MEDIO',riskScore:350,archive:false},
  CONTROLADO:{statusClass:'controlled',risk:'watch',riskLabel:'VIGILANCIA',riskScore:90,archive:true},
  EXTINGUIDO:{statusClass:'controlled',risk:'clear',riskLabel:'ARCHIVO',riskScore:20,archive:true}
};
const MONTHS={
  enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
  julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12
};

let memoryCache=null;
let runtimeCacheOverride;
let sourceOverride;

export function __resetGaliciaCacheForTests(){
  memoryCache=null;
  runtimeCacheOverride=undefined;
  sourceOverride=undefined;
}

export function __setGaliciaRuntimeCacheForTests(cache){
  runtimeCacheOverride=cache;
}

export function __setGaliciaSourceForTests(value){
  sourceOverride=value;
}

function runtimeCache(){
  if(runtimeCacheOverride!==undefined)return runtimeCacheOverride;
  try{return getCache({namespace:'fuegocerca-galicia'})}catch{return null}
}

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function slug(value=''){
  return normalize(value).replace(/\s+/g,'-').replace(/^-|-$/g,'');
}

function decodeHtml(value=''){
  return String(value)
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#0*39;|&apos;/gi,"'")
    .replace(/&aacute;/gi,'á').replace(/&eacute;/gi,'é')
    .replace(/&iacute;/gi,'í').replace(/&oacute;/gi,'ó')
    .replace(/&uacute;/gi,'ú').replace(/&ntilde;/gi,'ñ')
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)));
}

function textContent(value=''){
  return decodeHtml(String(value)
    .replace(/<br\s*\/?>/gi,' ')
    .replace(/<\/p>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .trim());
}

function downloadXuntaWithVerifiedChain(url,{signal}={}){
  return new Promise((resolve,reject)=>{
    const request=httpsRequest(url,{
      ca:[...rootCertificates,GLOBALSIGN_RSA_OV_SSL_CA_2018],
      headers:{accept:'text/html','user-agent':'FuegoCerca/4.17'}
    },response=>{
      if(response.statusCode!==200){
        response.resume();
        reject(Error(`Medio Rural HTTP ${response.statusCode}`));
        return;
      }
      let body='';
      response.setEncoding('utf8');
      response.on('data',chunk=>{
        body+=chunk;
        if(body.length>2_000_000)request.destroy(Error('Respuesta de Medio Rural demasiado grande'));
      });
      response.on('end',()=>resolve(body));
    });
    request.on('error',reject);
    signal?.addEventListener('abort',()=>request.destroy(Error('Medio Rural timeout')),{once:true});
    request.end();
  });
}

async function downloadXuntaHtml(url,{fetchImpl,signal}){
  try{
    const response=await fetchImpl(url,{
      headers:{accept:'text/html','user-agent':'FuegoCerca/4.17'},
      cache:'no-store',
      signal
    });
    if(!response.ok)throw Error(`Medio Rural HTTP ${response.status}`);
    return await response.text();
  }catch(error){
    if(fetchImpl!==globalThis.fetch||error?.cause?.code!=='UNABLE_TO_VERIFY_LEAF_SIGNATURE')throw error;
    return downloadXuntaWithVerifiedChain(url,{signal});
  }
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

function listDate(value=''){
  const match=String(value).match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  return match?localIso(Number(match[3]),Number(match[2]),Number(match[1])):null;
}

export function parseGaliciaListing(html='',baseUrl=GALICIA_SOURCE_URL){
  const candidates=[];
  const anchorPattern=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const match of String(html).matchAll(anchorPattern)){
    const label=textContent(match[2]);
    if(!/informa\s+de\s+la\s+situaci[oó]n\s+de\s+los?\s+(?:incendios|fuegos)\s+forestales/i.test(label))continue;
    const publishedAt=listDate(label);
    if(!publishedAt)continue;
    candidates.push({
      url:new URL(match[1],baseUrl).toString(),
      title:label.replace(/^\s*\d{2}\/\d{2}\/\d{4}\s*-\s*/,'').trim(),
      listedAt:publishedAt
    });
  }
  return [...new Map(candidates.map(item=>[item.url,item])).values()]
    .sort((a,b)=>new Date(b.listedAt)-new Date(a.listedAt));
}

function bulletinTimestamp(html=''){
  const plain=textContent(html);
  const dateMatch=plain.match(/Santiago de Compostela,\s*(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
  if(!dateMatch)return null;
  const month=MONTHS[normalize(dateMatch[2])];
  if(!month)return null;
  const cutoff=plain.match(/datos\s+recogidos\s+hasta\s+las\s+(\d{1,2})[.:](\d{2})\s+horas/i);
  return localIso(Number(dateMatch[3]),month,Number(dateMatch[1]),Number(cutoff?.[1]||12),Number(cutoff?.[2]||0));
}

function incidentHeading(value=''){
  const clean=textContent(value);
  const match=clean.match(/^(Activo|Estabilizado|Controlado|Extinguido)\s+(.+)$/i);
  if(!match)return null;
  const status=normalize(match[1]).toUpperCase();
  const place=match[2].trim();
  const separator=place.indexOf('-');
  const municipality=(separator>=0?place.slice(0,separator):place).trim();
  const parish=(separator>=0?place.slice(separator+1):'').replace(/\s*\([^)]*\)\s*$/,'').trim()||null;
  if(!municipality||!STATUSES[status])return null;
  return {status,municipality,parish};
}

export function parseGaliciaBulletin(html=''){
  const publishedAt=bulletinTimestamp(html);
  const entries=[];
  const blockPattern=/<h2\b[^>]*>([\s\S]*?)<\/h2>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  for(const match of String(html).matchAll(blockPattern)){
    const heading=incidentHeading(match[1]);
    if(!heading)continue;
    const detail=textContent(match[2]);
    const areaMatch=detail.match(/(\d+(?:[.,]\d+)?)\s+hect[aá]reas/i);
    entries.push({
      ...heading,
      detail,
      officialAreaHa:areaMatch?Number(areaMatch[1].replace(',','.')):null
    });
  }
  return {publishedAt,entries};
}

export function buildCartociudadCandidatesUrl(municipality){
  const url=new URL('https://www.cartociudad.es/geocoder/api/geocoder/candidates');
  url.searchParams.set('q',municipality);
  url.searchParams.set('limit','50');
  return url;
}

export function buildCartociudadFindUrl(municipality,province){
  const url=new URL('https://www.cartociudad.es/geocoder/api/geocoder/find');
  url.searchParams.set('q',`${municipality}, ${province}`);
  return url;
}

async function locateMunicipality(municipality,{fetchImpl,signal}){
  const headers={accept:'application/json','user-agent':'FuegoCerca/4.17'};
  const candidatesResponse=await fetchImpl(buildCartociudadCandidatesUrl(municipality),{headers,cache:'no-store',signal});
  if(!candidatesResponse.ok)throw Error(`CartoCiudad candidatos HTTP ${candidatesResponse.status}`);
  const candidates=await candidatesResponse.json();
  const exact=(Array.isArray(candidates)?candidates:[]).find(item=>
    normalize(item?.muni)===normalize(municipality)
    &&normalize(item?.type)==='municipio'
    &&normalize(item?.comunidadAutonoma||'').includes('galicia')
  );
  if(!exact?.province)return null;
  const findResponse=await fetchImpl(buildCartociudadFindUrl(exact.muni,exact.province),{headers,cache:'no-store',signal});
  if(!findResponse.ok)throw Error(`CartoCiudad localización HTTP ${findResponse.status}`);
  const result=await findResponse.json();
  const match=(Array.isArray(result)?result:[result]).find(item=>
    normalize(item?.muni)===normalize(exact.muni)
    &&normalize(item?.type)==='municipio'
    &&normalize(item?.comunidadAutonoma||'').includes('galicia')
  );
  const lat=Number(match?.lat);
  const lon=Number(match?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<41.8||lat>43.9||lon<-9.5||lon>-6.6)return null;
  return {
    lat,lon,
    province:match.province||exact.province,
    municipalityCode:String(match.id||exact.muniCode||exact.id||'')||null
  };
}

function normalizeIncident(entry,location,{receivedAt,publishedAt,bulletinUrl}){
  if(!location)return null;
  const priority=STATUSES[entry.status];
  return {
    id:`xunta-galicia-${slug(location.province)}-${slug(entry.municipality)}-${publishedAt.slice(0,10)}`,
    name:entry.municipality,
    parish:entry.parish,
    area:`${location.province}, Galicia`,
    region:'Galicia',
    status:entry.status,
    lat:location.lat,
    lon:location.lon,
    level:null,
    evidence:[{
      source:SOURCE,
      sourceType:'direct',
      status:entry.status,
      publishedAt,
      url:bulletinUrl
    }],
    alerts:[],
    timeline:[{status:entry.status,at:publishedAt,source:'Medio Rural · parte de situación'}],
    primaryUrl:bulletinUrl,
    observedAt:publishedAt,
    publishedAt,
    receivedAt,
    directSources:1,
    confidence:'media',
    sourceConfidence:'alta',
    locationConfidence:'municipality',
    locationApproximate:true,
    municipalityCode:location.municipalityCode,
    officialAreaHa:entry.officialAreaHa,
    officialDetail:entry.detail,
    coverageScope:'published-bulletin',
    reportingThresholdHectares:REPORTING_THRESHOLD_HECTARES,
    summary:`${entry.status}${entry.parish?` en ${entry.parish}`:''}. Parte oficial de Medio Rural. La posición representa el municipio, no el origen, frente ni perímetro del incendio.`,
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
      tags:['xunta-galicia','regional-incidents'],
      name:'Xunta Galicia fire bulletins'
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
      ?`Se muestra la última copia válida de Medio Rural (${ageMinutes} min). La fuente no responde temporalmente y la ausencia de registros no confirma que no haya incendios.`
      :safe.summary
  };
}

async function listingCandidates({fetchImpl,signal,now}){
  const pages=await Promise.all(Array.from({length:LISTING_PAGES},async(_,index)=>{
    const url=new URL(GALICIA_SOURCE_URL);
    url.searchParams.set('page',String(index));
    return parseGaliciaListing(await downloadXuntaHtml(url,{fetchImpl,signal}),url);
  }));
  return [...new Map(pages.flat().map(item=>[item.url,item])).values()]
    .filter(item=>now-new Date(item.listedAt).getTime()>=0&&now-new Date(item.listedAt).getTime()<=CANDIDATE_WINDOW_MS)
    .sort((a,b)=>new Date(b.listedAt)-new Date(a.listedAt));
}

function emptyResult({receivedAt,summary}){
  return {
    ok:true,
    source:SOURCE,
    sourceUrl:GALICIA_SOURCE_URL,
    bulletinUrl:null,
    receivedAt,
    lastSuccessAt:receivedAt,
    publishedAt:null,
    currentBulletin:false,
    incidents:[],
    archive:[],
    unlocated:[],
    fallback:false,
    degraded:false,
    cacheStatus:'live',
    cacheAgeMinutes:0,
    coverageComplete:false,
    confidenceForAbsence:false,
    reportingThresholdHectares:REPORTING_THRESHOLD_HECTARES,
    coverageNote:'Medio Rural publica partes selectivos, habitualmente de incendios que alcanzan 20 hectáreas. No encontrar un parte vigente no confirma que no existan incendios.',
    summary
  };
}

export async function fetchGalicia({
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
    const candidates=await listingCandidates({fetchImpl,signal:controller.signal,now});
    if(!candidates.length){
      const data=emptyResult({
        receivedAt,
        summary:'Portal oficial consultado sin un parte de situación vigente. Esto no confirma la ausencia de incendios en Galicia.'
      });
      if(useCache)await writeCache({fetchedAt:now,data});
      return data;
    }
    let selected=null;
    for(const candidate of candidates){
      let html;
      try{html=await downloadXuntaHtml(candidate.url,{fetchImpl,signal:controller.signal})}
      catch{continue}
      const parsed=parseGaliciaBulletin(html);
      if(!parsed.publishedAt)continue;
      const age=now-new Date(parsed.publishedAt).getTime();
      if(age>=0&&age<=MAX_REPORT_AGE_MS){
        if(!parsed.entries.length)throw Error('El parte vigente de Medio Rural no contiene bloques de incendios interpretables');
        selected={candidate,...parsed};
        break;
      }
    }
    if(!selected){
      const data=emptyResult({
        receivedAt,
        summary:'Los partes encontrados no están vigentes. La ausencia de un parte reciente no confirma que no existan incendios en Galicia.'
      });
      if(useCache)await writeCache({fetchedAt:now,data});
      return data;
    }
    const located=await Promise.all(selected.entries.map(async entry=>{
      try{return {entry,location:await locateMunicipality(entry.municipality,{fetchImpl,signal:controller.signal})}}
      catch{return {entry,location:null}}
    }));
    const records=located
      .map(({entry,location})=>normalizeIncident(entry,location,{
        receivedAt,
        publishedAt:selected.publishedAt,
        bulletinUrl:selected.candidate.url
      }))
      .filter(Boolean);
    const incidents=records.filter(item=>!item.archive);
    const archive=records.filter(item=>item.archive);
    const unlocated=located.filter(item=>!item.location).map(item=>item.entry.municipality);
    const data={
      ...emptyResult({receivedAt,summary:''}),
      bulletinUrl:selected.candidate.url,
      publishedAt:selected.publishedAt,
      currentBulletin:true,
      incidents,
      archive,
      unlocated,
      degraded:Boolean(unlocated.length),
      summary:`${incidents.length} incendios vigentes y ${archive.length} en archivo en el último parte selectivo de Medio Rural${unlocated.length?`; ${unlocated.length} sin ubicación municipal verificable`:''}. No constituye un inventario completo.`
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
