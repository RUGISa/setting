(function(){
const wmeRoot=document.getElementById('wmeRoot');
const $=s=>wmeRoot.querySelector(s);
const $$=s=>[...wmeRoot.querySelectorAll(s)];
const canvas=$('#wmeMapCanvas'),ctx=canvas.getContext('2d');
const wrap=$('#canvasWrap'),holder=$('#canvasHolder');
const cursorPreview=$('#cursorPreview'),cursorLabel=$('#cursorLabel'),cursorStampPreview=$('#cursorStampPreview');
const stampSelectBox=$('#stampSelectBox'),stampPropPanel=$('#stampPropPanel');

const landPresets=['#d2c29f','#b7a481','#9d9679','#707c64','#d8c7a4','#ad8f67','#c7b493','#928371','#7e8a75','#cdbca0'];
const outlineOffsets=[[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]];

function iconData(inner){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke="#6f6454" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
const defaultStampDefs=[
  {name:'산',category:'지형',terrain:'land',src:iconData('<path d="M8 50 23 26 31 38 42 16 56 50"/><path d="M29 27l4 6 4-4"/>')},
  {name:'숲',category:'숲',terrain:'land',src:iconData('<path d="M21 49V40"/><path d="M16 40 21 28 26 40Z"/><path d="M43 49V38"/><path d="M36 38 43 22 50 38Z"/>')},
  {name:'도시',category:'건물',terrain:'land',src:iconData('<path d="M14 49V30h12v19"/><path d="M26 49V20h12v29"/><path d="M38 49V26h12v23"/>')},
  {name:'성',category:'건물',terrain:'land',src:iconData('<path d="M12 49V28h8v6h6v-6h12v6h6v-6h8v21"/><path d="M12 49h40"/><path d="M28 49V39h8v10"/>')},
  {name:'유적',category:'지형',terrain:'land',src:iconData('<path d="M12 49h40"/><path d="M18 49V27"/><path d="M30 49V22"/><path d="M42 49V30"/>')},
  {name:'항구',category:'건물',terrain:'coast',src:iconData('<path d="M32 14v27"/><path d="M22 24c4 4 6 7 10 7s6-3 10-7"/><path d="M22 44c4 4 7 6 10 6s6-2 10-6"/>')},
  {name:'동굴',category:'지형',terrain:'land',src:iconData('<path d="M10 47c6-16 16-23 22-23s16 7 22 23"/><path d="M24 47V35"/><path d="M40 47V35"/>')},
  {name:'탑',category:'지형',terrain:'land',src:iconData('<path d="M24 49h16"/><path d="M26 49 29 19h6l3 30"/><path d="M24 19h16"/>')},
  {name:'마을',category:'건물',terrain:'land',src:iconData('<path d="M15 49V32l11-9 11 9v17"/><path d="M20 49V38h12v11"/><path d="M40 49V36l9-7v20"/>')},
  {name:'파도',category:'바다',terrain:'sea',src:iconData('<path d="M8 28c6-7 12-7 18 0s12 7 18 0 12-7 18 0"/><path d="M8 40c6-7 12-7 18 0s12 7 18 0 12-7 18 0"/>')},
  {name:'선박',category:'바다',terrain:'sea',src:iconData('<path d="M16 39h34l-7 10H23Z"/><path d="M31 15v24"/><path d="M32 18l13 9H32Z"/>')},
  {name:'소용돌이',category:'바다',terrain:'sea',src:iconData('<path d="M50 31c0-11-10-19-21-16-9 2-14 12-9 20 5 8 18 8 23 0 4-7-2-15-10-14-6 1-9 8-5 13 4 5 12 3 12-3"/>')}
];
const STAMP_CATEGORY_ORDER=['지형','숲','건물','바다'];

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
  blendMode:'source-over',
  stampMode:'region',
  stampSize:34,
  stampGap:22,
  stampRotation:0,
  shape2:{type:'circle',mode:'paint',perimeterOnly:false},
  shapeDraft:null,
  activeContextTab:'brush',
  terrains:[
    {id:'water',name:'바다',color:'#8C9184',type:'Sea',texture:{id:'none',tileSize:64,strength:0.4,depth:0.3}},
    {id:'grassland',name:'Grassland',color:'#AE987B',type:'Land',texture:{id:'none',tileSize:64,strength:0.4,depth:0.3}},
    {id:'forest',name:'Forest',color:'#9E8B76',type:'Land',texture:{id:'none',tileSize:64,strength:0.4,depth:0.3}},
    {id:'desert',name:'Desert',color:'#B6A591',type:'Land',texture:{id:'none',tileSize:64,strength:0.4,depth:0.3}},
    {id:'snow',name:'Snow',color:'#BFAB92',type:'Land',texture:{id:'none',tileSize:64,strength:0.4,depth:0.3}}
  ],
  activeTerrainId:'grassland',
  coastColor:'#75654e',
  coastBands:[],
  stampColor:'#6f6454',
  scale:1,viewX:0,viewY:0,
  selectedStamp:{type:'default',index:0},
  defaultStamps:[],customStamps:[],
  layers:[],activeLayerId:null,
  history:[],historyIndex:-1, pointerDown:false, activePointerId:null,
  selectedStampRef:null,
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
  {name:'황무지',terrains:{water:'#918383',grassland:'#AE987B',forest:'#8C7A63',desert:'#B08F6C',snow:'#C9BBA6'},coast:'#4a4038'},
  {name:'모래빛',terrains:{water:'#969D8E',grassland:'#E5C494',forest:'#C9A46E',desert:'#EE987B',snow:'#F2E4C9'},coast:'#6b5a3f'}
];

function activeTerrain(){return state.terrains.find(t=>t.id===state.activeTerrainId)||state.terrains[1]}
function terrainColorById(id){return state.terrains.find(t=>t.id===id)?.color||'#AE987B'}
function waterColor(){return state.terrains[0].color}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
const COAST_BAND_TYPES=[{id:'soft',label:'종이'},{id:'gradient',label:'그라데이션'}];
function defaultCoastBands(){
  return [
    {id:uid(),type:'soft',width:11,strength:0.78},
    {id:uid(),type:'gradient',width:7,strength:0.4}
  ];
}
state.coastBands=defaultCoastBands();
function defaultTerrainTexture(){return {id:'none',tileSize:64,strength:0.4,depth:0.3};}
function makeCanvas(){const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;return c}
function makeLayer(name,{locked=false}={}){
  const masks={};
  state.terrains.forEach(t=>{masks[t.id]=makeCanvas();});
  return {id:uid(),name,visible:true,locked,masks,art:makeCanvas(),stamps:[]};
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
}
const TEXTURE_DEFS=[
  {id:'none',label:'없음'},
  {id:'dots',label:'점묘'},
  {id:'crosshatch',label:'교차선'},
  {id:'grain',label:'입자'}
];
const textureTileCache={};
function buildTextureTile(id){
  const size=64;
  const t=document.createElement('canvas');
  t.width=size;t.height=size;
  const c=t.getContext('2d');
  if(id==='dots'){
    c.fillStyle='rgba(0,0,0,.45)';
    for(let y=6;y<size;y+=12)for(let x=6;x<size;x+=12){
      const jitter=((x*7+y*13)%5)-2;
      c.beginPath();c.arc(x+jitter,y+jitter*.6,1.6,0,Math.PI*2);c.fill();
    }
  }else if(id==='crosshatch'){
    c.strokeStyle='rgba(0,0,0,.32)';c.lineWidth=1;
    for(let i=-size;i<size*2;i+=8){
      c.beginPath();c.moveTo(i,0);c.lineTo(i+size,size);c.stroke();
      c.beginPath();c.moveTo(i,size);c.lineTo(i+size,0);c.stroke();
    }
  }else if(id==='grain'){
    const img=c.createImageData(size,size);
    for(let i=0;i<img.data.length;i+=4){
      img.data[i+3]=Math.random()*130;
    }
    c.putImageData(img,0,0);
  }
  return t;
}
function getTextureTile(id){
  if(id==='none')return null;
  if(!textureTileCache[id])textureTileCache[id]=buildTextureTile(id);
  return textureTileCache[id];
}
function applyTerrainTexture(terrain,mask){
  const tex=terrain.texture;
  if(!tex||tex.id==='none')return;
  const tile=getTextureTile(tex.id);
  if(!tile)return;
  const dpr=state.dpr;
  const tileSizePx=Math.max(8,tex.tileSize*dpr);

  const patternCanvas=getScratch(5);
  const pc=patternCanvas.getContext('2d');
  pc.save();
  const scale=tileSizePx/64;
  pc.scale(scale,scale);
  pc.fillStyle=pc.createPattern(tile,'repeat');
  pc.fillRect(0,0,patternCanvas.width/scale,patternCanvas.height/scale);
  pc.restore();
  pc.globalCompositeOperation='destination-in';
  pc.drawImage(mask,0,0);
  pc.globalCompositeOperation='source-over';

  ctx.save();
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=clamp(tex.strength,0,1);
  ctx.drawImage(patternCanvas,0,0);
  ctx.restore();

  if(tex.depth>0){
    const d=Math.max(1,tex.depth*10*dpr);
    const light=tintMask(mask,'#ffffff',6);
    ctx.save();
    ctx.globalAlpha=clamp(tex.depth,0,1)*0.6;
    ctx.globalCompositeOperation='overlay';
    ctx.drawImage(light,-d,-d);
    ctx.restore();
    const dark=tintMask(mask,'#000000',6);
    ctx.save();
    ctx.globalAlpha=clamp(tex.depth,0,1)*0.6;
    ctx.globalCompositeOperation='overlay';
    ctx.drawImage(dark,d,d);
    ctx.restore();
  }
}
function drawCoastBand(coast,band,dpr){
  const w=Math.max(1,band.width*dpr);
  const s=clamp(band.strength,0,1);
  const gradient=band.type==='gradient';
  const ringCount=gradient?5:3;
  const spread=gradient?1:0.55;

  ctx.save();
  ctx.globalAlpha=s*0.2;
  ctx.filter=`blur(${Math.max(1,w*0.5)}px)`;
  ctx.drawImage(coast,0,w*0.2);
  ctx.restore();

  ctx.save();
  for(let i=0;i<ringCount;i++){
    const r=w*spread*((i+1)/ringCount);
    const a=s*0.16*(1-(i/ringCount)*0.6);
    if(a<=0)continue;
    ctx.globalAlpha=a;
    const steps=Math.max(10,Math.round(r*0.45));
    for(let k=0;k<steps;k++){
      const angle=(k/steps)*Math.PI*2;
      ctx.drawImage(coast,Math.cos(angle)*r,Math.sin(angle)*r);
    }
  }
  ctx.restore();
}
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
  const dpr=state.dpr;

  state.coastBands.forEach(band=>drawCoastBand(coast,band,dpr));

  ctx.save();
  ctx.globalAlpha=.48;
  outlineOffsets.forEach(([x,y])=>ctx.drawImage(coast,x*dpr,y*dpr));
  ctx.restore();

  // 각 지형을 현재 색상으로 실시간 채색해서 그림 (프리셋 바뀌면 이미 칠한 부분도 같이 바뀜)
  state.terrains.forEach(t=>{
    const m=layer.masks[t.id];
    if(!m)return;
    ctx.drawImage(tintMask(m,t.color,2),0,0);
    applyTerrainTexture(t,m);
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
    if(!layer.visible)return;
    drawLayerTerrain(layer);
    ctx.drawImage(layer.art,0,0);
    renderLayerStamps(layer);
  });
  drawPaperTexture();
  drawShapeDraftPreview();
  updateStampSelectionOverlay();
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
      renderTextureGrid();
      syncTextureControls();
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
function renderTextureGrid(){
  const tex=activeTerrain().texture;
  $('#textureGrid').innerHTML=TEXTURE_DEFS.map(d=>{
    if(d.id==='none'){
      return `<button class="texture-swatch ${tex.id===d.id?'active':''}" data-id="${d.id}" title="${d.label}">⊘</button>`;
    }
    const tile=getTextureTile(d.id);
    return `<button class="texture-swatch ${tex.id===d.id?'active':''}" data-id="${d.id}" title="${d.label}"><img src="${tile.toDataURL()}" alt="${d.label}"></button>`;
  }).join('');
  $$('.texture-swatch').forEach(b=>b.onclick=()=>{
    activeTerrain().texture.id=b.dataset.id;
    renderTextureGrid();
    composite();
  });
}
function syncTextureControls(){
  const tex=activeTerrain().texture;
  $('#textureTileSize').value=tex.tileSize;$('#textureTileSizeNum').textContent=tex.tileSize;
  $('#textureStrength').value=Math.round(tex.strength*100);$('#textureStrengthNum').textContent=Math.round(tex.strength*100);
  $('#textureDepth').value=Math.round(tex.depth*100);$('#textureDepthNum').textContent=Math.round(tex.depth*100);
}
function renderCoastBands(){
  $('#coastBandList').innerHTML=state.coastBands.map((b,i)=>`
    <div class="coast-band" data-id="${b.id}">
      <div class="coast-band-head">
        <span class="terrain-key">${i+1}</span>
        <select class="cb-type" data-id="${b.id}">
          ${COAST_BAND_TYPES.map(t=>`<option value="${t.id}" ${b.type===t.id?'selected':''}>${t.label}</option>`).join('')}
        </select>
        <button class="cb-del" data-id="${b.id}" title="삭제">×</button>
      </div>
      <div class="row"><label>폭</label><input type="range" class="cb-width" data-id="${b.id}" min="1" max="40" value="${b.width}"><span class="num">${b.width}</span></div>
      <div class="row"><label>세기</label><input type="range" class="cb-strength" data-id="${b.id}" min="0" max="100" value="${Math.round(b.strength*100)}"><span class="num">${Math.round(b.strength*100)}</span></div>
    </div>
  `).join('');
  $$('.cb-type').forEach(sel=>sel.onchange=e=>{
    const b=state.coastBands.find(x=>x.id===e.target.dataset.id);
    if(b){b.type=e.target.value;composite();}
  });
  $$('.cb-del').forEach(btn=>btn.onclick=()=>{
    state.coastBands=state.coastBands.filter(x=>x.id!==btn.dataset.id);
    renderCoastBands();composite();pushHistory();
  });
  $$('.cb-width').forEach(input=>input.oninput=e=>{
    const b=state.coastBands.find(x=>x.id===e.target.dataset.id);
    if(b){b.width=+e.target.value;e.target.nextElementSibling.textContent=e.target.value;composite();}
  });
  $$('.cb-strength').forEach(input=>input.oninput=e=>{
    const b=state.coastBands.find(x=>x.id===e.target.dataset.id);
    if(b){b.strength=+e.target.value/100;e.target.nextElementSibling.textContent=e.target.value;composite();}
  });
}
function initDefaultStamps(){
  state.defaultStamps=defaultStampDefs.map(d=>{const img=new Image();img.src=d.src;return {...d,img}});
}
function renderDefaultAssets(){
  $('#defaultAssets').innerHTML=STAMP_CATEGORY_ORDER.map(cat=>{
    const items=state.defaultStamps.map((s,i)=>({s,i})).filter(({s})=>s.category===cat);
    if(!items.length)return '';
    return `
      <div class="asset-category-label">${cat}</div>
      <div class="asset-grid">
        ${items.map(({s,i})=>`
          <button class="asset ${state.selectedStamp.type==='default'&&state.selectedStamp.index===i?'active':''}" data-index="${i}">
            <img src="${s.src}" alt="${s.name}" title="${s.name}">
          </button>`).join('')}
      </div>`;
  }).join('');
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
const EYE_OPEN_ICON=`<svg viewBox="0 0 24 24" width="14" height="14"><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const EYE_CLOSED_ICON=`<svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M7.4 7.5C4.7 9 3 12 3 12s3.8 7 10 7c1.7 0 3.2-.4 4.5-1M17.4 15.9C19.6 14.3 21 12 21 12s-3.8-7-10-7c-.9 0-1.7.1-2.5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LOCK_CLOSED_ICON=`<svg viewBox="0 0 24 24" width="13" height="13"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const LOCK_OPEN_ICON=`<svg viewBox="0 0 24 24" width="13" height="13"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
function renderLayers(){
  $('#layerList').innerHTML=[...state.layers].reverse().map(l=>`
    <div class="layer ${l.id===state.activeLayerId?'active':''} ${l.locked?'locked':''}" data-id="${l.id}">
      <button class="layer-eye" data-eye="${l.id}" title="${l.visible?'숨기기':'보이기'}" aria-label="${l.visible?'숨기기':'보이기'}">${l.visible?EYE_OPEN_ICON:EYE_CLOSED_ICON}</button>
      <button class="layer-lock" data-lock="${l.id}" title="${l.locked?'잠금 해제':'잠그기'}" aria-label="${l.locked?'잠금 해제':'잠그기'}">${l.locked?LOCK_CLOSED_ICON:LOCK_OPEN_ICON}</button>
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
    l.locked=!l.locked;
    renderLayers();
    composite();
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
    coastBands:state.coastBands,
    stampColor:state.stampColor,stampMode:state.stampMode,stampSize:state.stampSize,stampGap:state.stampGap,
    layers:state.layers.map(l=>({
      id:l.id,name:l.name,visible:l.visible,locked:l.locked,
      masks:Object.fromEntries(Object.entries(l.masks).map(([id,c])=>[id,c.toDataURL()])),
      art:l.art.toDataURL(),
      stamps:(l.stamps||[]).map(s=>({...s}))
    })),
    customStamps:state.customStamps.map(s=>({name:s.name,src:s.src}))
  };
}
async function loadImage(src){return await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});}
async function restore(s){
  clearStampSelection();
  setDocSize(s.docWidth||s.width,s.docHeight||s.height);
  if(Array.isArray(s.terrains)&&s.terrains.length){
    state.terrains=s.terrains;
    state.activeTerrainId=s.activeTerrainId||state.terrains[1]?.id||state.terrains[0].id;
  }else if(s.waterColor||s.landColor){
    // 예전 저장 파일(단일 바다/육지 색상) 호환
    state.terrains[0].color=s.waterColor||state.terrains[0].color;
    state.terrains[1].color=s.landColor||state.terrains[1].color;
  }
  // 예전 저장 파일(지형별 텍스처가 없던 버전) 호환: 텍스처 없음으로 기본값 채움
  state.terrains.forEach(t=>{ if(!t.texture) t.texture=defaultTerrainTexture(); });
  state.coastColor=s.coastColor||'#75654e';
  state.coastBands=Array.isArray(s.coastBands)&&s.coastBands.length?s.coastBands:defaultCoastBands();
  state.stampColor=s.stampColor||'#6f6454';
  state.stampMode=s.stampMode||'region';
  state.stampSize=s.stampSize||34;
  state.stampGap=s.stampGap||22;

  renderTerrainList();
  $('#coastColor').value=state.coastColor;
  renderCoastBands();
  renderTextureGrid();
  syncTextureControls();
  syncStampColorInputs();
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
    l.stamps=Array.isArray(item.stamps)?item.stamps.map(s=>({...s})):[];
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
  if(tool!=='select')clearStampSelection();
  if(tool!=='shape')state.shapeDraft=null;
  state.tool=tool;
  $$('.mode-card').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  renderToolSettings();
  updateCursorPreviewState();
  scheduleComposite();
}
function focusCoastlineSection(){
  const el=$('#coastBandList');
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.classList.add('flash-highlight');
  setTimeout(()=>el.classList.remove('flash-highlight'),900);
}
const TAB_LABELS={brush:'브러시',texture:'텍스처',terrain:'지형',coastline:'해안선',stamp:'스탬프',icons:'아이콘',shape:'도형',hint:'정보'};
function tabsForTool(){
  const tool=state.tool;
  if(tool==='brush'||tool==='eraser')return['brush','texture','terrain','coastline'];
  if(tool==='stamp')return['stamp','icons'];
  if(tool==='shape')return state.shape2.mode==='paint'?['shape','texture','terrain','coastline']:['shape','icons'];
  return['hint'];
}
function renderToolSettings(){
  const tabs=tabsForTool();
  if(!tabs.includes(state.activeContextTab))state.activeContextTab=tabs[0];
  const header=$('#topTabHeader');
  header.innerHTML=tabs.map(id=>`<button class="tab-btn${id===state.activeContextTab?' active':''}" data-tabid="${id}">${TAB_LABELS[id]}</button>`).join('');
  $$('#topTabHeader [data-tabid]').forEach(b=>b.onclick=()=>{
    state.activeContextTab=b.dataset.tabid;
    renderToolSettings();
  });
  $$('.tabpanel').forEach(el=>el.classList.toggle('hidden',el.dataset.tabpanel!==state.activeContextTab));
  const tool=state.tool;
  if(tool==='select'||tool==='pan'||tool==='zoom'){
    const hints={
      select:`선택 범위: ${state.perf.selectScope==='active'?'현재 레이어만':'보이는 모든 레이어'}. 스탬프를 클릭해 선택하고, Delete 키로 삭제할 수 있습니다.`,
      pan:'캔버스를 드래그해서 이동합니다. 휠 스크롤로도 이동할 수 있습니다.',
      zoom:`현재 확대: ${Math.round(state.scale*100)}%. 캔버스를 클릭하면 확대, Shift+클릭하면 축소됩니다. Ctrl+휠로도 조정할 수 있습니다.`
    };
    $('#toolHintText').textContent=hints[tool]||'';
  }
}
function syncStampModeButtons(){
  $$('[data-stamp-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.stampMode===state.stampMode));
  updateCursorPreviewState();
}
function setView(){
  holder.style.transform=`translate(${state.viewX}px,${state.viewY}px) scale(${state.scale})`;
  $('#zoomText').textContent=Math.round(state.scale*100)+'%';
  updateStampSelectionOverlay();
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
const tintedIconCache={};
function getTintedIcon(item,color){
  const key=item.src+'|'+color;
  let c=tintedIconCache[key];
  if(!c){
    c=document.createElement('canvas');
    c.width=64;c.height=64;
    const tc=c.getContext('2d');
    tc.drawImage(item.img,0,0,64,64);
    tc.globalCompositeOperation='source-in';
    tc.fillStyle=color;
    tc.fillRect(0,0,64,64);
    tintedIconCache[key]=c;
  }
  return c;
}
function drawBrushStampOnContext(c, item, kind, color, x, y, size, opacity=1, rotation=0){
  if(!item?.img)return;
  c.save();
  c.globalAlpha=opacity;
  c.translate(x,y);
  if(rotation)c.rotate(rotation*Math.PI/180);
  if(kind==='default'){
    c.drawImage(getTintedIcon(item,color),-size/2,-size/2,size,size);
  }else{
    c.drawImage(item.img,-size/2,-size/2,size,size);
  }
  c.restore();
}
function renderLayerStamps(layer){
  const dpr=state.dpr;
  const stamps=[...(layer.stamps||[])].sort((a,b)=>a.y-b.y);
  stamps.forEach(st=>{
    const item=st.kind==='default'?state.defaultStamps[st.index]:state.customStamps[st.index];
    if(!item)return;
    drawBrushStampOnContext(ctx,item,st.kind,st.color,st.x*dpr,st.y*dpr,st.size*dpr,st.opacity==null?1:st.opacity,st.rotation||0);
  });
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
    if(layer.stamps&&layer.stamps.length){
      const rLogical=state.size/2;
      const before=layer.stamps.length;
      layer.stamps=layer.stamps.filter(st=>Math.hypot(st.x-x/dpr,st.y-y/dpr)>rLogical);
      if(layer.stamps.length!==before&&state.selectedStampRef&&state.selectedStampRef.layerId===layer.id&&!layer.stamps.find(st=>st.id===state.selectedStampRef.stampId)){
        clearStampSelection();
      }
    }
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
  c.globalCompositeOperation=state.blendMode;
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
  const item=currentStamp();
  if(!item)return;
  if(!layer.stamps)layer.stamps=[];
  layer.stamps.push({
    id:uid(),kind:state.selectedStamp.type,index:state.selectedStamp.index,
    x,y,size:state.stampSize,color:state.stampColor,opacity:1,rotation:state.stampRotation
  });
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

  if(state.perf.stampObjectMode==='all'){
    if(!layer.stamps)layer.stamps=[];
    for(const cell of cells){
      const iconSize=(cellR*(cell.kind==='sea'?.96:1.08))/state.dpr;
      layer.stamps.push({
        id:uid(),kind:state.selectedStamp.type,index:state.selectedStamp.index,
        x:cell.x/state.dpr,y:cell.y/state.dpr,size:iconSize,color:state.stampColor,opacity:1
      });
    }
  }else{
    for(const cell of cells){
      const iconSize=cellR*(cell.kind==='sea'?.96:1.08);
      drawBrushStampOnContext(c,item,state.selectedStamp.type,state.stampColor,cell.x,cell.y,iconSize);
    }
  }
  c.restore();
  scheduleComposite();
}

function stampLayerCandidates(){
  if(state.perf.selectScope==='active'){
    const l=activeLayer();
    return l?[l]:[];
  }
  return [...state.layers].reverse().filter(l=>l.visible&&!l.locked);
}
function findStampAt(x,y){
  for(const layer of stampLayerCandidates()){
    const stamps=[...(layer.stamps||[])].sort((a,b)=>b.y-a.y);
    for(const st of stamps){
      const r=Math.max(st.size/2,10);
      if(Math.hypot(x-st.x,y-st.y)<=r)return {layer,stamp:st};
    }
  }
  return null;
}
function selectStamp(layerId,stampId){
  state.selectedStampRef={layerId,stampId};
  syncStampPropPanel();
}
function clearStampSelection(){
  state.selectedStampRef=null;
  stampSelectBox.classList.add('hidden');
  stampPropPanel.classList.add('hidden');
}
function getSelectedStamp(){
  if(!state.selectedStampRef)return null;
  const layer=state.layers.find(l=>l.id===state.selectedStampRef.layerId);
  if(!layer)return null;
  const stamp=(layer.stamps||[]).find(s=>s.id===state.selectedStampRef.stampId);
  if(!stamp)return null;
  return {layer,stamp};
}
function syncStampPropPanel(){
  const found=getSelectedStamp();
  if(!found)return;
  $('#stampPropSize').value=found.stamp.size;$('#stampPropSizeNum').textContent=Math.round(found.stamp.size);
  $('#stampPropOpacity').value=Math.round((found.stamp.opacity==null?1:found.stamp.opacity)*100);
  $('#stampPropOpacityNum').textContent=$('#stampPropOpacity').value;
  $('#stampPropRotation').value=found.stamp.rotation||0;
  $('#stampPropRotationNum').textContent=found.stamp.rotation||0;
}
function updateStampSelectionOverlay(){
  if(state.tool!=='select'){stampSelectBox.classList.add('hidden');stampPropPanel.classList.add('hidden');return;}
  const found=getSelectedStamp();
  if(!found){stampSelectBox.classList.add('hidden');stampPropPanel.classList.add('hidden');return;}
  const {stamp}=found;
  const rect=wrap.getBoundingClientRect();
  const half=stamp.size/2;
  const left=state.viewX+(stamp.x-half)*state.scale;
  const top=state.viewY+(stamp.y-half)*state.scale;
  const size=stamp.size*state.scale;
  stampSelectBox.classList.remove('hidden');
  stampSelectBox.style.left=left+'px';
  stampSelectBox.style.top=top+'px';
  stampSelectBox.style.width=size+'px';
  stampSelectBox.style.height=size+'px';

  stampPropPanel.classList.remove('hidden');
  stampPropPanel.style.transform=`translate(${left+size+10}px,${top}px)`;
}

// ---- 도형 도구 ----
function starPoints(cx,cy,rOuter,points=5){
  const rInner=rOuter*0.45;
  const pts=[];
  for(let i=0;i<points*2;i++){
    const r=i%2===0?rOuter:rInner;
    const a=(Math.PI*i/points)-Math.PI/2;
    pts.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r});
  }
  return pts;
}
function shapeOutlinePoints(shape){
  if(shape.type==='circle'){
    const pts=[];
    const steps=48;
    for(let i=0;i<steps;i++){
      const a=(i/steps)*Math.PI*2;
      pts.push({x:shape.cx+Math.cos(a)*shape.r,y:shape.cy+Math.sin(a)*shape.r});
    }
    return pts;
  }
  if(shape.type==='square'){
    const r=shape.r;
    return [
      {x:shape.cx-r,y:shape.cy-r},{x:shape.cx+r,y:shape.cy-r},
      {x:shape.cx+r,y:shape.cy+r},{x:shape.cx-r,y:shape.cy+r}
    ];
  }
  if(shape.type==='star')return starPoints(shape.cx,shape.cy,shape.r);
  if(shape.type==='polygon')return shape.points;
  return [];
}
function pointInShape(px,py,shape){
  if(shape.type==='circle')return Math.hypot(px-shape.cx,py-shape.cy)<=shape.r;
  if(shape.type==='square')return Math.abs(px-shape.cx)<=shape.r&&Math.abs(py-shape.cy)<=shape.r;
  const pts=shapeOutlinePoints(shape);
  if(pts.length<3)return false;
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const a=pts[i],b=pts[j];
    if(((a.y>py)!==(b.y>py))&&(px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x))inside=!inside;
  }
  return inside;
}
function traceShapePath(c,shape){
  c.beginPath();
  if(shape.type==='circle'){
    c.arc(shape.cx,shape.cy,Math.max(0,shape.r),0,Math.PI*2);
  }else if(shape.type==='square'){
    c.rect(shape.cx-shape.r,shape.cy-shape.r,shape.r*2,shape.r*2);
  }else{
    const pts=shapeOutlinePoints(shape);
    pts.forEach((p,i)=>{if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);});
  }
  c.closePath();
}
function shapeBounds(shape){
  const pts=shape.type==='circle'||shape.type==='square'
    ?[{x:shape.cx-shape.r,y:shape.cy-shape.r},{x:shape.cx+shape.r,y:shape.cy+shape.r}]
    :shapeOutlinePoints(shape);
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
function sampleShapePerimeter(shape,count){
  if(shape.type==='circle'){
    const pts=[];
    for(let i=0;i<count;i++){
      const a=(i/count)*Math.PI*2;
      pts.push({x:shape.cx+Math.cos(a)*shape.r,y:shape.cy+Math.sin(a)*shape.r});
    }
    return pts;
  }
  const verts=shapeOutlinePoints(shape);
  if(verts.length<2)return [];
  const edges=verts.map((p,i)=>{const q=verts[(i+1)%verts.length];return {p,q,len:Math.hypot(q.x-p.x,q.y-p.y)};});
  const total=edges.reduce((s,e)=>s+e.len,0)||1;
  const pts=[];
  for(let i=0;i<count;i++){
    let d=(i/count)*total;
    for(const e of edges){
      if(d<=e.len){pts.push({x:e.p.x+(e.q.x-e.p.x)*(d/e.len),y:e.p.y+(e.q.y-e.p.y)*(d/e.len)});break;}
      d-=e.len;
    }
  }
  return pts;
}
function beginShapeDraft(x,y,e){
  const type=state.shape2.type;
  if(type==='polygon'){
    if(!state.shapeDraft){
      state.shapeDraft={type:'polygon',points:[{x,y}]};
    }else{
      const first=state.shapeDraft.points[0];
      const closeDist=12/state.scale;
      if(state.shapeDraft.points.length>=3&&Math.hypot(x-first.x,y-first.y)<closeDist){
        commitShapeDraft();return;
      }
      state.shapeDraft.points.push({x,y});
    }
    scheduleComposite();
    return;
  }
  state.shapeDraft={type,cx:x,cy:y,r:0};
  drag={type:'shapeDrag'};
  changed=false;
}
function updateShapeDraftDrag(x,y){
  if(!state.shapeDraft)return;
  state.shapeDraft.r=Math.hypot(x-state.shapeDraft.cx,y-state.shapeDraft.cy);
  scheduleComposite();
}
function cancelShapeDraft(){
  state.shapeDraft=null;
  scheduleComposite();
}
function commitShapeDraft(){
  const shape=state.shapeDraft;
  state.shapeDraft=null;
  if(!shape)return;
  if(shape.type==='polygon'&&shape.points.length<3)return;
  if((shape.type==='circle'||shape.type==='square')&&shape.r<2)return;
  const layer=editableLayer();
  if(!layer){scheduleComposite();return;}
  const dpr=state.dpr;
  const bufShape=shape.type==='polygon'
    ?{type:'polygon',points:shape.points.map(p=>({x:p.x*dpr,y:p.y*dpr}))}
    :{type:shape.type,cx:shape.cx*dpr,cy:shape.cy*dpr,r:shape.r*dpr};

  if(state.shape2.mode==='paint'){
    ensureLayerMasks(layer);
    const activeId=state.activeTerrainId;
    state.terrains.forEach(t=>{
      if(t.id===activeId)return;
      const c=layer.masks[t.id].getContext('2d');
      c.save();c.globalCompositeOperation='destination-out';
      traceShapePath(c,bufShape);c.fill();c.restore();
    });
    const c=layer.masks[activeId].getContext('2d');
    c.save();
    c.globalAlpha=state.opacity;
    c.globalCompositeOperation=state.blendMode;
    c.fillStyle='#fff';
    traceShapePath(c,bufShape);
    c.fill();
    c.restore();
    changed=true;
    scheduleComposite();
    pushHistory();
  }else{
    const item=currentStamp();
    if(!item){scheduleComposite();return;}
    if(!layer.stamps)layer.stamps=[];
    const targetCount=Math.max(4,Math.round((shape.r||80)/Math.max(10,state.stampSize*0.5)*4));
    const points=state.shape2.perimeterOnly
      ? sampleShapePerimeter(shape,targetCount)
      : (()=>{
          const bounds=shapeBounds(shape);
          const pts=[];
          let guard=0;
          while(pts.length<targetCount&&guard<targetCount*40){
            guard++;
            const px=bounds.minX+Math.random()*(bounds.maxX-bounds.minX);
            const py=bounds.minY+Math.random()*(bounds.maxY-bounds.minY);
            if(pointInShape(px,py,shape))pts.push({x:px,y:py});
          }
          return pts;
        })();
    points.forEach(p=>{
      layer.stamps.push({
        id:uid(),kind:state.selectedStamp.type,index:state.selectedStamp.index,
        x:p.x,y:p.y,size:state.stampSize,color:state.stampColor,opacity:1,rotation:state.stampRotation
      });
    });
    changed=true;
    scheduleComposite();
    pushHistory();
  }
}
function drawShapeDraftPreview(){
  if(!state.shapeDraft)return;
  const dpr=state.dpr;
  const shape=state.shapeDraft;
  const bufShape=shape.type==='polygon'
    ?{type:'polygon',points:shape.points.map(p=>({x:p.x*dpr,y:p.y*dpr}))}
    :{type:shape.type,cx:shape.cx*dpr,cy:shape.cy*dpr,r:shape.r*dpr};
  ctx.save();
  ctx.strokeStyle='#1473e6';
  ctx.lineWidth=Math.max(1,1.5*dpr);
  ctx.setLineDash([6*dpr,5*dpr]);
  if(shape.type==='polygon'){
    ctx.beginPath();
    bufShape.points.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});
    if(shape.previewPoint)ctx.lineTo(shape.previewPoint.x*dpr,shape.previewPoint.y*dpr);
    ctx.stroke();
    bufShape.points.forEach(p=>{
      ctx.save();ctx.setLineDash([]);ctx.fillStyle='#1473e6';
      ctx.beginPath();ctx.arc(p.x,p.y,3*dpr,0,Math.PI*2);ctx.fill();ctx.restore();
    });
  }else{
    traceShapePath(ctx,bufShape);
    ctx.stroke();
  }
  ctx.restore();
}

let drag=null,last=null,lastStamp=null,changed=false;
function cancelPointerAction(commit=true){
  if(commit&&drag&&drag.type==='shapeDrag'){
    commitShapeDraft();
  }else if(commit&&drag&&drag.type!=='pan'&&changed){
    pushHistory();
  }
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
  }else if(state.tool==='select'){
    const hit=findStampAt(p.x,p.y);
    if(hit){
      selectStamp(hit.layer.id,hit.stamp.id);
      drag={type:'moveStamp',layer:hit.layer,stamp:hit.stamp,startX:hit.stamp.x,startY:hit.stamp.y,px:p.x,py:p.y};
      changed=false;
    }else{
      clearStampSelection();
      drag=null;
    }
    scheduleComposite();
  }else if(state.tool==='zoom'){
    const r=wrap.getBoundingClientRect();
    const factor=e.shiftKey?1/1.35:1.35;
    zoomAt(state.scale*factor,e.clientX-r.left,e.clientY-r.top);
    drag=null;
  }else if(state.tool==='shape'){
    beginShapeDraft(p.x,p.y,e);
  }
};
window.onpointermove=e=>{
  moveCursorPreview(e.clientX,e.clientY);
  if(state.tool==='shape'&&state.shape2.type==='polygon'&&state.shapeDraft){
    state.shapeDraft.previewPoint=localPoint(e);
    scheduleComposite();
  }
  if(!state.pointerDown||!drag)return;
  if(state.activePointerId!==null&&e.pointerId!==state.activePointerId)return;
  if(e.buttons===0){cancelPointerAction(true);return;}

  if(drag.type==='pan'){
    state.viewX=drag.vx+e.clientX-drag.x;state.viewY=drag.vy+e.clientY-drag.y;setView();return;
  }
  const p=localPoint(e);
  if(drag.type==='paint'){
    const d=Math.hypot(p.x-last.x,p.y-last.y);
    const step=Math.max(1.2,state.size*.06);
    const steps=Math.max(1,Math.ceil(d/step));
    for(let i=1;i<=steps;i++){const t=i/steps;drawBrush(last.x+(p.x-last.x)*t,last.y+(p.y-last.y)*t)}
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
  }else if(drag.type==='moveStamp'){
    drag.stamp.x=drag.startX+(p.x-drag.px);
    drag.stamp.y=drag.startY+(p.y-drag.py);
    changed=true;
    scheduleComposite();
  }else if(drag.type==='shapeDrag'){
    updateShapeDraftDrag(p.x,p.y);
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
wrap.addEventListener('dblclick',e=>{
  if(state.tool==='shape'&&state.shapeDraft&&state.shapeDraft.type==='polygon'){
    e.preventDefault();
    state.shapeDraft.points.pop();
    if(state.shapeDraft.points.length>=3)commitShapeDraft();
    else cancelShapeDraft();
  }
});

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
      syncSizeInputs();
    }
    updateCursorPreviewState();
    moveCursorPreview(e.clientX,e.clientY);
    return;
  }

  const r=wrap.getBoundingClientRect();
  zoomAt(state.scale*(e.deltaY<0?1.1:.9),e.clientX-r.left,e.clientY-r.top);
},{passive:false});

$$('.mode-card').forEach(b=>b.onclick=()=>{
  if(b.dataset.tool==='coastline'){focusCoastlineSection();return;}
  setTool(b.dataset.tool);
});
$$('[data-shape]').forEach(b=>b.onclick=()=>{
  state.shape=b.dataset.shape;
  $$('[data-shape]').forEach(x=>x.classList.toggle('active',x===b));
});
$$('[data-stamp-mode]').forEach(b=>b.onclick=()=>{
  state.stampMode=b.dataset.stampMode;
  syncStampModeButtons();
});
function syncSizeInputs(){
  $('#sizeRange').value=state.size;$('#sizeNum').textContent=state.size;
}
function syncStampColorInputs(){
  $('#stampColor').value=state.stampColor;
}
$('#sizeRange').oninput=e=>{state.size=+e.target.value;syncSizeInputs();updateCursorPreviewState();}
$('#opacityRange').oninput=e=>{state.opacity=+e.target.value/100;$('#opacityNum').textContent=e.target.value;}
$('#softRange').oninput=e=>{state.softness=+e.target.value/100;$('#softNum').textContent=e.target.value;}
$('#stampSize').oninput=e=>{state.stampSize=+e.target.value;$('#stampSizeNum').textContent=e.target.value;updateCursorPreviewState();}
$('#stampGap').oninput=e=>{state.stampGap=+e.target.value;$('#stampGapNum').textContent=e.target.value;}
$('#stampRotation').oninput=e=>{state.stampRotation=+e.target.value;$('#stampRotationNum').textContent=e.target.value;}
$('#blendModeSelect').onchange=e=>{state.blendMode=e.target.value;}
const SHAPE2_TYPES={
  paint:[{id:'circle',label:'원'},{id:'square',label:'사각'},{id:'polygon',label:'다각형'}],
  stamp:[{id:'circle',label:'원'},{id:'square',label:'사각'},{id:'star',label:'별'}]
};
function renderShape2Types(){
  const list=SHAPE2_TYPES[state.shape2.mode];
  if(!list.find(t=>t.id===state.shape2.type))state.shape2.type=list[0].id;
  $('#shape2Type').innerHTML=list.map(t=>`<option value="${t.id}" ${t.id===state.shape2.type?'selected':''}>${t.label}</option>`).join('');
  $('#shape2PerimeterRow').classList.toggle('hidden',state.shape2.mode!=='stamp');
}
$$('[data-shape2-mode]').forEach(b=>b.onclick=()=>{
  state.shape2.mode=b.dataset.shape2Mode;
  $$('[data-shape2-mode]').forEach(x=>x.classList.toggle('active',x===b));
  renderShape2Types();
  cancelShapeDraft();
  renderToolSettings();
});
$('#shape2Type').onchange=e=>{state.shape2.type=e.target.value;cancelShapeDraft();}
$('#shape2Perimeter').onchange=e=>{state.shape2.perimeterOnly=e.target.checked;}
renderShape2Types();
$('#coastColor').oninput=e=>{state.coastColor=e.target.value;composite();}
$('#addCoastBandBtn').onclick=()=>{
  state.coastBands.push({id:uid(),type:'soft',width:11,strength:0.5});
  renderCoastBands();composite();pushHistory();
};
$('#textureTileSize').oninput=e=>{activeTerrain().texture.tileSize=+e.target.value;$('#textureTileSizeNum').textContent=e.target.value;composite();}
$('#textureStrength').oninput=e=>{activeTerrain().texture.strength=+e.target.value/100;$('#textureStrengthNum').textContent=e.target.value;composite();}
$('#textureDepth').oninput=e=>{activeTerrain().texture.depth=+e.target.value/100;$('#textureDepthNum').textContent=e.target.value;composite();}
$('#stampPropSize').oninput=e=>{
  const found=getSelectedStamp(); if(!found)return;
  found.stamp.size=+e.target.value;$('#stampPropSizeNum').textContent=e.target.value;
  scheduleComposite();
};
$('#stampPropSize').onchange=()=>pushHistory();
$('#stampPropOpacity').oninput=e=>{
  const found=getSelectedStamp(); if(!found)return;
  found.stamp.opacity=+e.target.value/100;$('#stampPropOpacityNum').textContent=e.target.value;
  scheduleComposite();
};
$('#stampPropOpacity').onchange=()=>pushHistory();
$('#stampPropRotation').oninput=e=>{
  const found=getSelectedStamp(); if(!found)return;
  found.stamp.rotation=+e.target.value;$('#stampPropRotationNum').textContent=e.target.value;
  scheduleComposite();
};
$('#stampPropRotation').onchange=()=>pushHistory();
$('#stampPropDelete').onclick=()=>{
  const found=getSelectedStamp(); if(!found)return;
  found.layer.stamps=found.layer.stamps.filter(s=>s.id!==found.stamp.id);
  clearStampSelection();
  composite();pushHistory();
};
$('#stampColor').oninput=e=>{state.stampColor=e.target.value;syncStampColorInputs();}

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
  l.stamps=(src.stamps||[]).map(s=>({...s,id:uid()}));
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
  if(e.key==='Escape'&&state.shapeDraft){e.preventDefault();cancelShapeDraft();}
  if(e.key==='Enter'&&state.shapeDraft&&state.shapeDraft.type==='polygon'&&document.activeElement?.tagName!=='INPUT'){
    e.preventDefault();
    if(state.shapeDraft.points.length>=3)commitShapeDraft();
  }
  if((e.key==='Delete'||e.key==='Backspace')&&document.activeElement?.tagName!=='INPUT'&&state.selectedStampRef){
    e.preventDefault();
    const found=getSelectedStamp();
    if(found){
      found.layer.stamps=found.layer.stamps.filter(s=>s.id!==found.stamp.id);
      clearStampSelection();
      composite();pushHistory();
    }
  }
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&document.activeElement?.tagName!=='INPUT'){
    const n=parseInt(e.key,10);
    if(n>=1&&n<=state.terrains.length){
      state.activeTerrainId=state.terrains[n-1].id;
      setTool('brush');
      renderTerrainList();
      renderTextureGrid();
      syncTextureControls();
    }
  }
});

initDefaultStamps();
setDocSize(state.docWidth,state.docHeight);
resetLayers();
renderLandSwatches();
renderCoastBands();
renderTextureGrid();
syncTextureControls();
renderStylePresets();
renderDefaultAssets();
renderCustomAssets();
renderLayers();
syncStampModeButtons();
renderToolSettings();
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
