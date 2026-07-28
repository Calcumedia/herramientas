export const config={runtime:'edge'};

import {fetchInfoca,INFOCA_SOURCE_URL,INFOCA_VIEWER_URL} from './infoca-source.js';

const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=120, stale-while-revalidate=300',
  'access-control-allow-origin':'*'
};

export default async function handler(){
  try{
    const data=await fetchInfoca();
    return new Response(JSON.stringify({version:'4.14.0',official:true,...data}),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.14.0',
      official:true,
      ok:false,
      degraded:true,
      source:'Agencia de Emergencias de Andalucía · INFOCA',
      sourceUrl:INFOCA_SOURCE_URL,
      viewerUrl:INFOCA_VIEWER_URL,
      incidents:[],
      archive:[],
      error:String(error?.message||error),
      coverageNote:'No se ha podido consultar INFOCA. La ausencia de registros no significa que no existan incendios en Andalucía.'
    }),{status:503,headers});
  }
}
