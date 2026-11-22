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
  assert.deepEqual(manifest.runtimeFiles,['index.html','social-card.jpg']);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.runtimeSHA256);
  assert.equal(manifest.runtimeSHA256,'3560f7352cb65a4d25e886b84640075c8a8add2c3b2585b6d5a04e2ffd27808a');
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
test('canonical share page declares its exact versioned publication asset for OG and X',()=>{
  const canonical='https://chameleonjp-lab.github.io/himatubushi/';
  const image=canonical+'social-card.jpg';
  assert.equal(manifest.canonicalURL,canonical);
  assert.equal(manifest.thumbnail.status,'prepared-pending-publication');
  const entries=[
    ['rel','canonical','href',canonical],
    ['property','og:url','content',canonical],
    ['property','og:image','content',image],
    ['name','twitter:image','content',image],
    ['name','twitter:card','content','summary_large_image'],
    ['property','og:image:type','content','image/jpeg'],
    ['property','og:image:width','content','1200'],
    ['property','og:image:height','content','630']
  ];
  for(const [a,k,b,v] of entries){
    assert.equal(html.split(a+'="'+k+'" '+b+'="'+v+'"').length,2,k);
  }
  assert.equal(require('../client-core.cjs').publicUrl,canonical);
  assert.ok(html.includes('const PUBLIC_URL="'+canonical+'";'));
  const imageBytes=fs.readFileSync(path.join(root,'social-card.jpg'));
  const baseline=Buffer.from([255,192,0,17,8,2,118,4,176,3]);
  assert.ok(imageBytes.includes(baseline),'1200 by 630 baseline JPEG');
  assert.equal(crypto.createHash('sha256').update(imageBytes).digest('hex'),manifest.thumbnail.sha256);
});
