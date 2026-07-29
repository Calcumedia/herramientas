const DEFAULT_MAX_AGE_HOURS=36;

const MAX_AGE_BY_REGION=new Map([
  ['Cataluña',6],
  ['Andalucía',12],
  ['Comunidad de Madrid',24],
  ['Castilla y León',36],
  ['Aragón',36],
  ['Galicia',36],
  ['Principado de Asturias',36]
]);

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function validDate(value){
  const timestamp=Date.parse(value||'');
  return Number.isFinite(timestamp)?timestamp:null;
}

function matchesRegion(source,region){
  const scope=normalize(source?.scope);
  if(!scope)return false;
  return [region.region,...(region.aliases||[])].some(alias=>{
    const candidate=normalize(alias);
    return candidate&&(scope===candidate||scope.includes(candidate)||candidate.includes(scope));
  });
}

function schemaIsValid(source){
  return Boolean(
    source&&
    typeof source.id==='string'&&source.id&&
    typeof source.label==='string'&&source.label&&
    typeof source.ok==='boolean'
  );
}

function sourceIssue(entry){
  if(entry.status==='schema-error')return {severity:'critical',category:'schema',region:entry.region,source:entry.sourceLabel,message:'La respuesta no cumple el contrato mínimo esperado.'};
  if(entry.status==='stale')return {severity:'warning',category:'freshness',region:entry.region,source:entry.sourceLabel,message:`La última verificación válida supera ${entry.maxAgeHours} horas.`};
  if(entry.status==='fallback')return {severity:'warning',category:'fallback',region:entry.region,source:entry.sourceLabel,message:'Se está usando la última copia válida; la fuente en vivo no ha respondido.'};
  return {severity:'critical',category:'availability',region:entry.region,source:entry.sourceLabel,message:'La fuente directa no está verificada en esta ejecución de producción.'};
}

export function buildSourceMonitor(regionalCoverage=[],coverage=[],now=new Date()){
  const checkedAt=new Date(now).toISOString();
  const nowMs=Date.parse(checkedAt);
  const entries=regionalCoverage.map(region=>{
    const declaredMode=region.declaredMode||region.mode||'limited';
    const source=coverage.find(item=>matchesRegion(item,region));
    const maxAgeHours=MAX_AGE_BY_REGION.get(region.region)||DEFAULT_MAX_AGE_HOURS;
    const lastSuccessAt=region.lastSuccessAt||source?.lastSuccessAt||source?.receivedAt||null;
    const lastSuccessMs=validDate(lastSuccessAt);
    const ageHours=lastSuccessMs===null?null:Math.max(0,(nowMs-lastSuccessMs)/36e5);
    const schemaValid=source?schemaIsValid(source):false;
    const fallback=Boolean(source?.fallback);
    const fresh=ageHours!==null&&ageHours<=maxAgeHours;
    const directCandidate=declaredMode==='integrated';
    const liveVerified=directCandidate&&schemaValid&&region.ok===true&&source?.ok===true&&fresh&&!fallback;
    let status='not-integrated';
    if(directCandidate){
      if(source&&!schemaValid)status='schema-error';
      else if(fallback&&fresh)status='fallback';
      else if(lastSuccessMs!==null&&!fresh)status='stale';
      else if(liveVerified)status='operational';
      else status='unavailable';
    }
    return {
      region:region.region,
      sourceId:source?.id||null,
      sourceLabel:region.sourceLabel||source?.label||'Fuente no identificada',
      declaredMode,
      effectiveMode:liveVerified?'integrated':declaredMode==='integrated'?'limited':declaredMode,
      status,
      productionAdmitted:liveVerified,
      schemaValid,
      fallback,
      confidenceForAbsence:liveVerified&&region.confidenceForAbsence!==false,
      checkedAt,
      lastSuccessAt,
      ageHours:ageHours===null?null:Number(ageHours.toFixed(2)),
      maxAgeHours
    };
  });
  const direct=entries.filter(entry=>entry.declaredMode==='integrated');
  const issues=direct.filter(entry=>!entry.productionAdmitted).map(sourceIssue);
  return {
    version:'4.18.0',
    checkedAt,
    status:issues.some(issue=>issue.severity==='critical')?'degraded':issues.length?'warning':'ok',
    configuredDirectSources:direct.length,
    admittedDirectSources:direct.filter(entry=>entry.productionAdmitted).length,
    limitedDirectSources:direct.filter(entry=>!entry.productionAdmitted).length,
    entries,
    issues,
    alerting:{
      runtimeLogs:true,
      externalNotifications:false,
      note:'Las incidencias se registran en los logs de Vercel. No hay correo, SMS ni mensajería externa configurados.'
    },
    persistence:{
      lastValidSituation:true,
      storage:'Vercel Runtime Cache',
      regional:true,
      durableDatabase:false,
      note:'La copia sobrevive a despliegues, pero puede ser expulsada y no sustituye una base de datos permanente.'
    }
  };
}

export function applySourceAdmission(regionalCoverage=[],coverage=[],now=new Date()){
  const monitor=buildSourceMonitor(regionalCoverage,coverage,now);
  const byRegion=new Map(monitor.entries.map(entry=>[entry.region,entry]));
  const regions=regionalCoverage.map(region=>{
    const entry=byRegion.get(region.region);
    if(!entry)return region;
    return {
      ...region,
      declaredMode:entry.declaredMode,
      mode:entry.effectiveMode,
      ok:entry.productionAdmitted,
      productionAdmitted:entry.productionAdmitted,
      sourceStatus:entry.status,
      sourceCheckedAt:entry.checkedAt,
      sourceAgeHours:entry.ageHours,
      confidenceForAbsence:entry.confidenceForAbsence
    };
  });
  return {regions,monitor};
}
