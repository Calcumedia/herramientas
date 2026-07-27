import { strict as assert } from 'node:assert';
import handler from '../api/fire-perimeters.js';

const originalFetch=globalThis.fetch;
const square=(minLon,minLat,maxLon,maxLat)=>({
  type:'MultiPolygon',
  coordinates:[[[[minLon,minLat],[maxLon,minLat],[maxLon,maxLat],[minLon,maxLat],[minLon,minLat]]]]
});
const payload={
  count:2,next:null,previous:null,
  results:[
    {
      id:100,
      centroid:{type:'Point',coordinates:[-6.10,36.70]},
      bbox:[-6.12,36.68,-6.08,36.72],
      shape:square(-6.12,36.68,-6.08,36.72),
      country:'ES',province:'Cádiz',commune:'Jerez de la Frontera',
      firedate:'2026-07-24T12:00:00Z',lastupdate:'2026-07-27T09:00:00Z',
      lastfiredate:'2026-07-26T18:00:00Z',area_ha:482.4
    },
    {
      id:200,
      centroid:{type:'Point',coordinates:[-3.7,40.4]},
      bbox:[-3.8,40.3,-3.6,40.5],
      shape:square(-3.8,40.3,-3.6,40.5),
      country:'ES',province:'Madrid',commune:'Madrid',
      firedate:'2026-07-24T12:00:00Z',lastupdate:'2026-07-27T09:00:00Z',
      area_ha:100
    }
  ]
};

globalThis.fetch=async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});

try{
  const inside=await handler(new Request('https://fuegocerca.test/api/fire-perimeters?lat=36.70&lon=-6.10&radius=100'));
  assert.equal(inside.status,200);
  const insideData=await inside.json();
  assert.equal(insideData.version,'4.9.0');
  assert.equal(insideData.source,'EFFIS · Copernicus EMS');
  assert.equal(insideData.official,false);
  assert.equal(insideData.nearbyCount,1);
  assert.equal(insideData.perimeters[0].containsLocality,true);
  assert.equal(insideData.perimeters[0].distanceToEdgeKm,0);
  assert.equal(insideData.perimeters[0].areaHa,482.4);
  assert.equal(insideData.perimeters[0].geometry.type,'MultiPolygon');
  assert.match(insideData.coverageNote,/No representa el frente de llama/);

  const outside=await handler(new Request('https://fuegocerca.test/api/fire-perimeters?lat=36.70&lon=-6.15&radius=100'));
  const outsideData=await outside.json();
  assert.ok(outsideData.perimeters[0].distanceToEdgeKm>2);
  assert.ok(outsideData.perimeters[0].distanceToEdgeKm<8);
  assert.equal(outsideData.perimeters[0].containsLocality,false);
  assert.match(outsideData.distanceMethod,/hasta el borde/);

  const invalid=await handler(new Request('https://fuegocerca.test/api/fire-perimeters?lat=91&lon=0'));
  assert.equal(invalid.status,400);

  globalThis.fetch=async()=>new Response('fallo',{status:502});
  const degraded=await handler(new Request('https://fuegocerca.test/api/fire-perimeters?lat=36.70&lon=-6.10'));
  assert.equal(degraded.status,503);
  const degradedData=await degraded.json();
  assert.equal(degradedData.degraded,true);
  assert.match(degradedData.coverageNote,/no significa que no exista/);

  console.log('EFFIS fire perimeter endpoint contract checks passed.');
}finally{
  globalThis.fetch=originalFetch;
}
