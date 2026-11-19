'use strict';
(() => {
  const source = window.PaperStudyRelease;
  const book = source.book;
  const dictionary = source.lookup;
  const images = source.images;
  const own = (obj, key) => Object.hasOwn(obj, key);

  // 语境义已经按句子和词性核对。基础释义只填入需要通释的词条。
  for (const entry of dictionary.entries) {
    if (!entry.basicKey) continue;
    const meaning = source.basic[entry.basicKey];
    if (typeof meaning !== 'string' || !meaning.trim()) {
      throw new Error('缺少基本释义：' + entry.basicKey);
    }
    entry.zh = meaning;
    delete entry.basicKey;
  }
  // 保留旧图的资源编号，让正文词卡、助记说明和原有精选卡同步使用替换后的图片。
  const paths = source.wordImages;
  const aliases = source.wordAssetIds;
  dictionary.art = {};
  for (const [lemma, path] of Object.entries(paths)) {
    if (!path) continue;
    if (typeof path !== 'string') throw new Error('词图路径应为字符串：' + lemma);
    if (own(aliases, lemma)) {
      const key = aliases[lemma];
      images[key] = path;
      dictionary.art[lemma] = {asset: key};
    } else {
      dictionary.art[lemma] = {file: path};
    }
  }
  book.lookup = dictionary;
  window.PaperStudyPublicLibrary = {books: [book], images};
})();
