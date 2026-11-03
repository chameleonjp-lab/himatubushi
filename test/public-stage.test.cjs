'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const bytes=fs.readFileSync(path.join(root,'index.html'));
const html=bytes.toString('utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'publish-manifest.json'),'utf8'));
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
test('the public candidate preserves the reviewed runtime bytes',()=>{
  assert.deepEqual(manifest.runtimeFiles,['index.html']);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.runtimeSHA256);
  assert.equal(manifest.runtimeSHA256,'93475a7b2c7bcd0288056fed22cf93094e6ee91d236a620dded8f9ef4b87eba4');
});
test('standalone editable sources match the scripts actually included in the page',()=>{
  for(const [id,file] of Object.entries(manifest.inlineSources)){
    const entries=scripts.filter(entry=>entry[1].includes('id="'+id+'"'));
    assert.equal(entries.length,1,id);
    const source=fs.readFileSync(path.join(root,file),'utf8');
    if(id==='hima-catalog')assert.deepEqual(JSON.parse(entries[0][2]),JSON.parse(source));
    else assert.equal(entries[0][2].trim(),source.trim(),id);
  }
});
test('scripts compile without executing the game or external library',()=>{
  for(const entry of scripts){
    if(/\bsrc=/.test(entry[1])||/application\/json/.test(entry[1]))continue;
    new vm.Script(entry[2]);
  }
  const sources=scripts.map(entry=>/\bsrc="([^"]+)"/.exec(entry[1])?.[1]).filter(Boolean);
  assert.deepEqual(sources,manifest.externalRuntime);
});
test('15 catalogs of 77 keys and unchanged game identity are explicit',()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'locales.json'),'utf8'));
  assert.deepEqual(Object.keys(catalog).sort(),['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'].sort());
  const keys=Object.keys(catalog.en).sort();assert.equal(keys.length,77);
  for(const locale of Object.keys(catalog))assert.deepEqual(Object.keys(catalog[locale]).sort(),keys,locale);
  assert.ok(html.includes('const GAME_SLUG="nayuta_no_himatsubushi";'));
  assert.ok(html.includes(manifest.canonicalURL));
  assert.ok(html.includes('ranking.html?game=nayuta_no_himatsubushi'));
  assert.equal(manifest.title,'暇をつぶそう');
  assert.ok(html.includes('<title>🦈暇をつぶそう🫧</title>'));
});
test('missing social image is pending, never a declared broken local asset',()=>{
  const images=[...html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/g)];
  if(images.length===0){assert.equal(manifest.thumbnail.status,'pending');assert.ok(manifest.thumbnail.reason);return;}
  for(const match of images){
    const content=/\bcontent=["']([^"']+)["']/.exec(match[0]);assert.ok(content,'declared image must have a nonempty content');
    assert.ok(!/^(?:https?:)?\/\//.test(content[1]),'remote assets need separate verified publication review');
    const target=path.resolve(root,content[1]);assert.ok(target.startsWith(root+path.sep),'image must be within the publication root');
    assert.ok(fs.statSync(target).isFile(),'declared image file must exist');
  }
});
