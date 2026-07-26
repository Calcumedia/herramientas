export const config={runtime:'edge'};
const UPSTREAM='https://fuego-centro-panel.vercel.app';
export default async function handler(){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'};
  try{
    const response=await fetch(`${UPSTREAM}/api/health`,{cache:'no-store'});
    if(!response.ok)throw Error(`Motor de datos HTTP ${response.status}`);
    const data=await response.json();
    return new Response(JSON.stringify({
      ...data,
      status:data.status==='ok'?'ok':'degraded',
      version:'4.4.9',
      dataEngineVersion:data.version||'4.3.1',
      nationalCoverageDirectory:19,
      mapCenter:[40.4167,-3.7033],
      mapZoom:6,
      staticLocalitySearch:true,
      initialAutoFit:false
    }),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({status:'down',version:'4.4.9',error:String(error.message||error)}),{status:503,headers});
  }
}
