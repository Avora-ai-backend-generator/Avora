import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { decode, encode } from 'fast-png';
import { dominantColor, LOGO_MAX_BYTES, LOGO_SIZE } from './appearance';

const SVG_TAGS = new Set(['svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon','linearGradient','radialGradient','stop','clipPath','mask','title','desc']);
const SVG_ATTRS = new Set(['xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity','transform','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','fx','fy','fr','clip-path','clip-rule','clipPathUnits','mask','maskUnits','maskContentUnits','preserveAspectRatio','version']);
/** Import a deliberately static SVG subset; no CSS, links, fonts, images, or active content. */
export function staticSvg(source: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG declarations and entities are unsupported. Export a plain SVG with outlined text.');
  const doc = new DOMParser({ onError: (_level, message) => { throw new Error(`Invalid SVG: ${message}`); } }).parseFromString(source, 'image/svg+xml');
  const root=doc.documentElement;
  if (!root || root.tagName!=='svg' || root.namespaceURI!=='http://www.w3.org/2000/svg') throw new Error('Choose a PNG or a plain SVG.');
  let count=0;
  function visit(node: any, depth=0) {
    if (++count>5000 || depth>64) throw new Error('SVG is too complex.');
    if (node.nodeType===1) {
      if (!SVG_TAGS.has(node.tagName)) throw new Error(`Unsupported SVG element ${node.tagName}. Export a plain SVG with outlined text, or use PNG.`);
      for (const attr of Array.from(node.attributes) as any[]) {
        if (!SVG_ATTRS.has(attr.name) || /[<>\\]/.test(attr.value) || (/(?:url\s*\(|:|@)/i.test(attr.value) && !(attr.name==='xmlns' && attr.value==='http://www.w3.org/2000/svg') && !/^url\(#[a-zA-Z0-9_-]+\)$/.test(attr.value))) throw new Error(`Unsupported SVG attribute: ${attr.name}. Use a plain SVG or PNG.`);
      }
    } else if (![3,8].includes(node.nodeType)) throw new Error('Unsupported SVG content.');
    for (const child of Array.from(node.childNodes || [])) visit(child,depth+1);
  }
  visit(root);
  // A bounded square viewport fits the source artwork without stretching it.
  if (!root.getAttribute('viewBox')) {
    const w=Number(root.getAttribute('width')),h=Number(root.getAttribute('height'));
    if (!(w>0 && h>0 && w<=4096 && h<=4096)) throw new Error('SVG needs a valid viewBox.');
    root.setAttribute('viewBox',`0 0 ${w} ${h}`);
  }
  const box=root.getAttribute('viewBox')!.trim().split(/[\s,]+/).map(Number);
  if (box.length!==4 || !box.every(Number.isFinite) || box[2]<=0 || box[3]<=0 || box.some(v=>Math.abs(v)>1e7)) throw new Error('Invalid SVG viewBox.');
  root.setAttribute('width',String(LOGO_SIZE));root.setAttribute('height',String(LOGO_SIZE));root.setAttribute('preserveAspectRatio','xMidYMid meet');
  return new XMLSerializer().serializeToString(root);
}
export function pngRgba(bytes: Uint8Array) {
  if (bytes.length>LOGO_MAX_BYTES*8 || bytes.length<24 || ![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) throw new Error('Invalid or oversized PNG.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const w=view.getUint32(16),h=view.getUint32(20);
  if (!w||!h||w>2048||h>2048) throw new Error('PNG dimensions must be 1–2048 pixels per side. Recommended: 256×256.');
  // Animated PNG is intentionally excluded.
  for (let i=8;i+12<=bytes.length;) { const length=view.getUint32(i); if (String.fromCharCode(...bytes.slice(i+4,i+8))==='acTL') throw new Error('Animated logos are unsupported.'); i+=length+12; }
  const decoded=decode(bytes,{checkCrc:true});
  if (decoded.depth!==8) throw new Error('Use an 8-bit RGB/RGBA PNG.');
  const rgba=new Uint8Array(w*h*4);
  for(let i=0;i<w*h;i++) {
    const p=i*decoded.channels;const d=decoded.data;
    if(decoded.palette){const c=decoded.palette[d[p]];if(!c)throw new Error('Invalid PNG palette index.');rgba.set([c[0],c[1],c[2],c[3]??255],i*4);continue;}
    if(decoded.transparency && Array.from(decoded.transparency).every((v,j)=>v===d[p+j])){rgba.set([0,0,0,0],i*4);continue;}
    rgba.set(decoded.channels<=2?[d[p],d[p],d[p],decoded.channels===2?d[p+1]:255]:[d[p],d[p+1],d[p+2],decoded.channels===4?d[p+3]:255],i*4);
  }
  return {width:w,height:h,rgba};
}
export async function importLogo(bytes: Uint8Array, rasterize: (svg:string)=>Promise<Uint8Array>) {
  if (bytes.length>LOGO_MAX_BYTES*8) throw new Error('Logo input must be under 2 MB.');
  const png=bytes[0]===137?bytes:await rasterize(staticSvg(new TextDecoder().decode(bytes)));
  const decoded=pngRgba(png);
  const rgba=new Uint8Array(LOGO_SIZE*LOGO_SIZE*4);
  const scale=Math.min(LOGO_SIZE/decoded.width,LOGO_SIZE/decoded.height);
  const w=Math.max(1,Math.round(decoded.width*scale)),h=Math.max(1,Math.round(decoded.height*scale));
  const ox=Math.floor((LOGO_SIZE-w)/2),oy=Math.floor((LOGO_SIZE-h)/2);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const from=(Math.min(decoded.height-1,Math.floor(y/scale))*decoded.width+Math.min(decoded.width-1,Math.floor(x/scale)))*4;
    rgba.set(decoded.rgba.subarray(from,from+4),((y+oy)*LOGO_SIZE+x+ox)*4);
  }
  const output=encode({width:LOGO_SIZE,height:LOGO_SIZE,data:rgba,channels:4,depth:8});
  if (output.length>LOGO_MAX_BYTES) throw new Error('Logo is too detailed. Use a simpler image under 256 KB.');
  return {bytes:output,color:dominantColor(rgba)};
}
