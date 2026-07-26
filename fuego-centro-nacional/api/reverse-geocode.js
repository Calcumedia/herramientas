export const config={runtime:'edge'};

const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=86400, stale-while-revalidate=604800',
  'access-control-allow-origin':'*'
};

export default async function handler(request){
  const url=new URL(request.url);
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
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
    const response=await fetch(target,{headers:{
      'user-agent':'FuegoCentro/4.5 buscador nacional',
      'accept-language':'es-ES,es;q=0.9'
    }});
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
