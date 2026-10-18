// Spatial rules are a game abstraction, not a model of measured snail immunity.
const SURFACE=[1,2,3,9,14,19,23,22,21,15,10,5];
const INNER=[6,7,8,11,12,13,16,17,18];
const PORTS=[1,4,7,10], GERMS=[6,12,18];
const RADIAL=[6,7,8,8,13,18,18,17,16,16,11,6];
const PHASES=['表面認識','血球接着','酸化攻撃','母スポロシスト定着'];
const WAVES=[[2,3],[7,8],[10,11]];
const DIRECTIONS=[-5,1,5,-1]; // N E S W
const PIPE_BASE={6:[0,1,2,3],7:[0,2],8:[2,3],11:[0,2,3],12:[0,1,2,3],13:[0,1,3],16:[0,1],17:[1,3],18:[0,1,2,3]};
let puzzle;
const ring=n=>(n+12)%12;
function maskCells(){return new Set(puzzle.masks.flatMap(n=>[n,ring(n+1)]))}
function protectedCells(){return new Set(puzzle.antioxidants.flatMap(n=>[ring(n-1),n,ring(n+1)]))}
function puzzleLive(){return s.stage==='invasion'&&!invasion.success&&!puzzle.failed}
function openPorts(){const masked=maskCells();return PORTS.filter(n=>!masked.has(n)&&!puzzle.blockers.includes(n)&&!puzzle.attached.has(n))}
function pipeDirections(cell){return PIPE_BASE[cell].map(d=>(d+puzzle.rotations[cell])%4)}
function connectedCells(){
  const seen=new Set(),queue=[];
  for(const port of openPorts()){
    const cell=RADIAL[port],entry=PORTS.indexOf(port);
    if(!puzzle.damage.has(cell)&&pipeDirections(cell).includes(entry)){seen.add(cell);queue.push(cell)}
  }
  while(queue.length){
    const cell=queue.shift();
    for(const d of pipeDirections(cell)){
      const other=cell+DIRECTIONS[d];
      if(!INNER.includes(other)||puzzle.damage.has(other)||seen.has(other))continue;
      if(d===1&&cell%5===4||d===3&&cell%5===0)continue;
      if(pipeDirections(other).includes((d+2)%4)){seen.add(other);queue.push(other)}
    }
  }
  return seen;
}
function puzzleTraits(){return{mask:puzzle.masks.length,inhibit:puzzle.blockers.length,antioxidant:puzzle.antioxidants.length}}
function puzzleMessage(message){puzzle.message=message;renderPuzzle()}
function selectPuzzleTool(tool){if(!puzzleLive())return;puzzle.tool=tool;puzzle.message='';renderPuzzle()}
function togglePuzzlePiece(list,n,max){
  const index=list.indexOf(n);
  if(index>=0){list.splice(index,1);return true}
  if(list.length>=max){puzzle.message='このピースはすべて使用中です。置いた場所をもう一度押すと回収できます。';return false}
  list.push(n);return true;
}
function puzzleCellClick(cell){
  if(!puzzleLive())return;
  const n=SURFACE.indexOf(cell),phase=puzzle.phase;
  if(phase===3&&puzzle.moves>=10){puzzleMessage('10手目で経路が完成しました。定着を確定してください。');return}
  if(phase>0&&phase<3&&puzzle.edits>=2){puzzleMessage('このターンの操作は2回までです。ターンを進めてください。');return}
  let changed=false;puzzle.message='';
  if(phase===0&&n>=0){
    const owner=puzzle.masks.find(start=>start===n||ring(start+1)===n);
    if(owner!==undefined){puzzle.masks.splice(puzzle.masks.indexOf(owner),1);changed=true}
    else if(maskCells().has(ring(n+1))){puzzle.message='2区画のマスクが重なります。隣の空き区画から配置してください。'}
    else changed=togglePuzzlePiece(puzzle.masks,n,3);
  }else if(phase===1&&n>=0){
    if(puzzle.attached.has(n)){puzzle.message='接着済みの血球は取り除けません。次の攻撃に備えてください。'}
    else changed=togglePuzzlePiece(puzzle.blockers,n,3);
  }else if(phase===2&&n>=0){changed=togglePuzzlePiece(puzzle.antioxidants,n,2)}
  else if(phase===3){
    if(puzzle.tool==='shed'&&n>=0){
      const owner=puzzle.masks.find(start=>start===n||ring(start+1)===n);
      if(owner!==undefined){puzzle.masks.splice(puzzle.masks.indexOf(owner),1);puzzle.shed++;changed=true}
      else puzzle.message='外皮を剥がせるのはマスクを置いた区画です。';
    }else if(puzzle.tool==='repair'&&INNER.includes(cell)){
      if(!puzzle.damage.has(cell))puzzle.message='この区画は損傷していません。';
      else if(!puzzle.repairs)puzzle.message='修復片は使い切りました。別の経路を探してください。';
      else{puzzle.damage.delete(cell);puzzle.repairs--;changed=true}
    }else if(puzzle.tool==='rotate'&&INNER.includes(cell)&&!GERMS.includes(cell)){
      if(puzzle.damage.has(cell))puzzle.message='損傷した区画は、修復してから回転してください。';
      else{puzzle.rotations[cell]=(puzzle.rotations[cell]+1)%4;changed=true}
    }else puzzle.message='選んだ道具に対応する区画を押してください。';
  }
  if(changed){
    if(phase===1||phase===2)puzzle.edits++;
    if(phase===3)puzzle.moves++;
  }
  if(phase===3&&puzzle.moves>=10&&!GERMS.every(c=>connectedCells().has(c)))failPuzzle('定着の10手を使い切りました。栄養口と3つの胚をつなぐ経路を見直してください。');
  else renderPuzzle();
}
function failPuzzle(message){
  puzzle.failed=true;invasion.running=false;
  invasion.exhausted=invasion.attempts>=4;
  puzzle.message=message;
  invasion.history.push(`試行${invasion.attempts}：${PHASES[puzzle.phase]}で失敗。${message}`);
  renderPuzzle();
}
function longestAttachment(){
  let run=0,best=0;
  for(let n=0;n<24;n++){run=puzzle.attached.has(n%12)?run+1:0;best=Math.max(best,run)}
  return Math.min(12,best);
}
function advancePuzzle(){
  if(s.stage!=='invasion')return;
  if(invasion.success){startColonyStage();return}
  if(puzzle.failed){if(invasion.exhausted)resetGame();else beginPuzzleAttempt();return}
  const phase=puzzle.phase;
  if(phase===0){
    const exposed=puzzle.recognition.filter(n=>!maskCells().has(n));
    if(exposed.length>1){failPuzzle(`認識点が${exposed.length}区画露出しました。黄色の認識点を残り1区画以下まで覆ってください。`);return}
    puzzle.alert=exposed.length;puzzle.phase=1;puzzle.turn=0;puzzle.edits=0;
    puzzle.message='表面認識を通過。予告された区画に阻害片を置いて、血球の包囲を分断してください。';
  }else if(phase===1){
    const wave=[...WAVES[puzzle.turn]];
    // An exposed recognition mark attracts one additional hemocyte in the last wave.
    if(puzzle.turn===2&&puzzle.alert)wave.push(0);
    wave.forEach(n=>{if(!puzzle.blockers.includes(n))puzzle.attached.add(n)});
    puzzle.turn++;puzzle.edits=0;
    if(puzzle.attached.size>=5||longestAttachment()>=4){failPuzzle('血球が5区画、または連続4区画に接着し、被包化されました。阻害片で包囲を分断してください。');return}
    puzzle.message=`血球が計${puzzle.attached.size}区画に接着。接着箇所は次フェイズの酸化攻撃の起点になります。`;
    if(puzzle.turn===3){puzzle.phase=2;puzzle.turn=0;puzzle.toxin=new Set(puzzle.attached);puzzle.message+=' 抗酸化片で起点と拡散先を守ってください。'}
  }else if(phase===2){
    const shield=protectedCells(),next=new Set();
    for(const n of puzzle.toxin){
      if(shield.has(n))continue;
      for(const target of [n,ring(n-1),ring(n+1)])if(!shield.has(target))next.add(target);
    }
    puzzle.toxin=next;
    for(const n of next)puzzle.damage.add(RADIAL[n]);
    puzzle.turn++;puzzle.edits=0;
    if(puzzle.damage.size>=7){failPuzzle('内部7区画以上が損傷し、母スポロシストへ変態できませんでした。攻撃の起点を早めに中和してください。');return}
    puzzle.message=`酸化攻撃を処理。内部損傷は${puzzle.damage.size}区画です。`;
    if(puzzle.turn===3){puzzle.phase=3;puzzle.turn=0;puzzle.tool='rotate';puzzle.message+=' 残った栄養口から、3つの胚すべてへ経路をつないでください。'}
  }else if(phase===3){
    if(!GERMS.every(c=>connectedCells().has(c))){puzzleMessage('栄養が届いていない胚があります。緑色の経路を確認してください。');return}
    invasion.success=true;invasion.running=false;activePhenotype=puzzleTraits();
    puzzle.message='母スポロシストが定着しました。配置した防御形質と、回復可能な損傷を群体へ引き継ぎます。';
    invasion.history.push(`試行${invasion.attempts}：定着成功（${traitLabel(activePhenotype)}・残存損傷${puzzle.damage.size}）`);
  }
  renderPuzzle();
}
function beginPuzzleAttempt(){
  if(invasion.attempts>=4)return;
  invasion.attempts++;invasion.running=true;invasion.success=false;invasion.exhausted=false;
  puzzle={phase:0,turn:0,edits:0,moves:0,repairs:2,shed:0,alert:0,tool:'mask',masks:[],blockers:[],antioxidants:[],recognition:[0,1,5,6,9],attached:new Set(),toxin:new Set(),damage:new Set(),rotations:Object.fromEntries(INNER.map(c=>[c,0])),failed:false,message:'黄色の認識点を、2区画つながったマスク3枚で覆います。青い栄養口も確認してください。'};
  renderPuzzle();
}
function resetGame(){
  s={...initial};motes=[];activePhenotype={mask:0,inhibit:0,antioxidant:0};
  invasion={attempts:0,history:[],running:false,success:false,exhausted:false};
  $('invasionStage').hidden=false;$('colonyStage').hidden=true;
  $('resultModal').classList.remove('show');$('eventModal').classList.remove('show');
  beginPuzzleAttempt();
}
function startColonyStage(){
  if(!invasion.success||s.stage!=='invasion')return;
  s={...initial,stage:'colony',invasionDamage:puzzle.damage.size,immune:Math.min(45,Math.max(8,20-activePhenotype.inhibit*2)+puzzle.alert*4+puzzle.shed*3)};
  motes=[];entries.innerHTML='';$('invasionStage').hidden=true;$('colonyStage').hidden=false;
  syncMotes();beginDay(true);
  $('phaseText').textContent=`${traitLabel(activePhenotype)}。侵入損傷は休養や外皮調整で回復できます。`;
  log(`母スポロシストが定着。侵入損傷${s.invasionDamage}を引き継いだ`);update();
}
function recoverInvasionDamage(amount){
  if(!s.invasionDamage)return;
  const before=s.invasionDamage;s.invasionDamage=Math.max(0,before-amount);
  if(before>0&&s.invasionDamage===0)log('侵入時の損傷がすべて回復した');
}
function resetPuzzleLayout(){
  if(!puzzleLive())return;
  if(puzzle.phase===0){puzzle.masks=[];puzzle.message='マスク配置を戻しました。';renderPuzzle()}
}
function renderPuzzle(){
  const live=puzzleLive(),phase=puzzle.phase,masked=maskCells(),shield=protectedCells(),connected=connectedCells();
  const exposed=puzzle.recognition.filter(n=>!masked.has(n)).length;
  $('stageClock').innerHTML=`侵入試行 <strong>${invasion.attempts}</strong> / 4`;
  $('larvaeLeft').textContent=12-invasion.attempts*3;
  $('puzzlePhase').textContent=`${phase+1} / 4｜${PHASES[phase]}`;
  $('puzzleMessage').textContent=puzzle.message;
  const instructions=[
    '外周を押すと、その区画から時計回りに2区画を覆います。置いたマスクを押すと回収できます。黄色の認識点の露出を1以下にして通過してください。',
    '外周を押して阻害片を配置・回収します。各ターン2操作まで、3ターン。血球5区画、または連続4区画の接着で失敗します。',
    '抗酸化片は置いた区画と両隣を守ります。各ターン2操作まで、3ターン。酸化は毎ターン左右へ1区画ずつ広がり、対応する内部区画を損傷します。内部損傷7区画で失敗します。',
    '内部の経路を押すと時計回りに回転します。開いた栄養口から3つの胚すべてへ栄養を届けてください。10手以内、修復片は2枚です。'
  ];
  $('puzzleInstructions').textContent=invasion.success?'形質は群体運営でも効果と維持コストを持ちます。':instructions[phase];
  $('puzzleStatus').textContent=phase===0?`マスク ${puzzle.masks.length}/3枚・認識点の露出 ${exposed}/5`:
    phase===1?`ターン ${Math.min(3,puzzle.turn+1)}/3・操作 ${puzzle.edits}/2・阻害片 ${puzzle.blockers.length}/3・接着 ${puzzle.attached.size}区画`:
    phase===2?`ターン ${Math.min(3,puzzle.turn+1)}/3・操作 ${puzzle.edits}/2・抗酸化片 ${puzzle.antioxidants.length}/2・内部損傷 ${puzzle.damage.size}/9`:
    `定着 ${puzzle.moves}/10手・修復片 残り${puzzle.repairs}・栄養到達 ${GERMS.filter(c=>connected.has(c)).length}/3胚`;
  const wave=WAVES[puzzle.turn]||[];
  const preview=phase===0?'栄養口は外周 2・5・8・11。覆うと栄養が通りません。':phase===1?
    `次の血球：${[...wave,...(puzzle.turn===2&&puzzle.alert?[0]:[])].map(n=>n+1).join('・')}番。以後：${WAVES.slice(puzzle.turn+1).map(w=>w.map(n=>n+1).join('・')).join(' → ')||'最終波'}。`:
    phase===2?`酸化の位置：${[...puzzle.toxin].sort((a,b)=>a-b).map(n=>n+1).join('・')||'中和済み'}。紫の区画と両隣で中和します。`:
    `開いた栄養口：${openPorts().map(n=>n+1).join('・')||'なし（外皮を剥がして開口できます）'}。斜線は損傷、緑は栄養が届いた区画です。`;
  $('puzzlePreview').textContent=preview;
  $('puzzleCarry').textContent=`${traitLabel(puzzleTraits())}／残存損傷${puzzle.damage.size}。マスキングは栄養吸収、阻害は超寄生リスク、抗酸化は維持費に影響します。`;
  $('attemptHistory').textContent=invasion.history.join('\n');
  $('phaseList').innerHTML=PHASES.map((p,i)=>`<li class="${i<phase||invasion.success?'done':i===phase?'current':''}" ${i===phase?'aria-current="step"':''}>${i+1}. ${p}</li>`).join('');
  $('puzzleTools').innerHTML='';
  const tools=phase===3?[['rotate','経路を回転'],['repair',`損傷を修復（残り${puzzle.repairs}）`],['shed','マスクを剥がす']]:[[['mask','block','antioxidant'][phase],['マスクを配置・回収','阻害片を配置・回収','抗酸化片を配置・回収'][phase]]];
  for(const [tool,label] of tools){const b=document.createElement('button');b.className='puzzle-tool';b.textContent=label;b.type='button';b.setAttribute('aria-pressed',String(phase===3?puzzle.tool===tool:true));b.disabled=!live;b.onclick=()=>selectPuzzleTool(tool);$('puzzleTools').appendChild(b)}
  const board=$('puzzleBoard');
  // Keep cells in the DOM to preserve focus for keyboard users.
  if(!board.children.length)for(let c=0;c<25;c++){const b=document.createElement('button');b.className='puzzle-cell';b.type='button';b.dataset.cell=c;b.onclick=()=>puzzleCellClick(c);board.appendChild(b)}
  [...board.children].forEach((b,cell)=>{
    const n=SURFACE.indexOf(cell),inside=INNER.includes(cell),germ=GERMS.includes(cell);
    let classes=['puzzle-cell'],mark='',state='',label='';
    if(n>=0){
      classes.push('surface');
      if(puzzle.recognition.includes(n))classes.push('recognized');
      if(masked.has(n))classes.push('masked');if(puzzle.blockers.includes(n))classes.push('inhibited');
      if(puzzle.attached.has(n))classes.push('attached');if(puzzle.toxin.has(n)&&phase>=2)classes.push('toxic');
      if(shield.has(n))classes.push('shielded');
      mark=puzzle.blockers.includes(n)?'阻':masked.has(n)?'膜':PORTS.includes(n)?'口':puzzle.recognition.includes(n)?'認':'';
      if(puzzle.attached.has(n))state+='血球 ';if(puzzle.antioxidants.includes(n))state+='抗酸化';else if(shield.has(n))state+='中和域';
      if(phase===1&&(wave.includes(n)||puzzle.turn===2&&puzzle.alert&&n===0))state+=' 次の血球';
      label=`外周${n+1}番${PORTS.includes(n)?' 栄養口':''}${puzzle.recognition.includes(n)?' 認識点':''}${masked.has(n)?' マスク':''}${puzzle.blockers.includes(n)?' 阻害片':''}${state?' '+state:''}`;
    }else if(inside){
      if(puzzle.damage.has(cell))classes.push('damaged');else if(connected.has(cell)&&phase===3)classes.push('connected');
      if(germ){classes.push('germ');mark='胚'}
      state=puzzle.damage.has(cell)?'損傷':phase===3&&connected.has(cell)?'栄養到達':'';
      label=`内部${Math.floor(cell/5)}行${cell%5}列 ${germ?'胚':'経路'}${state?' '+state:''}`;
    }else classes.push('void');
    b.className=classes.join(' ');b.disabled=!live||!inside&&n<0||phase<3&&inside;
    b.setAttribute('aria-label',label||'盤面外');
    let pipe='';
    if(inside&&phase===3&&!puzzle.damage.has(cell))pipe=`<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${pipeDirections(cell).map(d=>`M50 50L${[50,100,50,0][d]} ${[0,50,100,50][d]}`).join(' ')}"/></svg>`;
    b.innerHTML=`${pipe}<span class="cell-number">${n>=0?n+1:''}</span><span class="cell-mark ${PORTS.includes(n)?'cell-port':''}">${mark}</span><span class="cell-state">${state}</span>`;
  });
  const advance=$('invade');advance.disabled=false;
  advance.textContent=invasion.success?'群体運営を開始':puzzle.failed?invasion.exhausted?'新しい卵群で再開始':'次の3個体で再挑戦':phase===0?'表面認識を通過する':phase===3?'母スポロシストを定着させる':`${puzzle.turn+1}ターン目を進める`;
  $('resetLayout').hidden=phase!==0||!live;
}
