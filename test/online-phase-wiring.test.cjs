'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ackInline=/<script id="normal-score-ack8">\n([\s\S]*?)\n<\/script>/.exec(html);
assert.ok(ackInline);
function validReceipt(){return [{accepted:true,result_normalized_name:'Alice',result_display_name:'Alice',result_first_score:100,result_best_score:100,result_play_count:1,is_first_play:true,is_new_best:true}];}
function declaration(name){let a=html.indexOf('function '+name+'(');assert.ok(a>=0);if(html.slice(a-6,a)==='async ')a-=6;const n=html.slice(a+15).search(/\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);assert.ok(n>=0);return html.slice(a,a+15+n);}
function fixture(named=true){
  const calls=[],paints=[];const element=()=>({textContent:'',classList:{add(){},remove(){}}});
  const c={onlineDisplay:{sync:'idle',rank:'idle'},rankingReadSequence:0,rankingReadPending:false,updateRankingRetryControl(){},scoreSubmitted:false,scoreSubmitting:false,scoreSubmitResult:null,totalScore:100,playGeneration:0,
    playParticipation:Object.freeze({displayName:named?'Alice':'',participates:named}),GAME_SLUG:'nayuta_no_himatsubushi',CLIENT_VERSION:'himatsubushi-ranking-v1',
    bestRankingRows:[],firstRankingRows:[],activeRankingType:'best',setScoreActionsEnabled(){},renderScoreSyncResult(){},renderRanking(){},
    paintOnlineStatus:()=>paints.push({...c.onlineDisplay}),normalizeRpcRow:data=>data,console:{error(){}},
    createSupabaseClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='submit_score'?validReceipt():[],error:null};}})};
  for(const name of ['scoreSyncCard','scoreSyncStatus','scoreSyncDetails','rankingCard','rankingStatus','rankingList'])c[name]=element();
  vm.createContext(c,{codeGeneration:{strings:false,wasm:false}});new vm.Script(ackInline[1]+'\n'+['resetRankingState','setRankingError','submitScoreAndLoadRankings','loadRankingsOnly'].map(declaration).join('\n')).runInContext(c,{timeout:100});return {c,calls,paints};
}
test('actual named flow stores sending/loading then ready display phases, existing payload unchanged',async()=>{
  const {c,calls,paints}=fixture();await c.submitScoreAndLoadRankings();assert.ok(paints.some(x=>x.sync==='sending'&&x.rank==='loading'));
  assert.equal(c.onlineDisplay.sync,'submitted');assert.equal(c.onlineDisplay.rank,'ready');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{name:'submit_score',args:{p_display_name:'Alice',p_game_slug:'nayuta_no_himatsubushi',p_score:100,p_client_version:'himatsubushi-ranking-v1'}});
});
test('actual anonymous flow never writes and remains anonymous after read completion',async()=>{
  const {c,calls}=fixture(false);await c.submitScoreAndLoadRankings();assert.equal(calls.filter(x=>x.name==='submit_score').length,0);assert.equal(c.onlineDisplay.sync,'anonymous');assert.equal(c.onlineDisplay.rank,'ready');
});
test('actual failure keeps explicit failed phases, reset returns idle',async()=>{
  const {c}=fixture();c.createSupabaseClient=()=>({rpc:async()=>{throw new Error('controlled failure');}});await c.submitScoreAndLoadRankings();assert.equal(c.onlineDisplay.sync,'failed');assert.equal(c.onlineDisplay.rank,'failed');
  c.resetRankingState();assert.equal(c.onlineDisplay.sync,'idle');assert.equal(c.onlineDisplay.rank,'idle');
});
for(const stage of ['submit_score','get_best_score_ranking','get_first_try_ranking'])for(const reject of [false,true])test('stale '+stage+' '+(reject?'rejection':'success')+' never replaces new display phase',async()=>{
  const {c}=fixture();let release,fail,reached=false;const gate=new Promise((resolve,reject)=>{release=resolve;fail=reject;});
  c.createSupabaseClient=()=>({rpc:(name)=>{if(name===stage){reached=true;return gate;}return Promise.resolve({data:name==='submit_score'?validReceipt():[],error:null});}});
  const pending=c.submitScoreAndLoadRankings();for(let i=0;i<8&&!reached;i++)await Promise.resolve();assert.equal(reached,true);
  c.playGeneration++;const marker={sync:'idle',rank:'idle'};c.onlineDisplay=marker;
  if(reject)fail(new Error('old controlled failure'));else release({data:stage==='submit_score'?validReceipt():[],error:null});await pending;assert.equal(c.onlineDisplay,marker);assert.deepEqual(c.onlineDisplay,{sync:'idle',rank:'idle'});
});
