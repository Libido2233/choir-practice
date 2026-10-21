"""Upgrade scheduling only; retain each page's data, score, UI and timing extensions."""
from pathlib import Path
import re

SKILL=Path(__file__).resolve().parents[1]
def upgrade(html):
    html=re.sub(r'// BEGIN CHOIR AUDIO SCHEDULER v1.*?// END CHOIR AUDIO SCHEDULER v1\s*','',html,flags=re.S)
    html=re.sub(r'// Keep only a short audio horizon alive, independent of score redraws\..*?(?=function kill\(\))','',html,flags=re.S)
    cleanup='clearInterval(scheduleTimer);scheduleTimer=null;audioQueue=[];queueIndex=0;'
    html=html.replace('function kill(){'+cleanup,'function kill(){')
    # All prior player versions use the same adjacent score/click scheduling loops.
    html,count=re.subn(r' for\(const p of DATA.parts\)for\(const e of p.sounds\)\{const a=.*?\n if\(\$\(\x27click\x27\)\.checked\).*?\n',' prepareAudioQueue();\n',html,count=1,flags=re.S)
    if not count and ' prepareAudioQueue();' not in html:
        raise ValueError('Unrecognized scheduling block; original page preserved')
    html=html.replace('nodes.push(source);','trackSource(source,g);').replace('nodes.push(source)}','trackSource(source,g)}')
    if html.count('function kill(){')!=1:raise ValueError('Expected one stop/cleanup handler')
    scheduler=(SKILL/'assets/audio-scheduler.js').read_text(encoding='utf-8')
    html=html.replace('function kill(){',scheduler+'\nfunction kill(){'+cleanup)
    html=html.replace('ctx=new Audio();','ctx=new Audio({latencyHint:"playback"});').replace('timer=setInterval(tick,35)','timer=setInterval(tick,80)')
    assert html.count('function prepareAudioQueue(){')==1 and html.count('nodes.push(source)')==1
    return html

if __name__=='__main__':
    import sys
    for name in sys.argv[1:]:
        path=Path(name);old=path.read_text(encoding='utf-8');new=upgrade(old)
        if new!=old:path.write_text(new,encoding='utf-8')
        print('Updated',path.name)
