const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');

// A small DOM fixture runs the shipped scripts (including their event bindings).
// This checks game rules and integration, not browser layout or CSS.
function game(){
  class Element{
    constructor(){this.children=[];this.style={};this.dataset={};this.hidden=false;this.disabled=false;this.clientWidth=600;this.clientHeight=520;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),contains:x=>this.classes.has(x)};}
    set innerHTML(value){this.html=value;this.children=[]}
    get innerHTML(){return this.html||''}
    setAttribute(key,value){this[key]=value}
    appendChild(child){this.children.push(child);return child}
    prepend(child){this.children.unshift(child)}
    get lastChild(){return{remove:()=>this.children.pop()}}
    getContext(){return new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(obj,key)=>key in obj?obj[key]:()=>{}})}
  }
  const html=readFileSync(join(__dirname,'../dist/index.html'),'utf8');
  const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const actions=['expand','produce','hide'].map(action=>{const e=new Element();e.dataset.action=action;return e});
  const registered=new Map();
  const document={getElementById:id=>{assert.ok(nodes.has(id),`missing DOM id ${id}`);return nodes.get(id)},createElement:()=>new Element(),querySelectorAll:selector=>selector==='.action'?actions:[],modelContext:{registerTool:tool=>registered.set(tool.name,tool)}};
  const sandbox={document,console,performance:{now:()=>0},devicePixelRatio:1,requestAnimationFrame(){},setTimeout};
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(__dirname,'../dist/invasion.js'),'utf8'),sandbox);
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  vm.runInContext(inline,sandbox);
  const run=code=>vm.runInContext(code,sandbox);
  return{
    run,nodes,registered,
    surface:n=>run(`document.getElementById('puzzleBoard').children[SURFACE[${n}]].onclick()`),
    inner:n=>run(`document.getElementById('puzzleBoard').children[${n}].onclick()`),
    next:()=>nodes.get('invade').onclick(),
    state:()=>JSON.parse(run(`JSON.stringify({phase:puzzle.phase,failed:puzzle.failed,success:invasion.success,attempts:invasion.attempts,exhausted:invasion.exhausted,edits:puzzle.edits,masks:puzzle.masks,blockers:puzzle.blockers,antioxidants:puzzle.antioxidants,attached:[...puzzle.attached],toxin:[...puzzle.toxin],damage:[...puzzle.damage],moves:puzzle.moves,traits:activePhenotype,stage:s.stage,invasionDamage:s.invasionDamage})`))
  };
}
function recognize(g){[0,5,9].forEach(n=>g.surface(n));g.next();assert.equal(g.state().phase,1)}
function adhere(g){g.surface(2);g.surface(3);g.next();g.surface(7);g.next();g.next();assert.equal(g.state().phase,2)}
function oxidize(g,damaged=false){g.surface(9);if(!damaged)g.surface(11);g.next();g.next();g.next();assert.equal(g.state().phase,3)}
function connect(g){g.inner(11);g.inner(13);g.inner(13);g.next();assert.equal(g.state().success,true)}

test('full puzzle via bound controls carries placed traits to colony exactly once',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g);connect(g);
  assert.deepEqual(g.state().traits,{mask:3,inhibit:3,antioxidant:2});
  assert.equal(g.state().damage.length,0);
  g.next();assert.equal(g.state().stage,'colony');
  assert.equal(g.nodes.get('invasionStage').hidden,true);
  assert.equal(g.nodes.get('colonyStage').hidden,false);
  g.run('s.day=4; startColonyStage()');assert.equal(g.run('s.day'),4);
  assert.equal(g.registered.get('read_colony_state').execute().phenotype.mask,3);
});
test('masked nutrient ports stay shut and matching pipe rotation is required',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g);
  assert.equal(g.run('openPorts().join(",")'),'4');
  g.next();assert.equal(g.state().success,false);
  g.inner(13);g.next();assert.equal(g.state().success,false);
  g.inner(11);g.inner(13);g.next();assert.equal(g.state().success,true);
});
test('an overlapping two-cell mask is rejected, can be removed from either end',()=>{
  const g=game();g.surface(0);g.surface(11);
  assert.deepEqual(g.state().masks,[0]);g.surface(1);
  assert.deepEqual(g.state().masks,[]);
  g.surface(0);g.nodes.get('resetLayout').onclick();assert.deepEqual(g.state().masks,[]);
});
test('recognition failure consumes one attempt, retains history, exhausts at four',()=>{
  const g=game();
  for(let attempt=1;attempt<=4;attempt++){
    g.next();assert.equal(g.state().failed,true);assert.equal(g.state().attempts,attempt);
    assert.equal(g.state().exhausted,attempt===4);g.next();
  }
  assert.equal(g.state().attempts,1);assert.equal(g.state().failed,false);
  assert.equal(g.nodes.get('larvaeLeft').textContent,9);
});
test('two operations per turn prevents a third placement; removal also counts',()=>{
  const g=game();recognize(g);g.surface(2);g.surface(3);g.surface(7);
  assert.deepEqual(g.state().blockers,[2,3]);assert.equal(g.state().edits,2);
  g.next();g.surface(2);g.surface(7);g.surface(10);
  assert.deepEqual(g.state().blockers,[3,7]);assert.equal(g.state().edits,2);
});
test('unopposed hemocytes cause encapsulation and show the failing phase',()=>{
  const g=game();recognize(g);g.next();g.next();g.next();
  assert.equal(g.state().phase,1);assert.equal(g.state().failed,true);
  assert.match(g.nodes.get('puzzleMessage').textContent,/被包化/);
});
test('one exposed recognition mark adds an announced hemocyte in the last wave',()=>{
  const g=game();[0,5].forEach(n=>g.surface(n));g.next();
  assert.equal(g.state().phase,1);g.surface(2);g.surface(3);g.next();g.next();
  assert.match(g.nodes.get('puzzlePreview').textContent,/11・12・1/);g.next();
  assert.equal(g.state().failed,true);
});
test('antioxidant protection neutralizes existing origins before they spread',()=>{
  const g=game();recognize(g);adhere(g);
  assert.deepEqual(g.state().attached,[8,10,11]);
  g.surface(9);g.surface(11);g.next();
  assert.deepEqual(g.state().toxin,[]);assert.deepEqual(g.state().damage,[]);
  g.next();g.next();assert.equal(g.state().phase,3);
});
test('unopposed oxidation spreads and fails once seven internal cells are damaged',()=>{
  const g=game();recognize(g);adhere(g);g.next();g.next();g.next();
  assert.equal(g.state().failed,true);assert.equal(g.state().phase,2);
  assert.ok(g.state().damage.length>=7);
});
test('damaged germ needs repair; remaining damage carries over and recovers',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g,true);
  assert.deepEqual(g.state().damage.sort((a,b)=>a-b),[6,7,8]);
  g.run("selectPuzzleTool('repair')");g.inner(6);
  g.run("selectPuzzleTool('rotate')");connect(g);g.next();
  assert.equal(g.state().invasionDamage,2);
  assert.match(g.nodes.get('recoveryStatus').textContent,/8%/);
  const flowBefore=g.run('s.parasiteFlow');
  const undamagedFlow=g.run('(()=>{s.invasionDamage=0;beginDay(true);const flow=s.parasiteFlow;s.invasionDamage=2;return flow})()');
  assert.ok(undamagedFlow>flowBefore,'invasion damage must reduce actual nutrient flow');
  g.run("act('hide')");assert.equal(g.state().invasionDamage,0);
  assert.match(g.nodes.get('recoveryStatus').textContent,/侵入損傷なし/);
  assert.ok(flowBefore>0);
});
test('starvation rest repairs one cell and ordinary production retains damage',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g,true);
  g.run("selectPuzzleTool('repair')");g.inner(6);g.run("selectPuzzleTool('rotate')");connect(g);g.next();
  g.run("act('expand')");assert.equal(g.state().invasionDamage,2);
  g.run("s.energy=0;s.colonyReserve=0;act('produce')");
  assert.equal(g.state().invasionDamage,1);
});
test('shedding a two-cell mask reopens its nutrient port and reduces inherited masking',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g);
  assert.equal(g.run('openPorts().includes(1)'),false);
  g.run("selectPuzzleTool('shed')");g.surface(1);
  assert.equal(g.run('openPorts().includes(1)'),true);
  assert.equal(g.state().masks.length,2);
  g.run("selectPuzzleTool('rotate')");connect(g);g.next();
  assert.equal(g.state().traits.mask,2);assert.equal(g.run('s.immune'),17);
});
test('repair inventory cannot be exceeded or consumed on a healthy cell',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g,true);
  g.run("selectPuzzleTool('repair')");g.inner(12);
  assert.equal(g.state().moves,0);
  g.inner(6);g.inner(7);g.inner(8);
  assert.deepEqual(g.state().damage,[8]);assert.equal(g.state().moves,2);
  assert.equal(g.run('puzzle.repairs'),0);
});
test('ten moves without a viable network fail, and controls freeze after failure',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g);
  for(let i=0;i<10;i++)g.inner(8);
  assert.equal(g.state().failed,true);assert.equal(g.state().moves,10);
  g.inner(11);assert.equal(g.state().moves,10);
});
test('a network completed on the tenth move can still be accepted',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g);
  for(let i=0;i<7;i++)g.inner(8);
  g.inner(11);g.inner(13);g.inner(13);assert.equal(g.state().moves,10);
  g.inner(8);assert.equal(g.state().moves,10);
  g.next();assert.equal(g.state().success,true);assert.equal(g.state().failed,false);
});
test('stage reset clears puzzle, colonies, dialogs and inherited damage',()=>{
  const g=game();recognize(g);adhere(g);oxidize(g);connect(g);g.next();
  g.run("s.invasionDamage=5;$('eventModal').classList.add('show');resetGame()");
  assert.equal(g.state().stage,'invasion');assert.equal(g.state().invasionDamage,0);
  assert.equal(g.nodes.get('eventModal').classList.contains('show'),false);
  assert.deepEqual(g.state().masks,[]);assert.equal(g.state().attempts,1);
});
