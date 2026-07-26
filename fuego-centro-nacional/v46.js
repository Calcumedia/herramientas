(()=>{
  const BRAND='FuegoCerca';
  const HISTORY_KEY='fc_recent_places_v47';
  const SNAPSHOT_KEY='fc_last_snapshot_v47';
  const MAX_HISTORY=8;
  const DGT_URL='https://www.dgt.es/conoce-el-estado-del-trafico/informacion-e-incidencias-de-trafico/index.html';
  const EFFIS_URL='https://forest-fire.emergency.copernicus.eu/apps/effis_current_situation/';
  const $=selector=>document.querySelector(selector);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const finite=value=>Number.isFinite(value);
  const metric=(value,suffix='')=>finite(value)?`${Math.round(value)}${suffix}`:'No disponible';

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
    const badge=report.querySelector('.reportMeta .badge')?.textContent?.trim()||'Sin prioridad calculada';
    const lead=report.querySelector(':scope > p b')?.textContent?.trim()||'';
    const center=window.__FC_MAP__?.getCenter?.();
    return {name,badge,lead,lat:finite(center?.lat)?center.lat:null,lon:finite(center?.lng)?center.lng:null,time:new Date().toISOString(),html:report.outerHTML};
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

  function coordsForContext(){
    const report=currentReport();
    if(finite(report?.lat)&&finite(report?.lon))return {lat:report.lat,lon:report.lon,name:report.name};
    const center=window.__FC_MAP__?.getCenter?.();
    return {lat:finite(center?.lat)?center.lat:40.4167,lon:finite(center?.lng)?center.lng:-3.7033,name:'España'};
  }

  function renderDanger(data,place){
    const host=$('#preventionStatus');
    if(!host)return;
    const levels=(data.levels||[]).map(level=>`<span>${escapeHtml(level)}</span>`).join('');
    const status=data.configured?(data.degraded?'Integración temporalmente degradada':'Productos oficiales disponibles'):'Integración automática pendiente de credencial';
    const productLinks=[data.estimated?.dataUrl?`<a href="${escapeHtml(data.estimated.dataUrl)}" target="_blank" rel="noopener">Mapa estimado ↗</a>`:'',data.tomorrow?.dataUrl?`<a href="${escapeHtml(data.tomorrow.dataUrl)}" target="_blank" rel="noopener">Previsión de mañana ↗</a>`:''].filter(Boolean).join(' · ');
    host.innerHTML=`<div class="preventionStatus"><div><small>Fuente</small><strong>${escapeHtml(data.source||'AEMET')}</strong></div><div><small>Zona consultada</small><strong>${escapeHtml(place.name)}</strong></div><div><small>Estado</small><strong>${escapeHtml(status)}</strong></div><div><small>Resolución oficial</small><strong>${escapeHtml(data.resolutionKm||1)} km</strong></div></div><div class="aemetLevels" aria-label="Niveles oficiales AEMET">${levels}</div><div class="preventionDisclaimer"><b>No confirma un incendio.</b> El peligro meteorológico expresa condiciones favorables para la ignición y propagación. ${BRAND} no calcula todavía un nivel exacto para estas coordenadas.</div>${data.message?`<p>${escapeHtml(data.message)}</p>`:''}${productLinks?`<p>${productLinks}</p>`:''}`;
    const link=$('#aemetDangerLink');if(link&&data.viewerUrl)link.href=data.viewerUrl;
  }

  async function loadDanger(){
    const host=$('#preventionStatus');if(host)host.innerHTML='<span class="historyEmpty">Consultando AEMET…</span>';
    const place=coordsForContext();
    try{const response=await fetch(`/api/fire-danger?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}`,{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);renderDanger(await response.json(),place)}
    catch{if(host)host.innerHTML='<div class="preventionDisclaimer">No se ha podido consultar AEMET. Usa el enlace al visor oficial y no interpretes esta ausencia como riesgo bajo.</div>'}
  }

  function ensureLocalContext(){
    const report=$('#localReport .report');
    if(!report||report.querySelector('#localContextPanel'))return;
    const panel=document.createElement('section');
    panel.id='localContextPanel';
    panel.className='localContextPanel';
    panel.setAttribute('aria-labelledby','localContextTitle');
    panel.innerHTML=`<div class="localContextHead"><div><small>CONTEXTO LOCAL</small><h4 id="localContextTitle">Viento y condiciones próximas</h4></div><span class="modelTag">Predicción modelizada</span></div><div id="localWeatherStatus" class="localWeatherStatus" aria-live="polite"><span class="historyEmpty">Consultando viento y rachas…</span></div><div class="operationalLinks"><div><b>Carreteras e incidencias</b><p>Consulta manual en el mapa oficial de la DGT. Los cortes aún no se integran en este informe.</p><a href="${DGT_URL}" target="_blank" rel="noopener">Abrir DGT ↗</a></div><div><b>Perímetros y área quemada</b><p>Consulta manual en el visor europeo EFFIS. Solo se mostrará geometría automática cuando pueda verificarse.</p><a href="${EFFIS_URL}" target="_blank" rel="noopener">Abrir EFFIS ↗</a></div></div>`;
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

  function reportUrl(report){
    const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('localidad',report.name);return url.toString();
  }
  function shareText(report,url){
    const weather=$('#localWeatherStatus')?.dataset.weatherSummary||'';
    return [`${BRAND} · ${report.name}`,report.badge,report.lead,weather,`Consulta: ${new Date(report.time).toLocaleString('es-ES')}`,'En una emergencia prevalecen ES-Alert, 112 y las autoridades.',url].filter(Boolean).join('\n');
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
      let report=currentReport();if(!report)return;
      ensureLocalContext();ensureShareControls();
      report=currentReport();
      saveHistory({name:report.name,time:report.time,lat:report.lat,lon:report.lon});
      loadWeather(report);loadDanger();saveSnapshot(report);
    },180);
  }

  function bind(){
    renderHistory();setOfflineState();loadDanger();
    $('#refreshDangerBtn')?.addEventListener('click',loadDanger);
    $('#recentPlaces')?.addEventListener('click',event=>{const button=event.target.closest('[data-history]');if(button)openHistory(Number(button.dataset.history))});
    $('#localReport')?.addEventListener('click',event=>{if(event.target.closest('#shareReportBtn'))shareCurrentReport()});
    const localReport=$('#localReport');if(localReport)new MutationObserver(syncReport).observe(localReport,{childList:true,subtree:true});
    addEventListener('offline',setOfflineState);addEventListener('online',setOfflineState);openDeepLink();
  }

  window.FC46={getHistory,loadDanger,loadWeather,currentReport,setOfflineState,shareCurrentReport,openPlace};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
