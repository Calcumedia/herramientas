export const config={runtime:'nodejs',maxDuration:45};

import {fetchInfoca,INFOCA_SOURCE_URL} from './infoca-source.js';
import {BOMBERS_SOURCE_URL,fetchBombers} from './bombers-source.js';
import {fetchInfoar,INFOAR_SOURCE_URL} from './infoar-source.js';
import {fetchGalicia,GALICIA_SOURCE_URL} from './galicia-source.js';
import {ASTURIAS_SOURCE_URL,fetchAsturias} from '../sources/asturias-source.js';

const UPSTREAM='https://fuego-centro-panel.vercel.app';

const DIRECTORY=[
  ['Andalucía',['Andalucía','Andalucia'],'integrated','Agencia de Emergencias de Andalucía · INFOCA',INFOCA_SOURCE_URL,'Registros oficiales del visor INFOCA integrados directamente. El propio visor advierte de posibles retrasos respecto a sus canales de emergencia.'],
  ['Aragón',['Aragón','Aragon'],'integrated','Gobierno de Aragón · INFOAR',INFOAR_SOURCE_URL,'Incendios del parte diario oficial INFOAR integrados directamente. El estado es oficial y la posición representa aproximadamente el centro del término municipal, no el origen exacto.'],
  ['Principado de Asturias',['Asturias','Principado de Asturias'],'integrated','112 Asturias · SEPA',ASTURIAS_SOURCE_URL,'Partes oficiales episódicos del SEPA integrados directamente. La posición representa aproximadamente el concejo y la ausencia de un parte vigente no confirma que no existan incendios.',false],
  ['Illes Balears',['Illes Balears','Islas Baleares','Baleares'],'reference','112 Illes Balears · INFOBAL','https://www.caib.es/sites/112/es/portada-8673/','Portal oficial de emergencias y planificación; sin feed operativo integrado.'],
  ['Canarias',['Canarias','Islas Canarias'],'updates','112 Canarias · INFOCA','https://www.112canarias.com/112/','Alertas y actualizaciones oficiales identificadas; sin feed de incidentes integrado.'],
  ['Cantabria',['Cantabria'],'limited','Cobertura agregada',null,'Pendiente de incorporar una fuente oficial autonómica operativa verificable.'],
  ['Castilla-La Mancha',['Castilla-La Mancha','Castilla La Mancha'],'viewer','Portal INFOCAM','https://infocam.castillalamancha.es/mapa-de-incendios-forestales','El portal autonómico publica un avance provisional que califica expresamente como no oficial; no se utiliza para afirmar un incendio ni calcular afección local.'],
  ['Castilla y León',['Castilla y León','Castilla y Leon'],'integrated','Junta de Castilla y León','https://analisis.datosabiertos.jcyl.es/explore/dataset/incendios-forestales/','Datos oficiales directos integrados y evaluados automáticamente.'],
  ['Cataluña',['Cataluña','Catalunya'],'integrated','Bombers de la Generalitat de Catalunya',BOMBERS_SOURCE_URL,'Actuaciones oficiales georreferenciadas de incendios de vegetación forestal integradas directamente. Las actuaciones agrícolas y urbanas se mantienen separadas y una fase no publicada no se interpreta como incendio activo.'],
  ['Comunitat Valenciana',['Comunitat Valenciana','Comunidad Valenciana','Valenciana'],'viewer','112 Comunitat Valenciana · PREVIFOC','https://www.112cv.gva.es/WebPublica-MapasOnLineV2/','Nivel preventivo diario PREVIFOC integrado por localidad. El visor oficial muestra un subconjunto de incidentes relevantes con localización aproximada y no ofrece un feed estructurado completo, por lo que no se usa para confirmar incendios activos.'],
  ['Extremadura',['Extremadura'],'updates','Junta de Extremadura · INFOCAEX/INFOEX','https://www.juntaex.es/w/infocaex','Comunicados oficiales identificados, pero sin un feed operativo georreferenciado que permita integrarlos con seguridad en el cálculo local.'],
  ['Galicia',['Galicia'],'integrated','Xunta de Galicia · Medio Rural',GALICIA_SOURCE_URL,'Partes oficiales selectivos integrados directamente, habitualmente para incendios que alcanzan 20 hectáreas. La posición es municipal y la ausencia de un parte vigente no confirma que no existan incendios.',false],
  ['Comunidad de Madrid',['Comunidad de Madrid','Madrid'],'integrated','ASEM 112 Madrid','https://www.comunidad.madrid/seguridad-emergencias-asem-112','Avisos oficiales directos integrados y aplicados a localidades expresamente afectadas.'],
  ['Región de Murcia',['Región de Murcia','Region de Murcia','Murcia'],'updates','112 Región de Murcia · INFOMUR','https://noticias.112rmurcia.es/','Actualizaciones oficiales identificadas; todavía no alimentan directamente el cálculo local.'],
  ['Comunidad Foral de Navarra',['Comunidad Foral de Navarra','Navarra'],'reference','SOS Navarra 112','https://www.navarra.es/es/seguridad-y-emergencias/emergencias-112','Portal oficial de emergencias y prevención; sin feed operativo integrado.'],
  ['País Vasco',['País Vasco','Pais Vasco','Euskadi'],'updates','112 SOS Deiak','https://www.euskadi.eus/gobierno-vasco/emergencias-112/','Actualizaciones oficiales identificadas; sin feed autonómico directo integrado.'],
  ['La Rioja',['La Rioja'],'updates','SOS Rioja 112','https://www.larioja.org/emergencias-112/es','Noticias oficiales de emergencias identificadas; sin feed operativo integrado.'],
  ['Ceuta',['Ceuta'],'reference','112 Ciudad Autónoma de Ceuta','https://www.ceuta.es/112/paginas/como.html','Servicio oficial de emergencias enlazado; sin feed de incendios integrado.'],
  ['Melilla',['Melilla'],'reference','112 Ciudad Autónoma de Melilla','https://www.melilla.es/','Servicio oficial de emergencias enlazado; sin feed de incendios integrado.']
].map(([region,aliases,mode,sourceLabel,sourceUrl,description,confidenceForAbsence=true])=>({region,aliases,mode,sourceLabel,sourceUrl,description,confidenceForAbsence}));

function norm(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function distanceKm(a,b){
  const toRad=value=>value*Math.PI/180;
  const dLat=toRad(b.lat-a.lat);
  const dLon=toRad(b.lon-a.lon);
  const lat1=toRad(a.lat);
  const lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

function sameIncident(a,b){
  if(!Number.isFinite(a?.lat)||!Number.isFinite(a?.lon)||!Number.isFinite(b?.lat)||!Number.isFinite(b?.lon))return false;
  const distance=distanceKm(a,b);
  const namesMatch=norm(a.name)===norm(b.name)||norm(a.name).includes(norm(b.name))||norm(b.name).includes(norm(a.name));
  return distance<=5||(namesMatch&&distance<=20);
}

function uniqueBy(items,key){
  const seen=new Set();
  return items.filter(item=>{
    const value=key(item);
    if(seen.has(value))return false;
    seen.add(value);
    return true;
  });
}

function mergeIncident(existing,official){
  if(!existing)return official;
  const officialSources=new Set((official.evidence||[]).map(item=>item.source).filter(Boolean));
  const alreadyHasOfficialSource=(existing.evidence||[]).some(item=>officialSources.has(item.source));
  const evidence=uniqueBy([...(official.evidence||[]),...(existing.evidence||[])],item=>`${item.source}|${item.status}|${item.publishedAt}`);
  const timeline=uniqueBy([...(official.timeline||[]),...(existing.timeline||[])],item=>`${item.source}|${item.status}|${item.at}`)
    .sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
  const alerts=uniqueBy([...(existing.alerts||[]),...(official.alerts||[])],item=>`${item.type}|${item.text}|${item.publishedAt}`);
  const riskOrder={critical:5,high:4,medium:3,watch:2,clear:1};
  const keepExistingRisk=(riskOrder[existing.risk]||0)>(riskOrder[official.risk]||0);
  return {
    ...existing,
    ...official,
    id:existing.id||official.id,
    evidence,
    timeline,
    alerts,
    thermalCount:existing.thermalCount||0,
    thermalClusterCount:existing.thermalClusterCount||0,
    directSources:Math.max(1,(existing.directSources||0)+(alreadyHasOfficialSource?0:1)),
    conflictingStatuses:existing.conflictingStatuses||[],
    risk:keepExistingRisk?existing.risk:official.risk,
    riskLabel:keepExistingRisk?existing.riskLabel:official.riskLabel,
    riskScore:Math.max(existing.riskScore||0,official.riskScore||0),
    summary:alerts.length?`${official.summary} Hay avisos relacionados que deben revisarse en sus fuentes.`:official.summary
  };
}

function mergeRegionalIncidents(data,regional){
  const active=Array.isArray(data.incidents)?[...data.incidents]:[];
  const archive=Array.isArray(data.archive)?[...data.archive]:[];
  for(const official of [...regional.incidents,...regional.archive]){
    const activeIndex=active.findIndex(item=>sameIncident(item,official));
    const archiveIndex=archive.findIndex(item=>sameIncident(item,official));
    const existing=activeIndex>=0?active[activeIndex]:archiveIndex>=0?archive[archiveIndex]:null;
    if(activeIndex>=0)active.splice(activeIndex,1);
    if(archiveIndex>=0)archive.splice(archiveIndex,1);
    const merged=mergeIncident(existing,official);
    if(official.statusClass==='controlled')archive.push(merged);
    else active.push(merged);
  }
  data.incidents=active.sort((a,b)=>(b.riskScore||0)-(a.riskScore||0));
  data.archive=archive.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
}

function mergeInfoca(data,infoca){
  mergeRegionalIncidents(data,infoca);
}

function mergeBombers(data,bombers){
  mergeRegionalIncidents(data,bombers);
}

function mergeInfoar(data,infoar){
  mergeRegionalIncidents(data,infoar);
}

function mergeGalicia(data,galicia){
  mergeRegionalIncidents(data,galicia);
}

function mergeAsturias(data,asturias){
  mergeRegionalIncidents(data,asturias);
}

async function createResponse(request){
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'public, s-maxage=60, stale-while-revalidate=180',
    'access-control-allow-origin':'*'
  };
  try{
    const infocaPromise=fetchInfoca().catch(error=>({
      ok:false,
      source:'Agencia de Emergencias de Andalucía · INFOCA',
      sourceUrl:INFOCA_SOURCE_URL,
      receivedAt:new Date().toISOString(),
      publishedAt:null,
      incidents:[],
      archive:[],
      summary:'Fuente oficial temporalmente no disponible',
      error:String(error?.message||error)
    }));
    const bombersPromise=fetchBombers().catch(error=>({
      ok:false,
      source:'Bombers de la Generalitat de Catalunya',
      sourceUrl:BOMBERS_SOURCE_URL,
      receivedAt:new Date().toISOString(),
      publishedAt:null,
      incidents:[],
      archive:[],
      otherVegetation:[],
      summary:'Fuente oficial temporalmente no disponible',
      error:String(error?.message||error)
    }));
    const infoarPromise=fetchInfoar().catch(error=>({
      ok:false,
      source:'Gobierno de Aragón · INFOAR',
      sourceUrl:INFOAR_SOURCE_URL,
      receivedAt:new Date().toISOString(),
      publishedAt:null,
      incidents:[],
      archive:[],
      unlocated:[],
      summary:'Fuente oficial temporalmente no disponible',
      error:String(error?.message||error)
    }));
    const galiciaPromise=fetchGalicia().catch(error=>({
      ok:false,
      source:'Xunta de Galicia · Medio Rural',
      sourceUrl:GALICIA_SOURCE_URL,
      receivedAt:new Date().toISOString(),
      publishedAt:null,
      currentBulletin:false,
      incidents:[],
      archive:[],
      unlocated:[],
      confidenceForAbsence:false,
      summary:'Fuente oficial temporalmente no disponible',
      error:String(error?.message||error)
    }));
    const asturiasPromise=fetchAsturias().catch(error=>({
      ok:false,
      source:'112 Asturias · SEPA',
      sourceUrl:ASTURIAS_SOURCE_URL,
      receivedAt:new Date().toISOString(),
      publishedAt:null,
      currentBulletin:false,
      incidents:[],
      archive:[],
      unlocated:[],
      confidenceForAbsence:false,
      summary:'Fuente oficial temporalmente no disponible',
      error:String(error?.message||error)
    }));
    const url=new URL('/api/situation',UPSTREAM);
    url.search=new URL(request.url,'https://fuegocerca.local').search;
    const response=await fetch(url,{cache:'no-store',headers:{accept:'application/json'}});
    if(!response.ok)throw Error(`Upstream HTTP ${response.status}`);
    const data=await response.json();
    const infoca=await infocaPromise;
    const bombers=await bombersPromise;
    const infoar=await infoarPromise;
    const galicia=await galiciaPromise;
    const asturias=await asturiasPromise;
    if(infoca.ok)mergeInfoca(data,infoca);
    if(bombers.ok)mergeBombers(data,bombers);
    if(infoar.ok)mergeInfoar(data,infoar);
    if(galicia.ok)mergeGalicia(data,galicia);
    if(asturias.ok)mergeAsturias(data,asturias);
    data.coverage=Array.isArray(data.coverage)?data.coverage:[];
    data.coverage=data.coverage.filter(item=>!['infoca','bombers-catalunya','infoar-aragon','xunta-galicia','sepa-asturias'].includes(item.id));
    data.coverage.push({
      id:'infoca',
      label:'INFOCA Andalucía',
      scope:'Andalucía',
      ok:infoca.ok,
      fallback:false,
      summary:infoca.summary,
      error:infoca.error||null,
      publishedAt:infoca.publishedAt,
      receivedAt:infoca.receivedAt,
      lastSuccessAt:infoca.ok?infoca.receivedAt:null,
      url:INFOCA_SOURCE_URL
    });
    data.coverage.push({
      id:'bombers-catalunya',
      label:'Bombers Catalunya',
      scope:'Cataluña',
      ok:bombers.ok,
      fallback:Boolean(bombers.fallback),
      summary:bombers.summary,
      error:bombers.error||null,
      publishedAt:bombers.publishedAt,
      receivedAt:bombers.receivedAt,
      lastSuccessAt:bombers.ok?(bombers.lastSuccessAt||bombers.receivedAt):null,
      url:BOMBERS_SOURCE_URL
    });
    data.coverage.push({
      id:'infoar-aragon',
      label:'INFOAR Aragón',
      scope:'Aragón',
      ok:infoar.ok,
      fallback:Boolean(infoar.fallback),
      summary:infoar.summary,
      error:infoar.error||null,
      publishedAt:infoar.publishedAt,
      receivedAt:infoar.receivedAt,
      lastSuccessAt:infoar.ok?(infoar.lastSuccessAt||infoar.receivedAt):null,
      url:INFOAR_SOURCE_URL
    });
    data.coverage.push({
      id:'xunta-galicia',
      label:'Medio Rural Galicia',
      scope:'Galicia',
      ok:galicia.ok,
      fallback:Boolean(galicia.fallback),
      summary:galicia.summary,
      error:galicia.error||null,
      publishedAt:galicia.publishedAt,
      receivedAt:galicia.receivedAt,
      lastSuccessAt:galicia.ok?(galicia.lastSuccessAt||galicia.receivedAt):null,
      url:GALICIA_SOURCE_URL,
      coverageComplete:false,
      confidenceForAbsence:false
    });
    data.coverage.push({
      id:'sepa-asturias',
      label:'SEPA Asturias',
      scope:'Principado de Asturias',
      ok:asturias.ok,
      fallback:Boolean(asturias.fallback),
      summary:asturias.summary,
      error:asturias.error||null,
      publishedAt:asturias.publishedAt,
      receivedAt:asturias.receivedAt,
      lastSuccessAt:asturias.ok?(asturias.lastSuccessAt||asturias.receivedAt):null,
      url:ASTURIAS_SOURCE_URL,
      coverageComplete:false,
      confidenceForAbsence:false
    });
    if(!infoca.ok||!bombers.ok||bombers.fallback||!infoar.ok||infoar.fallback||infoar.degraded||!galicia.ok||galicia.fallback||galicia.degraded||!asturias.ok||asturias.fallback||asturias.degraded)data.degraded=true;
    const upstreamCoverage=new Map((data.regionalCoverage||[]).map(x=>[x.region,x]));
    data.version='4.16.0';
    data.dataEngineVersion='4.3.1';
    data.regionalCoverage=DIRECTORY.map(item=>{
      if(item.region==='Andalucía')return {...item,ok:infoca.ok,publishedAt:infoca.publishedAt,lastSuccessAt:infoca.ok?infoca.receivedAt:null};
      if(item.region==='Cataluña')return {...item,ok:bombers.ok,publishedAt:bombers.publishedAt,lastSuccessAt:bombers.ok?(bombers.lastSuccessAt||bombers.receivedAt):null};
      if(item.region==='Aragón')return {...item,ok:infoar.ok,publishedAt:infoar.publishedAt,lastSuccessAt:infoar.ok?(infoar.lastSuccessAt||infoar.receivedAt):null};
      if(item.region==='Galicia')return {...item,ok:galicia.ok,publishedAt:galicia.publishedAt,lastSuccessAt:galicia.ok?(galicia.lastSuccessAt||galicia.receivedAt):null};
      if(item.region==='Principado de Asturias')return {...item,ok:asturias.ok,publishedAt:asturias.publishedAt,lastSuccessAt:asturias.ok?(asturias.lastSuccessAt||asturias.receivedAt):null};
      const old=upstreamCoverage.get(item.region);
      return {...item,ok:item.mode==='integrated'&&Boolean(old?.ok),publishedAt:old?.publishedAt||null,lastSuccessAt:old?.lastSuccessAt||null};
    });
    data.coverageSummary={
      integrated:data.regionalCoverage.filter(x=>x.mode==='integrated').length,
      officialViewer:data.regionalCoverage.filter(x=>x.mode==='viewer').length,
      officialUpdates:data.regionalCoverage.filter(x=>x.mode==='updates').length,
      officialReference:data.regionalCoverage.filter(x=>x.mode==='reference').length,
      limited:data.regionalCoverage.filter(x=>x.mode==='limited').length
    };
    return new Response(JSON.stringify(data),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({version:'4.16.0',dataEngineVersion:'4.3.1',degraded:true,error:String(error.message||error),regionalCoverage:DIRECTORY,incidents:[],archive:[],alerts:[],thermalSignals:[],news:[],coverage:[]}),{status:503,headers});
  }
}

export default async function handler(request,response){
  const webResponse=await createResponse(request);
  if(!response)return webResponse;
  response.statusCode=webResponse.status;
  webResponse.headers.forEach((value,key)=>response.setHeader(key,value));
  response.end(await webResponse.text());
}
