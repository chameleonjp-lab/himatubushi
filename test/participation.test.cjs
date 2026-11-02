'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const HimaClient=require('../client-core.cjs');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ackInline=/<script id="normal-score-ack8">\n([\s\S]*?)\n<\/script>/.exec(html);
assert.ok(ackInline);
function validReceipt(){return [{accepted:true,result_normalized_name:'Bob',result_display_name:'Bob',result_first_score:-50,result_best_score:-50,result_play_count:1,is_first_play:true,is_new_best:true}];}
function declaration(name){
  let start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);
  if(html.slice(start-6,start)==='async ')start-=6;
  const next=html.slice(start+15).search(/\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);assert.ok(next>=0);
  return html.slice(start,start+15+next);
}
function fixture(){
  const calls=[],saved=[],started=[],states=[],actions=[];
  const classList={add(){},remove(){},toggle(){}};
  const element=()=>({textContent:'',classList});
  const context={unlockSound(){},HimaClient,currentPlayerName:'',startRequested:false,playParticipation:HimaClient.captureParticipation(''),
    playerNameInput:{value:'',focus(){},blur(){}},playerNameError:element(),
    getSavedPlayerName:()=> 'Saved Alice',savePlayerName:value=>saved.push(value),
    startNewGame:()=>started.push('direct'),startNewGameAfterNameInput:()=>started.push('blur-delay'),
    showScreen:name=>states.push(name),window:{setTimeout(){}},
    scoreSubmitted:false,scoreSubmitting:false,scoreSubmitResult:null,totalScore:-50,playGeneration:0,
    onlineDisplay:{sync:'idle',rank:'idle'},paintOnlineStatus(){},rankingReadSequence:0,rankingReadPending:false,updateRankingRetryControl(){},rankingList:{textContent:''},
    bestRankingRows:[],firstRankingRows:[],activeRankingType:'best',view:'score',gameState:'ended',
    GAME_SLUG:'nayuta_no_himatsubushi',CLIENT_VERSION:'himatsubushi-ranking-v1',
    scoreSyncCard:element(),scoreSyncStatus:element(),scoreSyncDetails:element(),rankingCard:element(),
    setScoreActionsEnabled:value=>actions.push(value),renderScoreSyncResult(){},renderRanking(){},setRankingError(){},
    normalizeRpcRow:data=>Array.isArray(data)?data[0]:data,
    createSupabaseClient:()=>({rpc:async(name,payload)=>{calls.push({name,payload});return {data:name==='submit_score'?validReceipt():[],error:null};}}),
    console:{error(){}}
  };
  vm.createContext(context,{codeGeneration:{strings:false,wasm:false}});
  new vm.Script(ackInline[1]+'\n'+declaration('requestGameStart')+'\n'+declaration('submitScoreAndLoadRankings')+'\n'+declaration('loadRankingsOnly')).runInContext(context,{timeout:100});
  return {context,calls,saved,started,states,actions};
}
test('empty home name stays anonymous despite stored name and begins without name screen',()=>{
  const f=fixture();f.context.view='home';f.context.requestGameStart();
  assert.equal(f.context.currentPlayerName,'');
  assert.deepEqual(JSON.parse(JSON.stringify(f.context.playParticipation)),{displayName:'',participates:false});
  assert.deepEqual(f.saved,['']);assert.equal(f.started.length,1);assert.equal(f.states.includes('name'),false);
});
test('home input is captured before start and later input edits cannot rename this play',()=>{
  const f=fixture();f.context.view='home';f.context.playerNameInput.value='  Bob  ';f.context.requestGameStart();
  f.context.playerNameInput.value='Carol';
  assert.equal(f.context.currentPlayerName,'Bob');assert.equal(f.context.playParticipation.displayName,'Bob');
  assert.ok(Object.isFrozen(f.context.playParticipation));assert.deepEqual(f.saved,['Bob']);assert.equal(f.started.length,1);
});
test('anonymous score view never submits score or substitutes saved name',async()=>{
  const f=fixture();await f.context.submitScoreAndLoadRankings();
  assert.equal(f.calls.filter(call=>call.name==='submit_score').length,0);
  assert.equal(f.context.scoreSubmitting,false);
});
for(const stage of ['submit_score','get_best_score_ranking','get_first_try_ranking'])for(const rejectResponse of [false,true])test('old '+stage+' '+(rejectResponse?'rejection':'success')+' cannot overwrite a new play',async()=>{
  const f=fixture();
  f.context.playParticipation=HimaClient.captureParticipation('Bob');
  let release,reject;
  const gate=new Promise((resolve,fail)=>{release=resolve;reject=fail;});
  let reached=false;
  f.context.createSupabaseClient=()=>({rpc:(name,payload)=>{
    f.calls.push({name,payload});
    if(name===stage){reached=true;return gate;}
    return Promise.resolve({data:name==='submit_score'?validReceipt():[],error:null});
  }});
  const pending=f.context.submitScoreAndLoadRankings();
  for(let i=0;i<8&&!reached;i++)await Promise.resolve();
  assert.equal(reached,true,'controlled target await reached');
  f.context.playGeneration+=1;
  const marker={newPlay:true};
  f.context.scoreSubmitResult=marker;
  f.context.bestRankingRows=[marker];f.context.firstRankingRows=[marker];
  f.context.scoreSubmitting=true;f.context.activeRankingType='first';
  f.context.scoreSyncStatus.textContent='new play status';f.actions.length=0;
  if(rejectResponse)reject(new Error('controlled old request failure'));
  else release({data:stage==='submit_score'?validReceipt():[{rank_no:1,display_name:'Old player',first_score:999,best_score:999,play_count:1,updated_at:'2026-11-02T00:00:00Z'}],error:null});
  await pending;
  assert.equal(f.context.scoreSubmitResult,marker);
  assert.deepEqual(f.context.bestRankingRows,[marker]);assert.deepEqual(f.context.firstRankingRows,[marker]);
  assert.equal(f.context.scoreSubmitting,true);assert.equal(f.context.activeRankingType,'first');
  assert.equal(f.context.scoreSyncStatus.textContent,'new play status');assert.deepEqual(f.actions,[]);
});
