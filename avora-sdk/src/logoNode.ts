import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { importLogo } from './logoImport';
import { safePath, readGenerationSource } from './generation';
import { parseProjectDocument } from './project';
import { hydrateAppearance, logoAssets } from './appearance';
import type { NodeManifest } from './index';
let initialized: Promise<void>|undefined;
export async function readLogoImport(file: string, wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm')) {
  const stat=await fs.stat(file);if (!stat.isFile()||stat.size>2_000_000) throw new Error('Choose a PNG or SVG under 2 MB.');
  return importLogo(await fs.readFile(file),async svg=>{
    await (initialized ||= fs.readFile(wasmPath).then(bytes=>initWasm(bytes)));
    const renderer=new Resvg(svg,{font:{loadSystemFonts:false}});
    try {const rendered=renderer.render();try{return rendered.asPng();}finally{rendered.free();}}finally{renderer.free();}
  });
}
export async function prepareLogoUpdate(folder: string, manifest: NodeManifest, file: string, theme: 'light'|'dark', wasmPath?: string) {
  if (theme==='dark'&&!manifest.payload.node_config.logo?.light) throw new Error('Add the default logo before its dark-theme version.');
  const imported=await readLogoImport(file,wasmPath);
  const assetPath=`assets/logo-${createHash('sha256').update(imported.bytes).digest('hex').slice(0,24)}.png`;
  const next=structuredClone(manifest);next.formatVersion=4;next.projectId ||= next.draftId;
  const config=next.payload.node_config;
  config.logo={...config.logo,[theme]:{path:assetPath}};
  if(theme==='light'&&config.colorSource!=='manual') {config.color=imported.color;config.colorSource='logo';}
  return {manifest:next,path:assetPath,bytes:imported.bytes,color:imported.color};
}
export async function addNodeLogo(folder:string,file:string,theme:'light'|'dark'='light') {
  const before=await readGenerationSource(folder,'avora.node.json');
  const parsed=parseProjectDocument(before,'manifest');
  if(parsed.diagnostics.some(d=>d.severity==='error')) throw new Error('Fix the node manifest before importing a logo.');
  const update=await prepareLogoUpdate(folder,parsed.value,file,theme);
  const target=await safePath(folder,update.path);await fs.mkdir(path.dirname(target),{recursive:true});
  try {await fs.writeFile(target,update.bytes,{flag:'wx'});}catch(error:any){if(error.code!=='EEXIST'||!Buffer.from(update.bytes).equals(await fs.readFile(target)))throw error;}
  if(await readGenerationSource(folder,'avora.node.json')!==before) throw new Error('The manifest changed during import. Retry.');
  await fs.writeFile(await safePath(folder,'avora.node.json'),JSON.stringify(update.manifest,null,2)+'\n');
  return {status:'imported',theme,path:update.path,color:update.color};
}
export async function readAppearance(folder:string,config:any) {
  const files:Record<string,string>={};
  for(const asset of logoAssets(config)) files[asset.path]=await readGenerationSource(folder,asset.path);
  return hydrateAppearance(config,files);
}
