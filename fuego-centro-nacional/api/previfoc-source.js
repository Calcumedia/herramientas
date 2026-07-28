import {inflateSync} from 'node:zlib';

export const PREVIFOC_PDF_URL='https://wpr.112cv.gva.es/external/api/storage/descargar/pdf/previfoc/previfoc.pdf';
export const PREVIFOC_VIEWER_URL='https://www.112cv.gva.es/WebPublica-MapasOnLineV2/municipiosPrevifoc.jsf';
export const INCIDENT_VIEWER_URL='https://www.112cv.gva.es/WebPublica-MapasOnLineV2/incidentes.jsf';

const SOURCE='112 Comunitat Valenciana · PREVIFOC';
const MAP_BOUNDS={minX:621376,minY:4187475,maxX:821273,maxY:4522833};
const MAX_PDF_BYTES=5_000_000;
const LEVELS={
  1:{value:1,label:'Riesgo bajo/medio',tone:'low'},
  2:{value:2,label:'Riesgo alto',tone:'high'},
  3:{value:3,label:'Riesgo extremo',tone:'extreme'}
};

function madridDate(value){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(value);
}

export function parsePdfCreationDate(buffer){
  const match=buffer.toString('latin1').match(/\/CreationDate\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:([+-])(\d{2})'?(\d{2})?)?/);
  if(!match)return null;
  const [,year,month,day,hour,minute,second,sign,offsetHour,offsetMinute]=match;
  const offset=sign&&offsetHour?`${sign}${offsetHour}:${offsetMinute||'00'}`:'';
  return {
    validFor:`${year}-${month}-${day}`,
    sourceTimestamp:`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`
  };
}

export function extractPdfImage(buffer,name='Im10'){
  if(!Buffer.isBuffer(buffer)||buffer.length>MAX_PDF_BYTES)throw Error('Documento PREVIFOC no válido');
  const text=buffer.toString('latin1');
  const markerIndex=text.indexOf(`/Name/${name}`);
  if(markerIndex<0)throw Error(`No se encuentra la imagen ${name}`);
  const objectStart=text.lastIndexOf(' obj',markerIndex);
  const streamKeyword=text.indexOf('stream',markerIndex);
  if(objectStart<0||streamKeyword<0)throw Error(`Estructura de imagen ${name} no válida`);
  const dictionary=text.slice(objectStart,streamKeyword);
  const width=Number(dictionary.match(/\/Width\s+(\d+)/)?.[1]);
  const height=Number(dictionary.match(/\/Height\s+(\d+)/)?.[1]);
  const length=Number(dictionary.match(/\/Length\s+(\d+)/)?.[1]);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1000||height>1000||!Number.isInteger(length)||length<1)throw Error(`Dimensiones de imagen ${name} no válidas`);
  let dataStart=streamKeyword+'stream'.length;
  if(text[dataStart]==='\r'&&text[dataStart+1]==='\n')dataStart+=2;
  else if(text[dataStart]==='\n'||text[dataStart]==='\r')dataStart+=1;
  if(dataStart+length>buffer.length)throw Error(`Flujo de imagen ${name} incompleto`);
  const pixels=inflateSync(buffer.subarray(dataStart,dataStart+length),{maxOutputLength:width*height*3});
  if(pixels.length!==width*height*3)throw Error(`Formato de imagen ${name} inesperado`);
  return {width,height,pixels};
}

export function latLonToUtm30(lat,lon){
  const a=6378388;
  const e2=0.006722670022333322;
  const ep2=e2/(1-e2);
  const k0=0.9996;
  const phi=lat*Math.PI/180;
  const lambda=lon*Math.PI/180;
  const lambda0=-3*Math.PI/180;
  const sin=Math.sin(phi);
  const cos=Math.cos(phi);
  const tan=Math.tan(phi);
  const n=a/Math.sqrt(1-e2*sin*sin);
  const t=tan*tan;
  const c=ep2*cos*cos;
  const aa=cos*(lambda-lambda0);
  const m=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi
    -(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*phi)
    +(15*e2**2/256+45*e2**3/1024)*Math.sin(4*phi)
    -(35*e2**3/3072)*Math.sin(6*phi));
  return {
    x:500000+k0*n*(aa+(1-t+c)*aa**3/6+(5-18*t+t**2+72*c-58*ep2)*aa**5/120),
    y:k0*(m+n*tan*(aa**2/2+(5-t+9*c+4*c**2)*aa**4/24+(61-58*t+t**2+600*c-330*ep2)*aa**6/720))
  };
}

function classifyPixel(red,green,blue){
  if(red>180&&green<105&&blue<110)return 3;
  if(red>210&&green>=105&&green<205&&blue<120)return 2;
  if(green>90&&green>red*0.8&&green>blue*1.1)return 1;
  return null;
}

export function samplePrevifocLevel(image,lat,lon,radius=5){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||!image?.pixels)return null;
  const {x,y}=latLonToUtm30(lat,lon);
  if(x<MAP_BOUNDS.minX||x>MAP_BOUNDS.maxX||y<MAP_BOUNDS.minY||y>MAP_BOUNDS.maxY)return null;
  const centerX=Math.round((x-MAP_BOUNDS.minX)/(MAP_BOUNDS.maxX-MAP_BOUNDS.minX)*(image.width-1));
  const centerY=Math.round((MAP_BOUNDS.maxY-y)/(MAP_BOUNDS.maxY-MAP_BOUNDS.minY)*(image.height-1));
  const counts=new Map();
  for(let offsetY=-radius;offsetY<=radius;offsetY++)for(let offsetX=-radius;offsetX<=radius;offsetX++){
    const pixelX=Math.max(0,Math.min(image.width-1,centerX+offsetX));
    const pixelY=Math.max(0,Math.min(image.height-1,centerY+offsetY));
    const index=(pixelY*image.width+pixelX)*3;
    const level=classifyPixel(image.pixels[index],image.pixels[index+1],image.pixels[index+2]);
    if(level)counts.set(level,(counts.get(level)||0)+1);
  }
  const winner=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  return winner?{...LEVELS[winner]}:null;
}

export async function fetchPrevifoc({lat,lon,fetchImpl=fetch,now=new Date(),timeoutMs=10_000}={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(PREVIFOC_PDF_URL,{
      headers:{accept:'application/pdf','user-agent':'FuegoCerca/4.14'},
      cache:'no-store',
      signal:controller.signal
    });
    if(!response.ok)throw Error(`PREVIFOC HTTP ${response.status}`);
    const contentType=response.headers.get('content-type')||'';
    if(contentType&&!contentType.includes('pdf')&&!contentType.includes('octet-stream'))throw Error('PREVIFOC no ha devuelto un PDF');
    const buffer=Buffer.from(await response.arrayBuffer());
    if(!buffer.length||buffer.length>MAX_PDF_BYTES)throw Error('Tamaño del PDF PREVIFOC no válido');
    const metadata=parsePdfCreationDate(buffer);
    if(!metadata)throw Error('El PDF PREVIFOC no indica una fecha verificable');
    const current=metadata.validFor===madridDate(now);
    const image=extractPdfImage(buffer);
    const sampled=current?samplePrevifocLevel(image,lat,lon):null;
    const applicable=Boolean(sampled)||(()=>{
      const point=latLonToUtm30(lat,lon);
      return point.x>=MAP_BOUNDS.minX&&point.x<=MAP_BOUNDS.maxX&&point.y>=MAP_BOUNDS.minY&&point.y<=MAP_BOUNDS.maxY;
    })();
    return {
      ok:true,
      official:true,
      source:SOURCE,
      sourceMode:'PDF oficial diario',
      validFor:metadata.validFor,
      sourceTimestamp:metadata.sourceTimestamp,
      current,
      applicable,
      degraded:!current||!sampled,
      level:sampled,
      pdfUrl:PREVIFOC_PDF_URL,
      viewerUrl:PREVIFOC_VIEWER_URL,
      incidentViewerUrl:INCIDENT_VIEWER_URL,
      method:'Muestreo aproximado del mapa oficial PREVIFOC',
      approximateResolutionKm:0.72,
      retrievedAt:new Date().toISOString(),
      validityNote:current
        ?'Nivel preventivo oficial válido para hoy. No confirma que exista un incendio.'
        :`El último documento recuperado corresponde al ${metadata.validFor}; no se utiliza para asignar un nivel actual.`,
      incidentCoverageNote:'El visor de incidentes 112CV publica un subconjunto de incidentes relevantes en curso con localización aproximada. FuegoCerca lo enlaza, pero no lo usa como un feed completo para confirmar incendios activos.'
    };
  }finally{
    clearTimeout(timeout);
  }
}
