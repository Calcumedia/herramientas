export const config={runtime:'nodejs',maxDuration:30};

import {fetchInfoar,INFOAR_HISTORY_URL,INFOAR_PDF_URL,INFOAR_SOURCE_URL} from './infoar-source.js';

const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=300, stale-while-revalidate=900',
  'access-control-allow-origin':'*'
};

async function createResponse(){
  try{
    const data=await fetchInfoar();
    return new Response(JSON.stringify({version:'4.14.0',official:true,...data}),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.14.0',
      official:true,
      ok:false,
      degraded:true,
      source:'Gobierno de Aragón · INFOAR',
      sourceUrl:INFOAR_SOURCE_URL,
      pdfUrl:INFOAR_PDF_URL,
      historyUrl:INFOAR_HISTORY_URL,
      incidents:[],
      archive:[],
      unlocated:[],
      error:String(error?.message||error),
      coverageNote:'No se ha podido validar el parte diario de INFOAR. La ausencia de registros no significa que no existan incendios en Aragón.'
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
