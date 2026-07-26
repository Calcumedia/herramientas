export const config={runtime:'edge'};

const VIEWER='https://www.aemet.es/es/eltiempo/prediccion/incendios';
const HELP='https://www.aemet.es/es/eltiempo/prediccion/incendios/ayuda';
const BASE='https://opendata.aemet.es/opendata/api/incendios/mapasriesgo';
const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=3600, stale-while-revalidate=21600',
  'access-control-allow-origin':'*'
};

function areaFor(lat,lon){
  return lat<31.5&&lon<-12?'c':'p';
}

async function requestProduct(path,key){
  const url=new URL(`${BASE}/${path}`);
  url.searchParams.set('api_key',key);
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw Error(`AEMET HTTP ${response.status}`);
  const json=await response.json();
  if(Number(json.estado)!==200||!json.datos)throw Error(json.descripcion||'AEMET no devolvió un producto descargable');
  return {
    description:json.descripcion||'Producto oficial AEMET',
    dataUrl:json.datos,
    metadataUrl:json.metadatos||null
  };
}

export default async function handler(request){
  const url=new URL(request.url);
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<27||lat>44.5||lon<-19||lon>5){
    return new Response(JSON.stringify({error:'Coordenadas no válidas para España'}),{status:400,headers:HEADERS});
  }

  const area=areaFor(lat,lon);
  const apiKey=typeof process!=='undefined'&&process.env?String(process.env.AEMET_API_KEY||'').trim():'';
  const base={
    version:'4.7.0',
    source:'AEMET',
    attribution:'© AEMET',
    area,
    viewerUrl:VIEWER,
    helpUrl:HELP,
    levels:['Muy bajo','Bajo','Moderado','Alto','Muy alto','Extremo'],
    resolutionKm:1,
    updatedDaily:true,
    exactLocalLevel:false
  };

  if(!apiKey){
    return new Response(JSON.stringify({...base,configured:false,estimated:null,tomorrow:null,message:'La integración automática necesita una API Key de AEMET. El visor oficial sigue disponible.'}),{status:200,headers:HEADERS});
  }

  try{
    const [estimated,tomorrow]=await Promise.all([
      requestProduct(`estimado/area/${area}`,apiKey),
      requestProduct(`previsto/dia/1/area/${area}`,apiKey)
    ]);
    return new Response(JSON.stringify({...base,configured:true,estimated,tomorrow,retrievedAt:new Date().toISOString()}),{status:200,headers:HEADERS});
  }catch(error){
    return new Response(JSON.stringify({...base,configured:true,degraded:true,estimated:null,tomorrow:null,message:String(error.message||error)}),{status:200,headers:HEADERS});
  }
}
