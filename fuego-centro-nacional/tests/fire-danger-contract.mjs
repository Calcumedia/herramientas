import { strict as assert } from 'node:assert';
import handler from '../api/fire-danger.js';
import mapHandler from '../api/fire-danger-map.js';

const originalFetch=globalThis.fetch;
const isoDate=offset=>new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date(Date.now()+offset*86400000));
const filename=date=>{
  const [year,month,day]=date.split('-');
  return `p_fc001_RIESGO_${day}${month}${year}_1.png`;
};
const today=isoDate(0);
const tomorrow=isoDate(1);

globalThis.fetch=async url=>{
  const value=String(url);
  if(value.includes('/timeline/riesgo/PB')){
    return Response.json({incendios:{penbal:{variables:{RIESGO:[
      {fecha:today,fichero:filename(today)},
      {fecha:tomorrow,fichero:filename(tomorrow)}
    ]}}}});
  }
  if(value.includes('/leyenda/riesgo')){
    return Response.json({'Lista RGBA':[
      {Valores:['1'],RGBA:['75,150,227,255']},
      {Valores:['2'],RGBA:['81,209,246,255']},
      {Valores:['3'],RGBA:['87,229,32,255']},
      {Valores:['4'],RGBA:['249,251,47,255']},
      {Valores:['5'],RGBA:['239,133,4,255']},
      {Valores:['6'],RGBA:['245,35,0,255']}
    ]});
  }
  if(value.includes('/bounds/RIESGO/')){
    return Response.json([[5.20554,34.9966],[5.20554,44.215],[-10.205,44.215],[-10.205,34.9966]]);
  }
  if(value.includes('/imagen/RIESGO/')){
    return new Response(new Uint8Array([137,80,78,71]),{status:200,headers:{'content-type':'image/png'}});
  }
  throw Error(`Unexpected fetch: ${value}`);
};

try{
  const valid=await handler(new Request('https://fuegocerca.test/api/fire-danger?lat=40.4167&lon=-3.7033'));
  assert.equal(valid.status,200);
  assert.match(valid.headers.get('content-type')||'',/application\/json/);
  const data=await valid.json();
  assert.equal(data.version,'4.10.1');
  assert.equal(data.source,'AEMET');
  assert.equal(data.configured,true);
  assert.equal(data.exactLocalLevel,true);
  assert.equal(data.resolutionKm,1);
  assert.equal(data.today.validFor,today);
  assert.equal(data.tomorrow.validFor,tomorrow);
  assert.ok(data.today.imageUrl.startsWith('/api/fire-danger-map?file='));
  assert.ok(data.today.officialImageUrl.includes('aemet.es'));
  assert.equal(data.palette.length,6);
  assert.equal(data.levels.length,6);
  assert.ok(data.viewerUrl.includes('aemet.es'));
  assert.match(data.validityNote,/No confirma que exista un incendio/);
  assert.equal('localLevel' in data,false,'El servidor entrega el producto oficial; el píxel se resuelve en el navegador');

  const invalid=await handler(new Request('https://fuegocerca.test/api/fire-danger?lat=91&lon=0'));
  assert.equal(invalid.status,400);
  assert.match((await invalid.json()).error,/Coordenadas no válidas/);

  const map=await mapHandler(new Request(`https://fuegocerca.test/api/fire-danger-map?file=${filename(today)}`));
  assert.equal(map.status,200);
  assert.match(map.headers.get('content-type')||'',/image\/png/);

  const invalidMap=await mapHandler(new Request('https://fuegocerca.test/api/fire-danger-map?file=otro.png'));
  assert.equal(invalidMap.status,400);

  console.log('Fire danger endpoint and official raster proxy contract checks passed.');
}finally{
  globalThis.fetch=originalFetch;
}
