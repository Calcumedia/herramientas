export const config={runtime:'edge'};

const UPSTREAM='https://fuego-centro-panel.vercel.app';

const DIRECTORY=[
  ['Andalucía',['Andalucía','Andalucia'],'viewer','Agencia de Emergencias de Andalucía · INFOCA','https://www.juntadeandalucia.es/organismos/ema/areas/incendios-forestales/situacion/incendios-activos.html','Visor oficial en tiempo real identificado; sus registros todavía no alimentan directamente el cálculo local.'],
  ['Aragón',['Aragón','Aragon'],'reference','Gobierno de Aragón · INFOAR','https://www.aragon.es/temas/medio-ambiente/gestion-forestal/incendios-forestales','Portal oficial de prevención, operativo y publicaciones; sin feed operativo integrado.'],
  ['Principado de Asturias',['Asturias','Principado de Asturias'],'updates','112 Asturias · SEPA','https://www.112asturias.es/','Actualizaciones oficiales identificadas; todavía no se convierten automáticamente en incidentes georreferenciados.'],
  ['Illes Balears',['Illes Balears','Islas Baleares','Baleares'],'reference','112 Illes Balears · INFOBAL','https://www.caib.es/sites/112/es/portada-8673/','Portal oficial de emergencias y planificación; sin feed operativo integrado.'],
  ['Canarias',['Canarias','Islas Canarias'],'updates','112 Canarias · INFOCA','https://www.112canarias.com/112/','Alertas y actualizaciones oficiales identificadas; sin feed de incidentes integrado.'],
  ['Cantabria',['Cantabria'],'limited','Cobertura agregada',null,'Pendiente de incorporar una fuente oficial autonómica operativa verificable.'],
  ['Castilla-La Mancha',['Castilla-La Mancha','Castilla La Mancha'],'viewer','Portal INFOCAM','https://infocam.castillalamancha.es/mapa-de-incendios-forestales','Mapa oficial de incendios identificado; todavía no alimenta directamente el cálculo local.'],
  ['Castilla y León',['Castilla y León','Castilla y Leon'],'integrated','Junta de Castilla y León','https://analisis.datosabiertos.jcyl.es/explore/dataset/incendios-forestales/','Datos oficiales directos integrados y evaluados automáticamente.'],
  ['Cataluña',['Cataluña','Catalunya'],'viewer','Bombers de la Generalitat · mapa de actuaciones','https://interior.gencat.cat/ca/incendis-forestals/inici/','Visor oficial en tiempo real identificado; sus actuaciones todavía no alimentan directamente el cálculo.'],
  ['Comunitat Valenciana',['Comunitat Valenciana','Comunidad Valenciana','Valenciana'],'viewer','112 Comunitat Valenciana','https://www.112cv.gva.es/WebPublica-MapasOnLineV2/','Visor oficial de incidentes y emergencias identificado; pendiente de integración directa.'],
  ['Extremadura',['Extremadura'],'updates','Junta de Extremadura · INFOCAEX/INFOEX','https://www.juntaex.es/w/infocaex','Actualizaciones y plan oficial identificados; sin feed operativo integrado.'],
  ['Galicia',['Galicia'],'updates','Xunta de Galicia · Medio Rural','https://mediorural.xunta.gal/es/recursos/noticias','Partes oficiales periódicos identificados; pendiente de extracción estructurada automática.'],
  ['Comunidad de Madrid',['Comunidad de Madrid','Madrid'],'integrated','ASEM 112 Madrid','https://www.comunidad.madrid/seguridad-emergencias-asem-112','Avisos oficiales directos integrados y aplicados a localidades expresamente afectadas.'],
  ['Región de Murcia',['Región de Murcia','Region de Murcia','Murcia'],'updates','112 Región de Murcia · INFOMUR','https://noticias.112rmurcia.es/','Actualizaciones oficiales identificadas; todavía no alimentan directamente el cálculo local.'],
  ['Comunidad Foral de Navarra',['Comunidad Foral de Navarra','Navarra'],'reference','SOS Navarra 112','https://www.navarra.es/es/seguridad-y-emergencias/emergencias-112','Portal oficial de emergencias y prevención; sin feed operativo integrado.'],
  ['País Vasco',['País Vasco','Pais Vasco','Euskadi'],'updates','112 SOS Deiak','https://www.euskadi.eus/gobierno-vasco/emergencias-112/','Actualizaciones oficiales identificadas; sin feed autonómico directo integrado.'],
  ['La Rioja',['La Rioja'],'updates','SOS Rioja 112','https://www.larioja.org/emergencias-112/es','Noticias oficiales de emergencias identificadas; sin feed operativo integrado.'],
  ['Ceuta',['Ceuta'],'reference','112 Ciudad Autónoma de Ceuta','https://www.ceuta.es/112/paginas/como.html','Servicio oficial de emergencias enlazado; sin feed de incendios integrado.'],
  ['Melilla',['Melilla'],'reference','112 Ciudad Autónoma de Melilla','https://www.melilla.es/','Servicio oficial de emergencias enlazado; sin feed de incendios integrado.']
].map(([region,aliases,mode,sourceLabel,sourceUrl,description])=>({region,aliases,mode,sourceLabel,sourceUrl,description}));

export default async function handler(request){
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'public, s-maxage=60, stale-while-revalidate=180',
    'access-control-allow-origin':'*'
  };
  try{
    const url=new URL('/api/situation',UPSTREAM);
    url.search=new URL(request.url).search;
    const response=await fetch(url,{cache:'no-store',headers:{accept:'application/json'}});
    if(!response.ok)throw Error(`Upstream HTTP ${response.status}`);
    const data=await response.json();
    const upstreamCoverage=new Map((data.regionalCoverage||[]).map(x=>[x.region,x]));
    data.version='4.4.9';
    data.dataEngineVersion='4.3.1';
    data.regionalCoverage=DIRECTORY.map(item=>{
      const old=upstreamCoverage.get(item.region);
      return {
        ...item,
        ok:item.mode==='integrated'&&Boolean(old?.ok),
        publishedAt:old?.publishedAt||null,
        lastSuccessAt:old?.lastSuccessAt||null
      };
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
    return new Response(JSON.stringify({
      version:'4.4.9',
      degraded:true,
      error:String(error.message||error),
      regionalCoverage:DIRECTORY,
      incidents:[],
      archive:[],
      alerts:[],
      thermalSignals:[],
      news:[],
      coverage:[]
    }),{status:503,headers});
  }
}
