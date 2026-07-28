export const config={runtime:'edge'};
const UPSTREAM='https://fuego-centro-panel.vercel.app';
export default async function handler(){
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'};
 try{
  const response=await fetch(`${UPSTREAM}/api/health`,{cache:'no-store'});
  if(!response.ok)throw Error(`Motor de datos HTTP ${response.status}`);
  const data=await response.json();
  return new Response(JSON.stringify({...data,status:data.status==='ok'?'ok':'degraded',version:'4.11.0',dataEngineVersion:data.dataEngineVersion||data.version||'4.3.1',brand:'FuegoCerca',mapCenter:[40.4167,-3.7033],mapZoom:6,staticLocalitySearch:true,initialAutoFit:false,nationalCoverageDirectory:19,integratedRegionalTerritories:3,infocaEndpoint:true,infocaOfficialSource:true,infocaGeoreferenced:true,infocaDirectIntegration:true,infocamProvisionalNotOfficial:true,infoexGeoreferencedFeed:false,failedSources:Array.isArray(data.failedSources)?data.failedSources:[],weatherEndpoint:true,airQualityEndpoint:true,airQualitySource:'MITECO · Índice Nacional de Calidad del Aire',airQualityOfficialDataset:true,airQualityProvisional:true,airQualityFireAttribution:false,airQualityFunctionRuntime:'nodejs',airQualityMaxDurationSeconds:20,fireDangerEndpoint:true,fireDangerOfficialRaster:true,fireDangerResolutionKm:1,roadIncidentsEndpoint:true,roadIncidentsFormat:'DATEX II 3.7',roadIncidentsCompact:true,firePerimetersEndpoint:true,firePerimetersSource:'EFFIS · Copernicus EMS',effisFunctionRuntime:'nodejs',effisMaxDurationSeconds:60,effisNodeRelativeUrlCompatible:true,effisPerimeterDistance:true,effisMapLayer:true,effisMapLayerToggle:true,effisAgeClassification:true,effisSharedDatasetCacheMinutes:60,effisRuntimeCache:true,effisRuntimeCacheTtlHours:24,effisBackgroundRefresh:true,effisAutomaticPrewarm:true,effisServerTiming:true,effisStaleFallbackHours:24,effisAutoAssociation:false,recentPlaceHistory:true,shareableLocalReport:true,offlineLocalSnapshot:true,smartLocalReport:true,localAttentionIsUnofficial:true,combinedIncidentTimeline:true}),{status:200,headers});
 }catch(error){
  return new Response(JSON.stringify({status:'down',version:'4.11.0',brand:'FuegoCerca',error:String(error.message||error)}),{status:503,headers});
 }
}
