# 声部练习室 · choir-practice

将合唱分声部乐谱或个人练唱的旋律谱整理成可离线使用的 HTML 练习页。

## 能做什么

- 切换练习声部，独立选择听音声部和音量。
- 对照五线谱、固定唱名简谱和结构化歌词练习。
- 慢练、分段循环、预备拍、节拍器和逐音试听。
- 可选一个参照声部；下一行跟随当前练习声部。
- 内嵌谱面、数据和钢琴采样；生成的 HTML 可单独分享。

单旋律乐谱也可使用；多声部提供额外的参照和混音功能。

## 使用

本仓库中的 `choir-practice/` 是完整 Skill。将该文件夹安装为 Skill 后，附上曲谱并向助手提出：

> 使用 $choir-practice，把这份乐谱做成本地练习网页。我练男高音，沿用默认界面。

个人练唱可改为：

> 使用 $choir-practice，把这份旋律谱做成个人练唱网页，保留简谱、歌词、慢练和逐音试听。

## 处理方式

优先使用 MusicXML/MXL。PDF 或图片需要识谱、逐部校对与谱面整理；自带生成器接收的是整理后的 JSON，不是直接把 PDF 一键转换。

生成器和项目检查器只需要 Python 标准库；播放器功能检查使用 Node.js。PDF 处理和识谱工具按输入另行准备。流程与数据格式见 `choir-practice/SKILL.md` 及其引用文件。

处理新谱仍需要音乐校对；不包含原唱音频扒谱、录音评分或完整声乐教学。手机打开本地 HTML 的方式取决于浏览器与文件管理器，分享前应在实际设备上试用。

## 素材

仓库仅包含 Skill、脚本、网页模板及采样，不包含社团曲谱或个人练习数据。钢琴采样为 Alexander Holm 的 Salamander Grand Piano，采用 CC BY 3.0；详细署名和来源见 `choir-practice/assets/piano/LICENSE.txt`。

## 许可证

代码、网页模板和 Skill 说明采用 [MIT 许可证](LICENSE)，允许使用、修改、分发和商用，需保留版权及许可声明。

钢琴采样不适用 MIT，仍按 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) 及[原素材许可](choir-practice/assets/piano/LICENSE.txt)使用。使用者导入的乐谱和歌词不属于本仓库的许可范围。
