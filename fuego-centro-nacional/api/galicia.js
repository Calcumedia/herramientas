export const config={runtime:'nodejs',maxDuration:30};

import {fetchGalicia,GALICIA_SOURCE_URL,CARTOCIUDAD_SOURCE_URL} from './galicia-source.js';

const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=300, stale-while-revalidate=900',
  'access-control-allow-origin':'*'
};

async function createResponse(){
  try{
    const data=await fetchGalicia();
    return new Response(JSON.stringify({
      version:'4.15.0',
      official:true,
      locationSource:'IGN · CartoCiudad',
      locationSourceUrl:CARTOCIUDAD_SOURCE_URL,
      ...data
    }),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.15.0',
      official:true,
      ok:false,
      degraded:true,
      source:'Xunta de Galicia · Medio Rural',
      sourceUrl:GALICIA_SOURCE_URL,
      locationSource:'IGN · CartoCiudad',
      locationSourceUrl:CARTOCIUDAD_SOURCE_URL,
      currentBulletin:false,
      incidents:[],
      archive:[],
      unlocated:[],
      coverageComplete:false,
      confidenceForAbsence:false,
      reportingThresholdHectares:20,
      error:String(error?.message||error),
      coverageNote:'No se ha podido validar el portal de Medio Rural. La ausencia de registros no significa que no existan incendios en Galicia.'
    }),{status:503,headers});
  }
}

export default async function handler(request,response){
  const webResponse=await createResponse();
  if(!response)return webResponse;
  response.statusCode=webResponse.status;
  webResponse.headers.forEach((value,key)=>response.setHeader(key,value));
  response.end(await webResponse.text());
}
