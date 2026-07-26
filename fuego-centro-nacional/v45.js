(()=>{
  const INITIAL_CENTER=[40.4167,-3.7033];
  const INITIAL_ZOOM=6;
  const state={lastDialogTrigger:null,locationMarker:null};
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function map(){return window.__FC_MAP__||null}
  function resetMap({clear=false}={}){
    const m=map();
    if(m){m.stop();m.setView(INITIAL_CENTER,INITIAL_ZOOM,{animate:false})}
    if(clear){
      const input=$('#placeQuery');
      if(input)input.value='';
      const results=$('#placeResults');
      const report=$('#localReport');
      if(results)results.innerHTML='';
      if(report)report.innerHTML='';
    }
  }
  window.FC45={resetMap,INITIAL_CENTER,INITIAL_ZOOM};

  function notice(text,error=false){
    const node=$('#locationNotice');
    if(!node)return;
    node.textContent=text;
    node.classList.add('on');
    node.style.borderColor=error?'#ff707066':'#79bdff66';
    clearTimeout(node._timer);
    node._timer=setTimeout(()=>node.classList.remove('on'),7000);
  }

  function setMobileView(view){
    const shell=$('.shell');
    if(!shell)return;
    shell.classList.toggle('mobile-map',view==='map');
    shell.classList.toggle('mobile-report',view==='report');
    $$('[data-mobile-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileView===view)));
    if(view==='map')setTimeout(()=>map()?.invalidateSize(),30);
    try{localStorage.setItem('fc_mobile_view_v45',view)}catch{}
  }

  function restoreLocationButton(){
    const button=$('#locateBtn');
    if(button){button.disabled=false;button.textContent='◎ Mi ubicación'}
  }

  async function useLocation(){
    if(!navigator.geolocation){notice('Este navegador no permite consultar la ubicación.',true);return}
    const button=$('#locateBtn');
    if(button){button.disabled=true;button.textContent='Localizando…'}
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=pos.coords.latitude,lon=pos.coords.longitude,m=map();
      if(m){
        m.setView([lat,lon],11,{animate:true});
        if(state.locationMarker)m.removeLayer(state.locationMarker);
        if(window.L)state.locationMarker=L.circleMarker([lat,lon],{radius:9,color:'#fff',weight:3,fillColor:'#327cff',fillOpacity:.9,className:'locationMarker'}).addTo(m).bindPopup('Tu ubicación aproximada');
      }
      setMobileView('report');
      notice('Ubicación obtenida. Preparando el informe de la localidad más próxima…');
      try{
        const response=await fetch(`/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,{cache:'no-store'});
        if(!response.ok)throw Error(response.status);
        const data=await response.json();
        const place=data.result;
        if(!place?.name)throw Error('Sin localidad');
        const input=$('#placeQuery');
        input.value=place.name;
        $('#placeSearchForm').requestSubmit();
        let attempts=0;
        const selectFirst=setInterval(()=>{
          const first=$('#placeResults [data-pick]');
          if(first){clearInterval(selectFirst);first.click();notice(`Mostrando el informe de ${place.name}.`);restoreLocationButton()}
          else if(++attempts>30){clearInterval(selectFirst);notice(`Ubicación próxima: ${place.name}. Selecciona el resultado para abrir el informe.`);restoreLocationButton()}
        },150);
      }catch{notice('Se ha localizado tu posición en el mapa, pero no se pudo identificar automáticamente la localidad.',true);restoreLocationButton()}
    },error=>{
      const messages={1:'No has concedido permiso para usar tu ubicación.',2:'No se ha podido determinar tu ubicación.',3:'La consulta de ubicación ha tardado demasiado.'};
      notice(messages[error.code]||'No se ha podido consultar tu ubicación.',true);
      restoreLocationButton();
    },{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  }

  function enhanceReport(){
    const report=$('#localReport .report');
    if(!report||report.dataset.v45==='1')return;
    report.dataset.v45='1';
    const badge=report.querySelector('.reportMeta .badge');
    if(badge)badge.dataset.panelPriority='true';
    const text=report.textContent||'';
    const officialMatch=text.match(/Incidente oficial más próximo\s*([^\n]+)/i);
    const coverageText=(text.match(/Cobertura (?:oficial )?regional[^\n]*/i)||[])[0]||'Cobertura no determinada';
    const isDirect=/datos integrados|integrada/i.test(coverageText);
    const isAlert=/ALERTA OFICIAL/i.test(text);
    const priority=badge?.textContent?.trim()||'Sin calcular';
    const trust=document.createElement('div');
    trust.className='trustGrid';
    trust.innerHTML=`<div class="trustItem"><small>Nivel oficial</small><strong>${officialMatch?'Incidente oficial próximo':'No publicado para la localidad'}</strong></div><div class="trustItem"><small>Prioridad del panel</small><strong>${priority}</strong></div><div class="trustItem"><small>Confianza de cobertura</small><strong>${isDirect?'Directa':'Limitada o complementaria'}</strong></div>`;
    const firstParagraph=report.querySelector(':scope > p');
    (firstParagraph||report.firstElementChild)?.insertAdjacentElement('afterend',trust);
    const action=document.createElement('section');
    action.className=`actionCard${isAlert?' alertAction':''}`;
    action.setAttribute('aria-label','Qué hacer ahora');
    action.innerHTML=isAlert
      ?'<h4>Qué hacer ahora</h4><p><b>Existe un aviso oficial relacionado.</b> Sigue las instrucciones de ES-Alert, 112 y la autoridad emisora.</p><p>No uses este panel para decidir rutas de evacuación. Comprueba el enlace oficial incluido en el informe.</p>'
      :'<h4>Cómo interpretar este resultado</h4><p>No aparece una orden oficial dirigida expresamente a esta localidad en los datos recuperados.</p><p>Mantente atento a ES-Alert, 112 y los canales oficiales si percibes humo, ceniza o cambios rápidos.</p>';
    trust.insertAdjacentElement('afterend',action);
    const note=report.querySelector('.note');
    if(note)note.innerHTML='<b>Prioridad orientativa del panel.</b> No es un nivel oficial. Las distancias se calculan hasta puntos de referencia, no hasta perímetros. Consulta siempre la fuente oficial enlazada.';
  }

  function sourceRank(source){
    const s=normalize(source);
    if(/112|junta|gobierno|xunta|generalitat|infoca|infocam|proteccion civil|miteco|aemet/.test(s))return 0;
    if(/rtve|efe|europa press|canal extremadura/.test(s))return 1;
    if(/facebook|instagram|x com|twitter|tiktok/.test(s))return 9;
    return 3;
  }
  function enhanceNews(){
    const pane=$('#news');
    if(!pane||pane.dataset.enhancing==='1')return;
    const cards=$$('#news article.card');
    if(!cards.length||cards.every(card=>card.dataset.v45==='1'))return;
    pane.dataset.enhancing='1';
    const seen=new Set();
    cards.forEach(card=>{
      card.dataset.v45='1';
      const title=card.querySelector('h3')?.textContent||'';
      const sourceLine=card.querySelector('p')?.textContent||'';
      const key=normalize(title).replace(/\b(hoy|directo|ultima hora|mapa|incendios|espana)\b/g,'').trim().slice(0,90);
      const rank=sourceRank(sourceLine);
      card.dataset.rank=String(rank);
      if(seen.has(key)||rank===9)card.classList.add('newsHidden');else seen.add(key);
      const tag=document.createElement('span');
      tag.className='sourceTypeTag '+(rank===0?'direct':rank===1?'public':'');
      tag.textContent=rank===0?'OFICIAL':rank===1?'MEDIO PÚBLICO':'PRENSA';
      card.querySelector('.head')?.appendChild(tag);
      if(rank===0)card.classList.add('newsOfficial');
      if(rank===1)card.classList.add('newsPublic');
    });
    cards.filter(c=>!c.classList.contains('newsHidden')).sort((a,b)=>Number(a.dataset.rank)-Number(b.dataset.rank)).forEach(c=>pane.appendChild(c));
    const visible=cards.filter(c=>!c.classList.contains('newsHidden')).length;
    const count=pane.querySelector('.sectionTitle small');
    if(count)count.textContent=`${visible} depuradas`;
    queueMicrotask(()=>delete pane.dataset.enhancing);
  }

  function enhanceIncidentLabels(){
    const pane=$('#incidents');
    if(!pane)return;
    let section='';
    [...pane.children].forEach(node=>{
      if(node.classList?.contains('sectionTitle'))section=node.querySelector('h2')?.textContent||'';
      if(node.matches?.('article.card')&&!node.querySelector('.incidentOfficialLabel,.incidentPreliminaryLabel')){
        const label=document.createElement('span');
        const official=/fuente oficial directa/i.test(section);
        label.className=official?'incidentOfficialLabel':'incidentPreliminaryLabel';
        label.textContent=official?'● FUENTE OFICIAL DIRECTA':'◌ SEÑAL PRELIMINAR, NO CONFIRMADA DIRECTAMENTE';
        node.querySelector('.head > div')?.appendChild(label);
      }
    });
  }

  function bindTabs(){
    const tabs=$$('.tab[role="tab"]');
    tabs.forEach((tab,index)=>tab.addEventListener('keydown',event=>{
      let next=null;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next===null)return;
      event.preventDefault();tabs[next].focus();tabs[next].click();
    }));
    document.addEventListener('click',event=>{
      const tab=event.target.closest?.('.tab[role="tab"]');
      if(!tab)return;
      tabs.forEach(item=>item.tabIndex=item===tab?0:-1);
    });
  }

  function bindDialogFocus(){
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-incident]'))state.lastDialogTrigger=event.target.closest('[data-incident]')},true);
    $('#incidentDialog')?.addEventListener('close',()=>state.lastDialogTrigger?.focus());
  }

  function setupOffline(){
    const banner=document.createElement('div');
    banner.className='offlineBanner';
    banner.setAttribute('role','status');
    banner.textContent='Sin conexión. Se muestran los últimos datos guardados y pueden estar desactualizados.';
    document.querySelector('.top')?.insertAdjacentElement('afterend',banner);
    const update=()=>banner.classList.toggle('on',!navigator.onLine);
    addEventListener('online',update);addEventListener('offline',update);update();
  }

  function observeDynamicContent(){
    const observer=new MutationObserver(()=>{enhanceReport();enhanceNews();enhanceIncidentLabels()});
    ['localReport','news','incidents'].forEach(id=>{const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true})});
  }

  function init(){
    $('#homeBtn')?.addEventListener('click',()=>resetMap());
    $('#locateBtn')?.addEventListener('click',useLocation);
    $$('[data-mobile-view]').forEach(button=>button.addEventListener('click',()=>setMobileView(button.dataset.mobileView)));
    const saved=localStorage.getItem('fc_mobile_view_v45')||'report';setMobileView(saved);
    const form=$('#placeSearchForm'),results=$('#placeResults'),input=$('#placeQuery');
    form?.addEventListener('submit',()=>results?.setAttribute('aria-busy','true'));
    if(results)new MutationObserver(()=>results.setAttribute('aria-busy','false')).observe(results,{childList:true,subtree:true});
    input?.addEventListener('input',event=>{if(!event.target.value.trim())resetMap({clear:true})});
    input?.addEventListener('keydown',event=>{if(event.key==='Escape')setTimeout(()=>resetMap({clear:true}),0)},true);
    bindTabs();bindDialogFocus();setupOffline();observeDynamicContent();
    setTimeout(()=>{enhanceReport();enhanceNews();enhanceIncidentLabels()},800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
