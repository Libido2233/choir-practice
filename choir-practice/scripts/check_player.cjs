// 播放器 v2 功能自检：DOM / 音频元素均为桩，不打开浏览器、不发声。
// 用法：node scripts/check_player.cjs [某个成品HTML]   （不带参数时检查 assets/player.html 模板）
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const file=process.argv[2]||path.join(__dirname,'../assets/player.html');
// 成品页：把内嵌的 DATA/PIANO 换回占位符，用同一套样例数据检查页面代码
const html=fs.readFileSync(file,'utf8').replace(/^const DATA=.*$/m,'const DATA=__CHOIR_DATA__,PIANO=__PIANO_SAMPLES__;');
const isTemplate=html.includes('__CHOIR_DATA__');assert(isTemplate,'没找到 const DATA= 行');

class Element{
 constructor(tag='div'){Object.assign(this,{tagName:tag,children:[],dataset:{},value:'',checked:false,disabled:false,hidden:false,textContent:'',className:'',src:'',_html:'',attrs:{}});
  const self=this;this.style={setProperty(k,v){this[k]=v}};this.classList={set:new Set(),toggle(n,v){(v??!this.set.has(n))?this.set.add(n):this.set.delete(n)},remove(n){this.set.delete(n)},contains(n){return this.set.has(n)}}}
 append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]}
 get innerHTML(){return this._html}set innerHTML(v){this._html=v}querySelectorAll(){return []}addEventListener(){}
}
class Media extends Element{
 constructor(){super('audio');Object.assign(this,{readyState:0,_t:0,paused:true,muted:false,loop:false,ended:false,seeking:false,listeners:{},plays:0})}
 get currentTime(){return this._t}set currentTime(v){this._t=v;this.fire('seeked')}
 addEventListener(t,f,o){(this.listeners[t]??=[]).push({f,once:o&&o.once})}
 fire(t){const l=this.listeners[t]||[];this.listeners[t]=l.filter(x=>!x.once);for(const x of l)x.f()}
 load(){this.readyState=1;this.fire('loadedmetadata')}
 play(){this.plays++;this.paused=false;this.fire('play');return Promise.resolve()}
 pause(){this.paused=true;this.fire('pause')}
}
function harness(DATA){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const el=Object.fromEntries(ids.map(id=>[id,id==='player'||id==='preview'?new Media():new Element()]));
 el.countin.checked=true;el.from.value='1';el.modeListen.setAttribute('aria-selected','true');
 const timers=[];let now=0;
 const blobs=[];
 const document={title:'',hidden:false,body:new Element('body'),getElementById(id){assert(el[id],'缺少元素 #'+id);return el[id]},createElement:t=>new Element(t),createTextNode:t=>({textContent:t}),addEventListener(){}};
 class OfflineAudioContext{constructor(c,l,sr){this.sampleRate=sr}decodeAudioData(buf,ok){const d=new Float32Array(this.sampleRate*2);for(let i=0;i<d.length;i++)d[i]=Math.sin(i/8)*Math.exp(-i/this.sampleRate);const b={sampleRate:this.sampleRate,getChannelData:()=>d};ok&&ok(b);return Promise.resolve(b)}close(){}}
 const store=new Map();
 const sandbox={document,console,assert,
  window:{OfflineAudioContext,addEventListener(){}},navigator:{},location:{hash:'',pathname:'/x.html',search:''},history:{replaceState(){}},
  localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  URL:{createObjectURL:b=>{blobs.push(b);return 'blob:'+blobs.length},revokeObjectURL(){}},
  Blob:class{constructor(parts,opt){this.parts=parts;this.type=opt.type}},
  setTimeout:(f,ms)=>{timers.push({f,at:now+ms});return timers.length},clearTimeout(id){if(timers[id-1])timers[id-1].f=null},
  requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  Promise,Math,JSON,Object,Array,Number,String,Map,Set,Uint8Array,Uint32Array,Int16Array,Float32Array,ArrayBuffer,DataView,Error};
 sandbox.window.window=sandbox.window;
 vm.createContext(sandbox);
 let script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 if(isTemplate)script=script.replace('__CHOIR_DATA__',JSON.stringify(DATA)).replace('__PIANO_SAMPLES__',JSON.stringify({48:'AA==',54:'AA==',60:'AA==',66:'AA=='}));
 vm.runInContext(script,sandbox);
 const run=code=>vm.runInContext(code,sandbox);
 const flush=async(ms=1000)=>{for(let k=0;k<5;k++){await new Promise(r=>setImmediate(r));now+=ms;for(const t of timers)if(t.f&&t.at<=now){const f=t.f;t.f=null;f()}}};
 return {el,run,flush,blobs};
}
function sampleData(withGuide=false){
 const bars=[];let beat=0;
 for(let i=1;i<=6;i++){bars.push({number:i,label:String(i),beat,dur:4,beats:4,beatType:4,system:Math.floor((i-1)/2),left:.1,right:.9});beat+=4}
 const D={title:'自检',bpm:60,defaultPart:'T',notation:'固定唱名 1=C · 中音1=C4',unchecked:[],bars,totalBeats:beat,systemCount:3,parts:[]};
 for(const [id,midi] of [['Solo',67],['S',72],['A',64],['T',55],['B',43],['Drums',36]])D.parts.push({id,name:id,role:id==='Solo'?'solo':id==='Drums'?'percussion':'voice',
  events:bars.map((b,i)=>({eventIndex:i,bar:b.number,beat:b.beat,dur:4,midi,name:'音'+midi,x:.3})),sounds:bars.map(b=>({bar:b.number,beat:b.beat,dur:4,midi})),
  lyrics:id==='T'?[{eventIndex:0,text:'du & <',verse:1,bar:1,beat:0,endBeat:4,system:0}]:[],systems:[0,1,2].map(s=>({image:id+s,numbers:'<svg>'+id+s+'</svg>'}))});
 if(withGuide){D.melodyGuide=[{startBeat:0,endBeat:8,part:'S'},{startBeat:8,endBeat:24,part:'A'}];D.parts.forEach(p=>{if(p.role==='solo')p.role='voice'})}
 return D;
}
(async()=>{
 const {el,run,flush,blobs}=harness(sampleData());
 // 界面：没有旧的锁屏听/重唱等控件；两种模式与底部按钮齐全
 assert(!html.includes('锁屏听')&&!html.includes('重唱本小节')&&!html.includes('id="nativeAudio"'),'不应保留旧控件');
 for(const id of ['modeListen','modeRead','listenView','readView','reset','back','fwd','play','seek','loopband','lineplay','readerChips','readerParts','readerPages'])assert(el[id],'缺少 #'+id);
 // 默认混音
 assert(run('volumes.T===100&&volumes.Solo===50&&audible.T&&audible.Solo&&!audible.S&&!audible.Drums'),'默认混音不对');
 assert.equal(el.score.src,'T0');assert.equal(el.nextScore.src,'T1');assert(el.currentLyrics.innerHTML.includes('du &amp; &lt;'));
 await flush();
 assert(run('track&&!stale'),'载入后应预先合成');
 const wav=blobs.at(-1).parts;assert.equal(String.fromCharCode(...new Uint8Array(wav[0].buffer,0,4)),'RIFF');
 assert(Math.abs(run('track.duration')-(4+24+.8))<.01,'时长 = 预备拍 + 全曲 + 尾音');
 // 播放 / 暂停
 el.play.onclick();assert(run('playing&&player.currentTime===0'),'从头播放应从预备拍开始');
 assert(run('player.muted'),'开播先静音');await flush(10);assert(run('!player.muted'),'到位后开声');
 run('player.currentTime=6.5');assert(Math.abs(run('nowBeat()')-2.5)<1e-6);
 el.play.onclick();assert(run('!playing&&Math.abs(position-2.5)<1e-6'),'暂停记住位置');
 el.play.onclick();assert(run('playing&&position===0&&player.currentTime===0'),'开预备拍时从本小节开头进入');
 // 上一节 / 下一节 / 回起点（播放中直接跳，不打预备拍）
 run('jumpTo=null;player.currentTime=4+9');el.fwd.onclick();assert(run('barAt(nowBeat()).number===4&&jumpTo===null'),'下一节');
 el.back.onclick();el.back.onclick();assert(run('barAt(nowBeat()).number===2'),'上一节');
 el.reset.onclick();assert(run('nowBeat()===0'),'回第 1 小节');
 // 循环本行：不改手动范围，换行跟着走，再点结束
 run("$('next').onclick()");el.lineplay.onclick();await flush();
 assert(run('lineLoop===1&&track.loop&&track.lo===8&&track.hi===16'),'循环本行');
 assert(!el.player.loop,'带预备拍的循环应跳过音频开头');
 el.player.fire('ended');assert(run('player.currentTime===track.pre&&jumpTo===null'),'下一轮应直接进入循环起点');
 assert.equal(el.from.value,'1');assert(el.reset.textContent.includes('第 3 小节'));
 run('jumpTo=null;player.currentTime=4+5');el.fwd.onclick();el.fwd.onclick();assert(run('barAt(nowBeat()).number===4'),'循环中下一节不越过本行末尾');
 el.next.onclick();await flush();assert(run('lineLoop===2&&track.lo===16'),'换行后循环跟着走');
 el.lineplay.onclick();await flush();assert(run('lineLoop===null&&!track.loop&&playing'),'结束循环本行后继续播放');
 // 手动循环：跳出范围自动关闭
 el.from.value='2';el.to.value='3';el.loop.checked=true;el.loop.onchange();await flush();
 assert(run('track.loop&&track.lo===4&&track.hi===12'));
 el.lineplay.onclick();await flush();
 assert(run('lineLoop!==null')&&el.loop.checked,'循环本行应保留手动循环开关');
 el.lineplay.onclick();await flush();
 assert(run('lineLoop===null&&track.lo===4&&track.hi===12'),'结束循环本行应恢复手动循环');
 el.barlinks.children.length&&run("locate(20)");assert(!el.loop.checked,'跳出循环范围应关闭循环');
 // 播放中改音量：后台重合成并从同一位置接上
 await flush();run('jumpTo=null;player.currentTime=4+10');const before=run('nowBeat()');
 el.mix.children[0].children[1].children[3].onclick();await flush();
 assert(run('playing')&&Math.abs(run('nowBeat()')-before)<1e-6,'热切换应保持位置');
 // 切换“我练”重设混音
 el.part.value='B';el.part.onchange();assert(run('volumes.B===100&&volumes.Solo===50&&!audible.T'));
 // 只看谱：不出声，自选声部，原谱页
 run('single(part().events[0])');assert(!el.preview.paused,'应开始逐音试听');
 run("setMode('read')");assert(el.listenView.hidden&&el.dock.hidden&&!el.readView.hidden&&run('!playing')&&el.preview.paused,'看谱模式应停止整曲和逐音试听');
 assert.equal(el.readerParts.children.length,3,'每行一段');
 assert.equal(el.readerPages.hidden,true);assert.equal(el.readViewSwitch.hidden,true,'无原谱页时不显示切换');
 const chipS=el.readerChips.children.find(c=>c.textContent==='S');chipS.onclick();assert(run("reader.parts.includes('S')"));
 const numbers=el.readerChips.children.at(-1);numbers.onclick();assert(run('reader.numbers===false'));
 run("setMode('listen')");assert(!el.listenView.hidden&&!el.dock.hidden);
 // melodyGuide：参照随拍切换，移动位置不触发重合成
 {const {run,flush}=harness(sampleData(true));await flush();
  assert(run("audible.T&&audible.S&&!audible.A&&volumes.S===50"),'第一段参照 S');
  const key=run('track.key');run('showBeat(10)');assert(run("audible.A&&!audible.S")&&run('getReferencePart().id')==='A','第二段参照 A');
  assert.equal(run('JSON.stringify(settings())'),key,'参照随拍变化不应导致重合成');
  run("editVolume('A',80)");assert(run("mixOverrides.volumes.A===80"));}
 // 原谱页
 {const D=sampleData();D.scorePages=['data:image/png;base64,AA==','data:image/png;base64,AA=='];const {el,run}=harness(D);
  run("setMode('read')");assert.equal(el.readViewSwitch.hidden,false);el.readPages.onclick();assert.equal(el.readerPages.children.length,2);assert(el.readerParts.hidden);}
 console.log('PASS：v2 播放器——预合成音频、播放/暂停/预备拍、上一节/下一节/回起点、循环本行与手动循环、热切换、声部切换、melodyGuide、只看谱与原谱页（模拟，无声）。');
})().catch(e=>{console.error('检查失败：',e.message);process.exit(1)});
