#!/usr/bin/env python3
"""Validate corrected choir data and embed it in a portable offline player."""
import argparse
import base64
import copy
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SAMPLES = {48: "C3", 54: "Fs3", 60: "C4", 66: "Fs4"}


def number(value, name, low=0):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} 必须是数字")
    if not math.isfinite(value) or value < low:
        raise ValueError(f"{name} 数值不合法")
    return value


def static_svg(source):
    if re.search(r"<!DOCTYPE|<!ENTITY", source, re.I):
        raise ValueError("SVG 含外部声明")
    root = ET.fromstring(source)
    if root.tag.split("}")[-1] != "svg":
        raise ValueError("简谱应为 SVG")
    blocked = {"script", "foreignobject", "iframe", "object", "embed", "animate", "set"}
    for node in root.iter():
        if node.tag.split("}")[-1].lower() in blocked:
            raise ValueError("SVG 含动态内容")
        for key, value in node.attrib.items():
            key = key.split("}")[-1].lower()
            if key.startswith("on") or (key in {"href", "src"} and not value.startswith("#")):
                raise ValueError("SVG 含事件或外部资源")
    if re.search(r"@import|expression\s*\(", source, re.I):
        raise ValueError("SVG 含动态样式")
    for url in re.findall(r"url\s*\(([^)]*)\)", source, re.I):
        if not url.strip(" \t\r\n\"'").startswith("#"):
            raise ValueError("SVG 引用了外部资源")
    return source


def resource(value, base, svg=False):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("每一行均需要五线谱与简谱资源")
    if value.lstrip().startswith("<"):
        source = static_svg(value)
        return source if svg else "data:image/svg+xml;base64," + base64.b64encode(source.encode()).decode()
    if value.startswith("data:image/"):
        if svg:
            raise ValueError("简谱使用 SVG 文件或完整 SVG 文本")
        match = re.fullmatch(r"data:image/(png|jpeg|webp|svg\+xml);base64,([A-Za-z0-9+/=\s]+)", value)
        if not match:
            raise ValueError("仅接收内嵌 PNG/JPEG/WebP/SVG 图像")
        content = base64.b64decode(match[2], validate=True)
        if match[1] == "svg+xml":
            static_svg(content.decode("utf-8-sig"))
        return value
    if re.match(r"(?:https?:|file:|javascript:|//)", value, re.I):
        raise ValueError("资源请先保存为本地文件")
    path = Path(value)
    if not path.is_absolute():
        path = base / path
    if svg or path.suffix.lower() == ".svg":
        return resource(path.read_text(encoding="utf-8-sig"), base, svg)
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(path.suffix.lower())
    if not mime:
        raise ValueError(f"不支持的图像格式：{path.name}")
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def prepare(raw, base, draft=False):
    data = copy.deepcopy(raw)
    if not isinstance(data.get("title"), str) or not data["title"].strip():
        raise ValueError("请填写曲名 title")
    bpm = number(data.get("bpm"), "bpm", 20)
    if bpm > 300:
        raise ValueError("BPM 应在 20–300 范围")
    bars = data.get("bars", [])
    if not bars:
        raise ValueError("缺少小节 bars")
    end = 0
    system = 0
    for i, bar in enumerate(bars, 1):
        beat = number(bar.get("beat"), f"第{i}小节起拍")
        dur = number(bar.get("dur"), f"第{i}小节时长", 0.000001)
        if abs(beat - end) > 0.00001:
            raise ValueError(f"第{i}小节与前一小节未连续对齐")
        sid = bar.get("system")
        if type(sid) is not int or sid not in ({0} if i == 1 else {system, system + 1}):
            raise ValueError("行号 system 应从 0 连续递增")
        system = sid
        bar.update(number=i, label=str(bar.get("label", i)))
        beats = number(bar.get("beats", 4), "拍号分子", 1)
        beat_type = number(bar.get("beatType", 4), "拍号分母", 1)
        if int(beats) != beats or int(beat_type) != beat_type or beat_type not in {1, 2, 4, 8, 16, 32, 64}:
            raise ValueError("拍号需使用整数分子和有效分母")
        if dur > beats * 4 / beat_type + 0.00001:
            raise ValueError(f"第{i}小节超出拍号时长")
        bar.update(beats=beats, beatType=beat_type)
        for key in ("left", "right"):
            if key in bar and number(bar[key], key) > 1:
                raise ValueError("小节横坐标应在 0–1 之间")
        if "left" in bar and "right" in bar and bar["left"] >= bar["right"]:
            raise ValueError("小节左边界应小于右边界")
        end = beat + dur
    parts = data.get("parts", [])
    if not parts:
        raise ValueError("缺少声部 parts")
    seen, unchecked = set(), []
    for part in parts:
        pid = part.get("id", "")
        if not isinstance(pid, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", pid) or pid in seen:
            raise ValueError("声部 id 应唯一，使用英文、数字、短横线或下划线")
        seen.add(pid)
        if not isinstance(part.get("name"), str) or not part["name"].strip():
            raise ValueError(f"{pid} 缺少声部名称")
        if part.get("role", "voice") not in {"voice", "solo", "accompaniment", "percussion"}:
            raise ValueError(f"{pid} 的 role 不合法")
        part.setdefault("role", "voice")
        if part.get("verified") is not True:
            unchecked.append(part["name"])
        for field in ("events", "sounds"):
            if not isinstance(part.get(field), list):
                raise ValueError(f"{pid} 缺少 {field}")
            for e in part[field]:
                n = e.get("bar")
                if type(n) is not int or not 1 <= n <= len(bars):
                    raise ValueError(f"{pid} 事件缺少有效 bar")
                b = bars[n - 1]
                st = number(e.get("beat"), "事件起拍")
                dur = number(e.get("dur"), "事件时长")
                if dur == 0 and not (field == "events" and e.get("grace")):
                    raise ValueError("非装饰音时长应大于 0")
                if not b["beat"] - 0.00001 <= st < b["beat"] + b["dur"] + 0.00001:
                    raise ValueError(f"{pid} 第{n}小节事件起拍超界")
                if st + dur > (end if field == "sounds" else b["beat"] + b["dur"]) + 0.00001:
                    raise ValueError(f"{pid} 第{n}小节事件结束超界")
                pitch = e.get("midi")
                if pitch is None and field == "sounds":
                    raise ValueError("sounds 中仅放有声音的事件")
                if pitch is not None and (type(pitch) is not int or not 0 <= pitch <= 127):
                    raise ValueError("MIDI 音高应为 0–127 的整数")
                if "x" in e and e["x"] is not None and number(e["x"], "横坐标") > 1:
                    raise ValueError("音符横坐标应在 0–1 之间")
        part["events"].sort(key=lambda e: (e["beat"], not e.get("grace", False)))
        part["sounds"].sort(key=lambda e: e["beat"])
        for i, event in enumerate(part["events"]):
            event.setdefault("eventIndex", i)
            if type(event["eventIndex"]) is not int or event["eventIndex"] < 0:
                raise ValueError("eventIndex 应为非负整数")
        indices = {e["eventIndex"]: e for e in part["events"]}
        if len(indices) != len(part["events"]):
            raise ValueError(f"{pid} 的 eventIndex 应唯一")
        lyrics = part.setdefault("lyrics", [])
        if not isinstance(lyrics, list):
            raise ValueError("lyrics 应为歌词记录数组")
        for lyric in lyrics:
            if not isinstance(lyric.get("text"), str) or not lyric["text"].strip():
                raise ValueError("歌词缺少文字 text")
            event = indices.get(lyric.get("eventIndex"))
            if event is None or event["midi"] is None or event.get("grace") or event.get("optional"):
                raise ValueError("歌词须关联实际演唱音符的 eventIndex")
            lyric.update(bar=event["bar"], beat=event["beat"], system=bars[event["bar"]-1]["system"])
            lyric.setdefault("verse", 1)
            if type(lyric["verse"]) is not int or lyric["verse"] < 1:
                raise ValueError("歌词 verse 应为正整数")
            lyric.setdefault("endBeat", event["beat"]+event["dur"])
            if number(lyric["endBeat"], "歌词结束拍") < event["beat"] or lyric["endBeat"] > end+0.00001:
                raise ValueError("歌词时序超出有效范围")
            if lyric.get("extendTo") is not None and lyric["extendTo"] not in indices:
                raise ValueError("歌词延长目标音符不存在")
        rows = part.get("systems", [])
        if len(rows) != system + 1:
            raise ValueError(f"{pid} 的谱面行数与全局行号不一致")
        for row in rows:
            row["image"] = resource(row.get("image"), base)
            row["numbers"] = resource(row.get("numbers"), base, svg=True)
    guide = data.get("melodyGuide")
    if guide is not None:
        if not isinstance(guide, list) or not guide:
            raise ValueError("melodyGuide 应为非空分段数组")
        previous = 0
        for segment in guide:
            if not isinstance(segment, dict):
                raise ValueError("旋律参照分段须为对象")
            start = number(segment.get("startBeat"), "旋律参照起拍")
            finish = number(segment.get("endBeat"), "旋律参照结束拍")
            if abs(start - previous) > 0.00001 or finish <= start or finish > end + 0.00001:
                raise ValueError("旋律参照分段须连续覆盖全曲，结束拍大于起拍")
            pid = segment.get("part")
            if pid is not None and not any(p["id"] == pid and p["role"] in {"voice", "solo"} for p in parts):
                raise ValueError("旋律参照须使用现有演唱声部或 null")
            previous = finish
        if abs(previous - end) > 0.00001:
            raise ValueError("旋律参照分段须覆盖至曲末")
    if unchecked and not draft:
        raise ValueError("以下声部尚未核对：" + "、".join(unchecked) + "；初稿可使用 --draft")
    default = data.get("defaultPart") or next((p["id"] for p in parts if p["role"] in {"voice", "solo"}), parts[0]["id"])
    if default not in seen:
        raise ValueError("defaultPart 不是现有声部")
    data.update(defaultPart=default, totalBeats=end, systemCount=system + 1, unchecked=unchecked)
    data.setdefault("notation", "固定唱名 1=C · 中音1=C4")
    return data


def render(data):
    piano = {midi: base64.b64encode((SKILL / "assets/piano" / f"{name}.mp3").read_bytes()).decode() for midi, name in SAMPLES.items()}
    def dump(value):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    template = (SKILL / "assets/player.html").read_text(encoding="utf-8")
    return template.replace("__CHOIR_DATA__", dump(data)).replace("__PIANO_SAMPLES__", dump(piano))


def self_test():
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 80"><text x="30" y="40">1 2 3 0</text></svg>'
    raw = {"title": "生成器自检", "bpm": 72, "bars": [{"beat": 0, "dur": 4, "system": 0}], "parts": []}
    for pid in ("Solo", "S", "A", "T", "B", "Drums"):
        raw["parts"].append({"id": pid, "name": pid, "role": "solo" if pid == "Solo" else "percussion" if pid == "Drums" else "voice", "verified": True, "events": [{"bar": 1, "beat": 0, "dur": 4, "midi": 60, "name": "C4"}], "sounds": [{"bar": 1, "beat": 0, "dur": 4, "midi": 60}], "systems": [{"image": svg, "numbers": svg}]})
    raw['parts'][0]['lyrics']=[{'eventIndex':0,'text':'啊','verse':1}]
    data = prepare(raw, Path.cwd())
    assert data['parts'][0]['lyrics'][0]['beat']==0 and data['parts'][0]['lyrics'][0]['endBeat']==4
    assert len(data["parts"]) == 6 and data["defaultPart"] == "Solo" and data["totalBeats"] == 4
    specified = copy.deepcopy(raw)
    specified["defaultPart"] = "T"
    assert prepare(specified, Path.cwd())["defaultPart"] == "T"
    reordered = copy.deepcopy(raw)
    reordered["parts"] = [reordered["parts"][-1]] + reordered["parts"][:-1]
    assert prepare(reordered, Path.cwd())["defaultPart"] == "Solo"
    single = copy.deepcopy(raw)
    single["parts"] = [single["parts"][1]]
    single["parts"][0].update(id="Melody", name="旋律", role="voice")
    assert prepare(single, Path.cwd())["defaultPart"] == "Melody"
    html = render(data)
    guided = copy.deepcopy(raw)
    guided['melodyGuide'] = [{'startBeat': 0, 'endBeat': 2, 'part': 'S'}, {'startBeat': 2, 'endBeat': 4, 'part': None}]
    assert prepare(guided, Path.cwd())['melodyGuide'][0]['part'] == 'S'
    for field, value in [('part', 'Drums'), ('part', 'Missing'), ('startBeat', 1), ('endBeat', 5)]:
        broken_guide = copy.deepcopy(guided)
        broken_guide['melodyGuide'][0][field] = value
        try:
            prepare(broken_guide, Path.cwd())
            raise AssertionError('未拒绝无效旋律参照')
        except ValueError:
            pass
    assert "__CHOIR_DATA__" not in html and 'data:image/svg+xml;base64,' in html
    broken = copy.deepcopy(raw)
    broken["parts"][1]["verified"] = False
    try:
        prepare(broken, Path.cwd())
        raise AssertionError("未拒绝未校对成品")
    except ValueError as e:
        assert "尚未核对" in str(e)
    assert prepare(broken, Path.cwd(), True)["unchecked"] == ["S"]
    for bad in ('<svg><script>bad()</script></svg>', '<svg><image href="https://example.com/x.png"/></svg>'):
        try:
            static_svg(bad)
            raise AssertionError("未拒绝动态 SVG")
        except ValueError:
            pass
    broken = copy.deepcopy(raw)
    broken["bars"][0]["beat"] = 1
    try:
        prepare(broken, Path.cwd())
        raise AssertionError("未拒绝错位小节")
    except ValueError:
        pass
    bad_lyrics=copy.deepcopy(raw)
    bad_lyrics['parts'][0]['lyrics'][0]['eventIndex']=99
    try:
        prepare(bad_lyrics,Path.cwd())
        raise AssertionError('未拒绝无效歌词音符关联')
    except ValueError:
        pass
    print("PASS：六声部数据、歌词音符关联、谱图内嵌、校对标记、时序边界和静态 SVG 检查。")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--draft", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.input or not args.output:
        parser.error("请提供输入 JSON 和 --output HTML 路径")
    if args.output.resolve() == args.input.resolve():
        raise ValueError("输出文件不能覆盖输入数据")
    if args.output.suffix.lower() != ".html":
        raise ValueError("输出文件应使用 .html 扩展名")
    data = prepare(json.loads(args.input.read_text(encoding="utf-8-sig")), args.input.resolve().parent, args.draft)
    result = render(data)
    with args.output.open("w" if args.overwrite else "x", encoding="utf-8") as f:
        f.write(result)
    print(f"已生成：{args.output.resolve()}；{len(data['parts'])} 声部，{len(data['bars'])} 小节。")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, ET.ParseError) as exc:
        print(f"生成失败：{exc}", file=sys.stderr)
        sys.exit(1)
