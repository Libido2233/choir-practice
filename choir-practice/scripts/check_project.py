#!/usr/bin/env python3
"""Read-only verification of source data and its generated player; no audio."""
import argparse
import base64
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from build_player import prepare, SKILL, SAMPLES


def check_html(data, html):
    match = re.search(r"const\s+DATA\s*=", html)
    if not match:
        raise ValueError("页面缺少练习数据 DATA")
    decoder = json.JSONDecoder()
    source = html[match.end():].lstrip()
    embedded, end = decoder.raw_decode(source)
    tail = source[end:]
    piano = re.match(r",\s*PIANO\s*=\s*", tail)
    if not piano:
        raise ValueError("页面缺少钢琴采样 PIANO")
    samples, _ = decoder.raw_decode(tail[piano.end():])
    if embedded != data:
        raise ValueError("页面数据与当前 JSON 不一致，请重新生成")
    if not isinstance(samples, dict) or set(samples) != {str(k) for k in SAMPLES}:
        raise ValueError("钢琴采样不完整")
    for midi, name in SAMPLES.items():
        if base64.b64decode(samples[str(midi)], validate=True) != (SKILL / "assets/piano" / (name + ".mp3")).read_bytes():
            raise ValueError("钢琴采样内容不一致：" + name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--html", type=Path)
    parser.add_argument("--draft", action="store_true")
    args = parser.parse_args()
    data = prepare(json.loads(args.input.read_text(encoding="utf-8-sig")), args.input.resolve().parent, args.draft)
    if args.html:
        check_html(data, args.html.read_text(encoding="utf-8-sig"))
    print(f"PASS：{len(data['parts'])}声部、{len(data['bars'])}小节、{data['systemCount']}行，数据和谱面资源有效。")
    if args.html:
        print("PASS：页面与源数据一致，四个内嵌钢琴采样完整；检查未播放声音。")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, KeyError, OSError, ET.ParseError) as exc:
        print("检查失败：" + str(exc), file=sys.stderr)
        sys.exit(1)
