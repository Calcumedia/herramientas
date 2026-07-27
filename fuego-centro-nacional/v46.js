(()=>{
  const BRAND='FuegoCerca';
  const HISTORY_KEY='fc_recent_places_v47';
  const SNAPSHOT_KEY='fc_last_snapshot_v47';
  const MAX_HISTORY=8;
  const DGT_URL='https://www.dgt.es/conoce-el-estado-del-trafico/informacion-e-incidencias-de-trafico/index.html';
  const EFFIS_URL='https://forest-fire.emergency.copernicus.eu/apps/effis.csv/';
  const $=selector=>document.querySelector(selector);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const finite=value=>Number.isFinite(value);
  const metric=(value,suffix='')=>finite(value)?`${Math.round(value)}${suffix}`:'No disponible';
  const DANGER_TONES={0:'none',1:'very-low',2:'low',3:'moderate',4:'high',5:'very-high',6:'extreme',255:'unavailable'};

  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
  function getHistory(){const value=readJson(HISTORY_KEY,[]);return Array.isArray(value)?value:[]}
  function writeHistory(items){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(items))}catch{}}

  function renderHistory(){
    const host=$('#recentPlaces');
    if(!host)return;
    const items=getHistory();
    host.innerHTML=`<div class="sectionTitle"><h2>Consultas recientes</h2><small>${items.length}</small></div>${items.length?`<div class="historyList">${items.map((item,index)=>`<div class="historyItem"><div><b>${escapeHtml(item.name)}</b><small>${new Date(item.time).toLocaleString('es-ES')}</small></div><button type="button" class="secondary" data-history="${index}">Abrir</button></div>`).join('')}</div><div class="actions"><button id="clearHistoryBtn" type="button" class="secondary">Borrar historial</button></div>`:'<div class="historyEmpty">Aún no has consultado ninguna localidad.</div>'}`;
    $('#clearHistoryBtn')?.addEventListener('click',()=>{writeHistory([]);renderHistory()});
  }

  function saveHistory(item){
    if(!item?.name)return;
    const normalized=item.name.trim().toLocaleLowerCase('es');
    writeHistory([item,...getHistory().filter(existing=>existing.name.trim().toLocaleLowerCase('es')!==normalized)].slice(0,MAX_HISTORY));
    renderHistory();
  }

  function currentReport(){
    const report=$('#localReport .report');
    if(!report)return null;
    const name=report.querySelector('h3')?.textContent?.trim();
    if(!name)return null;
    const place=window.FC_APP?.getSelectedPlace?.();
    const assessment=window.FC_APP?.getLocalAssessment?.(place,50)||null;
    const attention=attentionInfo(assessment);
    const center=window.__FC_MAP__?.getCenter?.();
    return {
      name,
      badge:`Atención del panel: ${attention.label}`,
      lead:assessment?.lead||'Consulta informativa de FuegoCerca.',
      lat:finite(place?.lat)?place.lat:finite(center?.lat)?center.lat:null,
      lon:finite(place?.lon)?place.lon:finite(center?.lng)?center.lng:null,
      time:new Date().toISOString(),
      assessment,
      html:report.outerHTML
    };
  }

  function saveSnapshot(report){if(report)try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(report))}catch{}}

  function setOfflineState(){
    const notice=$('#offlineSnapshotNotice');
    if(!notice)return;
    if(navigator.onLine){notice.classList.remove('on');notice.textContent='';return}
    const snapshot=readJson(SNAPSHOT_KEY,null);
    notice.classList.add('on');
    notice.textContent=snapshot?`Sin conexión. La última copia local corresponde a ${snapshot.name}, guardada el ${new Date(snapshot.time).toLocaleString('es-ES')}. Puede estar desactualizada.`:'Sin conexión. No hay todavía un informe local guardado en este navegador.';
    const reportHost=$('#localReport');
    if(snapshot?.html&&reportHost&&!reportHost.querySelector('.report'))reportHost.innerHTML=snapshot.html;
  }

  function cardinal(degrees){
    if(!finite(degrees))return 'Dirección no disponible';
    const points=['N','NE','E','SE','S','SO','O','NO'];
    return `${points[Math.round(((degrees%360)+360)%360/45)%8]} · ${Math.round(degrees)}°`;
  }

  function attentionInfo(assessment){
    const options={
      critical:{label:'inmediata',title:'Atención inmediata',summary:'Existe una alerta oficial aplicable a la localidad en los datos recuperados.'},
      high:{label:'alta',title:'Atención alta',summary:'Hay una alerta o un incidente oficial prioritario en el entorno.'},
      medium:{label:'elevada',title:'Atención elevada',summary:'Hay información oficial relevante o una señal cercana que conviene comprobar.'},
      watch:{label:'de seguimiento',title:'Seguimiento',summary:'Hay actividad en el entorno ampliado que conviene vigilar.'},
      clear:{label:'normal',title:'Sin señales prioritarias',summary:'Las fuentes integradas no muestran una señal prioritaria cercana.'},
      limited:{label:'limitada por cobertura',title:'Cobertura limitada',summary:'No hay suficiente cobertura oficial directa para una conclusión firme.'}
    };
    return {...(options[assessment?.level]||options.limited),tone:assessment?.level||'limited'};
  }

  function localTime(value){
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'Hora no disponible':date.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});
  }

  function distanceCard(item,{kind,label,empty}){
    if(!item)return`<article class="smartDistance ${kind}"><div class="smartDistanceHead"><span>${escapeHtml(label)}</span><b>Sin registro</b></div><p>${escapeHtml(empty)}</p></article>`;
    const distance=finite(item._km)?`${item._km.toFixed(1)} km`:'Distancia no disponible';
    const status=item.status?` · ${escapeHtml(item.status)}`:'';
    const count=kind==='thermal'&&item.count?` · ${escapeHtml(item.count)} puntos agregados`:'';
    const url=item.primaryUrl||item.url;
    return`<article class="smartDistance ${kind}"><div class="smartDistanceHead"><span>${escapeHtml(label)}</span><b>${distance}</b></div><h5>${escapeHtml(item.name||'Registro sin nombre')}</h5><p>${escapeHtml(item.area||'')}${status}${count}</p><small>Publicado: ${escapeHtml(localTime(item.publishedAt))}</small>${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Comprobar fuente ↗</a>`:''}</article>`;
  }

  function combinedTimeline(incident){
    if(!incident)return[];
    const events=[];
    const add=(at,label,source,kind)=>{
      const timestamp=Date.parse(at);
      if(!Number.isFinite(timestamp)||!label)return;
      events.push({at:new Date(timestamp).toISOString(),timestamp,label:String(label),source:String(source||'Fuente oficial'),kind});
    };
    for(const event of incident.timeline||[])add(event.at,event.status||event.label,event.source,'state');
    for(const evidence of incident.evidence||[])add(evidence.publishedAt||evidence.observedAt,evidence.status||evidence.summary||'Evidencia publicada',evidence.source,'evidence');
    for(const alert of incident.alerts||[])add(alert.publishedAt,alert.type||alert.text||'Aviso operativo',alert.source||'Aviso oficial asociado','alert');
    add(incident.publishedAt,incident.status?`Estado publicado: ${incident.status}`:'Última publicación del incidente',incident.primarySource||incident.source||'Fuente oficial','publication');
    const unique=new Map();
    for(const event of events){
      const key=`${event.at}|${event.label.toLocaleLowerCase('es')}|${event.source.toLocaleLowerCase('es')}`;
      if(!unique.has(key))unique.set(key,event);
    }
    return [...unique.values()].sort((a,b)=>b.timestamp-a.timestamp).slice(0,8);
  }

  function timelineHtml(incident){
    if(!incident)return'<div class="smartTimelineEmpty">No hay un incidente oficial georreferenciado para construir una cronología local.</div>';
    const events=combinedTimeline(incident);
    const rows=events.map(event=>`<li data-timeline-at="${escapeHtml(event.at)}"><span class="timelineDot ${escapeHtml(event.kind)}" aria-hidden="true"></span><div><time datetime="${escapeHtml(event.at)}">${escapeHtml(localTime(event.at))}</time><b>${escapeHtml(event.label)}</b><small>${escapeHtml(event.source)}</small></div></li>`).join('');
    return`<div class="smartTimelineHead"><div><small>CRONOLOGÍA DEL INCIDENTE OFICIAL</small><h4>${escapeHtml(incident.name)}</h4></div>${incident.id?`<button type="button" class="secondary" data-smart-incident="${escapeHtml(incident.id)}">Ver ficha completa</button>`:''}</div><p class="smartTimelineIntro">Cronología combinada de estados, evidencias y avisos disponibles. Más reciente primero.</p>${rows?`<ol class="smartTimeline">${rows}</ol>`:'<div class="smartTimelineEmpty">La fuente no aporta todavía cambios fechados para este incidente.</div>'}`;
  }

  function ensureSmartLocalInsights(report){
    const host=$('#smartLocalInsights');
    const assessment=report?.assessment;
    if(!host||!assessment)return;
    const attention=attentionInfo(assessment);
    const key=[report.name,assessment.level,assessment.official?.id,assessment.official?.publishedAt,assessment.prelim?.id,assessment.th?.id].join('|');
    if(host.dataset.renderedFor===key)return;
    host.dataset.renderedFor=key;
    host.innerHTML=`<section id="smartLocalPanel" class="smartLocalPanel" aria-labelledby="smartLocalTitle"><div class="attentionPanel ${escapeHtml(attention.tone)}"><div><small>ORIENTACIÓN CALCULADA POR FUEGOCERCA</small><h4 id="smartLocalTitle">${escapeHtml(attention.title)}</h4><p>${escapeHtml(assessment.lead||attention.summary)}</p></div><span>NO OFICIAL</span></div><p class="attentionDisclaimer"><b>Nivel de atención local:</b> ayuda a ordenar la información disponible. No es un nivel oficial, no equivale al riesgo de incendio y no sustituye instrucciones de emergencia.</p><div class="smartDistances">${distanceCard(assessment.official,{kind:'official',label:'Incidente oficial más próximo',empty:'Sin incidente oficial georreferenciado en las fuentes integradas.'})}${distanceCard(assessment.prelim,{kind:'preliminary',label:'Señal preliminar más próxima',empty:'Sin señal preliminar georreferenciada.'})}${distanceCard(assessment.th,{kind:'thermal',label:'Señal térmica más próxima',empty:'Sin señal térmica georreferenciada.'})}</div><div class="distanceDisclaimer">Distancias en línea recta desde la localidad hasta el punto de referencia publicado; no son distancias al perímetro del incendio.</div><section class="smartTimelineSection" aria-label="Línea temporal del incidente oficial más próximo">${timelineHtml(assessment.official)}</section></section>`;
  }

  function coordsForContext(){
    const report=currentReport();
    if(finite(report?.lat)&&finite(report?.lon))return {lat:report.lat,lon:report.lon,name:report.name};
    const center=window.__FC_MAP__?.getCenter?.();
    return {lat:finite(center?.lat)?center.lat:40.4167,lon:finite(center?.lng)?center.lng:-3.7033,name:'España'};
  }

  function dateLabel(value){
    if(!value)return'Fecha no disponible';
    const date=new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
  }

  function dangerLevelHtml(level){
    if(!level)return'<strong class="dangerLevel unavailable">No disponible</strong>';
    const tone=DANGER_TONES[level.value]||'unavailable';
    return`<strong class="dangerLevel ${tone}">${escapeHtml(level.label||'Sin datos')}</strong>`;
  }

  function presetDangerLevel(product){
    const level=product?.localLevel;
    return level&&Number.isFinite(Number(level.value))?{...level,value:Number(level.value)}:null;
  }

  function loadDangerImage(url){
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(Error('No se ha podido leer el mapa oficial'));
      image.src=url;
    });
  }

  function productExtent(bounds){
    const points=(Array.isArray(bounds)?bounds:[]).filter(point=>Array.isArray(point)&&point.length>=2).map(([lon,lat])=>({lon:Number(lon),lat:Number(lat)})).filter(point=>finite(point.lat)&&finite(point.lon));
    if(!points.length)return null;
    return {
      minLon:Math.min(...points.map(point=>point.lon)),
      maxLon:Math.max(...points.map(point=>point.lon)),
      minLat:Math.min(...points.map(point=>point.lat)),
      maxLat:Math.max(...points.map(point=>point.lat))
    };
  }

  function closestDangerLevel(rgba,palette){
    if(rgba[3]===0)return null;
    let best=null;
    for(const entry of palette||[]){
      if(!Array.isArray(entry.rgba))continue;
      const distance=Math.sqrt((rgba[0]-entry.rgba[0])**2+(rgba[1]-entry.rgba[1])**2+(rgba[2]-entry.rgba[2])**2+(rgba[3]-entry.rgba[3])**2);
      if(!best||distance<best.distance)best={...entry,distance};
    }
    return best&&best.distance<=70?best:null;
  }

  async function sampleDangerProduct(product,place,palette){
    const preset=presetDangerLevel(product);
    if(preset)return preset;
    const extent=productExtent(product?.bounds);
    if(!extent||!product?.imageUrl||!finite(place?.lat)||!finite(place?.lon))return null;
    if(place.lon<extent.minLon||place.lon>extent.maxLon||place.lat<extent.minLat||place.lat>extent.maxLat)return null;
    const image=await loadDangerImage(product.imageUrl);
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth;
    canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,0,0);
    const x=Math.max(0,Math.min(canvas.width-1,Math.round((place.lon-extent.minLon)/(extent.maxLon-extent.minLon)*(canvas.width-1))));
    const y=Math.max(0,Math.min(canvas.height-1,Math.round((extent.maxLat-place.lat)/(extent.maxLat-extent.minLat)*(canvas.height-1))));
    const candidates=[];
    for(let offsetY=-1;offsetY<=1;offsetY++)for(let offsetX=-1;offsetX<=1;offsetX++){
      const pixel=context.getImageData(Math.max(0,Math.min(canvas.width-1,x+offsetX)),Math.max(0,Math.min(canvas.height-1,y+offsetY)),1,1).data;
      const level=closestDangerLevel(pixel,palette);
      if(level)candidates.push(level);
    }
    if(!candidates.length)return null;
    const counts=new Map();
    for(const candidate of candidates)counts.set(candidate.value,(counts.get(candidate.value)||0)+1);
    return candidates.sort((a,b)=>(counts.get(b.value)-counts.get(a.value))||a.distance-b.distance)[0];
  }

  async function resolveDangerProducts(data,place){
    const products=[['today',data.today],['tomorrow',data.tomorrow]].filter(([,product])=>product);
    await Promise.all(products.map(async([kind,product])=>{
      const target=document.querySelector(`[data-danger-level="${kind}"]`);
      if(!target)return;
      try{
        const level=await sampleDangerProduct(product,place,data.palette);
        target.innerHTML=dangerLevelHtml(level);
        target.dataset.level=level?.label||'No disponible';
      }catch{
        target.innerHTML=dangerLevelHtml(null);
        target.dataset.level='No disponible';
      }
    }));
  }

  async function renderDanger(data,place){
    const host=$('#preventionStatus');
    if(!host)return;
    const levels=(data.levels||[]).map(level=>`<span>${escapeHtml(level)}</span>`).join('');
    const status=data.degraded?'Consulta temporalmente degradada':'Producto oficial disponible';
    const productCard=(kind,product,label)=>product?`<article class="dangerProduct"><div><small>${escapeHtml(label)} · ${escapeHtml(dateLabel(product.validFor))}</small><div data-danger-level="${kind}" aria-live="polite"><strong class="dangerLevel loading">Calculando píxel…</strong></div></div><a href="${escapeHtml(product.officialImageUrl||data.viewerUrl)}" target="_blank" rel="noopener">Abrir mapa oficial ↗</a></article>`:`<article class="dangerProduct unavailable"><div><small>${escapeHtml(label)}</small><strong class="dangerLevel unavailable">Sin producto publicado</strong></div></article>`;
    host.innerHTML=`<div class="preventionStatus"><div><small>Fuente</small><strong>${escapeHtml(data.source||'AEMET')}</strong></div><div><small>Zona consultada</small><strong>${escapeHtml(place.name)}</strong></div><div><small>Estado</small><strong>${escapeHtml(status)}</strong></div><div><small>Resolución oficial</small><strong>${escapeHtml(data.resolutionKm||1)} km</strong></div></div><div class="dangerProducts">${productCard('today',data.today,'Hoy')}${productCard('tomorrow',data.tomorrow,'Mañana')}</div><div class="preventionDisclaimer"><b>No confirma un incendio.</b> Es el nivel meteorológico oficial del píxel de 1 km que contiene la localidad. No es una alerta, no equivale a una evaluación local de riesgo y no sustituye instrucciones de emergencia.</div><p class="dangerValidity">${escapeHtml(data.validityNote||'Producto preventivo diario de AEMET.')}${data.retrievedAt?` Consultado: ${escapeHtml(localTime(data.retrievedAt))}.`:''}</p>${data.degraded?`<p>${escapeHtml(data.message||'No se ha podido recuperar el producto oficial.')}</p><div class="aemetLevels" aria-label="Niveles oficiales AEMET">${levels}</div>`:''}`;
    const link=$('#aemetDangerLink');if(link&&data.viewerUrl)link.href=data.viewerUrl;
    if(!data.degraded)await resolveDangerProducts(data,place);
  }

  async function loadDanger(){
    const host=$('#preventionStatus');if(host)host.innerHTML='<span class="historyEmpty">Consultando AEMET…</span>';
    const place=coordsForContext();
    try{const response=await fetch(`/api/fire-danger?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}`,{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);await renderDanger(await response.json(),place)}
    catch{if(host)host.innerHTML='<div class="preventionDisclaimer">No se ha podido consultar AEMET. Usa el enlace al visor oficial y no interpretes esta ausencia como riesgo bajo.</div>'}
  }

  function ensureLocalContext(){
    const report=$('#localReport .report');
    if(!report||report.querySelector('#localContextPanel'))return;
    const panel=document.createElement('section');
    panel.id='localContextPanel';
    panel.className='localContextPanel';
    panel.setAttribute('aria-labelledby','localContextTitle');
    panel.innerHTML=`<div class="localContextHead"><div><small>CONTEXTO LOCAL</small><h4 id="localContextTitle">Viento y condiciones próximas</h4></div><span class="modelTag">Predicción modelizada</span></div><div id="localWeatherStatus" class="localWeatherStatus" aria-live="polite"><span class="historyEmpty">Consultando viento y rachas…</span></div><section class="perimeterPanel" aria-labelledby="perimeterPanelTitle"><div class="perimeterPanelHead"><div><small>EFFIS · COPERNICUS EMS</small><h5 id="perimeterPanelTitle">Perímetros de área quemada cercanos</h5></div><a href="${EFFIS_URL}" target="_blank" rel="noopener">Abrir EFFIS ↗</a></div><div id="localPerimeterStatus" aria-live="polite"><span class="historyEmpty">Consultando perímetros en 100 km…</span></div></section><section class="roadPanel" aria-labelledby="roadPanelTitle"><div class="roadPanelHead"><div><small>DGT · DATEX II</small><h5 id="roadPanelTitle">Carreteras e incidencias cercanas</h5></div><a href="${DGT_URL}" target="_blank" rel="noopener">Abrir DGT ↗</a></div><div id="localRoadStatus" aria-live="polite"><span class="historyEmpty">Consultando incidencias en 50 km…</span></div></section>`;
    const note=report.querySelector('.note');
    if(note)note.insertAdjacentElement('beforebegin',panel);else report.append(panel);
  }

  function renderWeather(data,report){
    const host=$('#localWeatherStatus');
    if(!host)return;
    if(data.degraded){host.innerHTML=`<div class="weatherUnavailable"><b>No se han podido recuperar las condiciones meteorológicas.</b><p>${escapeHtml(data.disclaimer||'La ausencia de datos no debe interpretarse como una situación segura.')}</p></div>`;return}
    const current=data.current||{};
    const next=data.next24Hours||{};
    const gust=finite(current.windGustKmh)?current.windGustKmh:next.maxWindGustKmh;
    const note=finite(gust)&&gust>=60?'Rachas fuertes: pueden dificultar la extinción y favorecer cambios rápidos, pero este dato no permite predecir por sí solo la trayectoria del fuego.':'El viento influye en la propagación, pero no permite deducir por sí solo hacia dónde avanzará un incendio.';
    host.dataset.weatherSummary=`Viento ${metric(current.windSpeedKmh,' km/h')} ${cardinal(current.windDirectionDeg)}; rachas ${metric(current.windGustKmh,' km/h')}`;
    host.innerHTML=`<div class="weatherGrid"><div><small>Viento actual</small><strong>${metric(current.windSpeedKmh,' km/h')}</strong><span>${escapeHtml(cardinal(current.windDirectionDeg))}</span></div><div><small>Rachas actuales</small><strong>${metric(current.windGustKmh,' km/h')}</strong><span>Máx. 24 h: ${metric(next.maxWindGustKmh,' km/h')}</span></div><div><small>Temperatura</small><strong>${metric(current.temperatureC,' °C')}</strong><span>Zona de ${escapeHtml(report.name)}</span></div><div><small>Humedad relativa</small><strong>${metric(current.relativeHumidity,' %')}</strong><span>Predicción local</span></div></div><div class="weatherInterpretation"><b>Cómo interpretarlo:</b> ${escapeHtml(note)}</div><div class="weatherSource">Fuente meteorológica: <a href="${escapeHtml(data.sourceUrl||'https://open-meteo.com/en/docs')}" target="_blank" rel="noopener">${escapeHtml(data.source||'Open-Meteo')} ↗</a>. Datos basados en modelos, no observación oficial de un incendio.</div>`;
  }

  async function loadWeather(report,{force=false}={}){
    const host=$('#localWeatherStatus');
    if(!host||!finite(report?.lat)||!finite(report?.lon))return;
    const key=`${report.name}|${report.lat.toFixed(4)}|${report.lon.toFixed(4)}`;
    if(!force&&host.dataset.loadedFor===key)return;
    host.dataset.loadedFor=key;
    host.innerHTML='<span class="historyEmpty">Consultando viento y rachas…</span>';
    try{
      const response=await fetch(`/api/weather?lat=${encodeURIComponent(report.lat)}&lon=${encodeURIComponent(report.lon)}`,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok&&response.status!==503)throw Error(`HTTP ${response.status}`);
      renderWeather(data,report);
    }catch{
      renderWeather({degraded:true,disclaimer:'No hay datos meteorológicos disponibles. Comprueba AEMET y no interpretes esta ausencia como riesgo bajo.'},report);
    }
  }

  function roadKilometer(item){
    if(!finite(item?.kilometerFrom))return'Punto kilométrico no publicado';
    return finite(item.kilometerTo)&&item.kilometerTo!==item.kilometerFrom?`km ${item.kilometerFrom}–${item.kilometerTo}`:`km ${item.kilometerFrom}`;
  }

  function renderRoadIncidents(data,report){
    const host=$('#localRoadStatus');
    if(!host)return;
    if(data.degraded){
      host.dataset.roadSummary='';
      host.innerHTML=`<div class="roadUnavailable"><b>No se ha podido consultar el feed oficial de la DGT.</b><p>${escapeHtml(data.coverageNote||'Comprueba el mapa oficial y no interpretes esta ausencia como carreteras abiertas.')}</p></div>`;
      return;
    }
    const incidents=Array.isArray(data.incidents)?data.incidents:[];
    const summary=incidents.length?`${data.nearbyCount} incidencias DGT en ${data.radiusKm} km${data.closuresCount?`, ${data.closuresCount} cortes`:''}`:`Sin incidencias DGT publicadas en ${data.radiusKm} km`;
    host.dataset.roadSummary=summary;
    const rows=incidents.map((item,index)=>`<article class="roadIncident${index>=3?' roadIncidentExtra':''}"><div class="roadIncidentHead"><span class="roadSeverity ${escapeHtml(item.severity)}">${escapeHtml(item.typeLabel)}</span><b>${finite(item.distanceKm)?`${item.distanceKm.toFixed(1)} km`:'Distancia no disponible'}</b></div><h6>${escapeHtml(item.road)}</h6><p>${escapeHtml([item.municipality,item.province].filter(Boolean).join(', ')||'Ubicación publicada por la DGT')} · ${escapeHtml(roadKilometer(item))}</p><small>Actualizada: ${escapeHtml(localTime(item.updatedAt||data.publicationTime))}</small></article>`).join('');
    const toggle=incidents.length>3?`<button type="button" class="secondary roadToggle" data-road-toggle aria-expanded="false">Ver las ${incidents.length} incidencias priorizadas</button>`:'';
    host.innerHTML=`<div class="roadSummary"><b>${escapeHtml(summary)}</b><small>Desde ${escapeHtml(report.name)} · feed publicado ${escapeHtml(localTime(data.publicationTime))}</small></div>${rows?`<div class="roadIncidentList is-collapsed">${rows}</div>${toggle}`:'<div class="roadEmpty">No se han recuperado incidencias dentro del radio consultado.</div>'}<p class="roadCoverage">${escapeHtml(data.coverageNote||'Cobertura según la red publicada por la DGT.')}</p><p class="roadRelationship">${escapeHtml(data.relationshipNote||'Una incidencia de tráfico no implica que esté relacionada con un incendio.')}</p>`;
  }

  let perimeterLayer=null;
  function perimeterControl(){
    return $('#perimeterToggle');
  }

  function syncPerimeterVisibility(){
    const map=window.__FC_MAP__,toggle=perimeterControl();
    if(!map||!perimeterLayer||!toggle)return;
    if(toggle.checked&&!map.hasLayer(perimeterLayer))perimeterLayer.addTo(map);
    if(!toggle.checked&&map.hasLayer(perimeterLayer))map.removeLayer(perimeterLayer);
  }

  function clearPerimeterLayer(){
    if(perimeterLayer&&window.__FC_MAP__?.hasLayer?.(perimeterLayer))window.__FC_MAP__.removeLayer(perimeterLayer);
    perimeterLayer=null;
    const toggle=perimeterControl();
    if(toggle)toggle.disabled=true;
  }

  function drawPerimeters(perimeters){
    clearPerimeterLayer();
    if(!window.L||!window.__FC_MAP__)return;
    const features=perimeters.filter(item=>item.geometry).map(item=>({
      type:'Feature',
      geometry:item.geometry,
      properties:{
        id:item.id,
        areaHa:item.areaHa,
        distanceToEdgeKm:item.distanceToEdgeKm,
        municipality:item.municipality,
        province:item.province,
        updatedAt:item.updatedAt,
        ageCategory:item.ageCategory,
        ageLabel:item.ageLabel
      }
    }));
    if(!features.length)return;
    perimeterLayer=window.L.geoJSON({type:'FeatureCollection',features},{
      style:feature=>{
        const age=feature?.properties?.ageCategory;
        if(age==='old')return {color:'#9aa4ad',weight:2,opacity:.8,fillColor:'#7f8b94',fillOpacity:.1,dashArray:'3 6'};
        if(age==='aging')return {color:'#f3c548',weight:2,opacity:.88,fillColor:'#dba932',fillOpacity:.13,dashArray:'7 5'};
        if(age==='unknown')return {color:'#ae9acb',weight:2,opacity:.8,fillColor:'#8d79aa',fillOpacity:.1,dashArray:'2 6'};
        return {color:'#ff8c5a',weight:2,opacity:.92,fillColor:'#ff7043',fillOpacity:.16};
      },
      onEachFeature:(feature,layer)=>{
        const properties=feature.properties||{};
        const area=finite(properties.areaHa)?`${Math.round(properties.areaHa).toLocaleString('es-ES')} ha`:'Superficie no disponible';
        const distance=finite(properties.distanceToEdgeKm)?`${properties.distanceToEdgeKm.toFixed(1)} km al borde`:'Distancia no disponible';
        layer.bindPopup(`<b>Área quemada EFFIS</b><br>${escapeHtml([properties.municipality,properties.province].filter(Boolean).join(', ')||'Área cartografiada')}<br>${escapeHtml(area)} · ${escapeHtml(distance)}<br><small>${escapeHtml(properties.ageLabel||'Antigüedad no confirmada')}</small><br><small>No confirma un incendio activo ni representa el frente de llama.</small>`);
      }
    });
    const toggle=perimeterControl();
    if(toggle)toggle.disabled=false;
    syncPerimeterVisibility();
  }

  function perimeterDistanceLabel(item){
    if(item.containsLocality)return'La coordenada consultada está dentro';
    return finite(item.distanceToEdgeKm)?`${item.distanceToEdgeKm.toFixed(1)} km al borde`:'Distancia no disponible';
  }

  function renderPerimeters(data,report){
    const host=$('#localPerimeterStatus');
    if(!host)return;
    host.dataset.cacheStatus=data.cacheStatus||'unavailable';
    host.dataset.processingMs=finite(data.processingMs)?String(data.processingMs):'';
    if(data.degraded){
      clearPerimeterLayer();
      host.dataset.perimeterSummary='';
      host.innerHTML=`<div class="perimeterUnavailable"><b>No se ha podido consultar EFFIS.</b><p>${escapeHtml(data.coverageNote||'La ausencia de perímetros no significa que no exista un incendio.')}</p></div>`;
      return;
    }
    const perimeters=Array.isArray(data.perimeters)?data.perimeters:[];
    drawPerimeters(perimeters);
    if(!perimeters.length){
      host.dataset.perimeterSummary=`Sin perímetro EFFIS publicado en ${data.radiusKm} km`;
      host.innerHTML=`<div class="perimeterEmpty"><b>Sin perímetros recientes publicados en ${escapeHtml(data.radiusKm)} km.</b><p>Esto no demuestra que no exista un incendio: EFFIS puede tardar en cartografiarlo y puede omitir incendios pequeños o recientes.</p></div><p class="perimeterCoverage">${escapeHtml(data.coverageNote||'Cobertura satelital europea.')}</p>`;
      return;
    }
    const nearest=perimeters[0];
    const area=finite(nearest.areaHa)?`${Math.round(nearest.areaHa).toLocaleString('es-ES')} ha`:'Superficie no disponible';
    const location=[nearest.municipality,nearest.province].filter(Boolean).join(', ')||'Área sin nombre publicado';
    const summary=`Perímetro EFFIS más próximo: ${perimeterDistanceLabel(nearest)}`;
    host.dataset.perimeterSummary=summary;
    const additional=perimeters.length-1;
    const ageCategory=['recent','aging','old','unknown'].includes(nearest.ageCategory)?nearest.ageCategory:'unknown';
    const staleMessage=data.refreshing?'EFFIS se está actualizando en segundo plano.':'La actualización de EFFIS no está disponible ahora.';
    const staleNotice=data.usingStaleCache?`<p class="perimeterStale"><b>Mostrando la última copia válida.</b> ${escapeHtml(staleMessage)} Datos recuperados ${escapeHtml(localTime(data.retrievedAt))}.</p>`:'';
    host.innerHTML=`${staleNotice}<article class="perimeterNearest"><div class="perimeterNearestHead"><span>Área quemada más próxima</span><b>${escapeHtml(perimeterDistanceLabel(nearest))}</b></div><div class="perimeterAge ${ageCategory}">${escapeHtml(nearest.ageLabel||'Antigüedad no confirmada')}</div><h6>${escapeHtml(location)}</h6><div class="perimeterMetrics"><span><small>Área cartografiada</small><strong>${escapeHtml(area)}</strong></span><span><small>Fecha del producto</small><strong>${escapeHtml(localTime(nearest.updatedAt||nearest.fireDate))}</strong></span></div><p><b>Qué significa:</b> distancia desde ${escapeHtml(report.name)} hasta el borde de un área quemada cartografiada por satélite.</p></article>${additional?`<p class="perimeterMore">${additional} ${additional===1?'área cartografiada adicional':'áreas cartografiadas adicionales'} dentro de ${escapeHtml(data.radiusKm)} km se ${additional===1?'muestra':'muestran'} en el mapa.</p>`:''}<p class="perimeterWarning"><b>No es un incendio activo ni el frente de llama.</b> El perímetro puede ser antiguo y EFFIS no confirma por sí solo que el fuego siga activo.</p><p class="perimeterAssociation">${escapeHtml(data.associationNote||nearest.associationNote||'No se vincula automáticamente a un incendio oficial sin una coincidencia verificable.')}</p><p class="perimeterCoverage">${escapeHtml(data.coverageNote||'Cobertura satelital europea.')}</p>`;
  }

  async function loadPerimeters(report,{force=false}={}){
    const host=$('#localPerimeterStatus');
    if(!host||!finite(report?.lat)||!finite(report?.lon))return;
    const key=`${report.lat.toFixed(4)}|${report.lon.toFixed(4)}|100`;
    if(!force&&host.dataset.loadedFor===key)return;
    host.dataset.loadedFor=key;
    host.innerHTML='<span class="historyEmpty">El informe local ya está disponible. Añadiendo las áreas EFFIS en segundo plano…</span>';
    try{
      const response=await fetch(`/api/fire-perimeters?lat=${encodeURIComponent(report.lat)}&lon=${encodeURIComponent(report.lon)}&radius=100`);
      const data=await response.json();
      if(!response.ok&&response.status!==503)throw Error(`HTTP ${response.status}`);
      renderPerimeters(data,report);
    }catch{
      renderPerimeters({degraded:true,coverageNote:'No se ha podido consultar EFFIS. La ausencia de perímetros no significa que no exista un incendio.'},report);
    }
  }

  let perimeterPrewarmStarted=false;
  function prewarmPerimeters(){
    if(perimeterPrewarmStarted||!navigator.onLine||navigator.connection?.saveData)return;
    perimeterPrewarmStarted=true;
    fetch('/api/fire-perimeters?lat=40.4167&lon=-3.7033&radius=10&prewarm=1').catch(()=>{});
  }

  async function loadRoadIncidents(report,{force=false}={}){
    const host=$('#localRoadStatus');
    if(!host||!finite(report?.lat)||!finite(report?.lon))return;
    const key=`${report.lat.toFixed(4)}|${report.lon.toFixed(4)}|50`;
    if(!force&&host.dataset.loadedFor===key)return;
    host.dataset.loadedFor=key;
    host.innerHTML='<span class="historyEmpty">Consultando incidencias en 50 km…</span>';
    try{
      const response=await fetch(`/api/road-incidents?lat=${encodeURIComponent(report.lat)}&lon=${encodeURIComponent(report.lon)}&radius=50`,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok&&response.status!==503)throw Error(`HTTP ${response.status}`);
      renderRoadIncidents(data,report);
    }catch{
      renderRoadIncidents({degraded:true,coverageNote:'No se ha podido consultar la DGT. Comprueba su mapa oficial y no interpretes esta ausencia como carreteras abiertas.'},report);
    }
  }

  function reportUrl(report){
    const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('localidad',report.name);return url.toString();
  }
  function shareText(report,url){
    const weather=$('#localWeatherStatus')?.dataset.weatherSummary||'';
    const roads=$('#localRoadStatus')?.dataset.roadSummary||'';
    const perimeter=$('#localPerimeterStatus')?.dataset.perimeterSummary||'';
    return [`${BRAND} · ${report.name}`,report.badge,report.lead,perimeter,weather,roads,`Consulta: ${new Date(report.time).toLocaleString('es-ES')}`,'En una emergencia prevalecen ES-Alert, 112 y las autoridades.',url].filter(Boolean).join('\n');
  }
  async function copyText(text){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
    const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
  }
  async function shareCurrentReport(){
    const report=currentReport();const feedback=$('#shareFeedback');
    if(!report){if(feedback)feedback.textContent='Consulta primero una localidad para compartir su informe.';return}
    const url=reportUrl(report);const text=shareText(report,url);
    try{if(navigator.share)await navigator.share({title:`${BRAND} · ${report.name}`,text,url});else{await copyText(text);if(feedback)feedback.textContent='Informe y enlace copiados al portapapeles.'}}
    catch(error){if(error?.name!=='AbortError'&&feedback)feedback.textContent='No se ha podido compartir el informe.'}
  }

  function ensureShareControls(){
    const report=$('#localReport .report');
    if(!report||report.querySelector('#shareReportBtn'))return;
    const box=document.createElement('div');box.className='reportShare';box.innerHTML='<button id="shareReportBtn" class="primary" type="button">Compartir esta situación</button><div id="shareFeedback" class="shareFeedback" role="status" aria-live="polite"></div>';
    report.append(box);
  }

  function openPlace(name){
    const input=$('#placeQuery');if(!name||!input)return;
    input.value=name;$('#placeSearchForm')?.requestSubmit();
    let attempts=0;
    const timer=setInterval(()=>{
      const candidates=[...document.querySelectorAll('#placeResults [data-pick]')];
      const normalized=name.toLocaleLowerCase('es');
      const match=candidates.find(button=>button.textContent.toLocaleLowerCase('es').includes(normalized))||candidates[0];
      if(match){clearInterval(timer);match.click()}else if(++attempts>40)clearInterval(timer);
    },150);
  }
  function openHistory(index){const item=getHistory()[index];if(item)openPlace(item.name)}
  function openDeepLink(){const name=new URLSearchParams(location.search).get('localidad')?.trim();if(name)setTimeout(()=>openPlace(name),250)}

  let reportTimer=null;
  function syncReport(){
    clearTimeout(reportTimer);
    reportTimer=setTimeout(()=>{
      let report=currentReport();if(!report){clearPerimeterLayer();return}
      ensureSmartLocalInsights(report);ensureLocalContext();ensureShareControls();
      report=currentReport();
      saveHistory({name:report.name,time:report.time,lat:report.lat,lon:report.lon});
      loadWeather(report);loadPerimeters(report);loadRoadIncidents(report);loadDanger();saveSnapshot(report);
    },180);
  }

  function bind(){
    renderHistory();setOfflineState();loadDanger();
    setTimeout(prewarmPerimeters,700);
    $('#refreshDangerBtn')?.addEventListener('click',loadDanger);
    $('#perimeterToggle')?.addEventListener('change',syncPerimeterVisibility);
    $('#recentPlaces')?.addEventListener('click',event=>{const button=event.target.closest('[data-history]');if(button)openHistory(Number(button.dataset.history))});
    $('#localReport')?.addEventListener('click',event=>{
      if(event.target.closest('#shareReportBtn'))shareCurrentReport();
      const roadToggle=event.target.closest('[data-road-toggle]');
      if(roadToggle){
        const list=$('#localRoadStatus .roadIncidentList');
        const expanded=roadToggle.getAttribute('aria-expanded')==='true';
        roadToggle.setAttribute('aria-expanded',String(!expanded));
        roadToggle.textContent=expanded?`Ver las ${list?.children.length||0} incidencias priorizadas`:'Mostrar solo las 3 más importantes';
        list?.classList.toggle('is-collapsed',expanded);
      }
      const incidentButton=event.target.closest('[data-smart-incident]');
      if(incidentButton)window.openIncident?.(incidentButton.dataset.smartIncident);
    });
    const localReport=$('#localReport');if(localReport)new MutationObserver(syncReport).observe(localReport,{childList:true,subtree:true});
    addEventListener('offline',setOfflineState);addEventListener('online',setOfflineState);openDeepLink();
  }

  window.FC46={getHistory,loadDanger,loadWeather,loadPerimeters,loadRoadIncidents,prewarmPerimeters,currentReport,setOfflineState,shareCurrentReport,openPlace,combinedTimeline,ensureSmartLocalInsights,getPerimeterLayerCount:()=>perimeterLayer?.getLayers?.().length||0,isPerimeterLayerVisible:()=>Boolean(perimeterLayer&&window.__FC_MAP__?.hasLayer?.(perimeterLayer))};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
