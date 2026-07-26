export const config={runtime:'edge'};
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, s-maxage=86400, stale-while-revalidate=604800','access-control-allow-origin':'*'};
export default async function handler(request){
  const q=new URL(request.url).searchParams.get('q')?.trim()||'';
  if(q.length<2)return new Response(JSON.stringify({results:[]}),{headers});
  try{
    const url=new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q',q);
    url.searchParams.set('format','jsonv2');
    url.searchParams.set('addressdetails','1');
    url.searchParams.set('countrycodes','es');
    url.searchParams.set('limit','10');
    url.searchParams.set('accept-language','es');
    const response=await fetch(url,{headers:{'user-agent':'FuegoCentro/4.4.9 buscador nacional','accept-language':'es-ES,es;q=0.9'}});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const data=await response.json();
    const results=data.map((x,i)=>({
      id:String(x.place_id||i),
      name:x.name||String(x.display_name||'').split(',')[0],
      displayName:x.display_name,
      lat:Number(x.lat),
      lon:Number(x.lon),
      region:x.address?.state||x.address?.province||x.address?.county||'',
      placeType:x.addresstype||x.type||'',
      category:x.category||''
    })).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
    return new Response(JSON.stringify({results}),{headers});
  }catch(error){
    return new Response(JSON.stringify({results:[],error:String(error.message||error)}),{headers});
  }
}
