export const config={runtime:'edge'};
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, s-maxage=86400, stale-while-revalidate=604800','access-control-allow-origin':'*'};
const requestHeaders={'user-agent':'FuegoCerca/4.18 buscador nacional','accept-language':'es-ES,es;q=0.9'};

async function reverseGeocode(lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<27||lat>44.5||lon<-19||lon>5){
  return new Response(JSON.stringify({error:'Coordenadas no válidas para España'}),{status:400,headers});
 }
 try{
  const target=new URL('https://nominatim.openstreetmap.org/reverse');
  target.searchParams.set('lat',lat.toFixed(5));
  target.searchParams.set('lon',lon.toFixed(5));
  target.searchParams.set('format','jsonv2');
  target.searchParams.set('addressdetails','1');
  target.searchParams.set('zoom','14');
  target.searchParams.set('accept-language','es');
  const response=await fetch(target,{headers:requestHeaders});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const data=await response.json();
  const address=data.address||{};
  const name=address.city||address.town||address.village||address.municipality||address.hamlet||address.county||data.name;
  if(!name)throw Error('Localidad no identificada');
  return new Response(JSON.stringify({result:{
   name,
   displayName:data.display_name||name,
   region:address.state||address.region||address.province||'',
   lat:Number(data.lat)||lat,
   lon:Number(data.lon)||lon,
   placeType:data.addresstype||data.type||'locality',
   category:data.category||'place'
  }}),{status:200,headers});
 }catch(error){
  return new Response(JSON.stringify({error:String(error.message||error)}),{status:502,headers});
 }
}

async function searchPlaces(q){
 if(q.length<2)return new Response(JSON.stringify({results:[]}),{headers});
 try{
  const target=new URL('https://nominatim.openstreetmap.org/search');
  target.searchParams.set('q',q);
  target.searchParams.set('format','jsonv2');
  target.searchParams.set('addressdetails','1');
  target.searchParams.set('countrycodes','es');
  target.searchParams.set('limit','10');
  target.searchParams.set('accept-language','es');
  const response=await fetch(target,{headers:requestHeaders});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const data=await response.json();
  const results=data.map((item,index)=>({
   id:String(item.place_id||index),
   name:item.name||String(item.display_name||'').split(',')[0],
   displayName:item.display_name,
   lat:Number(item.lat),
   lon:Number(item.lon),
   region:item.address?.state||item.address?.province||item.address?.county||'',
   placeType:item.addresstype||item.type||'',
   category:item.category||''
  })).filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lon));
  return new Response(JSON.stringify({results}),{headers});
 }catch(error){
  return new Response(JSON.stringify({results:[],error:String(error.message||error)}),{headers});
 }
}

export default async function handler(request){
 const url=new URL(request.url);
 const hasCoordinates=url.searchParams.has('lat')||url.searchParams.has('lon');
 if(hasCoordinates)return reverseGeocode(Number(url.searchParams.get('lat')),Number(url.searchParams.get('lon')));
 return searchPlaces(url.searchParams.get('q')?.trim()||'');
}
