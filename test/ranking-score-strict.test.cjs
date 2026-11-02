'use strict';
// Built-ins and three selected declarations only; never bootstrap the game.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function declaration(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);const next=html.slice(start+9).search(/\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);assert.ok(next>=0);return html.slice(start,start+9+next);}
function row(extra={}){return {rank_no:1,display_name:'A',first_score:9,best_score:7,play_count:2,updated_at:'2026-11-02T18:48:00Z',...extra};}
function actual(rows,kind){
 const element=()=>({children:[],value:'',get textContent(){return this.value;},set textContent(v){this.value=v;this.children=[];},appendChild(child){this.children.push(child);},classList:{toggle(){}}});
 const c={onlineDisplay:{rank:'ready'},activeRankingType:kind,bestRankingRows:rows,firstRankingRows:rows,document:{createElement:element},translator:{format:String,t:(key,v={})=>key==='rankName'?`${v.rank}|${v.name}`:key==='points'?String(v.score):key}};
 for(const id of ['rankingList','rankingStatus','bestRankingTab','firstRankingTab'])c[id]=element();
 vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});new vm.Script(['formatRankingScore','formatScore','renderRanking'].map(declaration).join('\n')).runInContext(c,{timeout:100});c.renderRanking();return {rows:c.rankingList.children.map(r=>r.children.map(cell=>cell.textContent)),format:c.formatRankingScore};
}
for(const kind of ['best','first']){
 const field=kind==='best'?'best_score':'first_score';
 for(const [label,value] of [['missing',undefined],['null',null],['zero string','0'],['negative string','-700'],['positive string','42'],['fraction string','1.5'],['empty',''],['space',' '],['boolean false',false],['boolean true',true],['object',{}],['array',[]],['NaN',NaN],['infinite',Infinity],['negative infinite',-Infinity],['fraction',1.5],['above int4',2147483648],['below int4',-2147483649]]){
  test(kind+' '+label+' stays unknown despite aliases/other-tab value',()=>{
   const record=row({[field]:value,score:55,result_first_score:66,result_best_score:77});if(label==='missing')delete record[field];
   const view=actual([record],kind);assert.deepEqual(view.rows,[['1|A','—']]);assert.equal(view.format(value),'—');
  });
 }
 test(kind+' numeric zero/negative/int4 bounds remain exact with ties, same names and source order',()=>{
  const values=[0,-700,-2147483648,2147483647],records=values.map((score,i)=>row({rank_no:[1,1,3,4][i],display_name:i<2?'Same':'Row'+i,[field]:score}));
  const view=actual(records,kind);assert.deepEqual(view.rows,[['1|Same','0'],['1|Same','-700'],['3|Row2','-2147483648'],['4|Row3','2147483647']]);for(const value of values)assert.equal(view.format(value),String(value));
 });
 test(kind+' authoritative valid score is not replaced by legacy aliases',()=>{
  assert.deepEqual(actual([row({[field]:-123,score:500,result_first_score:600,result_best_score:700})],kind).rows,[['1|A','-123']]);
 });
}
