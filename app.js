'use strict';
const library=window.PaperStudyPublicLibrary;
const books=library.books;
const $=(sel,el=document)=>el.querySelector(sel);
const $$=(sel,el=document)=>[...el.querySelectorAll(sel)];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={book:'<path d="M3 4.5c3.6-.7 6.6-.1 9 1.8v14c-2.8-1.8-6-2.4-9-1.9zM21 4.5c-3.6-.7-6.6-.1-9 1.8v14c2.8-1.8 6-2.4 9-1.9z"/>',cards:'<rect x="6.7" y="6.5" width="14.1" height="13.5" rx="2"/><path d="m3 16-.6-11.5a1.8 1.8 0 0 1 1.8-2l12.2-.5"/>',library:'<path d="M3 4h4v15H3zM9 4h4v15H9zM15 5l3.2-1 4 14-3.2 1z"/>',chev:'<path d="m6 9 6 6 6-6"/>',arr:'<path d="M4 12h15m-6-6 6 6-6 6"/>',prev:'<path d="m15 5-7 7 7 7"/>',next:'<path d="m9 5 7 7-7 7"/>',list:'<path d="M7 5h14M7 12h14M7 19h14M2 5h.1M2 12h.1M2 19h.1"/>',x:'<path d="m5 5 14 14M19 5 5 19"/>',pen:'<path d="m4 15-1 6 6-1L20 9l-5-5zM13 6l5 5"/>',check:'<path d="m4 12 5 5L20 6"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>'};
const svg=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
paths.speaker='<path d="M11 5 6 9H3v6h3l5 4zM15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>';
const icon=name=>'<i aria-hidden="true" data-icon="'+name+'">'+svg(name)+'</i>';
$$('[data-icon]').forEach(el=>el.innerHTML=svg(el.dataset.icon));
const cache=new Map();
function read(key){try{return localStorage.getItem('paperstudy.public.v1.'+key)??cache.get(key)??''}catch{return cache.get(key)||''}}
function save(key,value){cache.set(key,value);try{localStorage.setItem('paperstudy.public.v1.'+key,value);return true}catch{return false}}
// 全书预先录音。翻页和点词只改变本地录音的播放区间，共用同一个播放器。
let currentCaption=null;
let narrationControl=null;
let endNarration=null;
let recordingPlayer=null;
const recordingsFolder='纸间研读语音/';
function stopNarration(){
 const end=endNarration;endNarration=null;narrationControl=null;
 if(end)end();
}
function autoNarration(){return read('narration.room.auto')!=='off'}
function recordedExcerpt(id,first=null,last=null,fromStart=false,toEnd=false){
 const track=window.paperStudyAudio?.tracks[id];
 if(!track)return null;
 return {file:track.file,start:fromStart?0:track.words[first]?.[0]??0,
  end:toEnd?track.duration:track.words[last]?.[1]??track.duration};
}
function narrate(excerpt,button){
 stopNarration();
 if(!button?.isConnected)return;
 const status=button.closest('#word-lookup,dialog')?.querySelector('[data-speech-status]')||document.querySelector('#lesson [data-speech-status]');
 const message=value=>{if(status){status.textContent=value;status.hidden=!value}};
 message('');
 if(!excerpt){message('找不到本地录音。请把「纸间研读语音」文件夹与网页放在一起，再点喇叭。');return}
 if(!recordingPlayer){recordingPlayer=new Audio();recordingPlayer.preload='auto'}
 const audio=recordingPlayer, url=new URL(recordingsFolder+encodeURIComponent(excerpt.file),document.baseURI).href;
 let timer=0;
 const events=new AbortController();
 function cancel(){
  clearTimeout(timer);events.abort();audio.pause();button.classList.remove('is-speaking');
 }
 function finish(){
  if(endNarration===cancel)stopNarration();
 }
 function fail(){
  if(endNarration!==cancel)return;
  finish();message('这段录音未能播放。请确认「纸间研读语音」文件夹完整，再点喇叭重试。');
 }
 function checkTime(){
  clearTimeout(timer);
  const remaining=excerpt.end-audio.currentTime;
  if(remaining<=0.009){finish();return}
  if(!audio.paused)timer=setTimeout(checkTime,Math.min(250,Math.max(12,remaining*1000)));
 }
 const on=(event,listener)=>audio.addEventListener(event,listener,{signal:events.signal});
 endNarration=cancel;narrationControl=button;
 on('error',()=>{if(audio.error)fail()});on('ended',()=>{if(audio.ended)finish()});on('timeupdate',checkTime);
 on('playing',()=>{button.classList.add('is-speaking');checkTime()});
 if(audio.src!==url||audio.error)audio.src=url;
 // 在点击事件内发起播放；媒体元数据未就绪时浏览器保存此次起点。
 audio.currentTime=excerpt.start;
 audio.play().catch(err=>{if(err.name!=='AbortError')fail()});
}
function speakCaption(automatic=false){
 if(automatic&&!autoNarration()){stopNarration();return}
 if(currentCaption)narrate(currentCaption.excerpt(),currentCaption.button);
}
function speechButton(attr,label){
 return '<button type="button" '+attr+' class="speech-button" aria-label="'+escapeHTML(label)+'" title="'+escapeHTML(label)+'">'+icon('speaker')+'</button>';
}
function captionExcerpt(paragraph,frame,firstPage,lastPage){
 const id=paragraph.dataset.lookupSid;
 if(firstPage&&lastPage)return recordedExcerpt(id,null,null,true,true);
 const bounds=frame.getBoundingClientRect();
 const visible=[...paragraph.querySelectorAll('[data-lookup-i]')].filter(el=>[...el.getClientRects()].some(r=>{
  const x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
  return r.width>0&&r.height>0&&x>=bounds.left&&x<bounds.right&&y>=bounds.top-1&&y<bounds.bottom+1;
 }));
 const track=window.paperStudyAudio?.tracks[id];
 if(!track||!visible.length)return null;
 const first=Number(visible[0].dataset.lookupI),last=Number(visible[visible.length-1].dataset.lookupI);
 const clip=recordedExcerpt(id,first,last,firstPage,lastPage);
 // 句中出现数字或停顿时，前一屏一直读到下一屏首词之前。
 if(!lastPage&&track.words[last+1])clip.end=track.words[last+1][0];
 return clip;
}
const speechStatus='<p class="speech-status" data-speech-status role="status" hidden></p>';
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNarration()});
window.addEventListener('pagehide',stopNarration);
function savedPosition(book){const p=read('pos.'+book.id);return book.chapters.flatMap(c=>c.cards).some(c=>c.id===p)?p:book.chapters[0].cards[0].id}
const bookCards=b=>b.chapters.flatMap(ch=>ch.cards);
const wordCount=b=>new Set(bookCards(b).flatMap(c=>c.v.map(v=>v.w))).size;
const chnum=n=>'第 '+n+' 章';
const two=n=>String(n).padStart(2,'0');
let book,chapter,card,mode='read',filter='all',reviewIndex=0,revealed=false;
let captionObserver;
let nextFullBookEdge=null;
let startBookAtBeginning=new URLSearchParams(location.search).get('read')==='begin';
const dlg=$('#menu');
function bindAssets(el){
 $$('img[data-asset]',el).forEach(im=>{const url=library.images[im.dataset.asset];if(url)im.src=url;});
}
function asset(id,cls,alt){return '<img class="'+cls+'" data-asset="'+escapeHTML(id)+'" alt="'+escapeHTML(alt)+'">'}
function go(b,cardId,scroll=true){
 const chunk=cardId.split('-');
 const route='#'+b.id+'/'+chunk[1]+'/'+chunk[2];
 if(location.hash!==route)history.pushState(null,'',route);
 loadRoute();
 $('.side').classList.remove('open');$('#fold').setAttribute('aria-expanded','false');
 if(scroll)scrollToWork();
 if(mode==='read'&&b.id==='room')speakCaption(true);
}
function scrollToWork(){requestAnimationFrame(()=>$('#workspace').scrollIntoView({behavior:'instant',block:'start'}))}
function loadRoute(){
 const oldBook=book?.id;
 const [id,where,item]=decodeURI(location.hash.slice(1)).split('/');
 book=books.find(b=>b.id===id)||books[0];
 if(oldBook!==book.id){filter='all';reviewIndex=0;revealed=false}
 const auxiliary=where==='review'||(book.lookup&&where==='words');
 const fallback=savedPosition(book).split('-');
 const ch=Number(auxiliary?fallback[1]:where)||Number(fallback[1]);
 chapter=book.chapters.find(c=>c.num===ch)||book.chapters[0];
 const ci=Number(auxiliary?fallback[2]:item)||Number(fallback[2]);
 card=chapter.cards[ci-1]||chapter.cards[0];
 mode=auxiliary?(book.lookup?'words':'review'):'read';
 if(mode==='read')save('pos.'+book.id,card.id);
 render();
}
function showRead(){go(book,savedPosition(book),true)}
function showReview(){const route='#'+book.id+(book.lookup?'/words':'/review');if(location.hash!==route)history.pushState(null,'',route);loadRoute();scrollToWork()}
function render(){
 stopNarration();currentCaption=null;
 dismissLookup();
 if(captionObserver){captionObserver.disconnect();captionObserver=null}
 $('#hero').dataset.book=book.id;
 const h=$('#hero-img');const key='hero-'+book.id;if(h.dataset.image!==key){h.src=library.images[key];h.dataset.image=key}
 h.alt=book.id==='room'?'窗边伏案写作的女子，远处是学院与庭园':'俯瞰街区中的学校、住宅、河流和行人';
 $('#book-title').textContent=book.name;$('#book-en').textContent=book.en;
 $('#book-meta').textContent=book.category+'　 /　'+book.author;$('#book-summary').textContent=book.summary;
 $('#book-count').textContent=book.chapters.length+' 章'+(book.id==='city'?'选读':'')+'　·　'+bookCards(book).length+' 张精读卡';
 const auxiliary=mode!=='read',label=book.lookup?'生词表':'词卡复习';
 $('#review-tab').innerHTML=icon(book.lookup?'list':'cards')+label;
 $('#shelf').hidden=books.length===1;
 $('#read-tab').classList.toggle('active',mode==='read');$('#review-tab').classList.toggle('active',auxiliary);
 $('#read-tab').setAttribute('aria-pressed',mode==='read');$('#review-tab').setAttribute('aria-pressed',auxiliary);
 $('#reading').hidden=mode!=='read';$('#review').hidden=!auxiliary;
 $('#begin').innerHTML=(auxiliary?'回到精读':'进入本章')+icon('arr');
 document.title=book.name+' · '+(mode==='read'?card.title:label)+' | 纸间研读';
 if(mode==='read')renderLesson();else if(mode==='words')renderBookVocabulary();else renderReview();
}
// 只在当前显示的英语原句上加点词入口，保持书里的拼写、标点、换行和重点标记。
let activeLookup=null;
function decorateLookup(root,sid){
 const dictionary=book.lookup,refs=dictionary?.refs[sid];
 if(!refs||root.dataset.lookupSid)return;
 root.dataset.lookupSid=sid;
 const nodes=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let text='';
 while(walker.nextNode()){
  const node=walker.currentNode;
  if(node.parentElement.closest('small'))continue;
  nodes.push({node,start:text.length});text+=node.data;
 }
 const matches=[...text.matchAll(/[\p{L}]+(?:['’\-‐‑][\p{L}]+)*/gu)];
 if(matches.length!==refs.length)throw Error('点词编号与原句不符 '+sid);
 let word=0;
 for(const {node,start} of nodes){
  const limit=start+node.length;
  while(word<matches.length&&matches[word].index+matches[word][0].length<=start)word++;
  let i=word,cursor=0;
  const out=document.createDocumentFragment();
  while(i<matches.length&&matches[i].index<limit){
   const m=matches[i],a=Math.max(0,m.index-start),b=Math.min(node.length,m.index+m[0].length-start);
   if(b<=a){i++;continue}
   const entry=dictionary.entries[refs[i]];
   const existing=node.parentElement.closest('button.term');
   const el=existing||document.createElement('span');
   el.dataset.lookupI=i;el.dataset.lookupForm=m[0];el.classList.add('lookup-word');
   el.dataset.vocabKey=entry.lemma;el.classList.toggle('is-unknown',wordState(entry.lemma)==='unknown');
   if(existing)break;
   if(a>cursor)out.append(node.data.slice(cursor,a));
   el.setAttribute('role','button');el.tabIndex=0;el.textContent=node.data.slice(a,b);
   out.append(el);cursor=b;i++;
  }
  if(cursor){if(cursor<node.length)out.append(node.data.slice(cursor));node.replaceWith(out)}
 }
}
// 按原句确定词头。rose 作「起身」和作「玫瑰」时分别记录。
const vocabularyStorage='vocabulary.room.v2';
let vocabularyIndex=null;
let storageAvailable=true;
function buildVocabulary(){
 if(vocabularyIndex)return vocabularyIndex;
 const {refs,entries}=book.lookup;
 const all=new Map(),byCard=new Map(),defaults=new Map(),cardsForSentence=new Map();
 for(const lesson of bookCards(book)){
  const words=new Map(),preset=new Map(lesson.v.map(v=>[v.readerId,v]));
  byCard.set(lesson.id,words);
  function indexSentence(sid,text){
   if(!cardsForSentence.has(sid))cardsForSentence.set(sid,new Set());
   cardsForSentence.get(sid).add(lesson.id);
   const forms=text.match(/[\p{L}]+(?:['’\-‐‑][\p{L}]+)*/gu)||[];
   const ids=refs[sid];
   if(!ids||ids.length!==forms.length)throw Error('生词定位与原句不符 '+sid);
   const seed=preset.get(sid);
   ids.forEach((id,i)=>{
    const lemma=entries[id].lemma;
    const isDefault=seed&&forms[i].toLowerCase()===seed.w.toLowerCase();
    if(!words.has(lemma)||isDefault){
     const occurrence={sid,i,form:forms[i]};
     words.set(lemma,occurrence);
     if(!all.has(lemma)||isDefault)all.set(lemma,occurrence);
     if(isDefault)defaults.set(lemma,seed.w);
    }
   });
  }
  const template=document.createElement('template');template.innerHTML=lesson.body;
  for(const passage of template.content.querySelectorAll('.passage[data-reader-id]')){
   const paragraph=passage.querySelector('blockquote');
   paragraph.querySelectorAll('small').forEach(el=>el.remove());
   indexSentence(passage.dataset.readerId,paragraph.textContent);
   for(const note of paragraph.querySelectorAll('[data-footnote]')){
    const id=note.dataset.footnote;indexSentence('note.'+id,book.footnotes[id].en);
   }
  }
 }
 let choices=readChoices();
 if(!read(vocabularyStorage)){
  for(const old of JSON.parse(read('lookup.room.saved')||'[]')){
   const entry=entries[refs[old.sid]?.[old.i]];
   if(entry)choices.set(entry.lemma,{state:'unknown',sid:old.sid,i:old.i,form:old.form});
  }
  for(const [lemma,form] of defaults){
   if(read('known.'+form)==='1')choices.set(lemma,{state:'known'});
  }
  if(choices.size)storageAvailable=save(vocabularyStorage,JSON.stringify(Object.fromEntries(choices)));
 }
 vocabularyIndex={all,byCard,defaults,choices,cardsForSentence};return vocabularyIndex;
}
function readChoices(){
 const stored=storageAvailable?read(vocabularyStorage):cache.get(vocabularyStorage);
 return new Map(Object.entries(JSON.parse(stored||'{}')));
}
function wordState(lemma){
 const v=buildVocabulary();return v.choices.get(lemma)?.state||(v.defaults.has(lemma)?'unknown':'');
}
function changeChoices(changes){
 const index=buildVocabulary();
 const latest=read(vocabularyStorage)?readChoices():new Map(index.choices);
 for(const [lemma,choice] of changes)latest.set(lemma,choice);
 storageAvailable=save(vocabularyStorage,JSON.stringify(Object.fromEntries(latest)));
 index.choices=latest;refreshVocabulary();
}
function wordArtKey(entry){
 const key=entry.artKey||entry.lemma;
 return !entry.noArt&&Object.hasOwn(book.lookup.art,key)?key:null;
}
function wordArtImage(art,alt,thumbnail=false){
 const source=art.asset?'data-asset="'+escapeHTML(art.asset)+'"':'src="'+escapeHTML(art.file)+'"';
 return '<img '+source+' alt="'+escapeHTML(alt)+'" decoding="async"'+(thumbnail?' loading="lazy"':'')+'>';
}
function vocabListMarkup(words,scope){
 const index=buildVocabulary(),items=[];
 for(const [lemma,first] of words){
  if(wordState(lemma)!=='unknown')continue;
  const chosen=index.choices.get(lemma);
  // 卡下展示本卡的词义，全书表优先保留读者亲手点过的那一次。
  const ref=chosen?.sid&&(scope==='book'||index.cardsForSentence.get(chosen.sid)?.has(card.id))?chosen:first;
  const entry=book.lookup.entries[book.lookup.refs[ref.sid][ref.i]];
  items.push({lemma,ref,entry});
 }
 if(scope==='book')items.sort((a,b)=>a.lemma.localeCompare(b.lemma,'en'));
 const rows=items.map(({lemma,ref,entry})=>{
  const key=escapeHTML(lemma),form=escapeHTML(ref.form||lemma);
  const artKey=wordArtKey(entry);
  const thumbnail=artKey?'<button class="vocab-art-thumb" type="button" data-vocab-art="'+escapeHTML(artKey)+'" aria-label="放大 '+form+' 的助记图" aria-haspopup="dialog">'+wordArtImage(book.lookup.art[artKey],'',true)+'</button>':'';
  return '<li data-vocab-lemma="'+key+'"><button type="button" class="vocab-word" lang="en" data-lookup-sid="'+escapeHTML(ref.sid)+'" data-lookup-i="'+ref.i+'" data-lookup-form="'+form+'">'+form+'</button><span class="vocab-meaning">'+escapeHTML(entry.zh)+'</span>'+thumbnail+'<button type="button" class="vocab-known" data-vocab-known="'+key+'" aria-label="'+key+'，会">会</button></li>';
 }).join('');
 const title=scope==='book'?'生词表':'本卡生词';
 const heading=scope==='book'?'h2':'h3';
 return '<div class="vocab-heading"><'+heading+'>'+title+'</'+heading+'><span>'+items.length+' 词</span></div>'+(rows?'<ul class="vocab-list">'+rows+'</ul>':'<p class="vocab-empty">'+(scope==='book'?'生词表是空的。':'这张卡暂无生词。')+' 点原文中的词，选「不会」就能加入。</p>');
}
function renderBookVocabulary(){
 const index=buildVocabulary();
 $('#review').innerHTML='<section id="book-vocabulary" class="book-vocab-panel"><div class="vocab-content">'+vocabListMarkup(index.all,'book')+'</div><div class="vocab-backup"><button type="button" data-vocab-export>导出词表记录</button><label>导入记录<input type="file" accept=".json,application/json" data-vocab-import></label><span role="status" data-backup-status></span></div></section>';
 bindAssets($('#book-vocabulary'));
 const feedback=$('[data-backup-status]');feedback.textContent=storageAvailable?'记录保存在此浏览器。':'当前浏览器只能暂存，请导出记录。';
 $('[data-vocab-export]').onclick=()=>{
  const snapshot={book:'room',version:2,choices:Object.fromEntries(buildVocabulary().choices)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='一间自己的房间-我的词表记录.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 };
 $('[data-vocab-import]').onchange=async event=>{
  const input=event.target,file=input.files[0];if(!file)return;
  const dictionary=book.lookup;
  try{
   const data=JSON.parse(await file.text());
   if(data.book!=='room'||data.version!==2||!data.choices||Array.isArray(data.choices)||typeof data.choices!=='object')throw Error('请选择本书导出的词表记录。');
   const choices=new Map();
   for(const [lemma,value] of Object.entries(data.choices)){
    if(!index.all.has(lemma)||!value||!['known','unknown'].includes(value.state))throw Error('词表中的单词或标记无效。');
    const choice={state:value.state};
    if(value.sid!==undefined){
     const entry=dictionary.entries[dictionary.refs[value.sid]?.[value.i]];
     if(!Number.isInteger(value.i)||entry?.lemma!==lemma||typeof value.form!=='string'||value.form.length>160)throw Error('词表里的原句位置无效。');
     Object.assign(choice,{sid:value.sid,i:value.i,form:value.form});
    }
    choices.set(lemma,choice);
   }
   changeChoices(choices);feedback.textContent='已合并 '+choices.size+' 条记录。'+(storageAvailable?'':' 当前浏览器只能暂存。');
  }catch(err){feedback.textContent='导入失败。'+(err instanceof SyntaxError?'文件内容不是有效的词表。':err.message)}
  finally{input.value=''}
 };
}
function refreshVocabulary(){
 if(!book.lookup)return;
 const index=buildVocabulary();
 for(const el of document.querySelectorAll('[data-vocab-key]'))el.classList.toggle('is-unknown',wordState(el.dataset.vocabKey)==='unknown');
 const current=mode==='read'?$('#card-vocabulary'):$('#book-vocabulary .vocab-content');
 if(current){
  current.innerHTML=mode==='read'?vocabListMarkup(index.byCard.get(card.id),'card'):vocabListMarkup(index.all,'book');
  bindAssets(current);
 }
}
window.addEventListener('storage',event=>{
 if(!book?.lookup||(event.key!==null&&event.key!=='paperstudy.public.v1.'+vocabularyStorage))return;
 cache.delete(vocabularyStorage);const index=buildVocabulary();index.choices=readChoices();dismissLookup();refreshVocabulary();
});

function dismissLookup(restore=false){
 if(!activeLookup)return;
 const {panel,anchor}=activeLookup;activeLookup=null;panel.remove();anchor.classList.remove('lookup-active');
 if(panel.contains(narrationControl))stopNarration();
 if(restore&&anchor.isConnected)anchor.focus({preventScroll:true});
}
function positionLookup(){
 if(!activeLookup)return;
 const {anchor,panel}=activeLookup,box=anchor.getBoundingClientRect(),bounds=panel.getBoundingClientRect();
 const margin=10,w=document.documentElement.clientWidth,h=window.innerHeight;
 const above=box.top-margin,below=h-box.bottom-margin;
 let y=above>=bounds.height+7?box.top-bounds.height-7:below>=bounds.height+7?box.bottom+7:above>below?box.top-bounds.height-7:box.bottom+7;
 panel.style.left=Math.max(margin,Math.min(w-bounds.width-margin,box.left+box.width/2-bounds.width/2))+'px';
 panel.style.top=Math.max(margin,Math.min(h-bounds.height-margin,y))+'px';
}
function openLookup(anchor){
 if(activeLookup?.anchor===anchor){dismissLookup();return}
 dismissLookup();
 const sid=anchor.closest('[data-lookup-sid]').dataset.lookupSid,i=Number(anchor.dataset.lookupI);
 const entry=book.lookup.entries[book.lookup.refs[sid][i]],form=anchor.dataset.lookupForm;
 const artKey=wordArtKey(entry),art=artKey&&book.lookup.art[artKey];
 const panel=document.createElement('aside');panel.id='word-lookup';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',form+' 的释义');
 const same=entry.lemma===form.toLowerCase();
 panel.innerHTML='<div class="lookup-head"><div><h3 lang="en">'+escapeHTML(form)+'</h3><p>'+escapeHTML(entry.pos)+(same?'':' · '+escapeHTML(entry.lemma))+' · '+(entry.context?'语境释义':'常用义')+'</p></div><button class="lookup-close" type="button" aria-label="关闭释义">'+svg('x')+'</button></div><p class="lookup-meaning">'+escapeHTML(entry.zh)+'</p>'+(entry.phrase?'<p class="lookup-phrase"><b lang="en">'+escapeHTML(entry.phrase)+'</b>　'+escapeHTML(entry.phraseZh)+'</p>':'')+'<div class="lookup-actions"><button type="button" data-vocab-state="known">会</button><button type="button" data-vocab-state="unknown">不会</button>'+(art?'<button type="button" class="lookup-art-link" data-lookup-art aria-expanded="false">看助记卡</button>':'')+'</div>';
 for(const button of panel.querySelectorAll('[data-vocab-state]')){
  const state=button.dataset.vocabState;
  button.setAttribute('aria-pressed',wordState(entry.lemma)===state);
  button.onclick=()=>{
   dismissLookup(true);
   changeChoices([[entry.lemma,state==='known'?{state}:{state,sid,i,form}]]);
  };
 }
 if(art){
  const b=panel.querySelector('[data-lookup-art]');
  b.onclick=()=>{
   const existing=panel.querySelector('.lookup-memory');
   if(existing){existing.remove();panel.querySelector('.lookup-cue')?.remove();b.textContent='看助记卡';b.setAttribute('aria-expanded','false');panel.classList.remove('with-art')}
   else{
    const im=document.createElement('img');im.className='lookup-memory';im.alt=entry.lemma+' 的单词助记图';
    im.addEventListener('load',positionLookup,{once:true});
    im.addEventListener('error',()=>{const msg=document.createElement('p');msg.textContent='这张助记图未能打开。请确认词图文件夹和网页放在一起。';im.replaceWith(msg);positionLookup()},{once:true});
    im.src=art.asset?library.images[art.asset]:art.file;
    panel.append(im);
    if(art.asset){
     const source=bookCards(book).flatMap(c=>c.v).find(v=>v.image===art.asset&&v.cue);
     if(source){const cue=document.createElement('p');cue.className='lookup-cue';cue.textContent=source.cue;panel.append(cue)}
    }
    panel.classList.add('with-art');b.textContent='收起助记卡';b.setAttribute('aria-expanded','true');
   }
   positionLookup();
  };
 }
 panel.querySelector('.lookup-close').onclick=()=>dismissLookup(true);
 const title=panel.querySelector('h3');
 title.insertAdjacentHTML('beforeend',speechButton('data-word-aloud','重读 '+form));
 panel.insertAdjacentHTML('beforeend',speechStatus);
 const wordSpeaker=title.querySelector('[data-word-aloud]');
 const readWord=()=>narrate(recordedExcerpt(sid,i,i),wordSpeaker);
 wordSpeaker.onclick=readWord;
 (anchor.closest('dialog[open]')||document.body).append(panel);
 anchor.classList.add('lookup-active');
 activeLookup={panel,anchor};positionLookup();
 if(autoNarration())readWord();else stopNarration();
 panel.querySelector('.lookup-close').focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 if(activeLookup?.panel.contains(event.target))return;
 let anchor=event.target.closest('[data-lookup-i]');
 const frame=event.target.closest('.caption-window');
 if(frame&&!event.target.closest('[data-footnote]')&&event.detail>0){
  // 某些分栏里的内嵌元素能画出字形，但浏览器把点击交给了外层段落。
  const x=event.clientX,y=event.clientY;
  const contains=el=>[...el.getClientRects()].some(r=>r.width>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);
  if(contains(frame)){
   const section=frame.querySelector('.passage:not([hidden])');
   const footnote=section&&[...section.querySelectorAll('[data-footnote]')].find(contains);
   if(footnote){dismissLookup();event.stopImmediatePropagation();footnote.click();return}
   if(section&&!anchor&&!event.target.closest('button'))anchor=[...section.querySelectorAll('[data-lookup-i]')].find(contains);
  }
 }
 if(anchor){openLookup(anchor);event.stopImmediatePropagation();return}
 if(frame&&!event.target.closest('button'))speakCaption(true);
 dismissLookup();
},true);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&activeLookup){event.preventDefault();event.stopImmediatePropagation();dismissLookup(true);return}
 const anchor=event.target.closest('[data-lookup-i][role="button"]');
 if(anchor&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openLookup(anchor)}
},true);
window.addEventListener('resize',positionLookup);
document.addEventListener('scroll',event=>{if(activeLookup&&!activeLookup.panel.contains(event.target))positionLookup()},true);
dlg.addEventListener('close',()=>{if(!dlg.open&&dlg.contains(narrationControl))stopNarration();dismissLookup()});

function guideContents(row){
 const [chapter,paragraph]=row.start.split('.');
 const location=chapter==='preface'?'卷首说明':chapter==='note'?'原注 '+paragraph:'第'+chapter+'章 · 第'+paragraph+'段';
 return '<div class="guide-label"><h3>摘要</h3><small>'+escapeHTML(location)+'</small></div><p>'+escapeHTML(row.summary)+'</p><h3>解析</h3><p>'+escapeHTML(row.analysis)+'</p>';
}

function renderLiteraryPlate(body){
 const paper=body.parentElement;
 paper.classList.add('pilot-card');
 const figure=document.createElement('figure');
 figure.className='scene-figure pilot-figure';
 figure.innerHTML='<button type="button" class="pilot-art" data-openplate="'+card.id+'" aria-label="'+escapeHTML('放大插画：'+card.caption)+'">'+asset(card.plate,'scene-img',card.caption)+'</button><figcaption class="pilot-caption" lang="en"></figcaption>';
 const caption=figure.querySelector('figcaption');
 const translations=document.createElement('div');
 translations.className='pilot-translation';
 translations.setAttribute('lang','zh-CN');
 translations.setAttribute('aria-label','中文译文');
 for(const passage of body.querySelectorAll(':scope > .passage')){
  const label=passage.querySelector('.pass-label');
  passage.setAttribute('aria-label',label.textContent);
  label.remove();
  translations.append(passage.querySelector('.quote-translation'));
  caption.append(passage);
 }
 const notes=document.createElement('section');
 notes.className='pilot-notes';
 let guide=null;
 if(book.fullText&&card.readingGuide?.length){
  guide=document.createElement('div');
  guide.className='reading-guide';
  guide.innerHTML=card.readingGuide.map(row=>'<section hidden data-guide-start="'+escapeHTML(row.start)+'">'+guideContents(row)+'</section>').join('');
  notes.append(guide);
  // 保留专门的对照表，旧版重复的解读由本段精读接替。
  body.replaceChildren(...body.querySelectorAll(':scope > .table-wrap'));
 }else{
  notes.innerHTML='<h3>解读</h3>';
 }
 const supplementary=[...paper.children].filter(node=>node.matches('.memhead,.wordtiles,.source'));
 body.before(figure,translations,notes);
 notes.append(body,...supplementary);
 if(book.fullText)paginateFullBook(figure,caption,translations,guide);
 else paginateCaption(figure,caption,translations);
}
// 以英文空格划定整词范围，保留跨标签的标点、重点短语和可点击的词卡。
function captionWordRanges(paragraph){
 const walk=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
 const textNodes=[];
 while(walk.nextNode()){
  if(!walk.currentNode.parentElement.closest('small'))textNodes.push(walk.currentNode);
 }
 const gaps=[];
 for(const node of textNodes){
  if(!/\s/.test(node.data))continue;
  const fragment=document.createDocumentFragment();
  for(const part of node.data.match(/\s+|\S+/g)){
   const piece=document.createTextNode(part);
   fragment.append(piece);
   if(/\s/.test(part))gaps.push(piece);
  }
  node.replaceWith(fragment);
 }
 return Array.from({length:gaps.length+1},(_,i)=>{
  const range=document.createRange();
  range.selectNodeContents(paragraph);
  if(i>0)range.setStartAfter(gaps[i-1]);
  if(i<gaps.length)range.setEndBefore(gaps[i]);
  return {range,gap:gaps[i-1]};
 });
}
// 每栏是一页。只把末行会碰到箭头的第一个词移到下一行，再按实际字形复测。
function fitCaptionTails(words,box,lineHeight,reserved){
 for(let pass=0;pass<words.length;pass++){
  const lastLines=new Map();
  for(const {range,gap} of words){
   for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;
    const column=Math.floor((rect.left+rect.width/2-box.left)/box.width);
    const row=Math.floor((rect.top+rect.height/2-box.top)/lineHeight);
    let last=lastLines.get(column);
    if(!last||last.row<row){
     last={row,wrapAfter:null};
     lastLines.set(column,last);
    }
    const limit=box.left+(column+1)*box.width-reserved;
    if(row===last.row&&!last.wrapAfter&&rect.right>limit&&gap&&gap.nextSibling?.className!=='caption-wrap')last.wrapAfter=gap;
   }
  }
  const crowded=[...lastLines.values()].find(line=>line.wrapAfter);
  if(!crowded)break;
  const br=document.createElement('br');
  br.className='caption-wrap';
  crowded.wrapAfter.after(br);
 }
}
// 全文阅读按句排版。屏幕变窄或重新打开时，以原句和词的位置找回进度。
function paginateFullBook(figure,caption,translations,guide){
 const sections=[...caption.children], chinese=[...translations.children];
 const starts=new Map(Array.from(guide?.children||[],node=>[node.dataset.guideStart,node]));
 let group=null;
 const guideFor=sections.map(section=>(group=starts.get(section.dataset.readerId)||group));
 const all=bookCards(book), cardIndex=all.indexOf(card);
 const pages=document.createElement('div');
 pages.id='reading-subtitles';pages.className='caption-pages full-book-pages';
 pages.append(...sections);
 const frame=document.createElement('div');
 frame.className='caption-window';frame.append(pages);
 const nav=document.createElement('nav');
 nav.className='caption-navigation';nav.setAttribute('aria-label','字幕翻页');
 for(const [direction,label,shape] of [['prev','上一页','prev'],['next','下一页','next']]){
  const button=document.createElement('button');
  button.type='button';button.setAttribute('data-caption-'+direction,'');
  button.setAttribute('aria-controls',pages.id);button.setAttribute('aria-label',label);
  button.innerHTML=icon(shape);nav.append(button);
 }
 const [prev,next]=nav.children;
 nav.insertAdjacentHTML('afterbegin',speechButton('data-read-aloud','重读本页英文'));
 const speaker=nav.querySelector('[data-read-aloud]');
 speaker.onclick=()=>speakCaption();
 figure.classList.add('paged-plate');caption.append(frame,nav);
 const picture=figure.querySelector('.pilot-art img');
 const markKey='fulltext.'+card.id;
 const layoutWords=new WeakMap();
 let active=-1,word=0,fragment=0,page=0,count=1,width=0,words=[];
 currentCaption={button:speaker,excerpt:()=>captionExcerpt(sections[active].querySelector('blockquote p'),frame,page===0,page===count-1)};
 for(const section of sections)section.hidden=true;
 for(const paragraph of chinese)paragraph.hidden=true;
 translations.setAttribute('aria-live','polite');
 function displayPage(index){
  page=Math.max(0,Math.min(count-1,index));
  pages.scrollLeft=Math.round(page*width);
  const box=pages.getBoundingClientRect(),line=parseFloat(getComputedStyle(pages).lineHeight);
  let first=-1,firstFragment=0,lines=1;
  for(const [i,item] of words.entries()){
   const pieces=[...item.range.getClientRects()].filter(r=>r.width&&r.height);
   for(const [part,rect] of pieces.entries()){
    const x=rect.left+rect.width/2;
    if(!rect.width||x<box.left||x>=box.right)continue;
    if(first<0){first=i;firstFragment=part}
    lines=Math.max(lines,1+Math.floor((rect.top+rect.height/2-box.top)/line));
   }
  }
  if(first>=0){word=first;fragment=firstFragment}
  frame.style.height=Math.min(lines,4)+'lh';
  for(const button of sections[active].querySelectorAll('button,[data-lookup-i]')){
   const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2;
   button.tabIndex=x>=box.left&&x<box.right?0:-1;
  }
  prev.disabled=cardIndex===0&&active===0&&page===0;
  next.disabled=cardIndex===all.length-1&&active===sections.length-1&&page===count-1;
  save(markKey,[sections[active].dataset.readerId,word,fragment].join('|'));
 }
 function layout(){
  if(!figure.isConnected||!pages.clientWidth||active<0)return;
  pages.scrollLeft=0;
  for(const br of sections[active].querySelectorAll('.caption-wrap'))br.remove();
  const box=pages.getBoundingClientRect();width=box.width;
  fitCaptionTails(words,box,parseFloat(getComputedStyle(pages).lineHeight),nav.getBoundingClientRect().width+8);
  count=Math.max(1,Math.round(pages.scrollWidth/width));
  const pieces=word>=0?[...words[Math.min(word,words.length-1)].range.getClientRects()].filter(r=>r.width&&r.height):[];
  const rect=pieces[Math.min(fragment,pieces.length-1)];
  displayPage(word<0?count-1:rect?Math.floor((rect.left+rect.width/2-box.left)/width):0);
 }
 function select(i,targetWord,targetFragment=0){
  dismissLookup();
  if(guide){
   if(active>=0&&guideFor[active]!==guideFor[i])guideFor[active].hidden=true;
   guideFor[i].hidden=false;
  }
  if(active>=0){sections[active].hidden=true;chinese[active].hidden=true}
  active=i;word=targetWord;fragment=targetFragment;
  const section=sections[i];section.hidden=false;chinese[i].hidden=false;
  const p=section.querySelector('blockquote p');
  if(book.lookup)decorateLookup(p,section.dataset.readerId);
  if(!layoutWords.has(p))layoutWords.set(p,captionWordRanges(p));
  words=layoutWords.get(p);
  const key=section.dataset.scene||card.plate;
  if(picture.dataset.asset!==key){
   const description=card.scenes?.[key]||card.caption;
   picture.dataset.asset=key;picture.src=library.images[key];picture.alt=description;
   picture.parentElement.setAttribute('aria-label','放大插画：'+description);
  }
  layout();
 }
 function step(direction){
  if(page+direction>=0&&page+direction<count){dismissLookup();displayPage(page+direction);speakCaption(true);return}
  if(active+direction>=0&&active+direction<sections.length){
   select(active+direction,direction>0?0:-1);speakCaption(true);return;
  }
  const adjacent=all[cardIndex+direction];
  if(adjacent){
   nextFullBookEdge={id:adjacent.id,last:direction<0};
   go(book,adjacent.id);
   document.querySelector(direction>0?'[data-caption-next]':'[data-caption-prev]')?.focus({preventScroll:true});
  }
 }
 prev.onclick=()=>step(-1);next.onclick=()=>step(1);
 nav.onkeydown=event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
   event.preventDefault();step(event.key==='ArrowRight'?1:-1);
  }
 };
 const edge=nextFullBookEdge;nextFullBookEdge=null;
 const [savedId,savedWord,savedFragment]=read(markKey).split('|');
 const remembered=sections.findIndex(s=>s.dataset.readerId===savedId);
 if(edge?.id===card.id){
  const requested=edge.readerId?sections.findIndex(section=>section.dataset.readerId===edge.readerId):-1;
  select(requested>=0?requested:edge.last?sections.length-1:0,edge.last?-1:0);
 }
 else if(startBookAtBeginning||remembered<0)select(0,0);
 else select(remembered,Math.max(0,parseInt(savedWord,10)||0),Math.max(0,parseInt(savedFragment,10)||0));
 startBookAtBeginning=false;
 let measuredWidth=pages.clientWidth;
 captionObserver=new ResizeObserver(()=>{
  if(pages.clientWidth!==measuredWidth){measuredWidth=pages.clientWidth;layout()}
 });
 captionObserver.observe(pages);
 document.fonts.ready.then(layout);
}

function paginateCaption(figure,caption,translations){
 figure.classList.add('paged-plate');
 const pages=document.createElement('div');
 pages.className='caption-pages';
 pages.id='reading-subtitles';
 pages.append(...Array.from(caption.children));
 const frame=document.createElement('div');
 frame.className='caption-window';
 frame.append(pages);
 caption.append(frame);
 const nav=document.createElement('nav');
 nav.className='caption-navigation';
 nav.setAttribute('aria-label','字幕翻页');
 nav.innerHTML='<button type="button" data-caption-prev aria-controls="reading-subtitles" aria-label="上一页字幕">'+icon('prev')+'</button><button type="button" data-caption-next aria-controls="reading-subtitles" aria-label="下一页字幕">'+icon('next')+'</button>';
 caption.append(nav);
 const previous=nav.querySelector('[data-caption-prev]');
 const next=nav.querySelector('[data-caption-next]');
 const sentences=[...pages.querySelectorAll('blockquote p')];
 const words=sentences.map(captionWordRanges);
 const illustration=figure.querySelector('.pilot-art img');
 const sceneFor=sentences.map(p=>p.closest('.passage').dataset.scene||card.plate);
 if(card.scenes){
  for(const key of Object.keys(card.scenes))new Image().src=library.images[key];
 }
 let readingAnchor=null;
 const chinese=[...translations.querySelectorAll('.quote-translation')];
 translations.setAttribute('aria-live','polite');
 translations.setAttribute('aria-atomic','true');
 let current=0,total=1,width=0;
 function turn(index){
  current=Math.max(0,Math.min(index,total-1));
  pages.scrollLeft=Math.round(current*width);
  previous.disabled=current===0;
  next.disabled=current===total-1;
  const windowBox=pages.getBoundingClientRect();
  const lineHeight=parseFloat(getComputedStyle(pages).lineHeight);
  let lastLine=1;
  // 内层始终按四行分栏，外层只给本页真正出现的文字留空间。
  const range=document.createRange();
  let visibleSentence=-1;
  for(const [i,paragraph] of sentences.entries()){
   range.selectNodeContents(paragraph);
   for(const rect of range.getClientRects()){
    const x=rect.left+rect.width/2;
    if(rect.width>0 && x>=windowBox.left && x<windowBox.right){
     visibleSentence=i;
     const y=rect.top+rect.height/2-windowBox.top;
     lastLine=Math.max(lastLine,1+Math.floor(y/lineHeight));
    }
   }
  }
  // 每句英文独立分栏，同一个长句可以占几页。
  if(visibleSentence>=0){
   chinese.forEach((translation,i)=>{
    const hide=i!==visibleSentence;
    if(translation.hidden!==hide)translation.hidden=hide;
   });
   if(card.scenes){
    const key=sceneFor[visibleSentence];
    if(illustration.dataset.asset!==key){
     const description=card.scenes[key]||card.caption;
     illustration.dataset.asset=key;
     illustration.src=library.images[key];
     illustration.alt=description;
     illustration.parentElement.setAttribute('aria-label','放大插画：'+description);
    }
    // 屏宽改变时，仍从翻页前看到的词继续读。
    readingAnchor=words[visibleSentence].find(({range})=>[...range.getClientRects()].some(rect=>{
     const center=rect.left+rect.width/2;
     return rect.width>0&&center>=windowBox.left&&center<windowBox.right;
    }))?.range;
   }
  }
  frame.style.height=Math.min(lastLine,4)+'lh';
  for(const term of pages.querySelectorAll('.term')){
   const rect=term.getBoundingClientRect();
   const center=rect.left+rect.width/2;
   term.tabIndex=center>=windowBox.left && center<windowBox.right ? 0 : -1;
  }
 }
 function reflow(){
  if(!figure.isConnected || !pages.clientWidth)return;
  pages.scrollLeft=0;
  pages.querySelectorAll('.caption-wrap').forEach(br=>br.remove());
  const box=pages.getBoundingClientRect();
  const lineHeight=parseFloat(getComputedStyle(pages).lineHeight);
  const reserved=nav.getBoundingClientRect().width+8;
  for(const sentenceWords of words)fitCaptionTails(sentenceWords,box,lineHeight,reserved);
  width=box.width;
  total=Math.max(1,Math.round(pages.scrollWidth/width));
  const anchor=readingAnchor&&[...readingAnchor.getClientRects()].find(rect=>rect.width>0);
  turn(anchor?Math.floor((anchor.left+anchor.width/2-box.left)/width):current);
 }
 previous.onclick=()=>turn(current-1);
 next.onclick=()=>turn(current+1);
 nav.onkeydown=event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
   event.preventDefault();
   turn(current+(event.key==='ArrowRight'?1:-1));
  }
 };
 captionObserver=new ResizeObserver(reflow);
 captionObserver.observe(pages);
 reflow();
 document.fonts.ready.then(reflow);
}
function renderLesson(){
 $('#chapter-list').innerHTML=book.chapters.map(c=>'<button class="ch" aria-current="'+(c===chapter)+'" data-ch="'+c.num+'"><span class="num">'+two(c.num)+'</span><span><strong>'+escapeHTML(c.title)+'</strong><small>'+c.cards.length+' 张精读卡</small></span></button>').join('');
 $('#fold').innerHTML=($('.side').classList.contains('open')?'收起':'展开')+icon('chev');
 const all=bookCards(book),at=all.indexOf(card),idx=chapter.cards.indexOf(card);
 const prev=at===0?' disabled':'',next=at===all.length-1?' disabled':'';
 const tiles=book.lookup?'':card.v.map(w=>'<button class="minicard" data-term="'+w.w+'">'+(w.image?asset(w.image,'',''):'')+'<span><b lang="en">'+w.w+'</b><small>'+escapeHTML(w.zh)+'</small></span>'+icon('next')+'</button>').join('');
 $('#lesson').innerHTML='<div class="lessonbar"><div class="crumb"><span class="line"></span>'+chnum(chapter.num)+'　/　'+escapeHTML(chapter.title)+'</div><div class="navrail"><span class="counter">'+two(idx+1)+' / '+two(chapter.cards.length)+'</span><button class="iconbtn" data-step="-1" aria-label="上一张精读卡"'+prev+'>'+icon('prev')+'</button><button class="iconbtn" data-step="1" aria-label="下一张精读卡"'+next+'>'+icon('next')+'</button></div></div><article class="cardpaper"><div class="cardhead"><h2 class="lesson-title">'+escapeHTML(card.title)+'</h2></div><div class="body">'+card.body+'</div>'+(book.lookup?'<section id="card-vocabulary" class="card-vocab-panel"></section>':'<div class="memhead">'+icon('cards')+'词义与记忆图</div><div class="wordtiles">'+tiles+'</div>')+(card.source?'<p class="source">'+escapeHTML(card.source)+'</p>':'')+'</article><div class="thought"><label for="thought">'+icon('pen')+'我的想法</label>'+(card.prompt?'<p>'+escapeHTML(card.prompt)+'</p>':'')+'<textarea id="thought" placeholder="写下一句自己的理解…" rows="2"></textarea><small class="save-note" aria-live="polite">保存在当前浏览器</small></div><div class="bottom"><button class="softbtn" id="topics">'+icon('list')+'本章卡片</button><button class="softbtn" data-step="1"'+next+'>下一张'+icon('next')+'</button></div>';
 if(card.plate && book.id==='room'){
  const toolbar=$('#lesson .lessonbar .navrail');
  toolbar.insertAdjacentHTML('afterbegin','<label class="auto-narrate"><input type="checkbox" data-auto-narrate>自动朗读</label>');
  const automatic=toolbar.querySelector('[data-auto-narrate]');
  automatic.checked=autoNarration();
  automatic.onchange=()=>{save('narration.room.auto',automatic.checked?'on':'off');if(automatic.checked)speakCaption();else stopNarration()};
  const body=$('.body',$('#lesson'));
  if(book.lookup){
   const index=buildVocabulary();
   for(const p of body.querySelectorAll('p.sense'))if(p.textContent.trim().startsWith('推测生词'))p.remove();
   for(const button of body.querySelectorAll('button.term')){
    if(button.closest('.passage'))continue;
    const v=card.v.find(word=>word.w===button.dataset.term);
    if(!v)continue;
    const lemma=[...index.defaults].find(([,word])=>word===v.w)?.[0];
    const ref=index.byCard.get(card.id).get(lemma);
    if(!ref)continue;
    Object.assign(button.dataset,{lookupSid:ref.sid,lookupI:ref.i,lookupForm:ref.form,vocabKey:lemma});
    button.classList.add('lookup-word');
   }
  }
  renderLiteraryPlate(body);
  if(book.fullText)$('#lesson .pilot-figure').insertAdjacentHTML('afterend',speechStatus);
  if(book.lookup)refreshVocabulary();
 }else if(card.plate){
  const body=$('.body', $('#lesson'));
  const opening=body.firstElementChild;
  const spread=document.createElement('div');spread.className='illustrated-lead';
  const fig=document.createElement('figure');fig.className='scene-figure';
  fig.innerHTML='<button data-openplate="'+card.id+'" aria-label="放大插画：'+escapeHTML(card.caption)+'">'+asset(card.plate,'scene-img',card.caption)+'</button><figcaption><span>'+(book.id==='city'?'教学插画':'场景插画')+'</span>'+escapeHTML(card.caption)+'</figcaption>';
  const paired=opening;
  if(paired){paired.before(spread);spread.append(paired)}else{body.prepend(spread)}
  spread.append(fig);
 }
 const note=$('#thought');note.value=read('note.'+card.id);
 note.addEventListener('input',()=>{$('.save-note').textContent=save('note.'+card.id,note.value)?'已保存在当前浏览器':'当前浏览器禁用了本地保存，本次打开期间可用'});
 $$('.passage blockquote').forEach(e=>e.lang='en');
 bindAssets($('#lesson'));
}
function modal(title,content,wide=false){dlg.classList.toggle('wide',wide);$('#dialog-title').textContent=title;$('#dialog-content').innerHTML=content;bindAssets(dlg);if(!dlg.open)dlg.showModal();dlg.scrollTop=0}
function pickBook(){
 modal('我的书架',books.map(b=>'<button class="shelf-entry" data-bookpick="'+b.id+'">'+asset('hero-'+b.id,'','')+'<span><strong>'+b.name+'</strong><small>'+b.chapters.length+' 章'+(b.id==='city'?'选读':'')+' · '+bookCards(b).length+' 张精读卡'+(b.lookup?'':' · '+wordCount(b)+' 个生词')+'</small></span>'+icon(b.id===book.id?'check':'next')+'</button>').join(''))
}
function showTopics(){modal(chnum(chapter.num)+' · 精读卡',chapter.cards.map((c,i)=>'<button class="topic '+(c===card?'active':'')+'" data-topic="'+c.id+'">'+(c.plate?asset(c.plate,'topic-art',''):'')+'<span>'+two(i+1)+'</span>'+escapeHTML(c.title)+'</button>').join(''))}
function known(w){return read('known.'+w)==='1'}
function sceneContext(c,word){
 if(!c.plate)return '';
 const key=word.scene||c.plate;
 const description=c.scenes?.[key]||c.caption;
 return '<details class="review-scene"><summary>查看原句场景插画</summary><figure class="scene-figure"><button data-openplate="'+c.id+'" aria-label="放大插画：'+escapeHTML(description)+'">'+asset(key,'scene-img',description)+'</button><figcaption>'+escapeHTML(description)+'</figcaption></figure></details>';
}
function wordMemory(word){
 if(word.lookupArt){
  const art=word.lookupArt;
  const src=art.asset?library.images[art.asset]:art.file;
  return '<figure class="word-memory"><figcaption>单词记忆图</figcaption><img class="wordpic" src="'+escapeHTML(src)+'" alt="'+escapeHTML(word.w)+' 的助记图"></figure>';
 }
 if(!word.image)return '';
 const cue=word.cue?'<p class="word-usage">'+escapeHTML(word.cue)+'</p>':'';
 return '<figure class="word-memory"><figcaption>单词记忆图</figcaption>'+asset(word.image,'wordpic',word.alt||word.w+' 的词图')+'</figure>'+cue;
}
function translatedSentence(word,show=true){
 const english=escapeHTML(word.q).replace(new RegExp('\\b'+word.w+'\\b','gi'),match=>'<mark>'+match+'</mark>');
 const zh='<p class="quote-translation" lang="zh-CN" aria-label="中文译文">'+escapeHTML(word.qzh)+'</p>';
 return '<blockquote lang="en">'+english+'</blockquote>'+(show?zh:'<details class="sentence-hint"><summary>查看句子翻译</summary>'+zh+'</details>');
}
function termModal(w){
 const z=card.v.find(v=>v.w===w);if(!z)return;
 modal('语境词卡','<section class="worddetail"><h3 lang="en">'+escapeHTML(w)+'</h3><p class="meaning">'+escapeHTML(z.zh)+'</p>'+wordMemory(z)+translatedSentence(z)+sceneContext(card,z)+'<div class="actions"><button class="softbtn" data-know="'+w+'">'+icon('check')+(known(w)?'已掌握 · 撤销':'标记为已掌握')+'</button></div></section>')
}
function deck(){
 const entries=[];book.chapters.forEach(c=>c.cards.forEach(k=>k.v.forEach(v=>{if(!entries.some(x=>x.v.w===v.w&&x.v.zh===v.zh))entries.push({ch:c,k,v})})));
 return filter==='todo'?entries.filter(x=>!known(x.v.w)):filter==='known'?entries.filter(x=>known(x.v.w)):entries;
}
function renderReview(){
 const cards=deck();reviewIndex=Math.max(0,Math.min(reviewIndex,cards.length-1));const e=cards[reviewIndex];
 $('#review').innerHTML='<div class="review-head"><div><h2>词卡复习</h2><p>'+escapeHTML(book.name)+' · '+wordCount(book)+' 个生词</p></div><select aria-label="复习范围" id="scope"><option value="all">全书词卡</option><option value="todo">待复习</option><option value="known">已掌握</option></select></div>'+(e?'<div class="review-panel"><div class="readyline"><small class="smallmeta">'+chnum(e.ch.num)+' · '+escapeHTML(e.ch.title)+'</small><div class="navrail"><span class="counter">'+(reviewIndex+1)+' / '+cards.length+'</span><button class="iconbtn" data-reviewstep="-1" aria-label="上一词" '+(reviewIndex===0?'disabled':'')+'>'+icon('prev')+'</button><button class="iconbtn" data-reviewstep="1" aria-label="下一词" '+(reviewIndex===cards.length-1?'disabled':'')+'>'+icon('next')+'</button></div></div><h3 lang="en">'+e.v.w+'</h3>'+translatedSentence(e.v,revealed)+(revealed?'<div class="answer">'+escapeHTML(e.v.zh)+'</div>'+wordMemory(e.v):'<button class="primary" id="reveal">'+icon('eye')+'查看中文释义</button>')+'<div class="actions">'+(revealed?'<button class="softbtn" data-reviewknow="'+e.v.w+'">'+icon('check')+(known(e.v.w)?'已掌握 · 撤销':'标记为已掌握')+'</button>':'')+'<button class="softbtn" data-topic="'+e.k.id+'"'+(e.v.noteId?' data-reader-note="'+escapeHTML(e.v.noteId)+'"':'')+(e.v.readerId?' data-reader-target="'+escapeHTML(e.v.readerId)+'"':'')+'>回到这句原文'+icon('arr')+'</button></div></div>':'<div class="review-panel empty">'+(filter==='known'?'还没有标为已掌握的词。':'本书所有词都已标为掌握。')+'<br><button class="softbtn" id="allwords">看全书词卡</button></div>');
 if(e)$('.review-panel').insertAdjacentHTML('beforeend',sceneContext(e.k,e.v));
 $('#scope').value=filter;
 $('#scope').onchange=ev=>{filter=ev.target.value;revealed=false;reviewIndex=0;renderReview()};bindAssets($('#review'));
}
$('#read-tab').onclick=showRead;$('#review-tab').onclick=showReview;$('#shelf').onclick=pickBook;
$('#begin').onclick=()=>{if(mode!=='read')showRead();else{scrollToWork();if(book.id==='room')speakCaption(true)}};
$('#fold').onclick=()=>{const open=$('.side').classList.toggle('open');$('#fold').setAttribute('aria-expanded',open);$('#fold').innerHTML=(open?'收起':'展开')+icon('chev')};
dlg.addEventListener('click',ev=>{if(ev.target===dlg){const r=dlg.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dlg.close()}});
document.addEventListener('click',ev=>{
 const b=ev.target.closest('button');if(!b||b.disabled)return;const a=b.dataset;
 if('close' in a){dlg.close();return}
 if(a.footnote&&book.footnotes){
  const note=book.footnotes[a.footnote];
  if(note){
   const guide=note.readingGuide?'<div class="reading-guide footnote-guide"><section data-guide-start="'+escapeHTML(note.readingGuide.start)+'">'+guideContents(note.readingGuide)+'</section></div>':'';
   modal('原注 '+a.footnote,speechButton('data-note-aloud','重读英文原注')+'<blockquote lang="en" class="author-footnote">'+(note.enHtml||escapeHTML(note.en))+'</blockquote><p lang="zh-CN">'+escapeHTML(note.zh)+'</p>'+guide+speechStatus);
   const speaker=dlg.querySelector('[data-note-aloud]');
   const readNote=()=>narrate(recordedExcerpt('note.'+a.footnote,null,null,true,true),speaker);
   speaker.onclick=readNote;
   if(autoNarration())readNote();else stopNarration();
   if(book.lookup)decorateLookup(dlg.querySelector('.author-footnote'),'note.'+a.footnote);
  }
  return;
 }
 if(a.openplate){
  const image=b.querySelector('img[data-asset]');
  if(image)modal('阅读插画','<figure class="plate-full">'+asset(image.dataset.asset,'',image.alt)+'<figcaption>'+escapeHTML(image.alt)+'</figcaption></figure>',true);
  if(image&&book.id==='room')speakCaption(true);
  return;
 }
 if(a.vocabArt&&book.lookup){
  const row=b.closest('[data-vocab-lemma]'),art=book.lookup.art[a.vocabArt];
  const form=row.querySelector('.vocab-word').textContent;
  const meaning=row.querySelector('.vocab-meaning').textContent;
  b.focus({preventScroll:true});
  modal(form+' · 助记图','<figure class="vocab-art-full">'+wordArtImage(art,form+' 的单词辅助记忆图')+'<figcaption>'+escapeHTML(meaning)+'</figcaption></figure>',true);
  return;
 }
 if(a.bookpick){const pick=books.find(x=>x.id===a.bookpick);dlg.close();go(pick,savedPosition(pick),false);window.scrollTo({top:0,behavior:'instant'});return}
 if(a.ch){const g=book.chapters.find(x=>x.num===Number(a.ch));go(book,g.cards[0].id);return}
 if(a.topic){
  if(dlg.open)dlg.close();
  if(a.readerTarget)nextFullBookEdge={id:a.topic,readerId:a.readerTarget};
  go(book,a.topic);
  if(a.readerNote)document.querySelector('.full-book-pages .passage:not([hidden]) [data-footnote="'+a.readerNote+'"]')?.click();
  return;
 }
 if(a.step){const all=bookCards(book),k=all[all.indexOf(card)+Number(a.step)];if(k)go(book,k.id);return}
 if(a.vocabKnown&&book.lookup){changeChoices([[a.vocabKnown,{state:'known'}]]);return}
 if(a.term&&!book.lookup){termModal(a.term);return}
 if(a.know){save('known.'+a.know,known(a.know)?'0':'1');termModal(a.know);return}
 if(a.reviewstep){reviewIndex+=Number(a.reviewstep);revealed=false;renderReview();return}
 if(a.reviewknow){save('known.'+a.reviewknow,known(a.reviewknow)?'0':'1');if(filter!=='all')revealed=false;renderReview();return}
 if(b.id==='topics')showTopics();else if(b.id==='reveal'){revealed=true;renderReview()}else if(b.id==='allwords'){filter='all';reviewIndex=0;revealed=false;renderReview()}
});
window.addEventListener('popstate',loadRoute);window.addEventListener('hashchange',loadRoute);loadRoute();
const entryMode=new URLSearchParams(location.search).get('read');
if(['1','begin','resume'].includes(entryMode)&&location.hash)scrollToWork();
if(entryMode==='begin')history.replaceState(null,'',location.pathname+'?read=1'+location.hash);
