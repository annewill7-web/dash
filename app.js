const $ = (s) => document.querySelector(s);
const state = { type:'report', attachments:[], doc:null };
const TYPE_GUIDES = {
  report: '요약을 먼저 제시하고 1. 추진배경, 2. 주요내용, 3. 향후계획을 기본 골격으로 한다. 필요하면 가. 나. 소제목을 사용할 수 있다.',
  education: '교육/행사 계획형으로 작성한다. □ 추진 배경, □ 교육 개요, □ 세부 계획, □ 행정사항 순서를 우선한다. 일시·방법·대상·내용은 ○ 항목으로 명확하게 쓴다.',
  brief: '1~2페이지 분량의 간결 보고형으로 작성한다. 요약, 핵심 현황, 조치사항, 향후계획 중심으로 군더더기를 줄인다.'
};
const STYLE = { title:['21','12'], summary:['24','17'], hnum:['24','17'], box:['25','16'], bullet:['25','16'], dash:['27','16'], dot:['27','16'], body:['24','17'] };
const MARK = { box:'□ ', bullet:'○ ', dash:'- ', dot:'· ' };

$('#core').addEventListener('input', e => $('#counter').textContent = `${e.target.value.length} / 6000`);
document.querySelectorAll('.type-card').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.type-card').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.type=btn.dataset.type;}));

function syncApiUi(){
  const key=sessionStorage.getItem('gemini_api_key')||'';
  const inline=$('#apiKeyInline');
  const status=$('#apiStatus');
  if(inline && !inline.value) inline.value=key;
  if(status){ status.textContent=key?'설정 완료':'미설정'; status.classList.toggle('ok',!!key); }
}
$('#saveApiInline').onclick=()=>{
  const v=$('#apiKeyInline').value.trim();
  if(!v){ alert('Gemini API 키를 입력해 주세요.'); return; }
  sessionStorage.setItem('gemini_api_key',v); syncApiUi(); alert('API 키를 현재 브라우저 세션에 저장했습니다.');
};
$('#toggleApiKey').onclick=()=>{
  const input=$('#apiKeyInline'); const show=input.type==='password'; input.type=show?'text':'password'; $('#toggleApiKey').textContent=show?'키 숨기기':'키 보기';
};
$('#clearApiKey').onclick=()=>{ sessionStorage.removeItem('gemini_api_key'); $('#apiKeyInline').value=''; syncApiUi(); };
syncApiUi();

$('#apiButton').onclick=()=>{ $('#apiKey').value=sessionStorage.getItem('gemini_api_key')||''; $('#apiDialog').showModal(); };
$('#saveApi').onclick=()=>{ const v=$('#apiKey').value.trim(); if(v){ sessionStorage.setItem('gemini_api_key',v); if($('#apiKeyInline')) $('#apiKeyInline').value=v; syncApiUi(); } };

const dz=$('#dropzone');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));
dz.addEventListener('drop',e=>handleFiles([...e.dataTransfer.files]));
$('#files').addEventListener('change',e=>handleFiles([...e.target.files]));

async function handleFiles(files){
  for(const file of files.slice(0,5)){
    try{
      const text=await extractText(file);
      state.attachments.push({name:file.name,text:text.slice(0,16000)});
    }catch(err){state.attachments.push({name:file.name,text:`[추출 실패: ${err.message}]`});}
  }
  renderFiles();
}
function renderFiles(){ $('#fileList').innerHTML=state.attachments.map((f,i)=>`<div class="file-chip"><span>${escapeHtml(f.name)}</span><button type="button" data-rm="${i}" class="ghost">삭제</button></div>`).join(''); document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{state.attachments.splice(+b.dataset.rm,1);renderFiles()}); }
async function extractText(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(['txt','md'].includes(ext)) return await file.text();
  if(ext==='docx'){ const ab=await file.arrayBuffer(); const r=await mammoth.extractRawText({arrayBuffer:ab}); return r.value; }
  if(ext==='pdf'){
    const pdfjsLib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise; let out='';
    for(let i=1;i<=Math.min(pdf.numPages,20);i++){const page=await pdf.getPage(i);const c=await page.getTextContent();out+=`\n[${i}쪽]\n`+c.items.map(x=>x.str).join(' ');}
    return out;
  }
  throw new Error('지원하지 않는 파일 형식');
}

$('#draftForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const key=sessionStorage.getItem('gemini_api_key');
  if(!key){ $('#apiDialog').showModal(); return; }
  const btn=$('#generate'); btn.disabled=true; btn.innerHTML='초안을 작성하는 중…'; $('#resultBadge').textContent='생성 중';
  try{
    const prompt=buildPrompt();
    const doc=await callGemini(key,$('#model').value.trim()||'gemini-3.6-flash',prompt);
    state.doc=normalizeDoc(doc); renderDoc(state.doc);
  }catch(err){ alert('생성 실패: '+err.message); $('#resultBadge').textContent='오류'; }
  finally{btn.disabled=false;btn.innerHTML='<span>✦</span> AI 한글문서 초안 생성';}
});

function buildPrompt(){
  const refs=state.attachments.map(a=>`\n--- 참고파일: ${a.name} ---\n${a.text}`).join('\n');
  const tone=$('#tone').value==='formal'?'문장 종결은 공공기관 보고체(~함/~임/~됨)를 주로 사용':'정중한 서술체를 사용';
  return `당신은 대한민국 공공기관의 행정문서 작성 전문가다. 사용자가 제공한 사실을 임의로 만들거나 수치를 창작하지 말고, 정보가 없으면 추정하지 않는다.\n\n[문서 디자인/내용 시스템]\n- 제목은 간결하고 구체적으로 작성한다.\n- 보고형 문서는 문서 앞부분에 요약을 둔다.\n- 본문은 주어와 서술어가 드러나는 서술식 문장을 사용한다. ${tone}.\n- 항목 계층은 필요한 경우 □ → ○ → - → · 순서를 지키고 반드시 실제 유니코드 문자를 전제로 한다.\n- 표 없이도 의미가 이해되도록 일정·절차·체계는 먼저 문장으로 설명한다.\n- 과도한 장식, 박스 제목, 의미 없는 축약은 피한다.\n- ${TYPE_GUIDES[state.type]}\n\n[사용자 입력]\n제목/주제: ${$('#title').value.trim()}\n핵심내용: ${$('#core').value.trim()}\n발행기관: ${$('#org').value.trim()||'미입력'}\n담당/보고정보: ${$('#owner').value.trim()||'미입력'}\n추가지시: ${$('#extra').value.trim()||'없음'}\n${refs}\n\n반드시 아래 JSON 객체 하나만 반환한다. 마크다운 코드블록은 쓰지 않는다.\n{\n  "title":"문서 제목",\n  "meta":"보고방식/날짜/기관 또는 담당정보. 정보가 없으면 빈 문자열",\n  "summary":"전체를 2~4문장으로 요약",\n  "sections":[\n    {"heading":"1. 추진배경", "blocks":[\n      {"level":"bullet","text":"내용"},\n      {"level":"dash","text":"내용"}\n    ]}\n  ],\n  "review":["원문에서 확인이 필요한 사항 또는 빈 배열"]\n}\nlevel은 box, bullet, dash, dot, body 중 하나만 사용한다. heading은 필요 없으면 빈 문자열로 둘 수 있다.`;
}

async function callGemini(key,model,prompt){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({model,input:prompt,store:false})
  });
  const data=await r.json(); if(!r.ok) throw new Error(data?.error?.message||`HTTP ${r.status}`);
  let text=data.output_text || data?.steps?.at?.(-1)?.content?.find?.(x=>x.type==='text')?.text || '';
  if(!text){
    const pieces=[]; for(const step of (data.steps||[])) for(const c of (step.content||[])) if(c.text) pieces.push(c.text); text=pieces.join('\n');
  }
  text=text.trim().replace(/^```json\s*/,'').replace(/```$/,'').trim();
  try{return JSON.parse(text)}catch{throw new Error('Gemini 응답을 JSON으로 해석하지 못했습니다. 모델 응답: '+text.slice(0,180));}
}

function normalizeDoc(d){
  return {title:d.title||$('#title').value,meta:d.meta||'',summary:d.summary||'',sections:Array.isArray(d.sections)?d.sections:[],review:Array.isArray(d.review)?d.review:[]};
}
function renderDoc(d){
  $('#empty').hidden=true; $('#resultWrap').hidden=false; $('#resultBadge').textContent='완료'; $('#resultBadge').className='status-dot';
  let html=`<h1>${escapeHtml(d.title)}</h1>${d.meta?`<div class="meta">${escapeHtml(d.meta)}</div>`:''}<div class="summary-title">요약</div><p class="summary">${escapeHtml(d.summary)}</p>`;
  for(const s of d.sections){ if(s.heading) html+=`<h2>${escapeHtml(s.heading)}</h2>`; for(const b of (s.blocks||[])){const lv=['box','bullet','dash','dot','body'].includes(b.level)?b.level:'body'; html+=`<p class="block level-${lv}">${escapeHtml(MARK[lv]||'')}${escapeHtml(b.text||'')}</p>`;} }
  $('#paper').innerHTML=html;
  const checks=[]; checks.push('✓ 요약 우선 배치'); checks.push('✓ 유니코드 항목기호 사용'); checks.push('✓ HWPX 템플릿 기반 저장'); if(d.review.length) checks.push('확인 필요: '+d.review.join(' / '));
  $('#quality').textContent=checks.join('  ·  ');
}
function toPlainText(d){ let x=`${d.title}\n${d.meta?d.meta+'\n':''}\n요약\n${d.summary}\n`; for(const s of d.sections){x+=`\n${s.heading||''}\n`;for(const b of (s.blocks||[]))x+=(MARK[b.level]||'')+(b.text||'')+'\n';} if(d.review.length)x+='\n[확인 필요]\n- '+d.review.join('\n- '); return x.trim(); }
$('#copyText').onclick=async()=>{await navigator.clipboard.writeText(toPlainText(state.doc));$('#copyText').textContent='복사됨';setTimeout(()=>$('#copyText').textContent='텍스트 복사',1000)};
$('#downloadTxt').onclick=()=>downloadBlob(new Blob([toPlainText(state.doc)],{type:'text/plain;charset=utf-8'}),safeName(state.doc.title)+'.txt');
$('#downloadHwpx').onclick=async()=>{ try{const blob=await buildHwpx(state.doc);downloadBlob(blob,safeName(state.doc.title)+'.hwpx');}catch(e){alert('HWPX 생성 실패: '+e.message)} };

async function buildHwpx(d){
  if(!window.JSZip) throw new Error('JSZip 로딩 실패');
  const chunkPaths=['assets/base.0.txt','assets/base.1.txt','assets/base.2.txt','assets/base.3.txt','assets/base.4.txt','assets/base.5.txt'];
  const parts=await Promise.all(chunkPaths.map(async path=>{const r=await fetch(path);if(!r.ok)throw new Error('HWPX 템플릿 조각을 불러오지 못했습니다: '+path);return (await r.text()).trim();}));
  const b64=parts.join('');
  const raw=atob(b64);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  const zip=await JSZip.loadAsync(bytes.buffer);
  const secFile=zip.file('Contents/section0.xml'); if(!secFile) throw new Error('템플릿 section0.xml 없음');
  const xml=await secFile.async('string');
  const idx=xml.indexOf('<hp:p'); if(idx<0) throw new Error('템플릿 문단 구조를 찾지 못함');
  const head=xml.slice(0,idx); const m=xml.match(/<hp:secPr\b[\s\S]*?<\/hp:secPr>/); const secpr=m?m[0]:'';
  let pid=1000; const paras=[];
  paras.push(makeP('title',d.title,pid++,secpr));
  if(d.meta) paras.push(makeP('body',d.meta,pid++));
  paras.push(makeP('summary','요약',pid++)); paras.push(makeP('body',d.summary,pid++));
  for(const s of d.sections){ if(s.heading) paras.push(makeP('hnum',s.heading,pid++)); for(const b of (s.blocks||[])){const kind=STYLE[b.level]?b.level:'body';paras.push(makeP(kind,b.text||'',pid++));} }
  if(d.review.length){paras.push(makeP('hnum','[확인 필요]',pid++));d.review.forEach(t=>paras.push(makeP('dash',t,pid++)));}
  const newSection=head+paras.join('')+'</hs:sec>';
  const outZip=new JSZip();
  const mime=zip.file('mimetype');
  if(!mime) throw new Error('템플릿 mimetype 없음');
  outZip.file('mimetype',await mime.async('string'),{compression:'STORE'});
  const names=Object.keys(zip.files).filter(n=>n!=='mimetype').sort((a,b)=>a.localeCompare(b));
  for(const name of names){
    const entry=zip.files[name];
    if(entry.dir){ outZip.folder(name); continue; }
    const data=name==='Contents/section0.xml'?newSection:await entry.async('uint8array');
    outZip.file(name,data,{binary:name!=='Contents/section0.xml'});
  }
  return await outZip.generateAsync({type:'blob',mimeType:'application/hwp+zip',compression:'DEFLATE',compressionOptions:{level:6}});
}
function makeP(kind,text,pid,secpr=''){
  const [para,char]=STYLE[kind]; const body=xmlEsc((MARK[kind]||'')+text);
  if(kind==='title') return `<hp:p id="${pid}" paraPrIDRef="${para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${char}">${secpr}</hp:run><hp:run charPrIDRef="${char}"><hp:t>${body}</hp:t></hp:run></hp:p>`;
  return `<hp:p id="${pid}" paraPrIDRef="${para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${char}"><hp:t>${body}</hp:t></hp:run></hp:p>`;
}
function xmlEsc(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function safeName(s){return (s||'한글문서_초안').replace(/[\\/:*?"<>|]/g,'_').slice(0,80)}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
