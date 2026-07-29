import {strict as assert} from 'node:assert';
import {applySourceAdmission,buildSourceMonitor} from '../api/source-monitor.js';

const now=new Date('2026-07-29T12:00:00.000Z');
const regions=[
  {region:'Andalucía',aliases:['Andalucia'],mode:'integrated',sourceLabel:'INFOCA',ok:true,lastSuccessAt:'2026-07-29T11:55:00.000Z',confidenceForAbsence:true},
  {region:'Galicia',aliases:['Galicia'],mode:'integrated',sourceLabel:'Medio Rural',ok:true,lastSuccessAt:'2026-07-29T11:50:00.000Z',confidenceForAbsence:false},
  {region:'Comunidad de Madrid',aliases:['Madrid'],mode:'integrated',sourceLabel:'ASEM 112',ok:false,lastSuccessAt:'2026-07-29T11:40:00.000Z',confidenceForAbsence:true},
  {region:'Región de Murcia',aliases:['Murcia'],mode:'updates',sourceLabel:'INFOMUR',ok:false,confidenceForAbsence:false}
];
const coverage=[
  {id:'infoca',label:'INFOCA',scope:'Andalucía',ok:true,fallback:false,receivedAt:'2026-07-29T11:55:00.000Z',lastSuccessAt:'2026-07-29T11:55:00.000Z'},
  {id:'xunta-galicia',label:'Medio Rural',scope:'Galicia',ok:true,fallback:false,receivedAt:'2026-07-29T11:50:00.000Z',lastSuccessAt:'2026-07-29T11:50:00.000Z'},
  {id:'madrid',label:'ASEM 112',scope:'Madrid',ok:true,fallback:false,receivedAt:'2026-07-29T11:40:00.000Z',lastSuccessAt:'2026-07-29T11:40:00.000Z'}
];

const monitor=buildSourceMonitor(regions,coverage,now);
assert.equal(monitor.version,'4.18.0');
assert.equal(monitor.configuredDirectSources,3);
assert.equal(monitor.admittedDirectSources,2);
assert.equal(monitor.limitedDirectSources,1);
assert.equal(monitor.entries.find(item=>item.region==='Andalucía')?.status,'operational');
assert.equal(monitor.entries.find(item=>item.region==='Galicia')?.productionAdmitted,true);
assert.equal(monitor.entries.find(item=>item.region==='Galicia')?.confidenceForAbsence,false);
assert.equal(monitor.entries.find(item=>item.region==='Comunidad de Madrid')?.status,'unavailable');
assert.equal(monitor.entries.find(item=>item.region==='Región de Murcia')?.status,'not-integrated');
assert.equal(monitor.alerting.externalNotifications,false);
assert.equal(monitor.persistence.durableDatabase,false);

const applied=applySourceAdmission(regions,coverage,now);
assert.equal(applied.regions.find(item=>item.region==='Andalucía')?.mode,'integrated');
assert.equal(applied.regions.find(item=>item.region==='Comunidad de Madrid')?.mode,'limited');
assert.equal(applied.regions.find(item=>item.region==='Comunidad de Madrid')?.confidenceForAbsence,false);
assert.equal(applied.regions.find(item=>item.region==='Región de Murcia')?.mode,'updates');

const fallbackCoverage=coverage.map(item=>item.id==='infoca'?{...item,fallback:true}:item);
const fallback=applySourceAdmission(regions,fallbackCoverage,now);
assert.equal(fallback.regions.find(item=>item.region==='Andalucía')?.mode,'limited');
assert.equal(fallback.regions.find(item=>item.region==='Andalucía')?.sourceStatus,'fallback');
assert.equal(fallback.regions.find(item=>item.region==='Andalucía')?.confidenceForAbsence,false);

const staleCoverage=coverage.map(item=>item.id==='infoca'?{...item,lastSuccessAt:'2026-07-27T00:00:00.000Z'}:item);
const staleRegions=regions.map(item=>item.region==='Andalucía'?{...item,lastSuccessAt:'2026-07-27T00:00:00.000Z'}:item);
const stale=applySourceAdmission(staleRegions,staleCoverage,now);
assert.equal(stale.regions.find(item=>item.region==='Andalucía')?.sourceStatus,'stale');
assert.equal(stale.regions.find(item=>item.region==='Andalucía')?.mode,'limited');

console.log('Source admission, freshness and false-green contract checks passed.');
