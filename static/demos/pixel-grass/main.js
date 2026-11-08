import * as THREE from './vendor/three.module.js';
import { makeNoise } from './noise.js';
const root = new URL('.', import.meta.url);
const $ = id => document.getElementById(id);
const canvas = $('grass-canvas');
const titles = ['一切从一块绿色平面开始','几张透明贴图，变成一整片草地','让地面与草叶共享同一片颜色','风不是随机抖动，而是流经世界的场','给平面草叶一点倾倒的体积感','让草有分帧感，让相机保持流畅','角色走过，附近的草向外倾倒','用有限的明暗，组织草地的层次','最后，让云的影子掠过草地'];
const captions = ['绿色平面 + 正交相机 + 640 × 360 内部画面。','18,000 个实例共用草片网格；草片面向相机，少量实例使用装饰变体。','地面逐像素取色，草片按根部取色；两层噪声把三种绿色组织成块。','局部左右摇摆叠加世界风场。两层移动噪声共享同一张纹理。','UV 横向缩放随高度变化；旋转相机可以观察假透视如何随风向改变。','只量化草的动画时间；每撮草错开相位，避免整片同时跳动。','深色球体是教学角色；根据距离与半径拨草，不留下永久踩踏轨迹。','地面硬色阶 + 草片窄渐变色阶。网页实现使用向上的受光法线并叠加轻微倾斜。','向假想云层投影，再用两层噪声限制光照。云影与风场各有自己的速度。'];
let selectedStage = 1, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let elapsed = 0, last = performance.now(), ready = false, onScreen = true;
let yaw = 0.72, elevation = 0.72, zoom = 1;
let renderer, scene, camera, grass, actor, uniforms;
const shaderFiles = ['common.glsl','grass.vert.glsl','grass.frag.glsl','ground.vert.glsl','ground.frag.glsl'];
const loaded = {};
function stageFromHash() { const n = Number(location.hash.replace('#step-', '')); return Number.isInteger(n) && n >= 1 && n <= 9 ? n : 1; }
function updateStage(value, writeURL = true) {
  selectedStage = value;
  if (writeURL) history.replaceState(null,'',`#step-${value}`);
  const effective = $('grass-compare').checked ? Math.max(1,value-1) : value;
  $('grass-tabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === value)));
  document.querySelectorAll('.grass-step').forEach(s => s.hidden = Number(s.dataset.step) !== value);
  document.querySelectorAll('[data-from]').forEach(label => label.hidden = Number(label.dataset.from) > value);
  $('stage-number').textContent = `${String(value).padStart(2,'0')} / 09`;
  $('stage-label').textContent = titles[value-1] + ($('grass-compare').checked ? ' · 正在显示上一步' : '');
  $('grass-caption').textContent = captions[value-1];
  $('grass-compare').disabled = value === 1;
  const debug = $('grass-debug');
  [...debug.options].forEach((o,i) => o.disabled = effective < [1,3,4,9][i]);
  if (debug.selectedOptions[0].disabled) debug.value = '0';
  if (uniforms) { uniforms.uStage.value = effective; uniforms.uDebug.value = Number(debug.value); grass.visible = effective >= 2; actor.visible = effective >= 7; }
}
$('grass-tabs').addEventListener('click', e => { const b=e.target.closest('[data-stage]'); if(b) { $('grass-compare').checked=false; updateStage(Number(b.dataset.stage)); } });
$('grass-tabs').addEventListener('keydown', e => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
  e.preventDefault();
  const n=e.key==='Home'?1:e.key==='End'?9:Math.min(9,Math.max(1,selectedStage+(e.key==='ArrowRight'?1:-1)));
  $('grass-compare').checked=false; updateStage(n); $('grass-tabs').querySelector(`[data-stage="${n}"]`).focus();
});
window.addEventListener('hashchange',()=>updateStage(stageFromHash(),false));
$('grass-compare').addEventListener('change',()=>updateStage(selectedStage,false));
$('grass-debug').addEventListener('change',()=>{ if(uniforms) uniforms.uDebug.value=Number($('grass-debug').value); });
function updatePause() { $('grass-pause').textContent=paused?'播放动画':'暂停动画'; $('grass-pause').setAttribute('aria-pressed',String(paused)); }
$('grass-pause').addEventListener('click',()=>{paused=!paused;updatePause();});
updatePause(); updateStage(stageFromHash(),false);
function updateCamera() {
  if(!camera) return;
  const radius=22;
  camera.position.set(Math.sin(yaw)*Math.cos(elevation)*radius,Math.sin(elevation)*radius,Math.cos(yaw)*Math.cos(elevation)*radius);
  camera.lookAt(0,0,0); camera.zoom=zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  uniforms.uCamRight.value.setFromMatrixColumn(camera.matrixWorld,0);
  uniforms.uCamUp.value.setFromMatrixColumn(camera.matrixWorld,1);
  uniforms.uCamForward.value.setFromMatrixColumn(camera.matrixWorld,2);
}
$('grass-reset').addEventListener('click',()=>{yaw=.72;elevation=.72;zoom=1;updateCamera();});
let pointer=null;
canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  yaw-=(e.clientX-pointer.x)*.008;
  elevation=THREE.MathUtils.clamp(elevation+(e.clientY-pointer.y)*.006,.25,1.25);
  pointer.x=e.clientX;pointer.y=e.clientY;updateCamera();
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>pointer=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.65,1.8);updateCamera();},{passive:false});
canvas.addEventListener('keydown',e=>{
  const movement={ArrowLeft:[.1,0],ArrowRight:[-.1,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]}[e.key];
  if(movement){e.preventDefault();yaw+=movement[0];elevation=THREE.MathUtils.clamp(elevation+movement[1],.25,1.25);updateCamera();}
});
function resize() {
  if(!renderer)return;
  // BEGIN pixel-render
  const pixelated = $('grass-pixels').checked;
  const width = pixelated ? 640 : Math.min(1600, Math.round(canvas.clientWidth * devicePixelRatio));
  renderer.setSize(width, Math.round(width * 9 / 16), false);
  canvas.style.imageRendering = pixelated ? 'pixelated' : 'auto';
  // CSS scales the low-resolution render; the orthographic camera is unchanged.
  // END pixel-render
}
$('grass-pixels').addEventListener('change',resize);
new ResizeObserver(resize).observe($('grass-viewport'));
new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting;},{rootMargin:'100px'}).observe(canvas);
function noiseTexture(name,seed) {
  const {bytes,size}=makeNoise(seed);
  const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  const preview=document.createElement('canvas');preview.width=preview.height=size;
  preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),size,size),0,0);
  document.querySelectorAll(`[data-texture="${name}"]`).forEach(img=>{img.src=preview.toDataURL();});
  return texture;
}
async function init() {
  await Promise.all(shaderFiles.map(async file=>{const response=await fetch(new URL(file,root));if(!response.ok)throw new Error(`${file}: ${response.status}`);loaded[file]=await response.text();}));
  const textureLoader=new THREE.TextureLoader();
  const [leaf,accent]=await Promise.all(['grassleaf','accentleaf'].map(name=>textureLoader.loadAsync(new URL(`textures/${name}.png`,root).href)));
  for(const texture of [leaf,accent]){texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;}
  uniforms={uTime:{value:0},uStage:{value:selectedStage},uWindSpeed:{value:1},uCloudSpeed:{value:1},uFps:{value:5},uRadius:{value:1.1},uCuts:{value:3},uDebug:{value:0},uActor:{value:new THREE.Vector3()},uCamRight:{value:new THREE.Vector3()},uCamUp:{value:new THREE.Vector3()},uCamForward:{value:new THREE.Vector3()},uLeaf:{value:leaf},uAccent:{value:accent},uPatchA:{value:noiseTexture('patch-a',17)},uPatchB:{value:noiseTexture('patch-b',83)},uWind:{value:noiseTexture('wind',41)},uCloud:{value:noiseTexture('cloud',109)}};
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false});
  renderer.setPixelRatio(1);renderer.setClearColor(0xe6e8df);
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
    const log=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n');
    console.error('Grass shader failed',log);$('grass-status').hidden=false;$('grass-status').textContent='着色器编译失败，请检查浏览器控制台。';
    canvas.dataset.state='error';ready=false;
  };
  scene=new THREE.Scene();
  // BEGIN camera
  const viewHeight=13.5, aspect=16/9;
  camera=new THREE.OrthographicCamera(-viewHeight*aspect/2,viewHeight*aspect/2,viewHeight/2,-viewHeight/2,.1,100);
  // Ground plane is 12 × 12 world units. Camera orbit changes only the view.
  const geometry=new THREE.PlaneGeometry(12,12);
  geometry.rotateX(-Math.PI/2);
  // END camera
  const material=(vert,frag)=>new THREE.ShaderMaterial({uniforms,vertexShader:loaded['common.glsl']+'\n'+loaded[vert],fragmentShader:loaded['common.glsl']+'\n'+loaded[frag],side:THREE.DoubleSide});
  const ground=new THREE.Mesh(geometry,material('ground.vert.glsl','ground.frag.glsl'));scene.add(ground);
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(12,.22,12),new THREE.MeshLambertMaterial({color:0x68714b}));plinth.position.y=-.12;scene.add(plinth);
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const sunlight=new THREE.DirectionalLight(0xfff2d2,2.2);sunlight.position.set(-5,8,3);scene.add(sunlight);
  // BEGIN instancing
  const blades=new THREE.InstancedBufferGeometry();
  const quad=new THREE.PlaneGeometry(1,1);quad.translate(0,.5,0);
  blades.index=quad.index;blades.attributes.position=quad.attributes.position;blades.attributes.uv=quad.attributes.uv;
  const count=22000, roots=new Float32Array(count*3), seeds=new Float32Array(count), scales=new Float32Array(count);
  let seed=20261108;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++) {
    roots.set([(random()-.5)*11.9,.015,(random()-.5)*11.9],i*3);
    seeds[i]=random();scales[i]=.26+random()*.2;
  }
  blades.setAttribute('aRoot',new THREE.InstancedBufferAttribute(roots,3));
  blades.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,1));
  blades.setAttribute('aScale',new THREE.InstancedBufferAttribute(scales,1));
  blades.instanceCount=18000;
  grass=new THREE.Mesh(blades,material('grass.vert.glsl','grass.frag.glsl'));
  grass.frustumCulled=false;scene.add(grass);
  // END instancing
  actor=new THREE.Mesh(new THREE.SphereGeometry(.36,16,12),new THREE.MeshToonMaterial({color:0x263126}));scene.add(actor);
  $('grass-density').addEventListener('input',e=>{blades.instanceCount=Number(e.target.value);});
  const binding={'grass-wind':'uWindSpeed','grass-cloud':'uCloudSpeed','grass-fps':'uFps','grass-radius':'uRadius','grass-cuts':'uCuts'};
  document.querySelectorAll('.grass-tuning input').forEach(input=>input.addEventListener('input',()=>{input.nextElementSibling.value=input.value;if(binding[input.id])uniforms[binding[input.id]].value=Number(input.value);}));
  updateCamera();resize();updateStage(selectedStage,false);
  renderer.compile(scene,camera);
  if(canvas.dataset.state==='error')throw new Error('Shader compilation failed');
  ready=true;canvas.dataset.state='ready';$('grass-status').hidden=true;
  frame();
}
let fpsTime=0,frameCount=0;
function frame(now=performance.now()) {
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(!ready||document.hidden||!onScreen)return;
  if(!paused)elapsed+=dt;
  uniforms.uTime.value=elapsed;
  // BEGIN actor-path
  // Same analytic path in all stages; pausing freezes it together with wind/clouds.
  actor.position.set(Math.sin(elapsed*.43)*3.8,.38,Math.sin(elapsed*.67)*2.9);
  uniforms.uActor.value.set(actor.position.x,0,actor.position.z);
  // END actor-path
  renderer.render(scene,camera);
  frameCount++;fpsTime+=dt;
  if(fpsTime>.7){$('grass-stats').textContent=`${canvas.width} × ${canvas.height} · ${Math.round(frameCount/fpsTime)} FPS`;frameCount=0;fpsTime=0;}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;canvas.dataset.state='error';$('grass-status').hidden=false;$('grass-status').textContent='图形上下文已丢失，请刷新页面恢复演示。文章和代码仍可阅读。';});
init().catch(error=>{console.error(error);$('grass-status').hidden=false;$('grass-status').textContent='实时演示未能启动。请使用支持 WebGL 2 的浏览器；下方仍可切换阅读说明与代码。';canvas.dataset.state='error';});
