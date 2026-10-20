# 播放器数据和生成

`scripts/build_player.py` 将校正后的数据、原谱切片、简谱和钢琴采样嵌入单文件 HTML。它负责验证与打包；识谱、音符校正、简谱绘制先按 `score-workflow.md` 完成。

```powershell
python <Skill目录>/scripts/build_player.py 已校正练习数据.json --output "声部练习室 - 曲名.html"
python <Skill目录>/scripts/build_player.py 待校对数据.json --output 识谱草稿.html --draft
python <Skill目录>/scripts/check_project.py 已校正练习数据.json --html "声部练习室 - 曲名.html"
python <Skill目录>/scripts/build_player.py --self-test
```

`check_project.py` 只读取文件，核对数据时序、谱面资源、成品内嵌数据和实际采样内容，不播放声音；不依赖 `data:audio/` 等字符串猜测资源是否完整。

路径参数均由调用方传入。数据内相对图像路径按 JSON 所在目录解析；HTML 不依赖原路径。生成器拒绝覆盖已有文件，更新时明确加 `--overwrite`。

已具备 Node.js 时，可运行 `node <Skill目录>/scripts/check_player.cjs` 检查六声部独立音量、声部切换、当前/下一行、变拍、暂停和循环逻辑。这个检查使用模拟音频与界面，不替代真实浏览器试听和手机测试。

## 数据结构

时间统一以四分音符为 1 拍；`bar` 为数组中小节的序号（从 1 开始），`label` 可保留弱起、原谱小节号或反复次数。`system` 从 0 开始。示意：

```json
{
  "title": "曲名",
  "bpm": 72,
  "defaultPart": "Melody",
  "notation": "固定唱名 1=C · 中音1=C4",
  "bars": [
    {"label": "1", "beat": 0, "dur": 4, "system": 0, "beats": 4, "beatType": 4, "left": 0.08, "right": 0.95}
  ],
  "parts": [
    {
      "id": "Melody", "name": "旋律", "role": "voice", "verified": true,
      "events": [
        {"eventIndex": 0, "bar": 1, "beat": 0, "dur": 1, "midi": 60, "name": "C4", "x": 0.15},
        {"bar": 1, "beat": 1, "dur": 3, "midi": null, "name": "休止", "x": 0.4}
      ],
      "sounds": [{"bar": 1, "beat": 0, "dur": 1, "midi": 60}],
      "lyrics": [{"eventIndex": 0, "text": "啊", "verse": 1, "syllabic": "single"}],
      "systems": [{"image": "谱面/旋律-01.png", "numbers": "简谱/旋律-01.svg"}]
    }
  ]
}
```

- `defaultPart` 用于明确指定练习轨；省略时按数据顺序选择第一个演唱轨（voice/solo），无演唱轨时选第一轨。
- 可选 `melodyGuide`：`[{"startBeat":0,"endBeat":8,"part":"S"},{"startBeat":8,"endBeat":16,"part":null}]`。按已核对的旋律交接连续覆盖全曲，起拍含、结束拍不含；弱起可在小节内交接。`null` 表示此段不指定参照。它选择原轨作练习参照，不生成新主唱轨或改写音符。页面“跟随旋律”按拍换谱，默认只听自己100%与当段参照50%；参照等于自己时只听自己。手动音量和勾选覆盖该轨的自动设置，切换练习声部时重置；手动选择参照谱不改变听音。
- `parts` 可包含一个旋律轨或多个声部。`role` 用 `voice`、`solo`、`accompaniment` 或 `percussion`；声部分部用不同 `id`。Solo 可有多个。适用于合唱团与带伴奏的合唱。
- `events` 是谱面事件，含休止（`midi:null`）、装饰音（`grace:true`）、备选音（`optional:true`）和逐音试听；`x` 是相对整张谱图的横坐标 0–1。连音组和记号保存在结构化源文件及简谱 SVG 中。
- `sounds` 是已经合并延音、安排装饰音的实际播放事件。时间轴以 `beat` 与 `dur` 为准，不从唱名反推声音。打击乐使用 GM MIDI drum key（例如 36 底鼓、38 军鼓、42 踩镲），播放用简易鼓音色。
- `lyrics` 是歌词的文字记录数组，原谱未填词时为空。每条用 `eventIndex` 关联音符，含 `text`、`verse`、`syllabic`；可提供 `endBeat` 表示演唱终点，`extend:true` 与 `extendTo` 表示拖音线及末音符编号。生成器从音符推导小节、起拍和行号；页面用文字排版，不把歌词放进图片。谱图须去掉原歌词，防止重复；保留原谱音乐记号。音符 `numberX` 或 `x` 用于横向对齐。
- `verified` 仅在实际完成该声部校对后设为 true；正式生成要求所有声部已核对。
- 原谱某行未列出声部时，行数据可标 `sourceAbsent:true`，提供文字提示谱图及空白简谱；时间轴占位休止不能当作原谱明确休止。
- 每个声部的 `systems` 长度须等于全局行数，每行都包含该声部图和简谱；整行休止也照常保留。行图为同一小节范围，图像和数字使用一致的横坐标。
- `image` 支持本地图像、完整 SVG 或图像 data URL；`numbers` 支持 SVG 文件或完整 SVG 字符串。SVG 字符上的 `data-beat`、`data-duration` 可驱动逐音高亮；使用 `data-event` 标记每个音/休止。
- 总时长来自小节末端。变拍通过每小节 `dur`/`beats`/`beatType` 表达。不要在休止处压缩各轨时间。速度是本次练习的固定 BPM，速度变化需另行扩展后验证。

## 自包含与署名

生成器使用 Skill 自带的四个钢琴采样，采用 Salamander Grand Piano / Alexander Holm，CC BY 3.0，保留 `assets/piano/LICENSE.txt`；播放时进行移调和包络处理。输入图/SVG仅使用可信本地材料，拒绝含脚本、外部链接和事件处理器的 SVG。

