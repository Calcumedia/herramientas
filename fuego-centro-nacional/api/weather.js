export const config={runtime:'edge'};

const SOURCE='Open-Meteo';
const SOURCE_URL='https://open-meteo.com/en/docs';
const API='https://api.open-meteo.com/v1/forecast';
const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=900, stale-while-revalidate=1800',
  'access-control-allow-origin':'*'
};

function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=27&&lat<=44.5&&lon>=-19&&lon<=5;
}

function maxFinite(values){
  const filtered=(values||[]).filter(Number.isFinite);
  return filtered.length?Math.max(...filtered):null;
}

export default async function handler(request){
  const requestUrl=new URL(request.url);
  const lat=Number(requestUrl.searchParams.get('lat'));
  const lon=Number(requestUrl.searchParams.get('lon'));
  if(!validCoordinates(lat,lon)){
    return new Response(JSON.stringify({error:'Coordenadas no válidas para España'}),{status:400,headers:HEADERS});
  }

  const url=new URL(API);
  url.searchParams.set('latitude',String(lat));
  url.searchParams.set('longitude',String(lon));
  url.searchParams.set('current','temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m');
  url.searchParams.set('hourly','wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,relative_humidity_2m');
  url.searchParams.set('forecast_hours','24');
  url.searchParams.set('timezone','auto');
  url.searchParams.set('wind_speed_unit','kmh');

  try{
    const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw Error(`Open-Meteo HTTP ${response.status}`);
    const data=await response.json();
    const current=data.current||{};
    const hourly=data.hourly||{};
    return new Response(JSON.stringify({
      version:'4.10.0',
      source:SOURCE,
      sourceUrl:SOURCE_URL,
      attribution:'Weather data by Open-Meteo.com',
      modelBased:true,
      coordinates:{lat:data.latitude??lat,lon:data.longitude??lon},
      timezone:data.timezone||null,
      updatedAt:current.time||new Date().toISOString(),
      current:{
        temperatureC:Number.isFinite(current.temperature_2m)?current.temperature_2m:null,
        relativeHumidity:Number.isFinite(current.relative_humidity_2m)?current.relative_humidity_2m:null,
        windSpeedKmh:Number.isFinite(current.wind_speed_10m)?current.wind_speed_10m:null,
        windDirectionDeg:Number.isFinite(current.wind_direction_10m)?current.wind_direction_10m:null,
        windGustKmh:Number.isFinite(current.wind_gusts_10m)?current.wind_gusts_10m:null
      },
      next24Hours:{
        maxWindSpeedKmh:maxFinite(hourly.wind_speed_10m),
        maxWindGustKmh:maxFinite(hourly.wind_gusts_10m),
        times:Array.isArray(hourly.time)?hourly.time:[]
      },
      disclaimer:'Predicción meteorológica basada en modelos. No determina por sí sola la trayectoria de un incendio ni sustituye a AEMET, 112 o las autoridades.'
    }),{status:200,headers:HEADERS});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.10.0',source:SOURCE,sourceUrl:SOURCE_URL,degraded:true,
      error:String(error.message||error),
      disclaimer:'No hay datos meteorológicos disponibles. Esta ausencia no implica condiciones favorables ni desfavorables.'
    }),{status:503,headers:HEADERS});
  }
}
