const ARCGIS_QUERY_URL='https://utility.arcgis.com/usrsvcs/servers/d6d1c0079ddd4c7f8876d58e13fcf1ac/rest/services/INFOCA/AN_INCIDENTES_PRO/FeatureServer/2/query';
export const INFOCA_SOURCE_URL='https://www.juntadeandalucia.es/organismos/ema/areas/incendios-forestales/situacion/incendios-activos.html';
export const INFOCA_VIEWER_URL='https://laagencia.maps.arcgis.com/apps/dashboards/87a5fe2d397e4140add84f50d8bdafd3';

const ANDALUSIAN_PROVINCES=new Set([
  'ALMERIA','CADIZ','CORDOBA','GRANADA','HUELVA','JAEN','MALAGA','SEVILLA'
]);
const ACTIVE_STATES=new Set(['ACTIVO','DECLARADO']);
const VALID_STATES=new Set(['ACTIVO','DECLARADO','ESTABILIZADO','CONTROLADO']);
const MAX_ACTIVE_AGE_MS=7*24*60*60*1000;
const MAX_ARCHIVE_AGE_MS=14*24*60*60*1000;

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
}

function madridOffsetMs(date){
  try{
    const label=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Madrid',timeZoneName:'longOffset'}).formatToParts(date).find(x=>x.type==='timeZoneName')?.value||'GMT+01:00';
    const match=label.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if(!match)return 60*60*1000;
    const sign=match[1]==='-'?-1:1;
    return sign*(Number(match[2])*60+Number(match[3]||0))*60*1000;
  }catch{
    return 60*60*1000;
  }
}

export function observedAtFromFeature(attributes={}){
  const dateMs=Number(attributes.FECHA);
  if(!Number.isFinite(dateMs))return null;
  const parts=String(attributes.HORA||'00:00:00').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hours=Number(parts?.[1]||0);
  const minutes=Number(parts?.[2]||0);
  const seconds=Number(parts?.[3]||0);
  const utcGuess=new Date(dateMs+hours*3600000+minutes*60000+seconds*1000);
  return new Date(utcGuess.getTime()-madridOffsetMs(utcGuess)).toISOString();
}

function riskForStatus(status){
  if(ACTIVE_STATES.has(status))return {statusClass:'active',risk:'high',riskLabel:'ALTO',riskScore:640};
  if(status==='ESTABILIZADO')return {statusClass:'stabilized',risk:'medium',riskLabel:'MEDIO',riskScore:360};
  return {statusClass:'controlled',risk:'watch',riskLabel:'VIGILANCIA',riskScore:90};
}

export function normalizeInfocaFeature(feature,{receivedAt=new Date().toISOString(),now=Date.now()}={}){
  const attributes=feature?.attributes||{};
  const province=normalize(attributes.PROVINCIA);
  const municipality=String(attributes.TERMINO_MUNICIPAL||'').trim();
  const status=normalize(attributes.ESTADO);
  const lat=Number(feature?.geometry?.y);
  const lon=Number(feature?.geometry?.x);
  const observedAt=observedAtFromFeature(attributes);
  if(!ANDALUSIAN_PROVINCES.has(province)||!municipality||!VALID_STATES.has(status)||!Number.isFinite(lat)||!Number.isFinite(lon)||!observedAt)return null;
  const age=now-new Date(observedAt).getTime();
  const archive=status==='CONTROLADO';
  if(age<0||age>(archive?MAX_ARCHIVE_AGE_MS:MAX_ACTIVE_AGE_MS))return null;
  const priority=riskForStatus(status);
  const id=String(attributes.OID_ENTERO||attributes.ESRI_OID||`${municipality}-${observedAt}`);
  const resources={
    aircraft:Number(attributes.MEDIOS_AEREOS)||0,
    bricas:Number(attributes.BRICAS)||0,
    specialistGroups:Number(attributes.GRUPOS_ESPECIALISTAS)||0,
    vehicles:Number(attributes.VEHICULOS)||0,
    technicians:Number(attributes.TECNICOS)||0,
    supportGroups:Number(attributes.GRUPOS_APOYO)||0
  };
  return {
    id:`infoca-${id}`,
    name:municipality,
    area:`${String(attributes.PROVINCIA||'Andalucía').trim()}, Andalucía`,
    region:'Andalucía',
    status,
    lat,
    lon,
    level:null,
    evidence:[{
      source:'Agencia de Emergencias de Andalucía · INFOCA',
      sourceType:'direct',
      status,
      publishedAt:observedAt,
      url:INFOCA_SOURCE_URL
    }],
    alerts:[],
    timeline:[{status,at:observedAt,source:'INFOCA'}],
    primaryUrl:INFOCA_SOURCE_URL,
    observedAt,
    publishedAt:observedAt,
    receivedAt,
    directSources:1,
    confidence:'alta',
    summary:`${status}. Registro oficial del visor INFOCA; puede presentar retraso respecto a los canales de emergencia.`,
    officialResources:resources,
    ...priority
  };
}

export function buildInfocaQueryUrl(){
  const url=new URL(ARCGIS_QUERY_URL);
  url.searchParams.set('where',"ESTADO <> 'EXTINGUIDO'");
  url.searchParams.set('outFields','OID_ENTERO,TERMINO_MUNICIPAL,PROVINCIA,TIPO_INCIDENTE,ESTADO,FECHA,HORA,MEDIOS_AEREOS,BRICAS,GRUPOS_ESPECIALISTAS,VEHICULOS,TECNICOS,GRUPOS_APOYO');
  url.searchParams.set('returnGeometry','true');
  url.searchParams.set('outSR','4326');
  url.searchParams.set('orderByFields','FECHA DESC,HORA DESC');
  url.searchParams.set('resultRecordCount','1000');
  url.searchParams.set('f','json');
  return url;
}

export async function fetchInfoca({fetchImpl=fetch,now=Date.now(),timeoutMs=10000}={}){
  const receivedAt=new Date(now).toISOString();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(buildInfocaQueryUrl(),{
      headers:{accept:'application/json'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response.ok)throw new Error(`INFOCA HTTP ${response.status}`);
    const payload=await response.json();
    if(payload?.error)throw new Error(`INFOCA ArcGIS ${payload.error.code||'error'}`);
    if(!Array.isArray(payload?.features))throw new Error('INFOCA no devolvió una colección de entidades');
    const records=payload.features.map(feature=>normalizeInfocaFeature(feature,{receivedAt,now})).filter(Boolean);
    const incidents=records.filter(x=>x.statusClass!=='controlled');
    const archive=records.filter(x=>x.statusClass==='controlled');
    const latest=records.map(x=>x.observedAt).sort().at(-1)||null;
    return {
      ok:true,
      source:'Agencia de Emergencias de Andalucía · INFOCA',
      sourceUrl:INFOCA_SOURCE_URL,
      viewerUrl:INFOCA_VIEWER_URL,
      receivedAt,
      publishedAt:latest,
      incidents,
      archive,
      summary:`${incidents.length} vigentes y ${archive.length} controlados recientes`
    };
  }finally{
    clearTimeout(timer);
  }
}
