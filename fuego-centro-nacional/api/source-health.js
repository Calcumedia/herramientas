export const config={runtime:'nodejs',maxDuration:45,regions:['fra1']};

function requestOrigin(request){
  const url=new URL(request.url,'https://fuegocerca.local');
  if(url.hostname!=='fuegocerca.local')return url.origin;
  return process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'https://fuego-centro-nacional.vercel.app';
}

async function createResponse(request){
  const startedAt=Date.now();
  const requestId=request.headers?.get?.('x-vercel-id')||null;
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'public, s-maxage=60, stale-while-revalidate=180',
    'access-control-allow-origin':'*'
  };
  console.log(JSON.stringify({level:'info',msg:'source-monitor-start',route:'/api/source-health',requestId}));
  try{
    const response=await fetch(`${requestOrigin(request)}/api/situation`,{cache:'no-store',headers:{accept:'application/json'}});
    if(!response.ok)throw Error(`Situación HTTP ${response.status}`);
    const data=await response.json();
    if(!data.sourceMonitor)throw Error('La situación no contiene sourceMonitor');
    const result={
      ...data.sourceMonitor,
      version:'4.18.0',
      situationVersion:data.version,
      situationFallback:Boolean(data.fallback),
      generatedAt:data.generatedAt||null
    };
    const log={level:result.issues.length?'warning':'info',msg:'source-monitor-done',route:'/api/source-health',requestId,status:result.status,admitted:result.admittedDirectSources,configured:result.configuredDirectSources,issues:result.issues,ms:Date.now()-startedAt};
    (result.issues.length?console.warn:console.log)(JSON.stringify(log));
    return new Response(JSON.stringify(result),{status:200,headers});
  }catch(error){
    console.error(JSON.stringify({level:'error',msg:'source-monitor-failed',route:'/api/source-health',requestId,error:String(error?.message||error),ms:Date.now()-startedAt}));
    return new Response(JSON.stringify({version:'4.18.0',status:'down',error:String(error?.message||error),entries:[],issues:[]}),{status:503,headers});
  }
}

export default async function handler(request,response){
  const webResponse=await createResponse(request);
  if(!response)return webResponse;
  response.statusCode=webResponse.status;
  webResponse.headers.forEach((value,key)=>response.setHeader(key,value));
  response.end(await webResponse.text());
}
