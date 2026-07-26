(()=>{
  const HISTORY_KEY='fc_recent_places_v46';
  const SNAPSHOT_KEY='fc_last_snapshot_v46';
  const MAX_HISTORY=8;
  const $=selector=>document.querySelector(selector);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function readJson(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}
  }

  function getHistory(){
    const value=readJson(HISTORY_KEY,[]);
    return Array.isArray(value)?value:[];
  }

  function writeHistory(items){
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(items))}catch{}
  }

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
    const items=[item,...getHistory().filter(existing=>existing.name.trim().toLocaleLowerCase('es')!==normalized)].slice(0,MAX_HISTORY);
    writeHistory(items);
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
    return {
      name,
      badge,
      lead,
      lat:Number.isFinite(center?.lat)?center.lat:null,
      lon:Number.isFinite(center?.lng)?center.lng:null,
      time:new Date().toISOString(),
      html:report.outerHTML
    };
  }

  function saveSnapshot(report){
    if(!report)return;
    try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(report))}catch{}
  }

  function setOfflineState(){
    const notice=$('#offlineSnapshotNotice');
    if(!notice)return;
    if(navigator.onLine){notice.classList.remove('on');notice.textContent='';return}
    const snapshot=readJson(SNAPSHOT_KEY,null);
    notice.classList.add('on');
    notice.textContent=snapshot
      ?`Sin conexión. La última copia local corresponde a ${snapshot.name}, guardada el ${new Date(snapshot.time).toLocaleString('es-ES')}. Puede estar desactualizada.`
      :'Sin conexión. No hay todavía un informe local guardado en este navegador.';
    const reportHost=$('#localReport');
    if(snapshot?.html&&reportHost&&!reportHost.querySelector('.report'))reportHost.innerHTML=snapshot.html;
  }

  function coordsForDanger(){
    const report=currentReport();
    if(Number.isFinite(report?.lat)&&Number.isFinite(report?.lon))return {lat:report.lat,lon:report.lon,name:report.name};
    const center=window.__FC_MAP__?.getCenter?.();
    return {lat:Number.isFinite(center?.lat)?center.lat:40.4167,lon:Number.isFinite(center?.lng)?center.lng:-3.7033,name:'España'};
  }

  function renderDanger(data,place){
    const host=$('#preventionStatus');
    if(!host)return;
    const levels=(data.levels||[]).map(level=>`<span>${escapeHtml(level)}</span>`).join('');
    const status=data.configured
      ?data.degraded?'Integración temporalmente degradada':'Productos oficiales disponibles'
      :'Integración automática pendiente de credencial';
    const productLinks=[
      data.estimated?.dataUrl?`<a href="${escapeHtml(data.estimated.dataUrl)}" target="_blank" rel="noopener">Mapa estimado ↗</a>`:'',
      data.tomorrow?.dataUrl?`<a href="${escapeHtml(data.tomorrow.dataUrl)}" target="_blank" rel="noopener">Previsión de mañana ↗</a>`:''
    ].filter(Boolean).join(' · ');
    host.innerHTML=`<div class="preventionStatus"><div><small>Fuente</small><strong>${escapeHtml(data.source||'AEMET')}</strong></div><div><small>Zona consultada</small><strong>${escapeHtml(place.name)}</strong></div><div><small>Estado</small><strong>${escapeHtml(status)}</strong></div><div><small>Resolución oficial</small><strong>${escapeHtml(data.resolutionKm||1)} km</strong></div></div><div class="aemetLevels" aria-label="Niveles oficiales AEMET">${levels}</div><div class="preventionDisclaimer"><b>No confirma un incendio.</b> El peligro meteorológico expresa condiciones favorables para la ignición y propagación. Fuego Centro no calcula todavía un nivel exacto para estas coordenadas.</div>${data.message?`<p>${escapeHtml(data.message)}</p>`:''}${productLinks?`<p>${productLinks}</p>`:''}`;
    const link=$('#aemetDangerLink');
    if(link&&data.viewerUrl)link.href=data.viewerUrl;
  }

  async function loadDanger(){
    const host=$('#preventionStatus');
    if(host)host.innerHTML='<span class="historyEmpty">Consultando AEMET…</span>';
    const place=coordsForDanger();
    try{
      const response=await fetch(`/api/fire-danger?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}`,{cache:'no-store'});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      renderDanger(await response.json(),place);
    }catch{
      if(host)host.innerHTML='<div class="preventionDisclaimer">No se ha podido consultar AEMET. Usa el enlace al visor oficial y no interpretes esta ausencia como riesgo bajo.</div>';
    }
  }

  function shareText(report){
    const time=new Date(report.time).toLocaleString('es-ES');
    return [`Fuego Centro · ${report.name}`,report.badge,report.lead,`Consulta: ${time}`,'En una emergencia prevalecen ES-Alert, 112 y las autoridades.',location.href].filter(Boolean).join('\n');
  }

  async function copyText(text){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
    const area=document.createElement('textarea');
    area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
  }

  async function shareCurrentReport(){
    const feedback=$('#shareFeedback');
    const report=currentReport();
    if(!report){if(feedback)feedback.textContent='Consulta primero una localidad para compartir su informe.';return}
    const text=shareText(report);
    try{
      if(navigator.share)await navigator.share({title:`Fuego Centro · ${report.name}`,text,url:location.href});
      else{await copyText(text);if(feedback)feedback.textContent='Informe copiado al portapapeles.'}
    }catch(error){
      if(error?.name!=='AbortError'&&feedback)feedback.textContent='No se ha podido compartir el informe.';
    }
  }

  function openHistory(index){
    const item=getHistory()[index];
    const input=$('#placeQuery');
    if(!item||!input)return;
    input.value=item.name;
    $('#placeSearchForm')?.requestSubmit();
    let attempts=0;
    const timer=setInterval(()=>{
      const candidates=[...document.querySelectorAll('#placeResults [data-pick]')];
      const match=candidates.find(button=>button.textContent.toLocaleLowerCase('es').includes(item.name.toLocaleLowerCase('es')))||candidates[0];
      if(match){clearInterval(timer);match.click()}
      else if(++attempts>30)clearInterval(timer);
    },150);
  }

  let reportTimer=null;
  function syncReport(){
    clearTimeout(reportTimer);
    reportTimer=setTimeout(()=>{
      const report=currentReport();
      if(!report)return;
      saveHistory({name:report.name,time:report.time,lat:report.lat,lon:report.lon});
      saveSnapshot(report);
      loadDanger();
    },180);
  }

  function bind(){
    renderHistory();
    setOfflineState();
    loadDanger();
    $('#shareReportBtn')?.addEventListener('click',shareCurrentReport);
    $('#refreshDangerBtn')?.addEventListener('click',loadDanger);
    $('#recentPlaces')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-history]');
      if(button)openHistory(Number(button.dataset.history));
    });
    const localReport=$('#localReport');
    if(localReport)new MutationObserver(syncReport).observe(localReport,{childList:true,subtree:true});
    addEventListener('offline',setOfflineState);
    addEventListener('online',setOfflineState);
  }

  window.FC46={getHistory,loadDanger,currentReport,setOfflineState};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
