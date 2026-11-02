'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ackInline=/<script id="normal-score-ack8">\n([\s\S]*?)\n<\/script>/.exec(html);
function declaration(name){let a=html.indexOf('function '+name+'(');assert.ok(a>=0);if(html.slice(a-6,a)==='async ')a-=6;const n=html.slice(a+15).search(/\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);assert.ok(n>=0);return html.slice(a,a+15+n);}
const valid=()=>({accepted:true,result_normalized_name:'Alice',result_display_name:'Alice',result_first_score:0,result_best_score:100,result_play_count:2,is_first_play:false,is_new_best:true});
function fixture(data){
  const calls=[],receipts=[];const element=()=>({textContent:'',classList:{add(){},remove(){}}});
  const c={view:'score',playGeneration:0,rankingReadSequence:0,rankingReadPending:false,onlineDisplay:{sync:'idle',rank:'idle'},scoreSubmitted:false,scoreSubmitting:false,scoreSubmitResult:null,totalScore:100,
    playParticipation:Object.freeze({displayName:'Alice',participates:true}),GAME_SLUG:'nayuta_no_himatsubushi',CLIENT_VERSION:'himatsubushi-ranking-v1',bestRankingRows:[],firstRankingRows:[],activeRankingType:'best',
    setScoreActionsEnabled(){},paintOnlineStatus(){},updateRankingRetryControl(){},renderScoreSyncResult:(score,row)=>receipts.push({score,row}),normalizeRpcRow:data=>Array.isArray(data)?data[0]||{}:data||{},console:{error(){}},
    createSupabaseClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='submit_score'?data:[],error:null};}})};
  for(const id of ['scoreSyncCard','scoreSyncStatus','scoreSyncDetails','rankingCard','rankingStatus','rankingList'])c[id]=element();
  vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});new vm.Script((ackInline?ackInline[1]:'')+'\n'+['submitScoreAndLoadRankings','loadRankingsOnly','setRankingError'].map(declaration).join('\n')).runInContext(c,{timeout:100});return {c,calls,receipts};
}
test('actual normal8 receipt preserves legal first0 before existing read-only ranks',async()=>{
  const f=fixture([valid()]);await f.c.submitScoreAndLoadRankings();assert.equal(f.c.scoreSubmitResult.result_first_score,0);assert.equal(f.receipts.length,1);assert.equal(f.c.onlineDisplay.sync,'submitted');
  assert.deepEqual(f.calls.map(x=>x.name),['submit_score','get_best_score_ranking','get_first_try_ranking']);assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].args)),{p_display_name:'Alice',p_game_slug:'nayuta_no_himatsubushi',p_score:100,p_client_version:'himatsubushi-ranking-v1'});
});
test('actual first-play and historical signed first score remain valid',async()=>{
  for(const row of [{...valid(),result_first_score:100,result_play_count:1,is_first_play:true},{...valid(),result_first_score:-2147483648}]){const f=fixture([row]);await f.c.submitScoreAndLoadRankings();assert.equal(f.c.onlineDisplay.sync,'submitted');assert.equal(f.receipts.length,1);}
});
const invalidCases=Object.keys(valid()).map(key=>[key,()=>{const row=valid();delete row[key];return [row];}]);
invalidCases.push(['acceptedfalse',()=>[{...valid(),accepted:false}]],['wrongname',()=>[{...valid(),result_normalized_name:'Bob'}]],['bestbelowcurrent',()=>[{...valid(),result_best_score:0,is_new_best:false}]],['rowobjectnotarray',()=>valid()],['twoRows',()=>[valid(),valid()]],['invented9thfield',()=>[{...valid(),submission_id:'not-the-normal8-contract'}]]);
for(const [label,data] of invalidCases)test('actual caller rejects '+label+' without success UI, ranking continuation or automatic resend',async()=>{
  const f=fixture(data());await f.c.submitScoreAndLoadRankings();assert.equal(f.c.scoreSubmitResult,null);assert.equal(f.receipts.length,0);assert.equal(f.c.onlineDisplay.sync,'failed');assert.equal(f.c.scoreSubmitted,true);assert.equal(f.calls.length,1);assert.equal(f.c.totalScore,100);
  await f.c.submitScoreAndLoadRankings();assert.equal(f.calls.length,1);
});

test('actual inline validator is exact reviewed shared source',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','normal-score-ack8.js'),'utf8');
 assert.equal(require('node:crypto').createHash('sha256').update(source).digest('hex'),'157871e38fcc2e75184f3c44d09624aa06355afc7feebad4aa8a5cdfa04a2a16');assert.equal(ackInline[1],source);
});
test('normal8 expectation uses captured play name and score after await',async()=>{
 const f=fixture([valid()]);let release;const gate=new Promise(resolve=>{release=resolve;});
 f.c.createSupabaseClient=()=>({rpc:(name,args)=>{f.calls.push({name,args});return name==='submit_score'?gate:Promise.resolve({data:[],error:null});}});
 const pending=f.c.submitScoreAndLoadRankings();f.c.totalScore=999;f.c.playParticipation=Object.freeze({displayName:'Changed',participates:true});release({data:[valid()],error:null});await pending;
 assert.equal(f.c.onlineDisplay.sync,'submitted');assert.equal(f.receipts[0].score,100);assert.equal(f.c.scoreSubmitResult.result_display_name,'Alice');
});
