import { strict as assert } from 'node:assert';
import handler from '../api/fire-danger.js';

const originalKey=process.env.AEMET_API_KEY;
delete process.env.AEMET_API_KEY;

try{
  const valid=await handler(new Request('https://fuego-centro.test/api/fire-danger?lat=40.4167&lon=-3.7033'));
  assert.equal(valid.status,200);
  assert.match(valid.headers.get('content-type')||'',/application\/json/);
  const data=await valid.json();
  assert.equal(data.version,'4.7.0');
  assert.equal(data.source,'AEMET');
  assert.equal(data.configured,false);
  assert.equal(data.exactLocalLevel,false);
  assert.equal(data.estimated,null);
  assert.equal(data.tomorrow,null);
  assert.equal(data.levels.length,6);
  assert.ok(data.viewerUrl.includes('aemet.es'));
  assert.match(data.message,/API Key de AEMET/);
  assert.equal('localLevel' in data,false,'El endpoint no debe inventar un nivel local');

  const invalid=await handler(new Request('https://fuego-centro.test/api/fire-danger?lat=91&lon=0'));
  assert.equal(invalid.status,400);
  const invalidData=await invalid.json();
  assert.match(invalidData.error,/Coordenadas no válidas/);

  console.log('Fire danger endpoint contract checks passed.');
}finally{
  if(originalKey===undefined)delete process.env.AEMET_API_KEY;
  else process.env.AEMET_API_KEY=originalKey;
}
