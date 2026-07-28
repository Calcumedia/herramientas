export const config={runtime:'edge'};

import {fetchInfoca,INFOCA_SOURCE_URL} from './infoca-source.js';

const UPSTREAM='https://fuego-centro-panel.vercel.app';

const DIRECTORY=[
  ['Andalucía',['Andalucía','Andalucia'],'integrated','Agencia de Emergencias de Andalucía · INFOCA',INFOCA_SOURCE_URL,'Registros oficiales del visor INFOCA integrados directamente. El propio visor advierte de posibles retrasos respecto a sus canales de emergencia.'],
  ['Aragón',['Aragón','Aragon'],'reference','Gobierno de Aragón · INFOAR','https://www.aragon.es/temas/medio-ambiente/gestion-forestal/incendios-forestales','Portal oficial de prevención, operativo y publicaciones; sin feed operativo integrado.'],
  ['Principado de Asturias',['Asturias','Principado de Asturias'],'updates','112 Asturias · SEPA','https://www.112asturias.es/','Actualizaciones oficiales identificadas; todavía no se convierten automáticamente en incidentes georreferenciados.'],
  ['Illes Balears',['Illes Balears','Islas Baleares','Baleares'],'reference','112 Illes Balears · INFOBAL','https://www.caib.es/sites/112/es/portada-8673/','Portal oficial de emergencias y planificación; sin feed operativo integrado.'],
  ['Canarias',['Canarias','Islas Canarias'],'updates','112 Canarias · INFOCA','https://www.112canarias.com/112/','Alertas y actualizaciones oficiales identificadas; sin feed de incidentes integrado.'],
  ['Cantabria',['Cantabria'],'limited','Cobertura agregada',null,'Pendiente de incorporar una fuente oficial autonómica operativa verificable.'],
  ['Castilla-La Mancha',['Castilla-La Mancha','Castilla La Mancha'],'viewer','Portal INFOCAM','https://infocam.castillalamancha.es/mapa-de-incendios-forestales','El portal autonómico publica un avance provisional que califica expresamente como no oficial; no se utiliza para afirmar un incendio ni calcular afección local.'],
  ['Castilla y León',['Castilla y León','Castilla y Leon'],'integrated','Junta de Castilla y León','https://analisis.datosabiertos.jcyl.es/explore/dataset/incendios-forestales/','Datos oficiales directos integrados y evaluados automáticamente.'],
  ['Cataluña',['Cataluña','Catalunya'],'viewer','Bombers de la Generalitat · mapa de actuaciones','https://interior.gencat.cat/ca/incendis-forestals/inici/','Visor oficial en tiempo real identificado; sus actuaciones todavía no alimentan directamente el cálculo.'],
  ['Comunitat Valenciana',['Comunitat Valenciana','Comunidad Valenciana','Valenciana'],'viewer','112 Comunitat Valenciana','https://www.112cv.gva.es/WebPublica-MapasOnLineV2/','Visor oficial de incidentes y emergencias identificado; pendiente de integración directa.'],
  ['Extremadura',['Extremadura'],'updates','Junta de Extremadura · INFOCAEX/INFOEX','https://www.juntaex.es/w/infocaex','Comunicados oficiales identificados, pero sin un feed operativo georreferenciado que permita integrarlos con seguridad en el cálculo local.'],
  ['Galicia',['Galicia'],'updates','Xunta de Galicia · Medio Rural','https://mediorural.xunta.gal/es/recursos/noticias','Partes oficiales periódicos identificados; pendiente de extracción estructurada automática.'],
  ['Comunidad de Madrid',['Comunidad de Madrid','Madrid'],'integrated','ASEM 112 Madrid','https://www.comunidad.madrid/seguridad-emergencias-asem-112','Avisos oficiales directos integrados y aplicados a localidades expresamente afectadas.'],
  ['Región de Murcia',['Región de Murcia','Region de Murcia','Murcia'],'updates','112 Región de Murcia · INFOMUR','https://noticias.112rmurcia.es/','Actualizaciones oficiales identificadas; todavía no alimentan directamente el cálculo local.'],
  ['Comunidad Foral de Navarra',['Comunidad Foral de Navarra','Navarra'],'reference','SOS Navarra 112','https://www.navarra.es/es/seguridad-y-emergencias/emergencias-112','Portal oficial de emergencias y prevención; sin feed operativo integrado.'],
  ['País Vasco',['País Vasco','Pais Vasco','Euskadi'],'updates','112 SOS Deiak','https://www.euskadi.eus/gobierno-vasco/emergencias-112/','Actualizaciones oficiales identificadas; sin feed autonómico directo integrado.'],
  ['La Rioja',['La Rioja'],'updates','SOS Rioja 112','https://www.larioja.org/emergencias-112/es','Noticias oficiales de emergencias identificadas; sin feed operativo integrado.'],
  ['Ceuta',['Ceuta'],'reference','112 Ciudad Autónoma de Ceuta','https://www.ceuta.es/112/paginas/como.html','Servicio oficial de emergencias enlazado; sin feed de incendios integrado.'],
  ['Melilla',['Melilla'],'reference','112 Ciudad Autónoma de Melilla','https://www.melilla.es/','Servicio oficial de emergencias enlazado; sin feed de incendios integrado.']
].map(([region,aliases,mode,sourceLabel,sourceUrl,description])=>({region,aliases,mode,sourceLabel,sourceUrl,description}));

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
  const alreadyHasInfoca=(existing.evidence||[]).some(x=>x.source==='Agencia de Emergencias de Andalucía · INFOCA');
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
    directSources:Math.max(1,(existing.directSources||0)+(alreadyHasInfoca?0:1)),
    conflictingStatuses:existing.conflictingStatuses||[],
    risk:keepExistingRisk?existing.risk:official.risk,
    riskLabel:keepExistingRisk?existing.riskLabel:official.riskLabel,
    riskScore:Math.max(existing.riskScore||0,official.riskScore||0),
    summary:alerts.length?`${official.summary} Hay avisos relacionados que deben revisarse en sus fuentes.`:official.summary
  };
}

function mergeInfoca(data,infoca){
  const active=Array.isArray(data.incidents)?[...data.incidents]:[];
  const archive=Array.isArray(data.archive)?[...data.archive]:[];
  for(const official of [...infoca.incidents,...infoca.archive]){
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

export default async function handler(request){
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
    const url=new URL('/api/situation',UPSTREAM);
    url.search=new URL(request.url).search;
    const response=await fetch(url,{cache:'no-store',headers:{accept:'application/json'}});
    if(!response.ok)throw Error(`Upstream HTTP ${response.status}`);
    const data=await response.json();
    const infoca=await infocaPromise;
    if(infoca.ok)mergeInfoca(data,infoca);
    data.coverage=Array.isArray(data.coverage)?data.coverage:[];
    data.coverage=data.coverage.filter(item=>item.id!=='infoca');
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
    if(!infoca.ok)data.degraded=true;
    const upstreamCoverage=new Map((data.regionalCoverage||[]).map(x=>[x.region,x]));
    data.version='4.11.0';
    data.dataEngineVersion='4.3.1';
    data.regionalCoverage=DIRECTORY.map(item=>{
      if(item.region==='Andalucía')return {...item,ok:infoca.ok,publishedAt:infoca.publishedAt,lastSuccessAt:infoca.ok?infoca.receivedAt:null};
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
    return new Response(JSON.stringify({version:'4.11.0',dataEngineVersion:'4.3.1',degraded:true,error:String(error.message||error),regionalCoverage:DIRECTORY,incidents:[],archive:[],alerts:[],thermalSignals:[],news:[],coverage:[]}),{status:503,headers});
  }
}
