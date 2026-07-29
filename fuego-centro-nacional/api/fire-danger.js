export const config={runtime:'edge'};

const VIEWER='https://www.aemet.es/es/eltiempo/prediccion/incendios';
const HELP='https://www.aemet.es/es/eltiempo/prediccion/incendios/ayuda';
const API='https://www.aemet.es/es/api-eltiempo/incendios';
const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=1800, stale-while-revalidate=21600',
  'access-control-allow-origin':'*'
};
const LEVEL_NAMES={
  0:'Sin nivel forestal',
  1:'Muy bajo',
  2:'Bajo',
  3:'Moderado',
  4:'Alto',
  5:'Muy alto',
  6:'Extremo',
  255:'Sin datos'
};

function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=27&&lat<=44.5&&lon>=-19&&lon<=5.5;
}

function areaFor(lat,lon){
  return lat<31.8&&lon<-12?{timeline:'CAN',key:'canarias',label:'Canarias'}:{timeline:'PB',key:'penbal',label:'Península y Baleares'};
}

function madridDate(offset=0){
  const date=new Date(Date.now()+offset*86400000);
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}

function sourceRunDate(filename){
  const match=String(filename||'').match(/RIESGO_(\d{2})(\d{2})(\d{4})_/);
  return match?`${match[3]}-${match[2]}-${match[1]}`:null;
}

async function getJson(url){
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw Error(`AEMET HTTP ${response.status}`);
  return response.json();
}

function normalizePalette(data){
  return (data?.['Lista RGBA']||[]).map(entry=>{
    const value=Number(entry?.Valores?.[0]);
    const rgba=String(entry?.RGBA?.[0]||'').split(',').map(Number);
    return {
      value,
      label:LEVEL_NAMES[value]||`Nivel ${value}`,
      rgba:rgba.length===4&&rgba.every(Number.isFinite)?rgba:null
    };
  }).filter(item=>Number.isFinite(item.value)&&item.rgba);
}

function productFor(items,date){
  const sorted=[...(items||[])].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  return sorted.find(item=>item.fecha===date)||sorted.find(item=>item.fecha>date)||sorted.at(-1)||null;
}

async function enrichProduct(item,kind){
  if(!item?.fichero)return null;
  const bounds=await getJson(`${API}/bounds/RIESGO/${encodeURIComponent(item.fichero)}`);
  return {
    kind,
    validFor:item.fecha,
    filename:item.fichero,
    sourceRunDate:sourceRunDate(item.fichero),
    bounds,
    imageUrl:`/api/fire-danger-map?file=${encodeURIComponent(item.fichero)}`,
    officialImageUrl:`${API}/imagen/RIESGO/${encodeURIComponent(item.fichero)}`
  };
}

export default async function handler(request){
  const url=new URL(request.url);
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
  if(!validCoordinates(lat,lon)){
    return new Response(JSON.stringify({error:'Coordenadas no válidas para España'}),{status:400,headers:HEADERS});
  }

  const area=areaFor(lat,lon);
  const base={
    version:'4.18.0',
    source:'AEMET',
    attribution:'© AEMET',
    sourceMode:'visor oficial',
    area:area.timeline,
    areaLabel:area.label,
    viewerUrl:VIEWER,
    helpUrl:HELP,
    levels:Object.values(LEVEL_NAMES).filter(label=>!label.startsWith('Sin ')),
    resolutionKm:1,
    updatedDaily:true,
    exactLocalLevel:true,
    localLevelMethod:'Muestreo del píxel oficial AEMET de 1 km',
    validityNote:'El producto representa el máximo peligro diario, alrededor de las 12 UTC. No confirma que exista un incendio.'
  };

  try{
    const timeline=await getJson(`${API}/timeline/riesgo/${area.timeline}`);
    const items=timeline?.incendios?.[area.key]?.variables?.RIESGO||[];
    const todayItem=productFor(items,madridDate(0));
    const tomorrowItem=productFor(items,madridDate(1));
    if(!todayItem)throw Error('AEMET no ha publicado todavía un producto cartográfico');
    const [palette,today,tomorrow]=await Promise.all([
      getJson(`${API}/leyenda/riesgo`).then(normalizePalette),
      enrichProduct(todayItem,'today'),
      tomorrowItem&&tomorrowItem.fichero!==todayItem.fichero?enrichProduct(tomorrowItem,'tomorrow'):null
    ]);
    return new Response(JSON.stringify({
      ...base,
      configured:true,
      palette,
      today,
      tomorrow,
      retrievedAt:new Date().toISOString()
    }),{status:200,headers:HEADERS});
  }catch(error){
    return new Response(JSON.stringify({
      ...base,
      configured:true,
      degraded:true,
      today:null,
      tomorrow:null,
      retrievedAt:new Date().toISOString(),
      message:`No se ha podido recuperar el producto oficial: ${String(error.message||error)}`
    }),{status:200,headers:HEADERS});
  }
}
