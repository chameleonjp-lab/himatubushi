'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function declaration(name){const a=html.indexOf('function '+name+'(');assert.ok(a>=0,name);const n=html.slice(a+9).search(/\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);assert.ok(n>=0);return html.slice(a,a+9+n);}
function row(rank,name='Same'){return {rank_no:rank,display_name:name,first_score:100,best_score:100,play_count:2,updated_at:'2026-11-02T18:48:00Z'};}
function render(rows,kind){
  const element=()=>({children:[],textContent:'',appendChild(child){this.children.push(child);},classList:{toggle(){}}});
  const c={onlineDisplay:{rank:'ready'},activeRankingType:kind,bestRankingRows:rows,firstRankingRows:rows,document:{createElement:()=>element()},translator:{format:String,t:(key,v={})=>key==='rankName'?`${v.rank}|${v.name}`:key==='points'?String(v.score):key}};
  for(const id of ['rankingList','rankingStatus','bestRankingTab','firstRankingTab'])c[id]=element();
  vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});new vm.Script(['formatRankingScore','formatScore','renderRanking'].map(declaration).join('\n')).runInContext(c,{timeout:100});c.renderRanking();return c.rankingList.children.map(node=>node.children[0].textContent);
}
for(const kind of ['best','first']){
  test(kind+' actual renderer preserves real-shaped normal RPC rank_no ties/order',()=>assert.deepEqual(render([row(1),row(1),row(3,'Third')],kind),['1|Same','1|Same','3|Third']));
  for(const [label,value] of [['missing',undefined],['null',null],['zero',0],['negative',-1],['fraction',1.5],['string','1'],['boolean',true],['nan',NaN],['infinite',Infinity],['unsafe',Number.MAX_SAFE_INTEGER+1]])test(kind+' '+label+' rank is unknown rather than an array-index substitute',()=>assert.deepEqual(render([row(value)],kind),['—|Same']));
  test(kind+' server positive rank is retained with cap30',()=>{const result=render(Array.from({length:31},(_,i)=>row(i+10,'Row'+i)),kind);assert.equal(result.length,30);assert.equal(result[29],'39|Row29');assert.deepEqual(render([row(Number.MAX_SAFE_INTEGER)],kind),[String(Number.MAX_SAFE_INTEGER)+'|Same']);});
}
