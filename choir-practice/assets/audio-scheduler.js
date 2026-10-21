// BEGIN CHOIR AUDIO SCHEDULER v1
let scheduleTimer=null,audioQueue=[],queueIndex=0;
const AUDIO_AHEAD=1.5;
function playbackPosition(beat){return typeof performanceAt==='function'?performanceAt(beat):beat}
function trackSource(source,gain){
 nodes.push(source);
 source.onended=()=>{const i=nodes.indexOf(source);if(i>=0)nodes.splice(i,1);source.disconnect?.();gain.disconnect?.()};
}
function prepareAudioQueue(){
 const sec=60/runTempo,base=playbackPosition(startBeat);audioQueue=[];queueIndex=0;
 for(const p of DATA.parts)for(const e of p.sounds){
  const a=Math.max(startBeat,e.beat),b=Math.min(endBeat,e.beat+e.dur);if(b<=a)continue;
  const percussion=p.role==='percussion'||e.percussion;if(percussion&&e.beat<startBeat)continue;
  audioQueue.push({when:origin+(playbackPosition(a)-base)*sec,duration:(playbackPosition(b)-playbackPosition(a))*sec*(e.staccato?.55:1),id:p.id,midi:e.midi,percussion});
 }
 if($('click').checked)for(const b of DATA.bars){
  const pulse=4/b.beatType,phase=(b.pickupPhase||0)%pulse;
  for(let offset=phase?pulse-phase:0;offset<b.dur-.00001;offset+=pulse){const beat=b.beat+offset;if(startBeat<=beat&&beat<endBeat)audioQueue.push({when:origin+(playbackPosition(beat)-base)*sec,click:true,strong:offset===0})}
 }
 audioQueue.sort((a,b)=>a.when-b.when);
 scheduleAudio();scheduleTimer=setInterval(scheduleAudio,40);
}
function scheduleAudio(){
 if(!playing)return;
 const now=ctx.currentTime,horizon=now+AUDIO_AHEAD;
 while(queueIndex<audioQueue.length&&audioQueue[queueIndex].when<=horizon){
  const e=audioQueue[queueIndex++];
  if(e.click){if(e.when>=now-.02)click(Math.max(e.when,now+.005),e.strong);continue}
  if(e.when+e.duration<=now+.005)continue;
  const when=Math.max(e.when,now+.005),duration=e.duration-(when-e.when);
  if(e.percussion){if(e.when>=now-.04)drum(e.midi,when,e.id)}else tone(e.midi,when,duration,e.id);
 }
}
// END CHOIR AUDIO SCHEDULER v1
