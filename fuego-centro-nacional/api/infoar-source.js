import {DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
import {getCache} from '@vercel/functions';

globalThis.DOMMatrix??=DOMMatrix;
globalThis.ImageData??=ImageData;
globalThis.Path2D??=Path2D;

export const INFOAR_PDF_URL='https://infoar.aragon.es/flamabk/indicesMeteo/napif-pdf/download';
export const INFOAR_SOURCE_URL='https://www.aragon.es/-/nivel-de-alerta-de-peligro-de-incendios-forestales';
export const INFOAR_HISTORY_URL='https://infoar.aragon.es/flamabk/indicesMeteo/descarga-informe?indice=NAPIF';
export const INFOAR_INCIDENT_SECTION='Incendios acaecidos en las últimas horas (datos provisionales)';

const MUNICIPALITY_WFS_URL='https://idearagon.aragon.es/Visor2D';
const SOURCE='Gobierno de Aragón · INFOAR';
const MAX_PDF_BYTES=5_000_000;
const MAX_REPORT_AGE_MS=36*60*60*1000;
const MAX_INCIDENT_AGE_MS=45*24*60*60*1000;
const CACHE_FRESH_MS=10*60*1000;
const CACHE_STALE_MS=24*60*60*1000;
const RUNTIME_CACHE_TTL_SECONDS=24*60*60;
const RUNTIME_CACHE_KEY='infoar-aragon-incidents-v414';
const PROVINCES={H:'Huesca',T:'Teruel',Z:'Zaragoza'};
const STATUSES={
  ACTIVO:{statusClass:'active',risk:'high',riskLabel:'ALTO',riskScore:630,archive:false},
  ESTABILIZADO:{statusClass:'stabilized',risk:'medium',riskLabel:'MEDIO',riskScore:355,archive:false},
  CONTROLADO:{statusClass:'controlled',risk:'watch',riskLabel:'VIGILANCIA',riskScore:90,archive:true},
  EXTINGUIDO:{statusClass:'controlled',risk:'clear',riskLabel:'ARCHIVO',riskScore:20,archive:true}
};
let memoryCache=null;
let runtimeCacheOverride;
let sourceOverride;

export function __resetInfoarCacheForTests(){
  memoryCache=null;
  runtimeCacheOverride=undefined;
  sourceOverride=undefined;
}

export function __setInfoarRuntimeCacheForTests(cache){
  runtimeCacheOverride=cache;
}

export function __setInfoarSourceForTests(value){
  sourceOverride=value;
}

function runtimeCache(){
  if(runtimeCacheOverride!==undefined)return runtimeCacheOverride;
  try{return getCache({namespace:'fuegocerca-infoar'})}catch{return null}
}

function validCacheEntry(entry,now){
  return entry&&Number.isFinite(entry.fetchedAt)&&now-entry.fetchedAt>=0
    &&now-entry.fetchedAt<=CACHE_STALE_MS&&entry.data?.ok===true;
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
      tags:['infoar-aragon','regional-incidents'],
      name:'INFOAR Aragón daily incidents'
    });
  }catch{}
}

function cachedResult(entry,{now,receivedAt,fallback,error}){
  const ageMinutes=Math.max(0,Math.round((now-entry.fetchedAt)/60000));
  return {
    ...entry.data,
    receivedAt,
    fallback,
    degraded:fallback,
    cacheStatus:entry.cacheStatus||'memory',
    cacheAgeMinutes:ageMinutes,
    error:error||null,
    summary:fallback
      ?`${entry.data.incidents.length} incendios vigentes y ${entry.data.archive.length} en archivo desde la última copia válida (${ageMinutes} min); INFOAR no responde temporalmente`
      :entry.data.summary
  };
}

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
}

function slug(value=''){
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function pdfTimestamp(value=''){
  const match=String(value).match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:([+-])(\d{2})'?(\d{2})?)?/);
  if(!match)return null;
  const [,year,month,day,hour,minute,second,sign,offsetHour,offsetMinute]=match;
  const offset=sign&&offsetHour?`${sign}${offsetHour}:${offsetMinute||'00'}`:'Z';
  const date=new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

function incidentTimestamp(value=''){
  const match=String(value).match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if(!match)return null;
  const [,day,month,year]=match;
  const date=new Date(`${Number(year)+2000}-${month}-${day}T12:00:00+02:00`);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

export function parseInfoarEntries(text=''){
  const section=String(text).split(INFOAR_INCIDENT_SECTION)[1];
  if(!section)return [];
  const clean=section
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
  const pattern=/(?:^|(?<=\.\s))([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑa-záéíóúüñ' -]{0,80}?)\s+\(([HTZ])\)\s+\((\d{2}\/\d{2}\/\d{2})\):\s+(activo|estabilizado|controlado|extinguido)\./giu;
  const matches=[...clean.matchAll(pattern)];
  const entries=[];
  for(const [index,match] of matches.entries()){
    const name=match[1].trim();
    const provinceCode=match[2].toUpperCase();
    const startedAt=incidentTimestamp(match[3]);
    const status=normalize(match[4]);
    const detail=clean.slice(match.index+match[0].length,matches[index+1]?.index??clean.length).trim().slice(0,1200);
    if(!name||!PROVINCES[provinceCode]||!startedAt||!STATUSES[status])continue;
    entries.push({name,provinceCode,province:PROVINCES[provinceCode],startedAt,status,detail});
  }
  return entries;
}

export function buildMunicipalityUrl(name,province){
  const url=new URL(MUNICIPALITY_WFS_URL);
  url.searchParams.set('service','WFS');
  url.searchParams.set('version','1.0.0');
  url.searchParams.set('request','GetFeature');
  url.searchParams.set('typeName','Municipio');
  url.searchParams.set('outputFormat','application/json');
  url.searchParams.set('srsName','EPSG:4326');
  url.searchParams.set('maxFeatures','1');
  const quote=value=>String(value).replace(/'/g,"''");
  url.searchParams.set('CQL_FILTER',`d_muni_ine='${quote(name)}' AND provincia='${quote(province)}'`);
  return url;
}

function coordinatePairs(value,result=[]){
  if(!Array.isArray(value))return result;
  if(value.length>=2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1]))){
    result.push([Number(value[0]),Number(value[1])]);
    return result;
  }
  for(const item of value)coordinatePairs(item,result);
  return result;
}

export function approximateMunicipalityCenter(geometry){
  const pairs=coordinatePairs(geometry?.coordinates);
  if(!pairs.length)return null;
  const lons=pairs.map(pair=>pair[0]);
  const lats=pairs.map(pair=>pair[1]);
  const lon=(Math.min(...lons)+Math.max(...lons))/2;
  const lat=(Math.min(...lats)+Math.max(...lats))/2;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<39.8||lat>42.95||lon<-1.8||lon>1.0)return null;
  return {lat,lon};
}

async function locateMunicipality(entry,{fetchImpl,signal}){
  const response=await fetchImpl(buildMunicipalityUrl(entry.name,entry.province),{
    headers:{accept:'application/json','user-agent':'FuegoCerca/4.16'},
    cache:'no-store',
    signal
  });
  if(!response.ok)throw Error(`IGEAR HTTP ${response.status}`);
  const payload=await response.json();
  const feature=payload?.features?.[0];
  const center=approximateMunicipalityCenter(feature?.geometry);
  if(!center)return null;
  return {
    ...center,
    municipalityCode:String(feature?.properties?.cmunine||feature?.properties?.c_muni_ine||'')||null
  };
}

function normalizeIncident(entry,location,{receivedAt,publishedAt,now}){
  const priority=STATUSES[entry.status];
  const age=now-new Date(entry.startedAt).getTime();
  if(!location||age<0||age>MAX_INCIDENT_AGE_MS)return null;
  return {
    id:`infoar-${entry.provinceCode.toLowerCase()}-${slug(entry.name)}-${entry.startedAt.slice(0,10)}`,
    name:entry.name,
    area:`${entry.province}, Aragón`,
    region:'Aragón',
    status:entry.status,
    lat:location.lat,
    lon:location.lon,
    level:null,
    evidence:[{
      source:SOURCE,
      sourceType:'direct',
      status:entry.status,
      publishedAt,
      url:INFOAR_PDF_URL
    }],
    alerts:[],
    timeline:[
      {status:'INCENDIO DECLARADO',at:entry.startedAt,source:'INFOAR'},
      {status:entry.status,at:publishedAt,source:'INFOAR · parte diario'}
    ],
    primaryUrl:INFOAR_PDF_URL,
    observedAt:entry.startedAt,
    publishedAt,
    receivedAt,
    directSources:1,
    confidence:'media',
    sourceConfidence:'alta',
    locationConfidence:'municipality',
    locationApproximate:true,
    municipalityCode:location.municipalityCode,
    summary:`${entry.status}. Parte diario oficial INFOAR. La posición representa aproximadamente el centro del término municipal, no el origen exacto del incendio.`,
    officialDetail:entry.detail,
    ...priority
  };
}

async function extractPdf(buffer){
  const [{PDFParse},{getData}]=await Promise.all([
    import('pdf-parse'),
    import('pdf-parse/worker')
  ]);
  PDFParse.setWorker(getData());
  const parser=new PDFParse({data:buffer});
  try{
    const infoResult=await parser.getInfo();
    const textResult=await parser.getText();
    return {text:textResult.text||'',creationDate:infoResult.info?.CreationDate||null};
  }finally{
    await parser.destroy();
  }
}

export async function fetchInfoar({
  fetchImpl=fetch,
  extractPdfImpl=extractPdf,
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
    const response=await fetchImpl(INFOAR_PDF_URL,{
      headers:{accept:'application/pdf','user-agent':'FuegoCerca/4.16'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response.ok)throw Error(`INFOAR HTTP ${response.status}`);
    const contentType=response.headers.get('content-type')||'';
    if(contentType&&!contentType.includes('pdf')&&!contentType.includes('octet-stream'))throw Error('INFOAR no ha devuelto un PDF');
    const buffer=Buffer.from(await response.arrayBuffer());
    if(!buffer.length||buffer.length>MAX_PDF_BYTES)throw Error('Tamaño del PDF INFOAR no válido');
    const extracted=await extractPdfImpl(buffer);
    const publishedAt=pdfTimestamp(extracted.creationDate);
    if(!publishedAt)throw Error('INFOAR no publica una fecha verificable en el documento');
    const reportAge=now-new Date(publishedAt).getTime();
    if(reportAge<0||reportAge>MAX_REPORT_AGE_MS)throw Error('El parte INFOAR recuperado no está vigente');
    if(!String(extracted.text).includes(INFOAR_INCIDENT_SECTION))throw Error('INFOAR no contiene una sección de incendios interpretable');
    const entries=parseInfoarEntries(extracted.text);
    const located=await Promise.all(entries.map(async entry=>{
      try{
        const location=await locateMunicipality(entry,{fetchImpl,signal:controller.signal});
        return {entry,location};
      }catch{
        return {entry,location:null};
      }
    }));
    const records=located
      .map(({entry,location})=>normalizeIncident(entry,location,{receivedAt,publishedAt,now}))
      .filter(Boolean);
    const incidents=records.filter(item=>!item.archive);
    const archive=records.filter(item=>item.archive);
    const unlocated=located.filter(item=>!item.location).map(item=>`${item.entry.name} (${item.entry.province})`);
    const data={
      ok:true,
      source:SOURCE,
      sourceUrl:INFOAR_SOURCE_URL,
      pdfUrl:INFOAR_PDF_URL,
      historyUrl:INFOAR_HISTORY_URL,
      receivedAt,
      lastSuccessAt:receivedAt,
      publishedAt,
      incidents,
      archive,
      unlocated,
      fallback:false,
      degraded:Boolean(unlocated.length),
      cacheStatus:'live',
      cacheAgeMinutes:0,
      summary:`${incidents.length} incendios vigentes y ${archive.length} en archivo reciente${unlocated.length?`; ${unlocated.length} sin ubicación cartográfica verificable`:''}`
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
