import {strict as assert} from 'node:assert';
import {deflateSync} from 'node:zlib';
import handler from '../api/previfoc.js';
import {extractPdfImage,fetchPrevifoc,parsePdfCreationDate,samplePrevifocLevel} from '../api/previfoc-source.js';

const WIDTH=280;
const HEIGHT=467;
const madridParts=value=>new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'
}).format(value).replaceAll('-','');

function fakePdf(rgb,date=new Date()){
  const pixels=Buffer.alloc(WIDTH*HEIGHT*3);
  for(let index=0;index<pixels.length;index+=3){
    pixels[index]=rgb[0];
    pixels[index+1]=rgb[1];
    pixels[index+2]=rgb[2];
  }
  const compressed=deflateSync(pixels);
  return Buffer.concat([
    Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Name/Im10 /Width ${WIDTH} /Height ${HEIGHT} /BitsPerComponent 8 /ColorSpace /DeviceRGB /Filter/FlateDecode /Length ${compressed.length} >>\nstream\n`,'latin1'),
    compressed,
    Buffer.from(`\nendstream\nendobj\n2 0 obj\n<< /CreationDate(D:${madridParts(date)}000251+02'00') >>\nendobj\n%%EOF`,'latin1')
  ]);
}

const valencia={lat:39.4699,lon:-0.3763};
const currentPdf=fakePdf([231,61,53]);
const metadata=parsePdfCreationDate(currentPdf);
assert.equal(metadata.validFor,new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));

const image=extractPdfImage(currentPdf);
assert.equal(image.width,WIDTH);
assert.equal(image.height,HEIGHT);
assert.equal(image.pixels.length,WIDTH*HEIGHT*3);
assert.equal(samplePrevifocLevel(image,valencia.lat,valencia.lon).value,3);
assert.equal(samplePrevifocLevel(extractPdfImage(fakePdf([255,152,0])),valencia.lat,valencia.lon).value,2);
assert.equal(samplePrevifocLevel(extractPdfImage(fakePdf([72,151,73])),valencia.lat,valencia.lon).value,1);
assert.equal(samplePrevifocLevel(image,40.4167,-3.7033),null);

const responseFor=pdf=>new Response(pdf,{status:200,headers:{'content-type':'application/pdf'}});
const current=await fetchPrevifoc({
  ...valencia,
  fetchImpl:async()=>responseFor(currentPdf)
});
assert.equal(current.official,true);
assert.equal(current.current,true);
assert.equal(current.level.value,3);
assert.match(current.level.label,/extremo/i);
assert.match(current.validityNote,/No confirma que exista un incendio/);
assert.match(current.incidentCoverageNote,/subconjunto/i);
assert.match(current.incidentCoverageNote,/no lo usa como un feed completo/i);

const staleDate=new Date(Date.now()-86400000);
const stale=await fetchPrevifoc({
  ...valencia,
  fetchImpl:async()=>responseFor(fakePdf([72,151,73],staleDate))
});
assert.equal(stale.current,false);
assert.equal(stale.level,null);
assert.equal(stale.degraded,true);
assert.match(stale.validityNote,/no se utiliza para asignar un nivel actual/i);

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async()=>responseFor(currentPdf);
  const valid=await handler(new Request(`https://fuegocerca.test/api/previfoc?lat=${valencia.lat}&lon=${valencia.lon}`));
  assert.equal(valid.status,200);
  const data=await valid.json();
  assert.equal(data.version,'4.17.2');
  assert.equal(data.source,'112 Comunitat Valenciana · PREVIFOC');
  assert.equal(data.level.value,3);
  assert.equal(data.current,true);
  assert.ok(data.pdfUrl.includes('112cv.gva.es'));
  assert.ok(data.incidentViewerUrl.includes('incidentes.jsf'));

  const invalid=await handler(new Request('https://fuegocerca.test/api/previfoc?lat=40.4167&lon=-3.7033'));
  assert.equal(invalid.status,400);
  assert.match((await invalid.json()).error,/Comunitat Valenciana/);
}finally{
  globalThis.fetch=originalFetch;
}

console.log('PREVIFOC official PDF, freshness and local-level contract checks passed.');
