(()=>{
  const INITIAL_CENTER=[40.4167,-3.7033];
  const INITIAL_ZOOM=6;

  function clearLocalityView(){
    const input=document.getElementById('placeQuery');
    if(!input||input.value.trim()!=='')return;

    const results=document.getElementById('placeResults');
    const report=document.getElementById('localReport');
    if(results)results.innerHTML='';
    if(report)report.innerHTML='';

    const map=window.__FC_MAP__;
    if(!map)return;

    const apply=()=>{
      if(typeof map.stop==='function')map.stop();
      map.setView(INITIAL_CENTER,INITIAL_ZOOM,{animate:false});
    };

    apply();
    requestAnimationFrame(apply);
    setTimeout(apply,80);
  }

  window.addEventListener('load',()=>{
    const input=document.getElementById('placeQuery');
    if(!input)return;

    input.addEventListener('input',clearLocalityView,true);
    input.addEventListener('search',clearLocalityView,true);
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape')setTimeout(clearLocalityView,0);
    },true);
  });
})();
