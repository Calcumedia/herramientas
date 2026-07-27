import {getCache,waitUntil} from '@vercel/functions';

export const config={maxDuration:60};

const EFFIS_API='https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/';
const EFFIS_VIEWER='https://forest-fire.emergency.copernicus.eu/apps/effis.csv/';
const EFFIS_METHOD='https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/rapid-damage-assessment';
const EFFIS_LICENSE='https://forest-fire.emergency.copernicus.eu/about-effis/data-license';
const CACHE_TTL_MS=60*60*1000;
const STALE_TTL_MS=24*60*60*1000;
const FETCH_TIMEOUT_MS=22000;
const RUNTIME_CACHE_KEY='effis-spain-burnt-areas-v492';
const RUNTIME_CACHE_TTL_SECONDS=24*60*60;
const RUNTIME_CACHE_MAX_BYTES=1750*1024;
const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=900, stale-while-revalidate=3600',
  'access-control-allow-origin':'*'
};
let effisCache={records:null,fetchedAt:0,queriedFrom:null};
let effisRefreshPromise=null;
let runtimeCacheOverride;
let backgroundSchedulerOverride;

export function __resetEffisCacheForTests(){
  effisCache={records:null,fetchedAt:0,queriedFrom:null};
  effisRefreshPromise=null;
}

export function __setEffisRuntimeCacheForTests(cache){
  runtimeCacheOverride=cache;
}

export function __setEffisBackgroundSchedulerForTests(scheduler){
  backgroundSchedulerOverride=scheduler;
}

function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=27&&lat<=44.5&&lon>=-19&&lon<=5.5;
}

function haversine(lat1,lon1,lat2,lon2){
  const rad=value=>value*Math.PI/180;
  const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function pointInRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i]||[],[xj,yj]=ring[j]||[];
    if(![xi,yi,xj,yj].every(Number.isFinite))continue;
    const intersects=((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi);
    if(intersects)inside=!inside;
  }
  return inside;
}

function pointInPolygon(lon,lat,polygon){
  if(!Array.isArray(polygon)||!pointInRing(lon,lat,polygon[0]||[]))return false;
  return !polygon.slice(1).some(ring=>pointInRing(lon,lat,ring));
}

function projected(lon,lat,origin){
  return {
    x:(lon-origin.lon)*111.32*Math.cos(origin.lat*Math.PI/180),
    y:(lat-origin.lat)*110.574
  };
}

function segmentDistance(a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx===0&&dy===0)return Math.hypot(a.x,a.y);
  const t=Math.max(0,Math.min(1,-((a.x*dx)+(a.y*dy))/(dx*dx+dy*dy)));
  return Math.hypot(a.x+t*dx,a.y+t*dy);
}

function geometryDistance(geometry,origin){
  const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  if(!polygons.length)return {distanceKm:null,contains:false};
  const contains=polygons.some(polygon=>pointInPolygon(origin.lon,origin.lat,polygon));
  if(contains)return {distanceKm:0,contains:true};
  let nearest=Infinity;
  for(const polygon of polygons)for(const ring of polygon||[]){
    for(let index=1;index<ring.length;index++){
      const first=ring[index-1],second=ring[index];
      if(!first||!second)continue;
      const a=projected(Number(first[0]),Number(first[1]),origin);
      const b=projected(Number(second[0]),Number(second[1]),origin);
      if([a.x,a.y,b.x,b.y].every(Number.isFinite))nearest=Math.min(nearest,segmentDistance(a,b));
    }
  }
  return {distanceKm:Number.isFinite(nearest)?nearest:null,contains:false};
}

function perpendicularDistance(point,start,end){
  const dx=end[0]-start[0],dy=end[1]-start[1];
  if(!dx&&!dy)return Math.hypot(point[0]-start[0],point[1]-start[1]);
  const t=Math.max(0,Math.min(1,((point[0]-start[0])*dx+(point[1]-start[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(point[0]-(start[0]+t*dx),point[1]-(start[1]+t*dy));
}

function simplifyOpen(points,tolerance){
  if(points.length<=2)return points;
  let max=0,index=0;
  for(let i=1;i<points.length-1;i++){
    const distance=perpendicularDistance(points[i],points[0],points[points.length-1]);
    if(distance>max){max=distance;index=i}
  }
  if(max<=tolerance)return [points[0],points[points.length-1]];
  return [...simplifyOpen(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyOpen(points.slice(index),tolerance)];
}

function simplifyRing(ring,tolerance=.00055){
  const valid=(ring||[]).filter(point=>Array.isArray(point)&&Number.isFinite(Number(point[0]))&&Number.isFinite(Number(point[1]))).map(point=>[Number(point[0]),Number(point[1])]);
  if(valid.length<4)return valid;
  const closed=valid[0][0]===valid.at(-1)[0]&&valid[0][1]===valid.at(-1)[1];
  const open=closed?valid.slice(0,-1):valid;
  if(open.length<4)return valid;
  const midpoint=Math.floor(open.length/2);
  const simplified=[...simplifyOpen(open.slice(0,midpoint+1),tolerance).slice(0,-1),...simplifyOpen([...open.slice(midpoint),open[0]],tolerance)];
  if(simplified.length<4)return valid;
  if(simplified.at(-1)[0]!==simplified[0][0]||simplified.at(-1)[1]!==simplified[0][1])simplified.push(simplified[0]);
  return simplified;
}

function simplifyGeometry(geometry,tolerance=.00055){
  if(geometry?.type==='Polygon')return {type:'Polygon',coordinates:(geometry.coordinates||[]).map(ring=>simplifyRing(ring,tolerance))};
  if(geometry?.type==='MultiPolygon')return {type:'MultiPolygon',coordinates:(geometry.coordinates||[]).map(polygon=>polygon.map(ring=>simplifyRing(ring,tolerance)))};
  return null;
}

function bboxMayBeNear(bbox,origin,radius){
  if(!Array.isArray(bbox)||bbox.length<4)return true;
  const lon=Math.max(Number(bbox[0]),Math.min(origin.lon,Number(bbox[2])));
  const lat=Math.max(Number(bbox[1]),Math.min(origin.lat,Number(bbox[3])));
  return [lat,lon].every(Number.isFinite)&&haversine(origin.lat,origin.lon,lat,lon)<=radius+2;
}

function perimeterAge(record){
  const reference=Date.parse(record.lastupdate||record.lastfiredate||record.firedate||'');
  if(!Number.isFinite(reference)){
    return {ageHours:null,ageCategory:'unknown',ageLabel:'Antigüedad no confirmada',isOld:true};
  }
  const ageHours=Math.max(0,(Date.now()-reference)/3600000);
  if(ageHours<=72)return {ageHours,ageCategory:'recent',ageLabel:'Producto actualizado en las últimas 72 h',isOld:false};
  if(ageHours<=168)return {ageHours,ageCategory:'aging',ageLabel:'Producto sin actualización en más de 72 h',isOld:false};
  return {ageHours,ageCategory:'old',ageLabel:'Perímetro histórico reciente',isOld:true};
}

function normalize(record,origin,radius){
  if(!record?.shape||!bboxMayBeNear(record.bbox,origin,radius))return null;
  const edge=geometryDistance(record.shape,origin);
  if(!Number.isFinite(edge.distanceKm)||edge.distanceKm>radius)return null;
  const coordinates=record.centroid?.coordinates||[];
  const centroid={lat:Number(coordinates[1]),lon:Number(coordinates[0])};
  const age=perimeterAge(record);
  return {
    id:`effis-${record.id}`,
    source:'EFFIS · Copernicus EMS',
    sourceType:'perímetro satelital de área quemada',
    areaHa:Number.isFinite(Number(record.area_ha))?Number(record.area_ha):null,
    fireDate:record.firedate||null,
    lastFireDate:record.lastfiredate||null,
    updatedAt:record.lastupdate||null,
    province:record.province||null,
    municipality:record.commune||null,
    centroid:Number.isFinite(centroid.lat)&&Number.isFinite(centroid.lon)?centroid:null,
    centroidDistanceKm:Number.isFinite(centroid.lat)&&Number.isFinite(centroid.lon)?haversine(origin.lat,origin.lon,centroid.lat,centroid.lon):null,
    distanceToEdgeKm:edge.distanceKm,
    containsLocality:edge.contains,
    bbox:record.bbox,
    geometry:simplifyGeometry(record.shape),
    viewerUrl:EFFIS_VIEWER,
    ...age,
    associationStatus:'not-linked',
    associationNote:'No se vincula automáticamente a un incendio oficial: un área quemada no demuestra que el fuego siga activo.'
  };
}

function stableSince(){
  const date=new Date(Date.now()-45*24*60*60*1000);
  date.setUTCHours(0,0,0,0);
  return date.toISOString();
}

function compactRecord(record,tolerance){
  if(!record?.shape)return null;
  return {
    id:record.id,
    centroid:record.centroid||null,
    bbox:record.bbox||null,
    shape:simplifyGeometry(record.shape,tolerance),
    area_ha:record.area_ha??null,
    firedate:record.firedate||null,
    lastfiredate:record.lastfiredate||null,
    lastupdate:record.lastupdate||null,
    province:record.province||null,
    commune:record.commune||null
  };
}

function compactDataset(rawRecords){
  const tolerances=[.00055,.0012,.0025,.005];
  let records=[],bytes=Infinity;
  for(const tolerance of tolerances){
    records=rawRecords.map(record=>compactRecord(record,tolerance)).filter(record=>record?.shape);
    bytes=new TextEncoder().encode(JSON.stringify(records)).byteLength;
    if(bytes<=RUNTIME_CACHE_MAX_BYTES)break;
  }
  return {records,bytes,cacheable:bytes<=RUNTIME_CACHE_MAX_BYTES};
}

export function __compactEffisDatasetForTests(records){
  return compactDataset(records);
}

function runtimeCache(){
  if(runtimeCacheOverride!==undefined)return runtimeCacheOverride;
  try{return getCache({namespace:'fuegocerca-effis'})}catch{return null}
}

function validDataset(dataset){
  return dataset&&Array.isArray(dataset.records)&&Number.isFinite(dataset.fetchedAt)&&typeof dataset.queriedFrom==='string';
}

async function readRuntimeDataset(){
  try{
    const cache=runtimeCache();
    if(!cache)return null;
    const cached=await cache.get(RUNTIME_CACHE_KEY);
    return validDataset(cached)?cached:null;
  }catch{
    return null;
  }
}

async function writeRuntimeDataset(dataset){
  if(!dataset.cacheable)return false;
  try{
    const cache=runtimeCache();
    if(!cache)return false;
    await cache.set(RUNTIME_CACHE_KEY,{
      records:dataset.records,
      fetchedAt:dataset.fetchedAt,
      queriedFrom:dataset.queriedFrom,
      bytes:dataset.bytes
    },{
      ttl:RUNTIME_CACHE_TTL_SECONDS,
      tags:['effis-spain','fire-perimeters'],
      name:'EFFIS Spain burnt areas'
    });
    return true;
  }catch{
    return false;
  }
}

async function refreshEffisRecords(){
  if(effisRefreshPromise)return effisRefreshPromise;
  effisRefreshPromise=(async()=>{
    const startedAt=Date.now();
    const since=stableSince();
    const upstream=new URL(EFFIS_API);
    upstream.searchParams.set('country','ES');
    upstream.searchParams.set('firedate__gte',since);
    upstream.searchParams.set('ordering','-lastupdate');
    upstream.searchParams.set('limit','500');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
    try{
      const response=await fetch(upstream,{headers:{accept:'application/json'},cache:'force-cache',signal:controller.signal});
      if(!response.ok)throw Error(`EFFIS HTTP ${response.status}`);
      const raw=await response.json();
      const compact=compactDataset(Array.isArray(raw.results)?raw.results:[]);
      const dataset={
        records:compact.records,
        fetchedAt:Date.now(),
        queriedFrom:since,
        bytes:compact.bytes,
        cacheable:compact.cacheable,
        upstreamDurationMs:Date.now()-startedAt
      };
      const persisted=await writeRuntimeDataset(dataset);
      effisCache={records:dataset.records,fetchedAt:dataset.fetchedAt,queriedFrom:dataset.queriedFrom,bytes:dataset.bytes,persisted};
      return {...dataset,persisted,cacheStatus:'upstream',usingStaleCache:false,refreshing:false};
    }finally{
      clearTimeout(timeout);
    }
  })();
  try{return await effisRefreshPromise}finally{effisRefreshPromise=null}
}

function scheduleRefresh(){
  const factory=()=>refreshEffisRecords().catch(()=>null);
  if(backgroundSchedulerOverride)return backgroundSchedulerOverride(factory);
  const task=factory();
  try{waitUntil(task)}catch{}
}

async function fetchEffisRecords(){
  const now=Date.now();
  if(validDataset(effisCache)&&now-effisCache.fetchedAt<CACHE_TTL_MS){
    return {...effisCache,cacheStatus:'memory',usingStaleCache:false,refreshing:false};
  }
  const persistent=await readRuntimeDataset();
  if(persistent){
    effisCache={records:persistent.records,fetchedAt:persistent.fetchedAt,queriedFrom:persistent.queriedFrom,bytes:persistent.bytes,persisted:true};
    const age=now-persistent.fetchedAt;
    if(age<CACHE_TTL_MS)return {...persistent,cacheStatus:'runtime',usingStaleCache:false,refreshing:false};
    if(age<STALE_TTL_MS){
      scheduleRefresh();
      return {...persistent,cacheStatus:'runtime-stale',usingStaleCache:true,refreshing:true};
    }
  }
  const fallback=validDataset(effisCache)&&now-effisCache.fetchedAt<STALE_TTL_MS?{...effisCache}:null;
  try{
    return await refreshEffisRecords();
  }catch(error){
    if(fallback){
      return {...fallback,cacheStatus:'stale',usingStaleCache:true,refreshing:false,refreshError:String(error.message||error)};
    }
    throw error;
  }
}

async function createResponse(request){
  const startedAt=Date.now();
  // Node functions receive a relative URL on Vercel, while Edge and local
  // Request objects normally expose an absolute one.
  const url=new URL(request.url,'https://fuegocerca.local');
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
  const radius=Math.min(200,Math.max(10,Number(url.searchParams.get('radius'))||100));
  if(!validCoordinates(lat,lon)){
    return new Response(JSON.stringify({error:'Coordenadas no válidas para España'}),{status:400,headers:HEADERS});
  }
  try{
    const dataset=await fetchEffisRecords();
    const origin={lat,lon};
    const perimeters=dataset.records
      .map(record=>normalize(record,origin,radius))
      .filter(Boolean)
      .sort((a,b)=>Number(b.containsLocality)-Number(a.containsLocality)||a.distanceToEdgeKm-b.distanceToEdgeKm)
      .slice(0,12);
    const responseHeaders=dataset.usingStaleCache
      ?{...HEADERS,'cache-control':'public, s-maxage=30, stale-while-revalidate=60'}
      :HEADERS;
    return new Response(JSON.stringify({
      version:'4.9.3',
      source:'EFFIS · Copernicus EMS',
      official:false,
      product:'Rapid Damage Assessment · Burnt Areas',
      radiusKm:radius,
      servedAt:new Date().toISOString(),
      retrievedAt:new Date(dataset.fetchedAt).toISOString(),
      queriedFrom:dataset.queriedFrom,
      cacheStatus:dataset.cacheStatus,
      usingStaleCache:dataset.usingStaleCache,
      refreshing:dataset.refreshing,
      persistentCache:dataset.persisted!==false,
      datasetBytes:dataset.bytes||null,
      upstreamDurationMs:dataset.upstreamDurationMs||null,
      processingMs:Date.now()-startedAt,
      nearbyCount:perimeters.length,
      perimeters,
      viewerUrl:EFFIS_VIEWER,
      methodologyUrl:EFFIS_METHOD,
      licenseUrl:EFFIS_LICENSE,
      distanceMethod:'Distancia aproximada en línea recta desde la coordenada de la localidad hasta el borde del perímetro cartografiado.',
      coverageNote:'EFFIS cartografía áreas quemadas mediante satélite. No representa el frente de llama en tiempo real, no distingue todos los tipos de quema y puede omitir incendios pequeños o recientes.',
      associationNote:'FuegoCerca no asocia automáticamente estos perímetros a incendios oficiales sin una coincidencia espacial y temporal verificable.'
    }),{status:200,headers:{...responseHeaders,'server-timing':`fuegocerca;dur=${Date.now()-startedAt}`}});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.9.3',
      source:'EFFIS · Copernicus EMS',
      degraded:true,
      radiusKm:radius,
      retrievedAt:new Date().toISOString(),
      processingMs:Date.now()-startedAt,
      perimeters:[],
      viewerUrl:EFFIS_VIEWER,
      methodologyUrl:EFFIS_METHOD,
      message:String(error.message||error),
      coverageNote:'No se ha podido consultar EFFIS. La ausencia de perímetros no significa que no exista un incendio.'
    }),{status:503,headers:HEADERS});
  }
}

export default async function handler(request,response){
  const webResponse=await createResponse(request);
  if(!response)return webResponse;
  response.statusCode=webResponse.status;
  webResponse.headers.forEach((value,key)=>response.setHeader(key,value));
  response.end(await webResponse.text());
}
