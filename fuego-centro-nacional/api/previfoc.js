import {fetchPrevifoc,INCIDENT_VIEWER_URL,PREVIFOC_PDF_URL,PREVIFOC_VIEWER_URL} from './previfoc-source.js';

export const config={runtime:'nodejs',maxDuration:20};

const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=900, stale-while-revalidate=3600',
  'access-control-allow-origin':'*'
};

function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=37.7&&lat<=41&&lon>=-1.7&&lon<=1.1;
}

async function createResponse(request){
  const url=new URL(request.url,'https://fuegocerca.local');
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
  if(!validCoordinates(lat,lon)){
    return new Response(JSON.stringify({error:'Coordenadas no válidas para la Comunitat Valenciana'}),{status:400,headers:HEADERS});
  }
  try{
    return new Response(JSON.stringify({
      version:'4.17.2',
      ...await fetchPrevifoc({lat,lon})
    }),{status:200,headers:HEADERS});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.17.2',
      ok:false,
      official:true,
      degraded:true,
      source:'112 Comunitat Valenciana · PREVIFOC',
      level:null,
      pdfUrl:PREVIFOC_PDF_URL,
      viewerUrl:PREVIFOC_VIEWER_URL,
      incidentViewerUrl:INCIDENT_VIEWER_URL,
      retrievedAt:new Date().toISOString(),
      message:String(error?.message||error),
      validityNote:'No se ha podido verificar el nivel PREVIFOC actual. Esta ausencia no equivale a riesgo bajo.',
      incidentCoverageNote:'El visor de incidentes 112CV se enlaza como consulta oficial, pero no se utiliza como un feed completo de incendios activos.'
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
