export const config={runtime:'edge'};

import {BOMBERS_SOURCE_URL,BOMBERS_VIEWER_URL,fetchBombers} from './bombers-source.js';

const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=60, stale-while-revalidate=180',
  'access-control-allow-origin':'*'
};

export default async function handler(){
  try{
    const data=await fetchBombers();
    return new Response(JSON.stringify({version:'4.16.0',official:true,...data}),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.16.0',
      official:true,
      ok:false,
      degraded:true,
      source:'Bombers de la Generalitat de Catalunya',
      sourceUrl:BOMBERS_SOURCE_URL,
      viewerUrl:BOMBERS_VIEWER_URL,
      incidents:[],
      archive:[],
      otherVegetation:[],
      error:String(error?.message||error),
      coverageNote:'No se ha podido consultar Bombers. La ausencia de registros no significa que no existan incendios en Catalunya.'
    }),{status:503,headers});
  }
}
