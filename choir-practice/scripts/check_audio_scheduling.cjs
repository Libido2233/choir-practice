// Whole-song WebAudio simulation. Never opens an audio device.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
class Element{
 constructor(){Object.assign(this,{children:[],dataset:{},style:{},value:'',checked:false,disabled:false,hidden:false,textContent:'',className:'',scrollLeft:0,scrollWidth:1500,clientWidth:360,html:''});this.classList={toggle(){},remove(){}}}
 append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(k,v){this[k]=v}get firstElementChild(){return this.children[0]}get innerHTML(){return this.html}set innerHTML(v){this.html=v}querySelectorAll(){return []}
}
async function check(file){
 const html=fs.readFileSync(file,'utf8'),elements=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 elements.progress.append(new Element());elements.ownScroll.append(new Element());elements.from.value=1;
 let ctx,started=0,peak=0,late=0,live=new Set(),timers=new Map(),timerId=0;
 const records=[];
 function source(extra={}){
  const node={...extra,connect(){},disconnect(){},start(when){assert(Number.isFinite(when));if(when<ctx.currentTime-.001)late++;this.when=when;started++;live.add(this);records.push(this);peak=Math.max(peak,live.size)},stop(when){this.end=when??ctx.currentTime}};
  return node;
 }
 function ended(){for(const n of live)if(n.end<=ctx.currentTime){live.delete(n);n.onended?.()}}
 const param=()=>({value:1,scheduled:[],setValueAtTime(value,time){this.value=value;this.scheduled.push({value,time})},cancelScheduledValues(){this.scheduled=[]},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 class Audio{
  constructor(options){ctx=this;this.currentTime=0;this.sampleRate=22050;this.destination={};assert(options.latencyHint==='playback')}
  async resume(){}async decodeAudioData(){return {duration:20}}
  createGain(){return {gain:param(),connect(){},disconnect(){}}}createDynamicsCompressor(){return {connect(){}}}createBiquadFilter(){return {frequency:param(),connect(){}}}
  createBuffer(c,size){return {getChannelData(){return new Float32Array(Math.floor(size))}}}
  createBufferSource(){return source({playbackRate:{value:1}})}createOscillator(){return source({frequency:param()})}
 }
 const sandbox={document:{getElementById:id=>{assert(elements[id],id);return elements[id]},createElement:()=>new Element(),createTextNode:text=>({textContent:text})},window:{AudioContext:Audio,addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},console,atob:s=>Buffer.from(s,'base64').toString('binary'),setInterval(fn){timers.set(++timerId,fn);return timerId},clearInterval(id){timers.delete(id)}};
 vm.createContext(sandbox);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);const run=s=>vm.runInContext(s,sandbox);
 elements.countin.checked=false;elements.click.checked=false;elements.to.value=run('N');elements.tempo.value=run('DATA.bpm');
 await run('play()');assert(run('playing'));const initial=started,expected=run('DATA.parts.reduce((n,p)=>n+p.sounds.length,0)');
 assert(initial<expected*.5,'whole-song allocation at start');
 const begin=run('origin'),duration=run('(playbackPosition(endBeat)-playbackPosition(startBeat))*60/runTempo');
 let step=0;
 while(ctx.currentTime<begin+duration+.5){
  // Occasional 700 ms UI pauses remain inside the audio lookahead.
  ctx.currentTime+=++step%271===0?.7:.05;ended();run('scheduleAudio()');ended();
 }
 assert.equal(started,expected,'missing or duplicate notes');assert.equal(late,0,'scheduled after its intended onset');assert.equal(live.size,0,'finished nodes retained');assert.equal(run('nodes.length'),0);
 assert(peak<Math.max(100,expected*.3),'too many simultaneous scheduled sources');
 run('stop()');ended();assert.equal(timers.size,0,'timer left after stopping');
 // Real onset conversion must match the existing tempo/swing function.
 const reference=run(`DATA.parts.flatMap(p=>p.sounds.map(e=>origin+(typeof performanceAt==='function'?performanceAt(e.beat)-performanceAt(startBeat):e.beat-startBeat)*60/runTempo)).sort((a,b)=>a-b)`);
 const actual=records.map(r=>r.when).sort((a,b)=>a-b);assert.equal(reference.length,actual.length);
 for(let i=0;i<actual.length;i++)assert(Math.abs(actual[i]-reference[i])<1e-7,'tempo/swing timing changed');
 return {file:path.basename(file),status:'PASS',notes:expected,initialSources:initial,peakLiveSources:peak,lateStarts:late,finishedSourcesRetained:live.size,mockOnly:true};
}
(async()=>{const results=[];for(const file of process.argv.slice(2))results.push(await check(file));console.log(JSON.stringify(results,null,2))})().catch(e=>{console.error(e);process.exitCode=1});
