# 纸间研读 · 一间自己的房间

解压到同一个文件夹，双击 `index.html` 即可离线阅读。六章英文原文有逐句中译、场景插图和点词释义。全书生词表以 37 个精选词为起点。此后的“会／不会”和阅读位置保存在每位读者自己的浏览器。可以从生词表导出记录，再到另一台设备导入。

点「进入本章」或翻页，就能听当前屏的英文。字幕右下角的小喇叭可以重听。点词时可听单词发音，在释义旁点喇叭可再听一次。取消卡片上方的「自动朗读」即可安静阅读，喇叭仍可使用。全书采用英式女声 Emma。每句和每条原注已录成 MP3，保存在「纸间研读语音」文件夹。离线时直接播放，点词会播放该词在原句中的发音。移动网页时，请把录音文件夹一起移动。

## 发布到 GitHub Pages

1. 将解压后的文件与文件夹放在公开仓库的根目录。仓库首页应能直接看到 `index.html`、`data/`、`images/` 和 `纸间研读语音/`。图片较多时可以用 GitHub Desktop 把整个文件夹一次提交并推送。
2. 在仓库的 **Settings → Pages** 中，把 **Source** 设为 **Deploy from a branch**，选择存放网站的分支和 **/(root)**，然后保存。
3. 等待部署完成，在 Pages 设置页打开网站。核对第一章的插图，再点一个英文词查看中文和助记图。[GitHub Pages 发布说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 修改某个词的中文

打开 `data/basic-meanings.js`，搜索英文词头。竖线后是词性，等号右侧的大括号里每行是一条释义。修改双引号中的中文，保留引号与逗号，保存后刷新网页即可。比如可以把动词 `try` 的通释改为“尝试，试着做”。

在这本书里，*banks* 有一处专指河岸，*rose* 有时是“起身”，有时是“玫瑰”。书内已经逐句标定的语境义优先显示。编辑一个通用义时，其他语境义会继续使用自己的解释。

## 添加或更换助记图

将你有权公开分享的图片放入 `images/words/`。打开 `data/word-images.js`，照已有条目填写小写**词头**和从首页算起的相对路径。例如使用 `"shade": "images/words/shade.webp"`，新增条目时请在相邻两条之间保留逗号。文件名和扩展名的大小写要与图片一致。保存并刷新网页。该词标为“不会”时，本卡生词和全书生词表都会显示缩略图，点图即可放大。换一张已有图片时，也可以直接用相同文件名替换。

发布后，以上修改只需提交到同一个发布分支。书内明确标记为不宜配图的专名、缩写或特殊义项会继续隐藏词图。

## 来源

英文据 Virginia Woolf 的 *A Room of One’s Own*（1929），采用 Feedbooks 英文版的段落次序。中文为本学习材料的自译和语境讲解。部分通用释义取自 ECDICT，许可全文在 [LICENSE-ECDICT.txt](LICENSE-ECDICT.txt)。

朗读采用 Kokoro 的英式英语音色 bf_emma，录音随书保存。[Kokoro 模型说明](https://huggingface.co/hexgrad/Kokoro-82M) · [英式音色表](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md#british-english)
