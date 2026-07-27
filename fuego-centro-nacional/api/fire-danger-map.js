export const config={runtime:'edge'};

const SOURCE='https://www.aemet.es/es/api-eltiempo/incendios/imagen/RIESGO';
const FILE_PATTERN=/^[pc]_fc\d{3}_RIESGO_\d{8}_1\.png$/i;

export default async function handler(request){
  const url=new URL(request.url);
  const file=String(url.searchParams.get('file')||'');
  if(!FILE_PATTERN.test(file)){
    return new Response(JSON.stringify({error:'Producto AEMET no válido'}),{
      status:400,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
    });
  }
  try{
    const response=await fetch(`${SOURCE}/${encodeURIComponent(file)}`,{
      headers:{accept:'image/png'},
      cache:'no-store'
    });
    if(!response.ok)throw Error(`AEMET HTTP ${response.status}`);
    return new Response(response.body,{
      status:200,
      headers:{
        'content-type':'image/png',
        'cache-control':'public, s-maxage=86400, stale-while-revalidate=86400',
        'access-control-allow-origin':'*',
        'x-content-type-options':'nosniff'
      }
    });
  }catch(error){
    return new Response(JSON.stringify({error:String(error.message||error)}),{
      status:502,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
    });
  }
}
