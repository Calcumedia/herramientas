export const config={runtime:'edge'};

const DGT_FEED='https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml';
const DGT_MAP='https://etraffic.dgt.es/etrafficWEB/';
const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=60, stale-while-revalidate=300',
  'access-control-allow-origin':'*'
};
const TYPE_LABELS={
  roadClosed:'Carretera cortada',
  carriagewayClosures:'Calzada cerrada',
  lanesClosed:'Carriles cerrados',
  laneClosures:'Carriles cerrados',
  narrowLanes:'Estrechamiento',
  alternatingContraflow:'Paso alternativo',
  singleAlternateLineTraffic:'Paso alternativo',
  contraflow:'Circulación en sentido contrario',
  lanesDeviated:'Desvío de carriles',
  weightRestrictionInOperation:'Restricción de peso',
  doNotUseSpecifiedLanesOrCarriageways:'Carril o calzada restringidos',
  accident:'Accidente',
  vehicleObstruction:'Vehículo obstaculizando',
  fallenTrees:'Árboles caídos',
  flooding:'Inundación',
  smokeHazard:'Humo',
  fire:'Incendio',
  roadworks:'Obras',
  roadMaintenance:'Mantenimiento',
  poorEnvironmentConditions:'Condiciones adversas',
  obstruction:'Obstáculo',
  disturbanceActivity:'Incidencia',
  publicEvent:'Evento'
};
const TYPE_TAGS=[
  'roadOrCarriagewayOrLaneManagementType','accidentType','obstructionType',
  'vehicleObstructionType','poorEnvironmentType','disturbanceActivityType',
  'publicEventType','causeType','roadMaintenanceType'
];

function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=27&&lat<=44.5&&lon>=-19&&lon<=5.5;
}

function decodeXml(value=''){
  return String(value).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').trim();
}

function value(block,tag){
  const match=block.match(new RegExp(`<(?:[a-z]+:)?${tag}(?:\\s[^>]*)?>([^<]*)<\\/(?:[a-z]+:)?${tag}>`,'i'));
  return match?decodeXml(match[1]):null;
}

function values(block,tag){
  return [...block.matchAll(new RegExp(`<(?:[a-z]+:)?${tag}(?:\\s[^>]*)?>([^<]*)<\\/(?:[a-z]+:)?${tag}>`,'gi'))].map(match=>decodeXml(match[1]));
}

function distanceKm(lat1,lon1,lat2,lon2){
  const toRad=value=>value*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function coordinates(block){
  return [...block.matchAll(/<(?:[a-z]+:)?pointCoordinates(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-z]+:)?pointCoordinates>/gi)].map(match=>({
    lat:Number(value(match[1],'latitude')),
    lon:Number(value(match[1],'longitude'))
  })).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon));
}

function incidentType(block){
  for(const tag of TYPE_TAGS){
    const found=value(block,tag);
    if(found)return found;
  }
  const type=block.match(/<sit:situationRecord[^>]*xsi:type="sit:([^"]+)"/i)?.[1];
  return type?type.replace(/^[A-Z]/,letter=>letter.toLowerCase()):'disturbanceActivity';
}

function severityFor(type){
  if(/roadClosed|carriagewayClosures/i.test(type))return {key:'closed',label:'Corte',rank:4};
  if(/lanesClosed|laneClosures|accident|fire|smoke|flood/i.test(type))return {key:'high',label:'Importante',rank:3};
  if(/contraflow|singleAlternate|deviat|narrow|obstruction|restriction/i.test(type))return {key:'medium',label:'Precaución',rank:2};
  return {key:'info',label:'Información',rank:1};
}

function normalizeRecord(block,origin){
  if(value(block,'validityStatus')&&value(block,'validityStatus')!=='active')return null;
  const points=coordinates(block);
  if(!points.length)return null;
  const distances=points.map(point=>distanceKm(origin.lat,origin.lon,point.lat,point.lon));
  const nearestIndex=distances.indexOf(Math.min(...distances));
  const point=points[nearestIndex];
  const type=incidentType(block);
  const severity=severityFor(type);
  const kilometerPoints=values(block,'kilometerPoint').map(Number).filter(Number.isFinite);
  const municipalities=[...new Set(values(block,'municipality').filter(Boolean))];
  const provinces=[...new Set(values(block,'province').filter(Boolean))];
  const road=value(block,'roadName')||value(block,'roadDestination')||'Vía sin identificar';
  const recordId=block.match(/<sit:situationRecord[^>]*\sid="([^"]+)"/i)?.[1]||`${road}-${point.lat}-${point.lon}`;
  return {
    id:`dgt-${recordId}`,
    source:'DGT',
    sourceType:'oficial',
    type,
    typeLabel:TYPE_LABELS[type]||TYPE_LABELS[value(block,'causeType')]||'Incidencia de tráfico',
    severity:severity.key,
    severityLabel:severity.label,
    severityRank:severity.rank,
    road,
    municipality:municipalities.join(' / ')||null,
    province:provinces.join(' / ')||null,
    direction:value(block,'tpegDirectionRoad')||value(block,'tpegDirection')||null,
    kilometerFrom:kilometerPoints.length?Math.min(...kilometerPoints):null,
    kilometerTo:kilometerPoints.length?Math.max(...kilometerPoints):null,
    lat:point.lat,
    lon:point.lon,
    distanceKm:distances[nearestIndex],
    createdAt:value(block,'situationRecordCreationTime')||null,
    updatedAt:value(block,'situationRecordVersionTime')||value(block,'situationRecordCreationTime')||null,
    startsAt:value(block,'overallStartTime')||null,
    probability:value(block,'probabilityOfOccurrence')||null,
    url:DGT_MAP
  };
}

function parseFeed(xml,origin,radius){
  const publicationTime=value(xml,'publicationTime');
  const records=[...xml.matchAll(/<sit:situationRecord\b[\s\S]*?<\/sit:situationRecord>/gi)]
    .map(match=>normalizeRecord(match[0],origin))
    .filter(Boolean)
    .filter(item=>item.distanceKm<=radius)
    .sort((a,b)=>b.severityRank-a.severityRank||a.distanceKm-b.distanceKm);
  return {publicationTime,records};
}

export default async function handler(request){
  const url=new URL(request.url);
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
  const radius=Math.min(100,Math.max(5,Number(url.searchParams.get('radius'))||50));
  if(!validCoordinates(lat,lon)){
    return new Response(JSON.stringify({error:'Coordenadas no válidas para España'}),{status:400,headers:HEADERS});
  }
  try{
    const response=await fetch(DGT_FEED,{
      headers:{accept:'application/xml,text/xml'},
      cache:'no-store'
    });
    if(!response.ok)throw Error(`DGT HTTP ${response.status}`);
    const xml=await response.text();
    const {publicationTime,records}=parseFeed(xml,{lat,lon},radius);
    return new Response(JSON.stringify({
      version:'4.10.1',
      source:'DGT',
      sourceUrl:DGT_FEED,
      mapUrl:DGT_MAP,
      format:'DATEX II 3.7',
      official:true,
      radiusKm:radius,
      publicationTime,
      retrievedAt:new Date().toISOString(),
      incidents:records.slice(0,8),
      nearbyCount:records.length,
      closuresCount:records.filter(item=>item.severity==='closed').length,
      coverageNote:'Red estatal de carreteras, excepto Cataluña y País Vasco. Una ausencia de registros no garantiza que todas las vías estén abiertas.',
      relationshipNote:'La DGT no siempre indica si una incidencia está relacionada con un incendio.'
    }),{status:200,headers:HEADERS});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.10.1',
      source:'DGT',
      mapUrl:DGT_MAP,
      degraded:true,
      incidents:[],
      radiusKm:radius,
      retrievedAt:new Date().toISOString(),
      message:String(error.message||error),
      coverageNote:'No se ha podido consultar el feed oficial. Usa el mapa de la DGT y no interpretes esta ausencia como carreteras abiertas.'
    }),{status:503,headers:HEADERS});
  }
}
