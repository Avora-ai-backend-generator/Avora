const {test}=require('node:test');
const assert=require('node:assert/strict');
const {projectLanguage,offsetAt}=require('../dist/languageProjection');
function fixture() {
  const start='/*__HLV1_START__|type=config|id=main__*/',field='/*__HLV1_FIELD__|type=config|id=message__*/',stop='/*__HLV1_STOP__|type=config|id=main__*/';
  const source=start+'\r\nmessage = '+field+'\r\npass\r\n'+stop;
  const code='def run():\n    message = "hello"\n    pass\n    return message\n';
  const literal=(line,column,endColumn,start,end,repeatIndex)=>({line,column,endColumn,origin:{start,end,kind:'literal',repeatIndex}});
  const map={files:{'app/test.py':[
    literal(2,4,14,source.indexOf('message = '),source.indexOf(field)),
    {line:2,column:14,endColumn:21,origin:{start:source.indexOf(field),end:source.indexOf(field)+field.length,kind:'field'}},
    literal(3,4,8,source.indexOf('pass'),source.indexOf('pass')+4),
  ]}};
  return {source,code,map,field,project(text=source){return projectLanguage(text,source,code,map,'app/test.py');}};
}
test('literal overlays keep wrappers and expanded tags while supporting unsaved multiline code and CRLF/Unicode',()=>{
  const f=fixture();assert.equal(f.project().code,f.code);
  const text=f.source.replace('pass','import httpx\r\nemoji = "🐈"\r\nhttpx.');
  const p=f.project(text),position=p.generatedPosition(text.indexOf('httpx.')+6);
  assert.deepEqual(position,{line:4,character:10});
  assert.equal(p.code,'def run():\n    message = "hello"\n    import httpx\n    emoji = "🐈"\n    httpx.\n    return message\n');
  assert.deepEqual(p.sourceRange({start:{line:4,character:4},end:position}),{start:text.indexOf('httpx.'),end:text.indexOf('httpx.')+6,repeatIndex:undefined});
  assert.equal(p.generatedPosition(text.indexOf(f.field)+12),undefined);
  assert.equal(p.sourceRange({start:{line:1,character:14},end:{line:1,character:21}}),undefined);
  assert.equal(p.sourceRange({start:{line:5,character:4},end:{line:5,character:10}}),undefined);
});
test('tag edits and changes outside prepared literals cannot reuse stale context',()=>{
  const f=fixture();assert.throws(()=>f.project(f.source.replace('id=message','id=other')),/Tags changed/);
  assert.throws(()=>f.project('# new unowned code\n'+f.source),/outside/);
  assert.throws(()=>f.project(f.source.replace('\r\nmessage','message')),/boundaries/);
});
test('all repeated copies receive the same edit, and completion offsets choose one stable copy',()=>{
  const f=fixture();f.map.files['app/test.py'].push({...f.map.files['app/test.py'][2],line:4,origin:{...f.map.files['app/test.py'][2].origin,repeatIndex:1}});
  f.map.files['app/test.py'][2].origin.repeatIndex=0;
  const p=projectLanguage(f.source.replace('pass','message.upper()'),f.source,f.code.replace('    return message','    pass\n    return message'),f.map,'app/test.py');
  assert.equal(p.code.match(/message.upper\(\)/g).length,2);
  assert.equal(p.generatedPosition(p.source.indexOf('message.upper')).line,2);
  assert.equal(p.sourceRange({start:{line:3,character:4},end:{line:3,character:11}}).repeatIndex,1);
});
test('edits spanning a generated indentation gap or a field expansion are rejected',()=>{
  const f=fixture(),p=f.project();
  assert.equal(p.sourceRange({start:{line:1,character:4},end:{line:2,character:8}}),undefined);
  assert.equal(offsetAt(p.code,{line:-1,character:0}),undefined);
});
