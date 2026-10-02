const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {encode}=require('fast-png');
const {dominantColor,assembleDraft,materializeDraft,createLocalProject,manifestIssues}=require('../dist');
const {staticSvg,importLogo,pngRgba}=require('../dist/logoImport');
const {readLogoImport}=require('../dist/logoNode');
const {readGenerationSnapshot}=require('../dist/generation');
const png=(w,h,color)=>encode({width:w,height:h,channels:4,data:Uint8Array.from(Array(w*h).fill(color).flat())});
test('visible majority ignores transparent padding, including invisible black RGB',()=>{
  assert.equal(dominantColor(Uint8Array.from([0,0,0,0, 0,0,0,0, 238,51,0,255, 238,51,0,255, 0,0,255,255])),'#ee3300');
  assert.throws(()=>dominantColor(new Uint8Array(16)),/transparent/);
});
test('PNG import fits rectangular art, preserves alpha and detects corrupted images',async()=>{
  const result=await importLogo(png(2,1,[238,51,0,255]),()=>assert.fail());
  const image=pngRgba(result.bytes);
  assert.deepEqual([image.width,image.height],[256,256]);assert.equal(result.color,'#ee3300');
  assert.equal(image.rgba[3],0);assert.equal(image.rgba[(128*256+128)*4+3],255);
  const corrupt=Uint8Array.from(result.bytes);corrupt[45]^=255;
  assert.throws(()=>pngRgba(corrupt));
  await assert.rejects(importLogo(png(1,1,[0,0,0,0]),()=>assert.fail()),/transparent/);
});
test('SVG import is static and self-contained and uses actual rendered pixel color',async t=>{
  for(const body of ['<script>alert(1)</script>','<image href="file:///etc/passwd"/>','<foreignObject/>','<style>path{fill:red}</style>','<path onclick="bad()"/>','<path fill="url(https://x)"/>','<text>Hello</text>'])assert.throws(()=>staticSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">${body}</svg>`));
  assert.throws(()=>staticSvg('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>'));
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'avora-logo-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));
  const file=path.join(folder,'logo.svg');await fs.writeFile(file,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ee3300"/><rect width="20" height="20" fill="#0000ff"/></svg>');
  assert.equal((await readLogoImport(file)).color,'#ee3300');
});
test('local binary assets survive draft round trips without inline data or loss of metadata',async()=>{
  const project=createLocalProject('Branded','brand');const m=project.manifest;m.formatVersion=4;m.extra={keep:true};
  const data=Buffer.from((await importLogo(png(1,1,[238,51,0,255]),()=>assert.fail())).bytes).toString('base64');
  m.payload.node_config.logo={light:{path:'assets/logo-one.png'},dark:{path:'assets/logo-two.png'}};
  m.payload.node_config.color='#ee3300';m.payload.node_config.colorSource='logo';
  const files={...project.files,'assets/logo-one.png':data,'assets/logo-two.png':data};
  assert.deepEqual(manifestIssues(m),[]);
  const payload=assembleDraft(m,files);const restored=materializeDraft({draft_id:'a'.repeat(32),revision:4,payload});
  assert.equal(restored.manifest.formatVersion,4);assert.equal(restored.manifest.payload.node_config.logo.light.data,undefined);
  assert.equal(restored.files['assets/logo-one.png'],data);assert.deepEqual(assembleDraft(restored.manifest,restored.files),payload);
  assert.throws(()=>assembleDraft(m,project.files),/Missing or invalid/);
  m.payload.node_config.logo.light.path='../secret.png';assert.ok(manifestIssues(m).length);
});
test('branding changes do not invalidate generation or transmit image bytes',async t=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'avora-logo-cache-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));
  const project=createLocalProject('Branded','brand');const manifest=project.manifest;
  for(const [file,text] of Object.entries(project.files)){await fs.mkdir(path.dirname(path.join(folder,file)),{recursive:true});await fs.writeFile(path.join(folder,file),text);}
  const file=path.join(folder,'avora.node.json');await fs.writeFile(file,JSON.stringify(manifest));const before=await readGenerationSnapshot(folder);
  manifest.formatVersion=4;manifest.payload.node_config.color='#ff0000';manifest.payload.node_config.colorSource='manual';manifest.payload.node_config.logo={light:{path:'assets/logo-new.png'}};
  await fs.writeFile(file,JSON.stringify(manifest));const after=await readGenerationSnapshot(folder);
  assert.equal(before.sourceHash,after.sourceHash);assert.doesNotMatch(JSON.stringify(after.request),/logo-new|ff0000|colorSource/);
});
