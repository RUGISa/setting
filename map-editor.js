(function(){
const wmeRoot=document.getElementById('wmeRoot');
const $=s=>wmeRoot.querySelector(s);
const $$=s=>[...wmeRoot.querySelectorAll(s)];
const canvas=$('#wmeMapCanvas'),ctx=canvas.getContext('2d');
const wrap=$('#canvasWrap'),holder=$('#canvasHolder');
const cursorPreview=$('#cursorPreview'),cursorLabel=$('#cursorLabel'),cursorStampPreview=$('#cursorStampPreview');

const landPresets=['#d2c29f','#b7a481','#9d9679','#707c64','#d8c7a4','#ad8f67','#c7b493','#928371','#7e8a75','#cdbca0'];
const outlineOffsets=[[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]];

function iconData(inner){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke="#6f6454" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
const defaultStampDefs=[
  {name:'산',terrain:'land',src:iconData('<path d="M8 50 23 26 31 38 42 16 56 50"/><path d="M29 27l4 6 4-4"/>')},
  {name:'숲',terrain:'land',src:iconData('<path d="M21 49V40"/><path d="M16 40 21 28 26 40Z"/><path d="M43 49V38"/><path d="M36 38 43 22 50 38Z"/>')},
  {name:'도시',terrain:'land',src:iconData('<path d="M14 49V30h12v19"/><path d="M26 49V20h12v29"/><path d="M38 49V26h12v23"/>')},
  {name:'성',terrain:'land',src:iconData('<path d="M12 49V28h8v6h6v-6h12v6h6v-6h8v21"/><path d="M12 49h40"/><path d="M28 49V39h8v10"/>')},
  {name:'유적',terrain:'land',src:iconData('<path d="M12 49h40"/><path d="M18 49V27"/><path d="M30 49V22"/><path d="M42 49V30"/>')},
  {name:'항구',terrain:'coast',src:iconData('<path d="M32 14v27"/><path d="M22 24c4 4 6 7 10 7s6-3 10-7"/><path d="M22 44c4 4 7 6 10 6s6-2 10-6"/>')},
  {name:'동굴',terrain:'land',src:iconData('<path d="M10 47c6-16 16-23 22-23s16 7 22 23"/><path d="M24 47V35"/><path d="M40 47V35"/>')},
  {name:'탑',terrain:'land',src:iconData('<path d="M24 49h16"/><path d="M26 49 29 19h6l3 30"/><path d="M24 19h16"/>')},
  {name:'마을',terrain:'land',src:iconData('<path d="M15 49V32l11-9 11 9v17"/><path d="M20 49V38h12v11"/><path d="M40 49V36l9-7v20"/>')},
  {name:'파도',terrain:'sea',src:iconData('<path d="M8 28c6-7 12-7 18 0s12 7 18 0 12-7 18 0"/><path d="M8 40c6-7 12-7 18 0s12 7 18 0 12-7 18 0"/>')},
  {name:'선박',terrain:'sea',src:iconData('<path d="M16 39h34l-7 10H23Z"/><path d="M31 15v24"/><path d="M32 18l13 9H32Z"/>')},
  {name:'소용돌이',terrain:'sea',src:iconData('<path d="M50 31c0-11-10-19-21-16-9 2-14 12-9 20 5 8 18 8 23 0 4-7-2-15-10-14-6 1-9 8-5 13 4 5 12 3 12-3"/>')}
];

const PERF_KEY='wme-perf-settings-v1';
function loadPerfSettings(){
  let raw={};
  try{raw=JSON.parse(localStorage.getItem(PERF_KEY)||'{}');}catch{}
  return {
    dprCap: raw.dprCap==='uncapped' ? 'uncapped' : 2,
    stampObjectMode: raw.stampObjectMode==='all' ? 'all' : 'click',
    selectScope: raw.selectScope==='active' ? 'active' : 'all'
  };
}
function savePerfSettings(p){
  try{localStorage.setItem(PERF_KEY,JSON.stringify(p));}catch{}
}
function computeDpr(perf){
  const raw=window.devicePixelRatio||1;
  return perf.dprCap==='uncapped' ? raw : Math.min(raw,perf.dprCap);
}

let state={
  tool:'brush',
  shape:'round',
  size:72,
  opacity:1,
  softness:.35,
  stampMode:'region',
  stampSize:34,
  stampGap:22,
  terrains:[
    {id:'water',name:'Water',color:'#8C9184',type:'Sea'},
    {id:'grassland',name:'Grassland',color:'#AE987B',type:'Land'},
    {id:'forest',name:'Forest',color:'#9E8B76',type:'Land'},
    {id:'desert',name:'Desert',color:'#B6A591',type:'Land'},
    {id:'snow',name:'Snow',color:'#BFAB92',type:'Land'}
  ],
  activeTerrainId:'grassland',
  coastColor:'#75654e',
  stampColor:'#6f6454',
  scale:1,viewX:0,viewY:0,
  selectedStamp:{type:'default',index:0},
  defaultStamps:[],customStamps:[],
  layers:[],activeLayerId:null,
  history:[],historyIndex:-1, pointerDown:false, activePointerId:null,
  perf:loadPerfSettings(),
  dpr:1,
  docWidth:1400,docHeight:900
};
state.dpr=computeDpr(state.perf);

const STYLE_PRESETS=[
  {name:'사막',terrains:{water:'#8C9184',grassland:'#D8B674',forest:'#C79A5B',desert:'#E4C689',snow:'#EADCC0'},coast:'#6f5a3a'},
  {name:'초원',terrains:{water:'#8FAFB0',grassland:'#AE987B',forest:'#8E9E6F',desert:'#C7B389',snow:'#DCD3B8'},coast:'#5d5a3f'},
  {name:'다크',terrains:{water:'#3E4A52',grassland:'#5B5546',forest:'#454A3B',desert:'#6B5F49',snow:'#7C7A6E'},coast:'#1c1c1c'},
  {name:'빙하',terrains:{water:'#5C7A99',grassland:'#AAB9C4',forest:'#8FA0AE',desert:'#C7D2D8',snow:'#EFF4F6'},coast:'#3a4b5c'},
  {name:'황무지',terrains:{water:'#918383',grassland:'#AE987B',forest:'#8C7A63',desert:'#B08F6C',snow:'#C9BBA6'},coast:'#4a4038'}
];

function activeTerrain(){return state.terrains.find(t=>t.id===state.activeTerrainId)||state.terrains[1]}
function terrainColorById(id){return state.terrains.find(t=>t.id===id)?.color||'#AE987B'}
function waterColor(){return state.terrains[0].color}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
function makeCanvas(){const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;return c}
function makeLayer(name,{locked=false}={}){
  const masks={};
  state.terrains.forEach(t=>{masks[t.id]=makeCanvas();});
  return {id:uid(),name,visible:true,locked,masks,art:makeCanvas()};
}
function ensureLayerMasks(layer){
  state.terrains.forEach(t=>{
    if(!layer.masks[t.id])layer.masks[t.id]=makeCanvas();
  });
}
function activeLayer(){return state.layers.find(l=>l.id===state.activeLayerId)}
function editableLayer(){
  const layer=activeLayer();
  if(!layer||layer.locked){showStatus('편집 가능한 레이어를 선택하세요');return null}
  return layer;
}
function resetLayers(){
  const ocean=makeLayer('바다',{locked:true});
  const first=makeLayer('레이어 1');
  state.layers=[ocean,first];
  state.activeLayerId=first.id;
}
function showStatus(text){
  const s=$('#status');
  s.textContent=text;
  s.classList.add('show');
  clearTimeout(showStatus.t);
  showStatus.t=setTimeout(()=>s.classList.remove('show'),1300);
}
function updateHolderSize(){holder.style.width=state.docWidth+'px';holder.style.height=state.docHeight+'px'}
function setDocSize(w,h){
  state.docWidth=w;state.docHeight=h;
  canvas.width=Math.round(w*state.dpr);
  canvas.height=Math.round(h*state.dpr);
  canvas.style.width=w+'px';
  canvas.style.height=h+'px';
  updateHolderSize();
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function adjustColor(hex,amount){
  const n=parseInt(hex.slice(1),16);
  const r=clamp((n>>16)+amount,0,255),g=clamp(((n>>8)&255)+amount,0,255),b=clamp((n&255)+amount,0,255);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function hexToRgb(hex){
  const n=parseInt(hex.slice(1),16);
  return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
}
function rgba(hex,a){
  const {r,g,b}=hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
const scratchPool=[];
function getScratch(i){
  let t=scratchPool[i];
  if(!t){t=makeCanvas();scratchPool[i]=t;}
  else if(t.width!==canvas.width||t.height!==canvas.height){
    t.width=canvas.width;t.height=canvas.height;
  }else{
    t.getContext('2d').clearRect(0,0,t.width,t.height);
  }
  return t;
}
function tintMask(source,color,scratchIndex){
  const t=scratchIndex!=null?getScratch(scratchIndex):makeCanvas();
  const c=t.getContext('2d');
  c.globalCompositeOperation='source-over';
  c.fillStyle=color;c.fillRect(0,0,t.width,t.height);
  c.globalCompositeOperation='destination-in';
  c.drawImage(source,0,0);
  return t;
}
function drawOcean(){
  const wc=waterColor();
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,adjustColor(wc,18));
  g.addColorStop(.55,wc);
  g.addColorStop(1,adjustColor(wc,-12));
  ctx.fillStyle=g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.globalAlpha=.055;
  ctx.strokeStyle='#ffffff';
  ctx.lineWidth=1;
  for(let y=22;y<canvas.height;y+=34){
    ctx.beginPath();
    for(let x=0;x<=canvas.width;x+=18){
      const yy=y+Math.sin((x+y)*.018)*2.2;
      if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha=.045;
  for(let i=0;i<2200;i++){
    const x=(i*73)%canvas.width, y=(i*37)%canvas.height;
    ctx.fillStyle=i%3===0?'#ffffff':'#1f3942';
    ctx.fillRect(x,y,1,1);
  }
  ctx.restore();
}
const coastGlowRings=[{r:3,a:.16},{r:5,a:.09},{r:7.5,a:.05}];
function combinedMask(layer,predicate,scratchIndex){
  const out=scratchIndex!=null?getScratch(scratchIndex):makeCanvas();
  const c=out.getContext('2d');
  state.terrains.forEach(t=>{
    if(predicate&&!predicate(t))return;
    const m=layer.masks[t.id];
    if(m)c.drawImage(m,0,0);
  });
  return out;
}
function drawLayerTerrain(layer){
  ensureLayerMasks(layer);
  const landUnion=combinedMask(layer,t=>t.type==='Land',0);
  const coast=tintMask(landUnion,state.coastColor,1);

  ctx.save();
  ctx.globalAlpha=.16;
  ctx.filter='blur(5px)';
  ctx.drawImage(coast,0,3);
  ctx.restore();

  // 부드럽게 번지는 해안선 (안쪽은 진하고 밖으로 갈수록 옅어짐)
  ctx.save();
  coastGlowRings.forEach(({r,a})=>{
    ctx.globalAlpha=a;
    const steps=Math.max(10,Math.round(r*5));
    for(let i=0;i<steps;i++){
      const angle=(i/steps)*Math.PI*2;
      ctx.drawImage(coast,Math.cos(angle)*r,Math.sin(angle)*r);
    }
  });
  ctx.restore();

  ctx.save();
  ctx.globalAlpha=.48;
  outlineOffsets.forEach(([x,y])=>ctx.drawImage(coast,x,y));
  ctx.restore();

  // 각 지형을 현재 색상으로 실시간 채색해서 그림 (프리셋 바뀌면 이미 칠한 부분도 같이 바뀜)
  state.terrains.forEach(t=>{
    const m=layer.masks[t.id];
    if(!m)return;
    ctx.drawImage(tintMask(m,t.color,2),0,0);
  });

  ctx.save();
  ctx.globalCompositeOperation='source-atop';
  ctx.globalAlpha=.085;
  ctx.strokeStyle='#fff3da';
  ctx.lineWidth=1;
  for(let y=12;y<canvas.height;y+=20){
    ctx.beginPath();
    for(let x=0;x<=canvas.width;x+=16){
      const yy=y+Math.sin((x+y)*.025)*1.5;
      if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation='source-atop';
  ctx.globalAlpha=.055;
  ctx.fillStyle='#3b3024';
  for(let i=0;i<1800;i++){
    const x=(i*53)%canvas.width, y=(i*31)%canvas.height;
    ctx.fillRect(x,y,1,1);
  }
  ctx.restore();
}
let paperTextureCanvas=null;
function buildPaperTexture(){
  const t=document.createElement('canvas');
  t.width=300;t.height=300;
  const c=t.getContext('2d');
  const img=c.createImageData(300,300);
  for(let i=0;i<img.data.length;i+=4){
    const n=195+Math.random()*60;
    img.data[i]=n;img.data[i+1]=n;img.data[i+2]=n;img.data[i+3]=255;
  }
  c.putImageData(img,0,0);
  c.globalAlpha=.06;
  c.strokeStyle='#000';
  c.lineWidth=1;
  for(let i=0;i<50;i++){
    const y=Math.random()*300;
    c.beginPath();
    c.moveTo(0,y);
    c.bezierCurveTo(90,y+Math.random()*24-12,210,y+Math.random()*24-12,300,y);
    c.stroke();
  }
  paperTextureCanvas=t;
}
function drawPaperTexture(){
  if(!paperTextureCanvas)buildPaperTexture();
  ctx.save();
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=.14;
  ctx.fillStyle=ctx.createPattern(paperTextureCanvas,'repeat');
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();
  ctx.save();
  const vg=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.height*.35,canvas.width/2,canvas.height/2,canvas.height*.78);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(20,15,8,.14)');
  ctx.fillStyle=vg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();
}
let compositeScheduled=false;
function scheduleComposite(){
  if(compositeScheduled)return;
  compositeScheduled=true;
  requestAnimationFrame(()=>{compositeScheduled=false;composite();});
}
function composite(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawOcean();
  state.layers.forEach(layer=>{
    if(!layer.visible||layer.locked)return;
    drawLayerTerrain(layer);
    ctx.drawImage(layer.art,0,0);
  });
  drawPaperTexture();
}
function renderStylePresets(){
  $('#stylePresets').innerHTML=STYLE_PRESETS.map((p,i)=>`
    <button class="preset-swatch" data-index="${i}" title="${p.name}" style="background:linear-gradient(135deg, ${p.terrains.water}, ${p.terrains.grassland} 50%, ${p.terrains.forest})"></button>
  `).join('');
  $$('.preset-swatch').forEach(b=>{
    b.onclick=()=>{
      const preset=STYLE_PRESETS[Number(b.dataset.index)];
      if(!preset)return;
      state.terrains.forEach(t=>{ if(preset.terrains[t.id]) t.color=preset.terrains[t.id]; });
      state.coastColor=preset.coast;
      $('#coastColor').value=state.coastColor;
      renderTerrainList();
      composite();
      showStatus(`"${preset.name}" 스타일 적용됨`);
    };
  });
}
function renderTerrainList(){
  $('#terrainList').innerHTML=state.terrains.map((t,i)=>`
    <div class="terrain-row ${t.id===state.activeTerrainId?'active':''}" data-id="${t.id}">
      <span class="terrain-key">${i+1}</span>
      <input type="color" class="terrain-color" value="${t.color}" data-id="${t.id}">
      <span class="terrain-name">${t.name}</span>
      <select class="terrain-type" data-id="${t.id}">
        <option value="Sea" ${t.type==='Sea'?'selected':''}>Sea</option>
        <option value="Land" ${t.type==='Land'?'selected':''}>Land</option>
      </select>
    </div>
  `).join('');
  $$('.terrain-row').forEach(row=>{
    row.onclick=(e)=>{
      if(e.target.closest('input,select'))return;
      state.activeTerrainId=row.dataset.id;
      setTool('brush');
      renderTerrainList();
    };
  });
  $$('.terrain-color').forEach(input=>{
    input.oninput=(e)=>{
      const t=state.terrains.find(t=>t.id===e.target.dataset.id);
      if(t){t.color=e.target.value;composite();}
    };
  });
  $$('.terrain-type').forEach(sel=>{
    sel.onchange=(e)=>{
      const t=state.terrains.find(t=>t.id===e.target.dataset.id);
      if(t)t.type=e.target.value;
    };
  });
}
function renderLandSwatches(){renderTerrainList();}
function initDefaultStamps(){
  state.defaultStamps=defaultStampDefs.map(d=>{const img=new Image();img.src=d.src;return {...d,img}});
}
function renderDefaultAssets(){
  $('#defaultAssets').innerHTML=state.defaultStamps.map((s,i)=>`
    <button class="asset ${state.selectedStamp.type==='default'&&state.selectedStamp.index===i?'active':''}" data-index="${i}">
      <img src="${s.src}" alt="${s.name}">
    </button>`).join('');
  $$('#defaultAssets .asset').forEach(b=>b.onclick=()=>{
    state.selectedStamp={type:'default',index:+b.dataset.index};
    setTool('stamp');
    renderDefaultAssets();
    renderCustomAssets();
    refreshStampCursorPreview();
  });
}
function renderCustomAssets(){
  const box=$('#customAssets');
  if(!state.customStamps.length){
    box.innerHTML='<div class="empty-assets">추가된 이미지가 없습니다.</div>';
    return;
  }
  box.innerHTML=state.customStamps.map((s,i)=>`
    <button class="asset ${state.selectedStamp.type==='custom'&&state.selectedStamp.index===i?'active':''}" data-index="${i}">
      <img src="${s.src}" alt="">
    </button>`).join('');
  $$('#customAssets .asset').forEach(b=>b.onclick=()=>{
    state.selectedStamp={type:'custom',index:+b.dataset.index};
    setTool('stamp');
    renderDefaultAssets();
    renderCustomAssets();
    refreshStampCursorPreview();
  });
}
function renderLayers(){
  $('#layerList').innerHTML=[...state.layers].reverse().map(l=>`
    <div class="layer ${l.id===state.activeLayerId?'active':''} ${l.locked?'locked':''}" data-id="${l.id}">
      <button class="layer-eye" data-eye="${l.id}">${l.visible?'●':'○'}</button>
      <button class="layer-lock" data-lock="${l.id}">${l.locked?'🔒':' '}</button>
      <div class="layer-name" data-name="${l.id}">${l.name}</div>
      <button class="layer-delete" data-del="${l.id}">×</button>
    </div>`).join('');

  $$('.layer').forEach(el=>el.onclick=e=>{
    if(e.target.closest('button')||e.target.isContentEditable)return;
    state.activeLayerId=el.dataset.id;
    renderLayers();
  });
  $$('[data-eye]').forEach(b=>b.onclick=()=>{
    const l=state.layers.find(x=>x.id===b.dataset.eye);
    l.visible=!l.visible;
    renderLayers();
    composite();
  });
  $$('[data-lock]').forEach(b=>b.onclick=()=>{
    const l=state.layers.find(x=>x.id===b.dataset.lock);
    if(l.name==='바다')return;
    l.locked=!l.locked;
    renderLayers();
  });
  $$('[data-del]').forEach(b=>b.onclick=()=>{
    const l=state.layers.find(x=>x.id===b.dataset.del);
    if(!l||l.name==='바다')return;
    state.layers=state.layers.filter(x=>x.id!==l.id);
    if(!state.layers.find(x=>x.id===state.activeLayerId)){
      state.activeLayerId=[...state.layers].reverse().find(x=>!x.locked)?.id||state.layers[0].id;
    }
    renderLayers();
    composite();
    pushHistory();
  });
  $$('[data-name]').forEach(el=>{
    el.ondblclick=e=>{
      const l=state.layers.find(x=>x.id===el.dataset.name);
      if(l.name==='바다')return;
      e.stopPropagation();
      el.contentEditable='true';
      el.focus();
    };
    el.onblur=()=>{
      const l=state.layers.find(x=>x.id===el.dataset.name);
      if(l)l.name=el.textContent.trim()||'이름 없는 레이어';
      el.contentEditable='false';
      renderLayers();
    };
    el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}}
  });
}
function serialize(){
  return {
    width:canvas.width,height:canvas.height,
    docWidth:state.docWidth,docHeight:state.docHeight,
    terrains:state.terrains,activeTerrainId:state.activeTerrainId,coastColor:state.coastColor,
    stampColor:state.stampColor,stampMode:state.stampMode,stampSize:state.stampSize,stampGap:state.stampGap,
    layers:state.layers.map(l=>({
      id:l.id,name:l.name,visible:l.visible,locked:l.locked,
      masks:Object.fromEntries(Object.entries(l.masks).map(([id,c])=>[id,c.toDataURL()])),
      art:l.art.toDataURL()
    })),
    customStamps:state.customStamps.map(s=>({name:s.name,src:s.src}))
  };
}
async function loadImage(src){return await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});}
async function restore(s){
  setDocSize(s.docWidth||s.width,s.docHeight||s.height);
  if(Array.isArray(s.terrains)&&s.terrains.length){
    state.terrains=s.terrains;
    state.activeTerrainId=s.activeTerrainId||state.terrains[1]?.id||state.terrains[0].id;
  }else if(s.waterColor||s.landColor){
    // 예전 저장 파일(단일 바다/육지 색상) 호환
    state.terrains[0].color=s.waterColor||state.terrains[0].color;
    state.terrains[1].color=s.landColor||state.terrains[1].color;
  }
  state.coastColor=s.coastColor||'#75654e';
  state.stampColor=s.stampColor||'#6f6454';
  state.stampMode=s.stampMode||'region';
  state.stampSize=s.stampSize||34;
  state.stampGap=s.stampGap||22;

  renderTerrainList();
  $('#coastColor').value=state.coastColor;
  $('#stampColor').value=state.stampColor;
  $('#stampSize').value=state.stampSize;$('#stampSizeNum').textContent=state.stampSize;
  $('#stampGap').value=state.stampGap;$('#stampGapNum').textContent=state.stampGap;
  syncStampModeButtons();

  state.layers=[];
  for(const item of s.layers){
    const l=makeLayer(item.name,{locked:item.locked});
    l.id=item.id;
    l.visible=item.visible;
    if(item.masks){
      for(const [tid,src] of Object.entries(item.masks)){
        if(!l.masks[tid])l.masks[tid]=makeCanvas();
        const m=l.masks[tid];
        m.getContext('2d').drawImage(await loadImage(src),0,0,m.width,m.height);
      }
    }else if(item.terrain){
      // 예전 저장 파일(지형 하나로 합쳐진 캔버스) 호환: 육지 지형 마스크로 불러옵니다.
      const fallbackId=state.terrains.find(t=>t.type==='Land')?.id||state.terrains[1].id;
      const m=l.masks[fallbackId];
      m.getContext('2d').drawImage(await loadImage(item.terrain),0,0,m.width,m.height);
    }
    l.art.getContext('2d').drawImage(await loadImage(item.art),0,0,l.art.width,l.art.height);
    state.layers.push(l);
  }
  state.activeLayerId=[...state.layers].reverse().find(l=>!l.locked)?.id||state.layers[0].id;

  state.customStamps=[];
  for(const item of s.customStamps||[]){
    const img=await loadImage(item.src);
    state.customStamps.push({...item,img});
  }
  renderLandSwatches();
  renderDefaultAssets();
  renderCustomAssets();
  renderLayers();
  composite();
}
function pushHistory(){
  state.history=state.history.slice(0,state.historyIndex+1);
  state.history.push(serialize());
  if(state.history.length>30)state.history.shift();
  state.historyIndex=state.history.length-1;
}
function undo(){if(state.historyIndex<=0)return;state.historyIndex--;restore(state.history[state.historyIndex]);}
function redo(){if(state.historyIndex>=state.history.length-1)return;state.historyIndex++;restore(state.history[state.historyIndex]);}
function setTool(tool){
  state.tool=tool;
  $$('.mode-card').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  updateCursorPreviewState();
}
function syncStampModeButtons(){
  $$('[data-stamp-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.stampMode===state.stampMode));
  updateCursorPreviewState();
}
function setView(){
  holder.style.transform=`translate(${state.viewX}px,${state.viewY}px) scale(${state.scale})`;
  $('#zoomText').textContent=Math.round(state.scale*100)+'%';
}
function fitView(){
  if(!wrap.clientWidth||!wrap.clientHeight)return;
  const p=24;
  state.scale=Math.min(1,(wrap.clientWidth-p)/state.docWidth,(wrap.clientHeight-p)/state.docHeight);
  state.viewX=(wrap.clientWidth-state.docWidth*state.scale)/2;
  state.viewY=(wrap.clientHeight-state.docHeight*state.scale)/2;
  setView();
}
function zoomAt(next,x=wrap.clientWidth/2,y=wrap.clientHeight/2){
  next=Math.max(.2,Math.min(5,next));
  const wx=(x-state.viewX)/state.scale,wy=(y-state.viewY)/state.scale;
  state.viewX=x-wx*next;
  state.viewY=y-wy*next;
  state.scale=next;
  setView();
}
function localPoint(e){
  const r=wrap.getBoundingClientRect();
  return {x:(e.clientX-r.left-state.viewX)/state.scale,y:(e.clientY-r.top-state.viewY)/state.scale};
}
function brushPreviewSize(){
  if(state.tool==='brush'||state.tool==='eraser')return state.size;
  if(state.tool==='stamp'){
    if(state.stampMode==='single')return state.stampSize;
    return state.stampSize*2.3;
  }
  return 0;
}
function updateCursorPreviewState(){
  refreshStampCursorPreview();
  if(state.tool==='pan'){
    cursorPreview.style.display='none';
    return;
  }
  cursorPreview.style.display='flex';
  cursorPreview.classList.toggle('region', state.tool==='stamp' && state.stampMode!=='single');
}
function moveCursorPreview(clientX,clientY){
  const size=brushPreviewSize()*state.scale;
  if(!size||state.tool==='pan'){
    cursorPreview.style.transform='translate(-9999px,-9999px)';
    return;
  }
  const rect=wrap.getBoundingClientRect();
  const left=clientX-rect.left-size/2;
  const top=clientY-rect.top-size/2;
  cursorPreview.style.width=size+'px';
  cursorPreview.style.height=size+'px';
  cursorPreview.style.transform=`translate(${left}px,${top}px)`;
  const label = (state.tool==='stamp' && state.stampMode!=='single')
    ? `구역 ${Math.round(brushPreviewSize())}px`
    : `${Math.round(brushPreviewSize())}px`;
  cursorLabel.textContent=label;
  if(state.tool==='stamp')refreshStampCursorPreview();
}
function hideCursorPreview(){cursorPreview.style.transform='translate(-9999px,-9999px)';}
function refreshStampCursorPreview(){
  cursorStampPreview.innerHTML='';
  if(state.tool!=='stamp')return;

  const item=currentStamp();
  if(!item)return;

  const previewSize=brushPreviewSize()*state.scale;
  const source=item.src;
  if(state.stampMode==='single'){
    const img=document.createElement('img');
    img.src=source;
    img.style.left='50%';
    img.style.top='50%';
    img.style.width=Math.max(12,state.stampSize*state.scale)+'px';
    img.style.height=Math.max(12,state.stampSize*state.scale)+'px';
    cursorStampPreview.appendChild(img);
    return;
  }

  const rawRadius=state.stampSize*1.9;
  const rawCellR=Math.max(13,state.stampSize*.38);
  const step=rawCellR*1.58;
  const seed=state.stampSize*29;
  for(let gy=-5;gy<=5;gy++){
    for(let gx=-5;gx<=5;gx++){
      const jitterX=Math.sin(seed+gx*7+gy*13)*rawCellR*.25;
      const jitterY=Math.cos(seed+gx*11-gy*5)*rawCellR*.25;
      const px=gx*step+(gy%2)*step*.48+jitterX;
      const py=gy*step*.86+jitterY;
      if(Math.hypot(px,py)>=rawRadius-rawCellR*.3)continue;

      const img=document.createElement('img');
      img.src=source;
      img.style.left=(50+(px/(rawRadius*2))*100)+'%';
      img.style.top=(50+(py/(rawRadius*2))*100)+'%';
      const icon=Math.max(8,rawCellR*1.05*state.scale);
      img.style.width=icon+'px';
      img.style.height=icon+'px';
      cursorStampPreview.appendChild(img);
    }
  }
}


function currentStamp(){
  return state.selectedStamp.type==='default'
    ? state.defaultStamps[state.selectedStamp.index]
    : state.customStamps[state.selectedStamp.index];
}
function drawBrushStampOnContext(c, item, x, y, size){
  if(!item?.img)return;
  if(state.selectedStamp.type==='default'){
    const t=document.createElement('canvas');
    t.width=64;t.height=64;
    const tc=t.getContext('2d');
    tc.drawImage(item.img,0,0,64,64);
    tc.globalCompositeOperation='source-in';
    tc.fillStyle=state.stampColor;
    tc.fillRect(0,0,64,64);
    c.drawImage(t,x-size/2,y-size/2,size,size);
  }else{
    c.drawImage(item.img,x-size/2,y-size/2,size,size);
  }
}
function drawBrush(x,y){
  const layer=editableLayer(); if(!layer)return;
  ensureLayerMasks(layer);
  const dpr=state.dpr;
  x=x*dpr;y=y*dpr;

  if(state.tool==='eraser'){
    const eraseOne = (canvas2d)=>{
      const c=canvas2d.getContext('2d'),s=state.size*dpr;
      c.save();
      c.globalCompositeOperation='destination-out';
      if(state.shape==='round'){
        c.beginPath();c.arc(x,y,s/2,0,Math.PI*2);c.fill();
      }else{
        c.fillRect(x-s/2,y-s/2,s,s);
      }
      c.restore();
    };
    state.terrains.forEach(t=>eraseOne(layer.masks[t.id]));
    eraseOne(layer.art);
    scheduleComposite();
    return;
  }

  const activeId=state.activeTerrainId;
  const s=state.size*dpr;
  const eraseShapeFrom=(canvas2d)=>{
    const c=canvas2d.getContext('2d');
    c.save();
    c.globalCompositeOperation='destination-out';
    if(state.shape==='round'){
      c.beginPath();c.arc(x,y,s/2,0,Math.PI*2);c.fill();
    }else{
      c.fillRect(x-s/2,y-s/2,s,s);
    }
    c.restore();
  };
  // 다른 지형 마스크와 겹치지 않도록, 칠하기 전에 같은 자리를 다른 지형에서 지워둡니다.
  state.terrains.forEach(t=>{
    if(t.id!==activeId)eraseShapeFrom(layer.masks[t.id]);
  });

  const c=layer.masks[activeId].getContext('2d');
  c.save();
  c.globalAlpha=state.opacity;
  if(state.shape==='round'){
    if(state.softness>0){
      const g=c.createRadialGradient(x,y,s*.08,x,y,s/2);
      g.addColorStop(0,'rgba(255,255,255,1)');
      g.addColorStop(Math.max(.08,1-state.softness),'rgba(255,255,255,1)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=g;
    }else{
      c.fillStyle='#fff';
    }
    c.beginPath();c.arc(x,y,s/2,0,Math.PI*2);c.fill();
  }else{
    c.fillStyle='#fff';
    c.fillRect(x-s/2,y-s/2,s,s);
  }
  c.restore();
  scheduleComposite();
}
function drawSingleStamp(x,y){
  const layer=editableLayer(); if(!layer)return;
  const c=layer.art.getContext('2d');
  const dpr=state.dpr;
  drawBrushStampOnContext(c,currentStamp(),x*dpr,y*dpr,state.stampSize*dpr);
  scheduleComposite();
}
function drawIrregularCell(c, cx, cy, r, seed){
  c.beginPath();
  const count=7;
  for(let i=0;i<count;i++){
    const a=(Math.PI*2*i/count) + Math.sin(seed*1.7+i)*.12;
    const rr=r*(.78 + ((Math.sin(seed*3.1+i*2.7)+1)*.11));
    const px=cx+Math.cos(a)*rr, py=cy+Math.sin(a)*rr;
    if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
  }
  c.closePath();
}
function combinedLandAlpha(x,y){
  const sx=Math.max(0,Math.min(canvas.width-1,Math.round(x)));
  const sy=Math.max(0,Math.min(canvas.height-1,Math.round(y)));
  let alpha=0;
  for(const layer of state.layers){
    if(!layer.visible||layer.locked)continue;
    ensureLayerMasks(layer);
    state.terrains.forEach(t=>{
      if(t.type!=='Land')return;
      const mask=layer.masks[t.id];
      if(!mask)return;
      const d=mask.getContext('2d').getImageData(sx,sy,1,1).data[3];
      alpha=Math.max(alpha,d);
    });
  }
  return alpha/255;
}
function terrainKindAt(x,y,r=12){
  const center=combinedLandAlpha(x,y);
  let around=0, count=0;
  for(let a=0;a<Math.PI*2;a+=Math.PI/4){
    around+=combinedLandAlpha(x+Math.cos(a)*r,y+Math.sin(a)*r);count++;
  }
  const avg=(center+around/count)/2;
  if(avg>.58)return 'land';
  if(avg>.18)return 'coast';
  return 'sea';
}
function buildRegionCells(x,y){
  const dpr=state.dpr;
  const stampSize=state.stampSize*dpr;
  const radius=stampSize*1.9;
  const cellR=Math.max(13*dpr,stampSize*.38);
  const step=cellR*1.58;
  const cells=[];
  const seed=Math.floor(x*13+y*17+stampSize*29);

  for(let gy=-5;gy<=5;gy++){
    for(let gx=-5;gx<=5;gx++){
      const jitterX=Math.sin(seed+gx*7+gy*13)*cellR*.25;
      const jitterY=Math.cos(seed+gx*11-gy*5)*cellR*.25;
      const cx=x+gx*step+(gy%2)*step*.48+jitterX;
      const cy=y+gy*step*.86+jitterY;
      const dist=Math.hypot(cx-x,cy-y);
      if(dist<radius-cellR*.3){
        cells.push({
          x:cx,y:cy,
          kind:terrainKindAt(cx,cy,cellR*.65),
          seed:seed+gx*31+gy*47,
          dist
        });
      }
    }
  }
  cells.sort((a,b)=>a.dist-b.dist);
  return {cells,cellR,radius};
}
function drawRegionStamp(x,y,drawGuides){
  const layer=editableLayer();if(!layer)return;
  const c=layer.art.getContext('2d');
  const {cells,cellR}=buildRegionCells(x*state.dpr,y*state.dpr);
  const item=currentStamp();
  if(!item)return;

  c.save();
  for(const cell of cells){
    const baseFill=cell.kind==='land'
      ?activeTerrain().color
      :cell.kind==='coast'
        ?state.coastColor
        :waterColor();

    c.fillStyle=rgba(baseFill,drawGuides?.085:.045);
    c.strokeStyle=cell.kind==='land'
      ?rgba(state.coastColor,drawGuides?.22:.08)
      :rgba('#ffffff',drawGuides?.19:.065);
    c.lineWidth=drawGuides?1:.7;

    drawIrregularCell(c,cell.x,cell.y,cellR,cell.seed);
    c.fill();
    if(drawGuides)c.stroke();
  }

  for(const cell of cells){
    const iconSize=cellR*(cell.kind==='sea'?.96:1.08);
    drawBrushStampOnContext(c,item,cell.x,cell.y,iconSize);
  }
  c.restore();
  scheduleComposite();
}

let drag=null,last=null,lastStamp=null,changed=false;
function cancelPointerAction(commit=true){
  if(commit&&drag&&drag.type!=='pan'&&changed)pushHistory();
  drag=null;changed=false;state.pointerDown=false;state.activePointerId=null;
  wrap.classList.remove('dragging');
}
wrap.onpointerdown=e=>{
  e.preventDefault();
  if(e.button!==0&&e.button!==1)return;
  moveCursorPreview(e.clientX,e.clientY);
  state.pointerDown=true;state.activePointerId=e.pointerId;
  try{wrap.setPointerCapture(e.pointerId)}catch{}

  if(e.button===1||state.tool==='pan'){
    drag={type:'pan',x:e.clientX,y:e.clientY,vx:state.viewX,vy:state.viewY};
    wrap.classList.add('dragging');return;
  }
  const p=localPoint(e);
  if(p.x<0||p.y<0||p.x>state.docWidth||p.y>state.docHeight){cancelPointerAction(false);return;}
  if(state.tool==='brush'||state.tool==='eraser'){
    drag={type:'paint'};last=p;changed=true;drawBrush(p.x,p.y);
  }else if(state.tool==='stamp'){
    drag={type:'stamp'};lastStamp=p;changed=true;
    if(state.stampMode==='single')drawSingleStamp(p.x,p.y);
    else if(state.stampMode==='region')drawRegionStamp(p.x,p.y,false);
    else drawRegionStamp(p.x,p.y,true);
  }
};
window.onpointermove=e=>{
  moveCursorPreview(e.clientX,e.clientY);
  if(!state.pointerDown||!drag)return;
  if(state.activePointerId!==null&&e.pointerId!==state.activePointerId)return;
  if(e.buttons===0){cancelPointerAction(true);return;}

  if(drag.type==='pan'){
    state.viewX=drag.vx+e.clientX-drag.x;state.viewY=drag.vy+e.clientY-drag.y;setView();return;
  }
  const p=localPoint(e);
  if(drag.type==='paint'){
    const d=Math.hypot(p.x-last.x,p.y-last.y);
    const step=Math.max(1.2,state.size*.06,d/40);
    for(let i=step;i<=d;i+=step){const t=i/d;drawBrush(last.x+(p.x-last.x)*t,last.y+(p.y-last.y)*t)}
    last=p;
  }else if(drag.type==='stamp'){
    const d=Math.hypot(p.x-lastStamp.x,p.y-lastStamp.y);
    const gap=Math.max(10,state.stampGap+(state.stampMode==='single'?0:state.stampSize*2.2));
    for(let i=gap;i<=d;i+=gap){
      const t=i/d,sx=lastStamp.x+(p.x-lastStamp.x)*t,sy=lastStamp.y+(p.y-lastStamp.y)*t;
      if(state.stampMode==='single')drawSingleStamp(sx,sy);
      else if(state.stampMode==='region')drawRegionStamp(sx,sy,false);
      else drawRegionStamp(sx,sy,true);
    }
    if(d>=gap)lastStamp=p;
  }
};
window.onpointerup=e=>{
  if(state.activePointerId!==null&&e.pointerId!==state.activePointerId)return;
  try{wrap.releasePointerCapture(e.pointerId)}catch{}
  cancelPointerAction(true);
};
window.onpointercancel=()=>cancelPointerAction(true);
window.addEventListener('blur',()=>cancelPointerAction(true));
wrap.onpointerenter=e=>{updateCursorPreviewState();moveCursorPreview(e.clientX,e.clientY)};
wrap.onpointerleave=()=>{if(!state.pointerDown)hideCursorPreview()};

wrap.addEventListener('wheel',e=>{
  e.preventDefault();

  if(e.ctrlKey||e.metaKey){
    const direction=e.deltaY<0?1:-1;
    if(state.tool==='stamp'){
      state.stampSize=Math.max(14,Math.min(110,state.stampSize+direction*2));
      $('#stampSizeRange').value=state.stampSize;
      $('#stampSizeNum').textContent=state.stampSize;
    }else if(state.tool==='brush'||state.tool==='eraser'){
      state.size=Math.max(6,Math.min(220,state.size+direction*4));
      $('#sizeRange').value=state.size;
      $('#sizeNum').textContent=state.size;
    }
    updateCursorPreviewState();
    moveCursorPreview(e.clientX,e.clientY);
    return;
  }

  const r=wrap.getBoundingClientRect();
  zoomAt(state.scale*(e.deltaY<0?1.1:.9),e.clientX-r.left,e.clientY-r.top);
},{passive:false});

$$('.mode-card').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$$('[data-shape]').forEach(b=>b.onclick=()=>{
  state.shape=b.dataset.shape;
  $$('[data-shape]').forEach(x=>x.classList.toggle('active',x===b));
});
$$('[data-stamp-mode]').forEach(b=>b.onclick=()=>{
  state.stampMode=b.dataset.stampMode;
  syncStampModeButtons();
});
$('#sizeRange').oninput=e=>{state.size=+e.target.value;$('#sizeNum').textContent=e.target.value;updateCursorPreviewState();}
$('#opacityRange').oninput=e=>{state.opacity=+e.target.value/100;$('#opacityNum').textContent=e.target.value;}
$('#softRange').oninput=e=>{state.softness=+e.target.value/100;$('#softNum').textContent=e.target.value;}
$('#stampSize').oninput=e=>{state.stampSize=+e.target.value;$('#stampSizeNum').textContent=e.target.value;updateCursorPreviewState();}
$('#stampGap').oninput=e=>{state.stampGap=+e.target.value;$('#stampGapNum').textContent=e.target.value;}
$('#coastColor').oninput=e=>{state.coastColor=e.target.value;composite();}
$('#stampColor').oninput=e=>{state.stampColor=e.target.value;}

function syncPerfPanel(){
  $('#perfStampMode').value=state.perf.stampObjectMode;
  $('#perfDprCap').value=state.perf.dprCap;
  $('#perfSelectScope').value=state.perf.selectScope;
}
$('#perfSettingsBtn').onclick=()=>{
  syncPerfPanel();
  $('#perfPanel').classList.toggle('hidden');
};
$('#perfPanelClose').onclick=()=>$('#perfPanel').classList.add('hidden');
$('#perfStampMode').onchange=e=>{
  state.perf.stampObjectMode=e.target.value;
  savePerfSettings(state.perf);
};
$('#perfDprCap').onchange=e=>{
  state.perf.dprCap=e.target.value==='uncapped'?'uncapped':2;
  savePerfSettings(state.perf);
  state.dpr=computeDpr(state.perf);
  showStatus('새 지도를 만들거나 불러올 때부터 적용됩니다');
};
$('#perfSelectScope').onchange=e=>{
  state.perf.selectScope=e.target.value;
  savePerfSettings(state.perf);
};

$('#undoBtn').onclick=undo;
$('#redoBtn').onclick=redo;
$('#zoomIn').onclick=()=>zoomAt(state.scale*1.2);
$('#zoomOut').onclick=()=>zoomAt(state.scale/1.2);
$('#fitBtn').onclick=fitView;

$('#addLayerBtn').onclick=()=>{
  const l=makeLayer('레이어 '+state.layers.length);
  state.layers.push(l);
  state.activeLayerId=l.id;
  renderLayers();
  pushHistory();
};
$('#duplicateLayerBtn').onclick=()=>{
  const src=editableLayer(); if(!src)return;
  ensureLayerMasks(src);
  const l=makeLayer(src.name+' 복사');
  state.terrains.forEach(t=>{
    if(src.masks[t.id])l.masks[t.id].getContext('2d').drawImage(src.masks[t.id],0,0);
  });
  l.art.getContext('2d').drawImage(src.art,0,0);
  state.layers.push(l);
  state.activeLayerId=l.id;
  renderLayers();
  composite();
  pushHistory();
};

$('#newBtn').onclick=()=>{
  setDocSize(1400,900);
  resetLayers();
  state.history=[];state.historyIndex=-1;
  renderLayers();composite();pushHistory();fitView();
};
$('#backgroundInput').onchange=e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=async()=>{
    const img=await loadImage(r.result);
    setDocSize(img.width,img.height);
    resetLayers();
    const l=makeLayer('배경 이미지');
    l.art.getContext('2d').drawImage(img,0,0,l.art.width,l.art.height);
    state.layers.push(l);
    state.activeLayerId=l.id;
    renderLayers();composite();pushHistory();fitView();
  };
  r.readAsDataURL(f);
  e.target.value='';
};
$('#stampInput').onchange=e=>{
  [...e.target.files].forEach(f=>{
    const r=new FileReader();
    r.onload=async()=>{
      const img=await loadImage(r.result);
      state.customStamps.push({name:f.name,src:r.result,img});
      renderCustomAssets();
    };
    r.readAsDataURL(f);
  });
  e.target.value='';
};
$('#exportBtn').onclick=()=>{
  composite();
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download='world-map.png';
  a.click();
};
$('#saveBtn').onclick=()=>{
  const blob=new Blob([JSON.stringify(serialize())],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='world-map-project.json';
  a.click();
  URL.revokeObjectURL(a.href);
};
$('#loadBtn').onclick=()=>$('#projectInput').click();
$('#projectInput').onchange=e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=async()=>{
    try{
      await restore(JSON.parse(r.result));
      state.history=[];state.historyIndex=-1;
      pushHistory();fitView();
    }catch(err){
      alert('올바른 프로젝트 파일이 아닙니다.');
      console.error(err);
    }
  };
  r.readAsText(f);
  e.target.value='';
};

window.addEventListener('resize',fitView);
window.addEventListener('keydown',e=>{
  if(!wmeRoot.offsetParent)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&document.activeElement?.tagName!=='INPUT'){
    const n=parseInt(e.key,10);
    if(n>=1&&n<=state.terrains.length){
      state.activeTerrainId=state.terrains[n-1].id;
      setTool('brush');
      renderTerrainList();
    }
  }
});

initDefaultStamps();
setDocSize(state.docWidth,state.docHeight);
resetLayers();
renderLandSwatches();
renderStylePresets();
renderDefaultAssets();
renderCustomAssets();
renderLayers();
syncStampModeButtons();
updateCursorPreviewState();
composite();
pushHistory();

window.wmeActivate=function(){ fitView(); };

if(typeof ResizeObserver!=='undefined'){
  const ro=new ResizeObserver(()=>{
    if(!wrap.clientWidth||!wrap.clientHeight)return;
    fitView();
  });
  ro.observe(wrap);
  ro.observe(wmeRoot);
}
const mapViewEl=document.getElementById('mapView');
if(mapViewEl&&typeof MutationObserver!=='undefined'){
  const mo=new MutationObserver(()=>{
    if(!mapViewEl.classList.contains('hidden')){
      [0,60,150,350].forEach(delay=>setTimeout(fitView,delay));
    }
  });
  mo.observe(mapViewEl,{attributes:true,attributeFilter:['class']});
}

})();
