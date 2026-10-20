// Functional smoke test using a DOM/WebAudio stub; no browser compatibility claim.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
class Element {
 constructor(){this.children=[];this.dataset={};this.style={};this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.scrollLeft=0;this.scrollWidth=850;this.clientWidth=350;this.className='';this.html='';this.classList={toggle:(name,value)=>{this[name]=value},remove:name=>{this[name]=false}}}
 append(...elements){this.children.push(...elements)}replaceChildren(...elements){this.children=[...elements]}setAttribute(name,value){this[name]=value}get firstElementChild(){return this.children[0]}get innerHTML(){return this.html}set innerHTML(value){this.html=value}querySelectorAll(){return []}
}
const template=fs.readFileSync(path.join(__dirname,'../assets/player.html'),'utf8');
const elements=Object.fromEntries([...template.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
elements.progress.append(new Element());elements.ownScroll.append(new Element());elements.countin.checked=true;elements.from.value='1';
const document={title:'',getElementById(id){assert(elements[id],`Unknown element: ${id}`);return elements[id]},createElement:()=>new Element(),createTextNode:text=>({textContent:text})};
let context,sourceCount=0,oscillatorCount=0;
class AudioContext {
 constructor(){this.currentTime=0;this.sampleRate=22050;this.destination={};context=this}
 async resume(){}async decodeAudioData(){return {duration:10}}
 createGain(){return {gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}
 createDynamicsCompressor(){return {connect(){}}}createBiquadFilter(){return {frequency:{value:0},connect(){}}}
 createBuffer(channels,size){return {getChannelData(){return new Float32Array(Math.floor(size))}}}
 createBufferSource(){sourceCount++;return {playbackRate:{value:1},connect(){},start(){},stop(){}}}
 createOscillator(){oscillatorCount++;return {frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}}
}
const DATA={title:'自检',bpm:72,defaultPart:'T',totalBeats:11,systemCount:3,notation:'固定唱名 1=C · 中音1=C4',note:'固定速度',unchecked:[],bars:[{number:1,label:'1',beat:0,dur:4,system:0,beats:4,beatType:4,left:.05,right:.95},{number:2,label:'2',beat:4,dur:3,system:1,beats:3,beatType:4,left:.05,right:.95},{number:3,label:'3',beat:7,dur:4,system:2,beats:4,beatType:4,left:.05,right:.95}],parts:[]};
for(const [id,midi] of [['Solo',62],['S',72],['A',60],['T',52],['B',40],['Drums',36]])DATA.parts.push({id,name:id,role:id==='Solo'?'solo':id==='Drums'?'percussion':'voice',events:DATA.bars.map(b=>({bar:b.number,beat:b.beat,dur:b.dur,midi,name:id==='T'?'E3':'音'+midi,x:.2})),sounds:DATA.bars.map(b=>({bar:b.number,beat:b.beat,dur:b.dur,midi})),systems:DATA.bars.map(b=>({image:id+b.system,numbers:'<svg>'+id+b.system+'</svg>'}))});
const saved=new Map(),localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
for(const p of DATA.parts)for(let i=0;i<p.events.length;i++)p.events[i].eventIndex=i;
DATA.parts.find(p=>p.id==='T').lyrics=[{eventIndex:0,text:'du & <',system:0,bar:1,beat:0,endBeat:4,verse:1}];
const sandbox={document,window:{AudioContext,addEventListener(){}},localStorage,console,atob:s=>Buffer.from(s,'base64').toString('binary'),setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);const script=template.match(/<script>([\s\S]*?)<\/script>/)[1].replace('__CHOIR_DATA__',JSON.stringify(DATA)).replace('__PIANO_SAMPLES__',JSON.stringify({48:'AA==',54:'AA==',60:'AA==',66:'AA=='}));vm.runInContext(script,sandbox);
const run=code=>vm.runInContext(code,sandbox);
(async()=>{
 assert(!template.includes('id="previousContext"')&&!template.includes('下载练习材料'));assert(!template.includes('id="focusMix"')&&!template.includes('id="onlyMix"')&&!template.includes('id="allMix"'));assert(!template.includes('min-width:850px'));
 assert.equal(elements.mix.children.length,6);assert.equal(elements.score.src,'T0');assert.equal(elements.nextScore.src,'T1');assert.equal(elements.referenceRows.children.length,2);
 assert(elements.currentLyrics.innerHTML.includes('du &amp; &lt;'));assert(!elements.currentLyrics.innerHTML.includes('du & <'));assert.equal(elements.nextLyrics.innerHTML,'');
 assert(run('volumes.T===100&&volumes.Solo===35&&!audible.S&&!audible.Drums'));
 const tenorControls=elements.mix.children[3].children[1];tenorControls.children[0].onclick();assert(run('volumes.T===90&&volumes.Solo===35'));tenorControls.children[3].onclick();assert(run('volumes.T===100'));tenorControls.children[3].onclick();assert(run('volumes.T===100'));
 run('sliders.T.value=37;sliders.T.onchange()');assert(run('volumes.T===37'));run('sliders.T.value=999;sliders.T.onchange()');assert(run('volumes.T===100'));run('sliders.T.value=-5;sliders.T.onchange()');assert(run('volumes.T===0'));run('setVolume("T",100)');
 assert(elements.currentLyrics.innerHTML.includes('class="lyric-word"'));assert(!elements.currentLyrics.innerHTML.includes('<svg'));

 await run('play()');assert(run('playing'));assert(sourceCount>10&&oscillatorCount>=4);assert(run('gains.T.gain.value===1&&gains.Solo.gain.value===.35'));
 run('setAudible("S",true);setVolume("S",41)');assert(run('gains.S.gain.value===.41&&gains.T.gain.value===1&&gains.Solo.gain.value===.35'));
 run('setAudible("S",false)');assert(run('gains.S.gain.value===0&&volumes.S===41'));run('setAudible("S",true)');assert(run('gains.S.gain.value===.41'));
 run('for(const p of DATA.parts)setAudible(p.id,p.id===selected)');assert(run('gains.T.gain.value===1&&gains.S.gain.value===0&&gains.Solo.gain.value===0'));
 run('showSystem(0)');assert.equal(elements.referenceRows.children.length,2);assert.equal(elements.score.src,'T0');assert(run('gains.T.gain.value===1&&gains.S.gain.value===0'));
 assert.equal(elements.nextScore.src,'T1');assert.equal(elements.score.src,'T0');
 elements.part.value='S';elements.part.onchange();assert.equal(elements.score.src,'S0');assert.equal(elements.nextScore.src,'S1');assert(run('gains.S.gain.value===0&&gains.T.gain.value===1'));assert.equal(elements.referenceRows.children.length,2);assert.equal(elements.referenceRows.children[0].textContent,'Solo');
 elements.part.value='Solo';elements.part.onchange();assert.equal(elements.referenceRows.children.length,0);assert.equal(elements.score.src,'Solo0');
 context.currentTime=8;run('tick()');assert.equal(elements.score.src,'Solo1');assert.equal(elements.nextScore.src,'Solo2');assert(elements.location.textContent.startsWith('第 2 小节'));
 run('play()');assert.equal(elements.play.textContent,'▶ 继续练习');await run('play()');assert(run('playing'));
 run('selectBar(2)');assert.deepEqual(Array.from(run('range().slice(0,2)')),[4,7]);elements.countin.checked=false;await run('play()');assert(run('startBeat===4&&endBeat===7'));
 elements.loop.checked=true;context.currentTime=run('origin')+3*60/72+.1;run('tick()');await new Promise(resolve=>setImmediate(resolve));assert(run('playing&&startBeat===4&&endBeat===7'));
 run('stop();showSystem(2)');assert(elements.nextContext.hidden);assert.equal(elements.next.disabled,true);
 elements.part.value='T';elements.part.onchange();const noteButton=elements.pitchlist.children[0].children[1].children[0];assert(noteButton.textContent.startsWith('▶ '));await noteButton.onclick();assert.equal(elements.pitch.textContent,'E3');
 elements.slow.onclick();assert.equal(elements.tempo.value,54);elements.normal.onclick();assert.equal(elements.tempo.value,72);
 assert(template.indexOf('id="referenceRows"')<template.indexOf('id="ownLabel"'));
 const mixBefore=run('JSON.stringify({volumes,audible})');
 for(const p of DATA.parts){elements.part.value=p.id;elements.part.onchange();assert.equal(elements.ownLabel.textContent,p.name);assert.equal(elements.score.src,p.id+'2');assert.deepEqual(elements.referenceRows.children.filter((e,i)=>i%2===0).map(e=>e.textContent),DATA.parts.filter(q=>q.role==='solo'&&q.id!==p.id).map(q=>q.name));assert.equal(run('JSON.stringify({volumes,audible})'),mixBefore)}
 elements.part.value='T';elements.part.onchange();
 run('savePreferences();selected="B";loadPreferences()');assert(run('selected==="T"'));
 saved.set('choir-practice:'+DATA.title,JSON.stringify({selected:'T',preview:'B',references:['S','B'],volumes:{T:47},audible:{T:false}}));run('loadPreferences();showSystem(0)');assert(run('volumes.T===47&&!audible.T'));assert.equal(elements.nextScore.src,'T1');assert.equal(elements.referenceRows.children[0].textContent,'Solo');
 run('DATA.parts.find(p=>p.id==="T").lyrics[0].extend=true;DATA.parts.find(p=>p.id==="T").lyrics[0].extendTo=1;DATA.parts.find(p=>p.id==="T").events[1].bar=1;DATA.parts.find(p=>p.id==="T").events[1].x=.6');assert(run('lyricsSVG(part(),0).includes("lyric-extension")'));

 const originalMix=run('JSON.stringify({volumes,audible})');
 elements.referencePart.value='B';elements.referencePart.onchange();assert.equal(elements.referenceRows.children[0].textContent,'B');assert.equal(elements.score.src,'T0');assert.equal(elements.nextScore.src,'T1');assert.equal(run('JSON.stringify({volumes,audible})'),originalMix);
 run('referenceChoice="auto";loadPreferences();referenceChoices();showSystem(0)');assert.equal(elements.referenceRows.children[0].textContent,'B');
 elements.referencePart.value='';elements.referencePart.onchange();assert.equal(elements.referenceRows.children.length,0);
 elements.referencePart.value='B';elements.referencePart.onchange();elements.part.value='B';elements.part.onchange();assert.equal(elements.referenceRows.children.length,0);assert.equal(elements.referencePart.value,'');
 elements.part.value='T';elements.part.onchange();run('DATA.parts.find(p=>p.id==="Solo").role="voice";referenceChoice="auto";referenceChoices();showSystem(0)');assert.equal(elements.referenceRows.children.length,0);
 elements.referencePart.value='S';elements.referencePart.onchange();assert.equal(elements.referenceRows.children[0].textContent,'S');assert.equal(run('JSON.stringify({volumes,audible})'),originalMix);
 run('DATA.parts.find(p=>p.id==="Solo").role="solo";referenceChoice="auto";referenceChoices();showSystem(0)');assert.equal(elements.referenceRows.children[0].textContent,'Solo');
 run('stop()');console.log('PASS: independent listening/view/practice choices, six track switches and volumes, single optional reference, no-Solo fallback, next row follows practice part, preferences, variable meter, pause, loops and preview.');
})().catch(e=>{console.error(e);process.exitCode=1});
