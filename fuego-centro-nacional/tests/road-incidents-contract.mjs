import { strict as assert } from 'node:assert';
import handler from '../api/road-incidents.js';

const originalFetch=globalThis.fetch;
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<d2Payload xmlns:com="http://datex2.eu/schema/3/common" xmlns:sit="http://datex2.eu/schema/3/situation">
  <com:publicationTime>2026-07-27T10:05:00Z</com:publicationTime>
  <sit:situationRecord id="close-a4" xsi:type="sit:RoadOrCarriagewayOrLaneManagement" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <sit:validityStatus>active</sit:validityStatus>
    <sit:situationRecordCreationTime>2026-07-27T09:55:00Z</sit:situationRecordCreationTime>
    <sit:situationRecordVersionTime>2026-07-27T10:02:00Z</sit:situationRecordVersionTime>
    <sit:overallStartTime>2026-07-27T09:50:00Z</sit:overallStartTime>
    <sit:roadOrCarriagewayOrLaneManagementType>roadClosed</sit:roadOrCarriagewayOrLaneManagementType>
    <sit:roadName>A-4</sit:roadName>
    <sit:municipality>Jerez de la Frontera</sit:municipality>
    <sit:province>Cádiz</sit:province>
    <sit:kilometerPoint>636</sit:kilometerPoint>
    <sit:pointCoordinates><sit:latitude>36.692</sit:latitude><sit:longitude>-6.126</sit:longitude></sit:pointCoordinates>
  </sit:situationRecord>
  <sit:situationRecord id="far-a2" xsi:type="sit:Accident" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <sit:validityStatus>active</sit:validityStatus>
    <sit:accidentType>accident</sit:accidentType>
    <sit:roadName>A-2</sit:roadName>
    <sit:pointCoordinates><sit:latitude>40.4167</sit:latitude><sit:longitude>-3.7033</sit:longitude></sit:pointCoordinates>
  </sit:situationRecord>
</d2Payload>`;

globalThis.fetch=async()=>new Response(xml,{status:200,headers:{'content-type':'application/xml'}});

try{
  const valid=await handler(new Request('https://fuegocerca.test/api/road-incidents?lat=36.6817&lon=-6.1372&radius=50'));
  assert.equal(valid.status,200);
  const data=await valid.json();
  assert.equal(data.version,'4.17.0');
  assert.equal(data.source,'DGT');
  assert.equal(data.format,'DATEX II 3.7');
  assert.equal(data.nearbyCount,1);
  assert.equal(data.closuresCount,1);
  assert.equal(data.incidents[0].road,'A-4');
  assert.equal(data.incidents[0].type,'roadClosed');
  assert.equal(data.incidents[0].typeLabel,'Carretera cortada');
  assert.ok(data.incidents[0].distanceKm<5);
  assert.match(data.coverageNote,/excepto Cataluña y País Vasco/);
  assert.match(data.relationshipNote,/no siempre indica/);

  const invalid=await handler(new Request('https://fuegocerca.test/api/road-incidents?lat=91&lon=0'));
  assert.equal(invalid.status,400);

  console.log('DGT road incidents endpoint contract checks passed.');
}finally{
  globalThis.fetch=originalFetch;
}
