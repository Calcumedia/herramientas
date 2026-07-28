import {request as httpsRequest} from 'node:https';
import {FNMT_CHAIN} from './fnmt-ca.js';

export const config={runtime:'nodejs',maxDuration:20};

const ICA_CSV='https://ica.miteco.es/datos/ica-ultima-hora.csv';
const ICA_VIEWER='https://ica.miteco.es/';
const ICA_DICTIONARY='https://ica.miteco.es/datos/DICCIONARIO_DE_DATOS.txt';
const ICA_LICENSE='https://creativecommons.org/licenses/by/4.0/';
const FETCH_TIMEOUT_MS=9000;
const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=300, stale-while-revalidate=1800',
  'access-control-allow-origin':'*'
};
const CATEGORIES={
  1:{key:'good',label:'Buena'},
  2:{key:'reasonably-good',label:'Razonablemente buena'},
  3:{key:'regular',label:'Regular'},
  4:{key:'unfavourable',label:'Desfavorable'},
  5:{key:'very-unfavourable',label:'Muy desfavorable'},
  6:{key:'extremely-unfavourable',label:'Extremadamente desfavorable'}
};

function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=27&&lat<=44.5&&lon>=-19&&lon<=5.5;
}

function distanceKm(lat1,lon1,lat2,lon2){
  const toRad=value=>value*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function parseCsv(text){
  const rows=[];
  let row=[],field='',quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(char==='"'&&quoted&&text[index+1]==='"'){field+='"';index++;continue}
    if(char==='"'){quoted=!quoted;continue}
    if(char===','&&!quoted){row.push(field);field='';continue}
    if((char==='\n'||char==='\r')&&!quoted){
      if(char==='\r'&&text[index+1]==='\n')index++;
      row.push(field);field='';
      if(row.some(value=>value!==''))rows.push(row);
      row=[];
      continue;
    }
    field+=char;
  }
  if(field||row.length){row.push(field);rows.push(row)}
  return rows;
}

function categoryFor(rawIndex){
  const partial=rawIndex>=10;
  const value=partial?rawIndex/10:rawIndex;
  const category=CATEGORIES[value]||null;
  return category?{...category,value,partial}:null;
}

function utcTimestamp(value){
  if(!value)return null;
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?value:`${value}Z`;
}

function normalize(row,origin){
  const [code,name,type,latitude,longitude,active,measuredAt,indexValue,dueTo]=row;
  const lat=Number(latitude),lon=Number(longitude),rawIndex=Number(indexValue);
  const category=categoryFor(rawIndex);
  if(active!=='true'||!validCoordinates(lat,lon)||!category)return null;
  return {
    code,
    name:name||'Estación sin nombre',
    stationType:type||'SIN CLASIFICAR',
    lat,
    lon,
    distanceKm:distanceKm(origin.lat,origin.lon,lat,lon),
    measuredAt:utcTimestamp(measuredAt),
    index:category.value,
    indexRaw:rawIndex,
    categoryKey:category.key,
    categoryLabel:category.label,
    limitedPollutants:category.partial,
    dueTo:String(dueTo||'').split(',').map(value=>value.trim()).filter(Boolean)
  };
}

function parseStations(text,origin,radius){
  const rows=parseCsv(text);
  if(rows.length<2)throw Error('CSV ICA vacío');
  const header=rows.shift().map(value=>value.trim().toLowerCase());
  if(header[0]!=='cod_estacion'||!header.includes('indice'))throw Error('Formato ICA inesperado');
  return rows.map(row=>normalize(row,origin)).filter(Boolean).filter(station=>station.distanceKm<=radius).sort((a,b)=>a.distanceKm-b.distanceKm);
}

function downloadWithFnmtChain(signal){
  return new Promise((resolve,reject)=>{
    const request=httpsRequest(ICA_CSV,{
      ca:FNMT_CHAIN,
      headers:{
        accept:'text/csv,text/plain;q=0.9,*/*;q=0.1',
        'user-agent':'FuegoCerca/4.10 (+https://fuego-centro-nacional.vercel.app)'
      }
    },response=>{
      if(response.statusCode!==200){
        response.resume();
        reject(Error(`MITECO ICA HTTP ${response.statusCode}`));
        return;
      }
      let body='';
      response.setEncoding('utf8');
      response.on('data',chunk=>{
        body+=chunk;
        if(body.length>5*1024*1024)request.destroy(Error('CSV ICA demasiado grande'));
      });
      response.on('end',()=>resolve(body));
    });
    request.on('error',reject);
    signal?.addEventListener('abort',()=>request.destroy(Error('MITECO ICA timeout')),{once:true});
    request.end();
  });
}

async function downloadCsv(signal){
  try{
    const response=await fetch(ICA_CSV,{
      headers:{
        accept:'text/csv,text/plain;q=0.9,*/*;q=0.1',
        'user-agent':'FuegoCerca/4.10 (+https://fuego-centro-nacional.vercel.app)'
      },
      cache:'force-cache',
      signal
    });
    if(!response.ok)throw Error(`MITECO ICA HTTP ${response.status}`);
    return await response.text();
  }catch(error){
    if(error?.cause?.code!=='UNABLE_TO_VERIFY_LEAF_SIGNATURE')throw error;
    return downloadWithFnmtChain(signal);
  }
}

export function __parseIcaForTests(text,origin,radius=100){
  return parseStations(text,origin,radius);
}

async function createResponse(request){
  const url=new URL(request.url,'https://fuegocerca.local');
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
  const radius=Math.min(150,Math.max(10,Number(url.searchParams.get('radius'))||100));
  if(!validCoordinates(lat,lon)){
    return new Response(JSON.stringify({error:'Coordenadas no válidas para España'}),{status:400,headers:HEADERS});
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const stations=parseStations(await downloadCsv(controller.signal),{lat,lon},radius);
    return new Response(JSON.stringify({
      version:'4.11.0',
      source:'MITECO · Índice Nacional de Calidad del Aire',
      officialPublisher:'Ministerio para la Transición Ecológica y el Reto Demográfico',
      sourceUrl:ICA_CSV,
      viewerUrl:ICA_VIEWER,
      dictionaryUrl:ICA_DICTIONARY,
      licenseUrl:ICA_LICENSE,
      officialDataset:true,
      provisional:true,
      validated:false,
      radiusKm:radius,
      retrievedAt:new Date().toISOString(),
      nearbyCount:stations.length,
      nearest:stations[0]||null,
      stations:stations.slice(0,5),
      coverageNote:'Datos horarios provisionales y no validados comunicados por las redes de vigilancia. La estación puede estar alejada y no representa exactamente el aire de la localidad.',
      fireRelationshipNote:'El ICA mide contaminación atmosférica. FuegoCerca no atribuye su resultado al humo de un incendio sin una confirmación específica de la autoridad.'
    }),{status:200,headers:HEADERS});
  }catch(error){
    return new Response(JSON.stringify({
      version:'4.11.0',
      source:'MITECO · Índice Nacional de Calidad del Aire',
      degraded:true,
      radiusKm:radius,
      retrievedAt:new Date().toISOString(),
      nearest:null,
      stations:[],
      viewerUrl:ICA_VIEWER,
      message:String(error.message||error),
      coverageNote:'No se ha podido consultar el índice nacional. La ausencia de datos no significa que la calidad del aire sea buena.'
    }),{status:503,headers:HEADERS});
  }finally{
    clearTimeout(timeout);
  }
}

export default async function handler(request,response){
  const webResponse=await createResponse(request);
  if(!response)return webResponse;
  response.statusCode=webResponse.status;
  webResponse.headers.forEach((value,key)=>response.setHeader(key,value));
  response.end(await webResponse.text());
}
