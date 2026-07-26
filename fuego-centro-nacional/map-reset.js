(()=>{
  const INITIAL_CENTER=[40.4167,-3.7033];
  const INITIAL_ZOOM=6;

  function resetMapToInitialView(){
    const map=window.__FC_MAP__;
    if(!map)return;
    map.setView(INITIAL_CENTER,INITIAL_ZOOM,{animate:true});
  }

  function clearSearchPanels(){
    const results=document.getElementById('placeResults');
    if(results)results.innerHTML='';
  }

  document.addEventListener('input',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='placeQuery')return;
    if(input.value.trim()!=='')return;
    clearSearchPanels();
    resetMapToInitialView();
  });

  document.addEventListener('keydown',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='placeQuery'||event.key!=='Escape')return;
    setTimeout(()=>{
      clearSearchPanels();
      resetMapToInitialView();
    },0);
  },true);
})();
