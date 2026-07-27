import {strict as assert} from 'node:assert';
import handler,{__parseIcaForTests} from '../api/air-quality.js';

const originalFetch=globalThis.fetch;
const csv=`cod_estacion,nombre,tipo,latitud,longitud,activa,fecha,indice,debido_a
1,ESTACIÓN CERCANA,FONDO,36.70,-6.10,true,2026-07-27T10:00:00,40,"PM10,PM2.5"
2,ESTACIÓN LEJANA,TRAFICO,37.10,-6.50,true,2026-07-27T10:00:00,2,NO2
3,ESTACIÓN INACTIVA,FONDO,36.69,-6.11,false,2026-07-27T10:00:00,6,O3
4,SIN DATO,FONDO,36.68,-6.12,true,2026-07-27T10:00:00,0,
`;

try{
  const parsed=__parseIcaForTests(csv,{lat:36.6817,lon:-6.1372},100);
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].name,'ESTACIÓN CERCANA');
  assert.equal(parsed[0].categoryLabel,'Desfavorable');
  assert.equal(parsed[0].limitedPollutants,true);
  assert.deepEqual(parsed[0].dueTo,['PM10','PM2.5']);

  globalThis.fetch=async()=>new Response(csv,{status:200,headers:{'content-type':'text/csv'}});
  const response=await handler(new Request('https://fuegocerca.test/api/air-quality?lat=36.6817&lon=-6.1372&radius=100'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.version,'4.10.0');
  assert.equal(data.officialDataset,true);
  assert.equal(data.provisional,true);
  assert.equal(data.validated,false);
  assert.equal(data.nearest.categoryKey,'unfavourable');
  assert.ok(data.nearest.distanceKm<10);
  assert.match(data.fireRelationshipNote,/no atribuye/i);
  assert.match(response.headers.get('cache-control'),/s-maxage=300/);

  const invalid=await handler(new Request('https://fuegocerca.test/api/air-quality?lat=91&lon=0'));
  assert.equal(invalid.status,400);

  globalThis.fetch=async()=>new Response('fallo',{status:502});
  const degraded=await handler(new Request('https://fuegocerca.test/api/air-quality?lat=36.6817&lon=-6.1372'));
  assert.equal(degraded.status,503);
  const degradedData=await degraded.json();
  assert.equal(degradedData.degraded,true);
  assert.match(degradedData.coverageNote,/no significa/i);

  console.log('MITECO national air-quality endpoint contract checks passed.');
}finally{
  globalThis.fetch=originalFetch;
}
