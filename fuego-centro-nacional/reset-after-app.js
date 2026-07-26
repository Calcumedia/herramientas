(()=>{
  const INITIAL_CENTER=[40.4167,-3.7033];
  const INITIAL_ZOOM=6;
  let resetSequence=0;

  function clearLocalityView(){
    const input=document.getElementById('placeQuery');
    if(!input||input.value.trim()!=='')return;

    const results=document.getElementById('placeResults');
    const report=document.getElementById('localReport');
    if(results)results.innerHTML='';
    if(report)report.innerHTML='';

    const map=window.__FC_MAP__;
    if(!map)return;

    const sequence=++resetSequence;
    const apply=()=>{
      if(sequence!==resetSequence||input.value.trim()!=='')return;
      if(typeof map.stop==='function')map.stop();
      map.setView(INITIAL_CENTER,INITIAL_ZOOM,{animate:false});
    };

    apply();
    requestAnimationFrame(apply);

    const afterPendingZoom=()=>setTimeout(apply,0);
    map.once('zoomend',afterPendingZoom);

    setTimeout(apply,300);
    setTimeout(apply,700);
  }

  function bind(){
    const input=document.getElementById('placeQuery');
    if(!input)return;

    input.addEventListener('input',clearLocalityView,true);
    input.addEventListener('search',clearLocalityView,true);
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape')setTimeout(clearLocalityView,0);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
