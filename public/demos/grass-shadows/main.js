import * as THREE from '../pixel-grass/vendor/three.module.js';
import { makeNoise } from '../pixel-grass/noise.js';
const root = new URL('.', import.meta.url), previous = new URL('../pixel-grass/', root);
const $ = id => document.getElementById(id), canvas = $('grass-canvas');
const titles = ['同一块草坪，先摆上几块立方体','先让立方体的投影落到底板上','草也需要读取阴影，而不只是地面','画面位置与阴影查询必须对齐','先分段光照，再乘阴影衰减','用环境光保留暗部，而不是固定亮度','风动、拨草、投影与云影共同工作'];
const captions = ['有受光的明暗面，但还没有物体投影。云影关闭。','草暂不接收阴影，会遮住底板上的部分投影；关闭「显示草叶」可单独检查底板。','这一阶段按草根查询阴影：整撮草一起明暗，先理解接收机制。','现在使用风动和拨草后的表面位置查询；勾选错误示例可对比边界。','仅对漫反射做色阶处理，阴影的可见度保持连续。','直射光与环境光分别控制。把两者都设为 0，最终画面中的物体应全黑。','加入独立云影，并开放软边、偏移调节。草叶始终保留透明裁切，不互相投影。'];
let stage = 1, elapsed = 0, last = performance.now(), paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let yaw = .72, elevation = .72, zoom = 1, ready = false, mainVisible = true, mapVisible = false;
let renderer, scene, camera, shadowScene, sunCamera, shadowTarget, previewTarget, previewScene, previewCamera;
let uniforms, grass, actor, actorShadow, geometry, material, mapLast = -Infinity;
const shaders = {}, surfaceMeshes = [];
const state = { azimuth:305, altitude:48, sun:1.3, ambient:.22, cuts:3, softness:1, bias:.0008 };
function hashStage() { const n=Number(location.hash.replace('#step-','')); return Number.isInteger(n)&&n>=1&&n<=7?n:1; }
function effectiveStage() { return $('grass-compare').checked?Math.max(1,stage-1):stage; }
function applyStage(value, write=true) {
  stage=value;if(write)history.replaceState(null,'',`#step-${stage}`);
  const current=effectiveStage();
  $('grass-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===stage)));
  document.querySelectorAll('.grass-step').forEach(s=>s.hidden=Number(s.dataset.step)!==stage);
  document.querySelectorAll('[data-from]').forEach(e=>e.hidden=Number(e.dataset.from)>stage);
  $('stage-number').textContent=`${String(stage).padStart(2,'0')} / 07`;
  $('stage-label').textContent=titles[stage-1]+($('grass-compare').checked?' · 对比上一步':'');
  $('grass-caption').textContent=captions[current-1];$('grass-compare').disabled=stage===1;
  canvas.dataset.stage=String(current);
  applySettings();
}
function applySettings() {
  if(!uniforms)return;
  const current=effectiveStage();
  uniforms.uShadowStage.value=current;
  uniforms.uSunEnergy.value=state.sun;uniforms.uAmbientEnergy.value=state.ambient;uniforms.uCuts.value=state.cuts;
  uniforms.uFilterRadius.value=current>=7?state.softness:1;
  uniforms.uBias.value=current>=7?state.bias:.0008;
  uniforms.uMaskView.value=$('shadow-mask').checked?1:0;
  uniforms.uBanded.value=$('shadow-banded').checked?1:0;
  uniforms.uRootLookup.value=current>=4&&$('shadow-root').checked?1:0;
  uniforms.uCloudEnabled.value=$('shadow-clouds').checked?1:0;
  uniforms.uWindOn.value=$('shadow-wind').checked?1:0;
  grass.visible=$('shadow-grass').checked;
  actor.visible=actorShadow.visible=$('shadow-actor').checked;
  updateSun();
}
$('grass-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b){$('grass-compare').checked=false;applyStage(Number(b.dataset.stage));}});
$('grass-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?1:e.key==='End'?7:THREE.MathUtils.clamp(stage+(e.key==='ArrowRight'?1:-1),1,7);$('grass-compare').checked=false;applyStage(n);$('grass-tabs').querySelector(`[data-stage="${n}"]`).focus();});
addEventListener('hashchange',()=>applyStage(hashStage(),false));
$('grass-compare').addEventListener('change',()=>applyStage(stage,false));
function pauseLabel(){$('grass-pause').textContent=paused?'播放动画':'暂停动画';$('grass-pause').setAttribute('aria-pressed',String(paused));}
$('grass-pause').addEventListener('click',()=>{paused=!paused;pauseLabel();});pauseLabel();
for(const [id,key] of [['azimuth','azimuth'],['altitude','altitude'],['sun','sun'],['ambient','ambient'],['cuts','cuts'],['softness','softness'],['bias','bias']]){
  $(`shadow-${id}`).addEventListener('input',e=>{state[key]=Number(e.target.value);e.target.nextElementSibling.value=e.target.value+(['azimuth','altitude'].includes(key)?'°':'');applySettings();});
}
for(const id of ['shadow-grass','shadow-mask','shadow-wind','shadow-actor','shadow-root','shadow-banded','shadow-clouds'])$(id).addEventListener('change',applySettings);
function updateCamera(){
  if(!camera)return;
  camera.position.set(Math.sin(yaw)*Math.cos(elevation)*22,Math.sin(elevation)*22,Math.cos(yaw)*Math.cos(elevation)*22);
  camera.lookAt(0,.5,0);camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  uniforms.uCamRight.value.setFromMatrixColumn(camera.matrixWorld,0);
  uniforms.uCamUp.value.setFromMatrixColumn(camera.matrixWorld,1);
  uniforms.uCamForward.value.setFromMatrixColumn(camera.matrixWorld,2);
}
$('grass-reset').addEventListener('click',()=>{yaw=.72;elevation=.72;zoom=1;updateCamera();});
let pointer;
canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;yaw-=(e.clientX-pointer.x)*.008;elevation=THREE.MathUtils.clamp(elevation+(e.clientY-pointer.y)*.006,.25,1.25);pointer.x=e.clientX;pointer.y=e.clientY;updateCamera();});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>pointer=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.65,1.8);updateCamera();},{passive:false});
canvas.addEventListener('keydown',e=>{const d={ArrowLeft:[.1,0],ArrowRight:[-.1,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]}[e.key];if(d){e.preventDefault();yaw+=d[0];elevation=THREE.MathUtils.clamp(elevation+d[1],.25,1.25);updateCamera();}});
function resize(){if(!renderer)return;const pixel=$('grass-pixels').checked;const width=pixel?640:Math.min(1600,Math.round(canvas.clientWidth*devicePixelRatio));renderer.setSize(width,Math.round(width*9/16),false);canvas.style.imageRendering=pixel?'pixelated':'auto';}
$('grass-pixels').addEventListener('change',resize);new ResizeObserver(resize).observe($('grass-viewport'));
new IntersectionObserver(([e])=>mainVisible=e.isIntersecting,{rootMargin:'100px'}).observe(canvas);
new IntersectionObserver(([e])=>mapVisible=e.isIntersecting).observe($('shadow-map-panel'));
function noiseTexture(name,seed){
  const {bytes,size}=makeNoise(seed),texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  const preview=document.createElement('canvas');preview.width=preview.height=size;preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),size,size),0,0);
  document.querySelectorAll(`[data-texture="${name}"]`).forEach(img=>img.src=preview.toDataURL());return texture;
}
function updateSun(){
  if(!sunCamera)return;
  // BEGIN sun-matrix
  const azimuth=THREE.MathUtils.degToRad(state.azimuth), altitude=THREE.MathUtils.degToRad(state.altitude);
  const direction=new THREE.Vector3(Math.sin(azimuth)*Math.cos(altitude),Math.sin(altitude),Math.cos(azimuth)*Math.cos(altitude));
  uniforms.uSunDirection.value.copy(direction);
  sunCamera.position.copy(direction).multiplyScalar(20);sunCamera.lookAt(0,0,0);sunCamera.updateMatrixWorld();
  const biasMatrix=new THREE.Matrix4().set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1);
  // World -> light view -> light clip -> [0,1] UV/depth.
  uniforms.uLightMatrix.value.copy(biasMatrix).multiply(sunCamera.projectionMatrix).multiply(sunCamera.matrixWorldInverse);
  // END sun-matrix
}
async function init(){
  await Promise.all(['lighting.glsl','grass.vert.glsl','grass.frag.glsl','surface.vert.glsl','surface.frag.glsl'].map(async file=>{const r=await fetch(new URL(file,root));if(!r.ok)throw new Error(`${file}: ${r.status}`);shaders[file]=await r.text();}));
  const shared=await fetch(new URL('common.glsl',previous));if(!shared.ok)throw new Error('Shared shader missing');shaders.common=await shared.text();
  const loader=new THREE.TextureLoader(),[leaf,accent]=await Promise.all(['grassleaf','accentleaf'].map(n=>loader.loadAsync(new URL(`textures/${n}.png`,previous).href)));
  for(const texture of [leaf,accent]){texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;}
  uniforms={uTime:{value:0},uStage:{value:8},uWindSpeed:{value:1},uCloudSpeed:{value:1},uFps:{value:5},uRadius:{value:1.1},uCuts:{value:3},uDebug:{value:0},uActor:{value:new THREE.Vector3()},uCamRight:{value:new THREE.Vector3()},uCamUp:{value:new THREE.Vector3()},uCamForward:{value:new THREE.Vector3()},uLeaf:{value:leaf},uAccent:{value:accent},uPatchA:{value:noiseTexture('patch-a',17)},uPatchB:{value:noiseTexture('patch-b',83)},uWind:{value:noiseTexture('wind',41)},uCloud:{value:noiseTexture('cloud',109)},uWindOn:{value:1},uShadowStage:{value:stage},uShadowDepth:{value:null},uLightMatrix:{value:new THREE.Matrix4()},uSunDirection:{value:new THREE.Vector3()},uSunColor:{value:new THREE.Vector3(1,.96,.87)},uAmbientColor:{value:new THREE.Vector3(.65,.76,.85)},uSunEnergy:{value:1.3},uAmbientEnergy:{value:.22},uBias:{value:.0008},uFilterRadius:{value:1},uMapSize:{value:1024},uCloudEnabled:{value:0},uMaskView:{value:0},uBanded:{value:1},uRootLookup:{value:0}};
  renderer=new THREE.WebGLRenderer({canvas,antialias:false});renderer.setPixelRatio(1);renderer.setClearColor(0xe6e8df);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.debug.onShaderError=(gl,p,v,f)=>{console.error('Shadow shader compilation failed',gl.getProgramInfoLog(p),gl.getShaderInfoLog(v),gl.getShaderInfoLog(f));canvas.dataset.state='error';ready=false;$('grass-status').hidden=false;$('grass-status').textContent='着色器编译失败，请查看控制台。';};
  scene=new THREE.Scene();shadowScene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-12,12,6.75,-6.75,.1,100);
  // BEGIN shadow-target
  // Explicit depth pass: only opaque cubes and the moving sphere are present here.
  sunCamera=new THREE.OrthographicCamera(-10,10,10,-10,.1,45);
  shadowTarget=new THREE.WebGLRenderTarget(1024,1024,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
  shadowTarget.depthTexture=new THREE.DepthTexture(1024,1024,THREE.UnsignedIntType);
  shadowTarget.depthTexture.minFilter=shadowTarget.depthTexture.magFilter=THREE.NearestFilter;
  uniforms.uShadowDepth.value=shadowTarget.depthTexture;
  // END shadow-target
  material=(vert,frag,extras={})=>new THREE.ShaderMaterial({uniforms:{...uniforms,...extras},vertexShader:shaders.common+'\n'+shaders[vert],fragmentShader:shaders.common+'\n'+shaders['lighting.glsl']+'\n'+shaders[frag],side:THREE.DoubleSide});
  const surfaceMaterial=(color,ground=false)=>material('surface.vert.glsl','surface.frag.glsl',{uIsGround:{value:ground?1:0},uObjectColor:{value:new THREE.Vector3(...color)}});
  geometry=new THREE.PlaneGeometry(12,12);geometry.rotateX(-Math.PI/2);
  const ground=new THREE.Mesh(geometry,surfaceMaterial([.44,.62,.16],true));scene.add(ground);
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(12,.22,12),surfaceMaterial([.38,.42,.26]));plinth.position.y=-.12;scene.add(plinth);
  // BEGIN occluders
  const blocks=[{position:[-2.8,1.1,-1.8],size:[1.6,2.2,1.6],color:[.78,.69,.5]},
    {position:[1,.65,1],size:[1.8,1.3,1.8],color:[.61,.67,.68]},
    {position:[3.4,1.5,-3],size:[1,3,1],color:[.73,.53,.39]}];
  const depthMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
  for(const block of blocks){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...block.size),surfaceMaterial(block.color));mesh.position.set(...block.position);scene.add(mesh);surfaceMeshes.push(mesh);
    const occluder=new THREE.Mesh(mesh.geometry,depthMaterial);occluder.position.copy(mesh.position);shadowScene.add(occluder);
  }
  // Grass and ground are intentionally absent from shadowScene: receive, but do not cast.
  // END occluders
  const blades=new THREE.InstancedBufferGeometry(),quad=new THREE.PlaneGeometry(1,1);quad.translate(0,.5,0);
  blades.index=quad.index;blades.attributes.position=quad.attributes.position;blades.attributes.uv=quad.attributes.uv;
  const count=22000,roots=new Float32Array(count*3),seeds=new Float32Array(count),scales=new Float32Array(count);
  let seed=20261108;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){roots.set([(random()-.5)*11.9,.015,(random()-.5)*11.9],i*3);seeds[i]=random();scales[i]=.26+random()*.2;}
  blades.setAttribute('aRoot',new THREE.InstancedBufferAttribute(roots,3));blades.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,1));blades.setAttribute('aScale',new THREE.InstancedBufferAttribute(scales,1));blades.instanceCount=18000;
  grass=new THREE.Mesh(blades,material('grass.vert.glsl','grass.frag.glsl'));grass.frustumCulled=false;scene.add(grass);
  actor=new THREE.Mesh(new THREE.SphereGeometry(.36,16,12),surfaceMaterial([.18,.24,.2]));scene.add(actor);actorShadow=new THREE.Mesh(actor.geometry,depthMaterial);shadowScene.add(actorShadow);
  previewTarget=new THREE.WebGLRenderTarget(256,256,{depthBuffer:false});previewScene=new THREE.Scene();previewCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  previewScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{depthMap:{value:shadowTarget.depthTexture}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}',fragmentShader:'uniform sampler2D depthMap; varying vec2 vUv; void main(){float d=texture2D(depthMap,vUv).r;gl_FragColor=vec4(vec3(d),1.0);}'})));
  updateCamera();applyStage(stage,false);resize();renderer.compile(scene,camera);if(canvas.dataset.state==='error')throw new Error('Shader compile error');
  ready=true;canvas.dataset.state='ready';$('grass-status').hidden=true;frame();
}
const previewBytes=new Uint8Array(256*256*4),previewImage=new ImageData(256,256);
function drawDepthPreview(){
  // BEGIN depth-preview
  // Read an actual GPU visualization of the depth attachment, not an illustrative image.
  renderer.setRenderTarget(previewTarget);renderer.render(previewScene,previewCamera);
  renderer.readRenderTargetPixels(previewTarget,0,0,256,256,previewBytes);
  for(let y=0;y<256;y++)previewImage.data.set(previewBytes.subarray(y*1024,(y+1)*1024),(255-y)*1024);
  $('shadow-map').getContext('2d').putImageData(previewImage,0,0);
  renderer.setRenderTarget(null);
  // END depth-preview
}
let fpsElapsed=0,frames=0;
function frame(now=performance.now()){
  requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;
  if(!ready||document.hidden||(!mainVisible&&!(mapVisible&&$('shadow-map-panel').open)))return;
  if(!paused)elapsed+=dt;uniforms.uTime.value=elapsed;
  actor.position.set(Math.sin(elapsed*.43)*4,.38,3.5+Math.cos(elapsed*.43)*.6);actorShadow.position.copy(actor.position);
  if(actor.visible)uniforms.uActor.value.set(actor.position.x,0,actor.position.z);else uniforms.uActor.value.set(1000,0,1000);
  // BEGIN render-passes
  renderer.setRenderTarget(shadowTarget);renderer.setClearColor(0xffffff);
  renderer.render(shadowScene,sunCamera); // Writes the light camera's depth attachment.
  renderer.setRenderTarget(null);renderer.setClearColor(0xe6e8df);
  renderer.render(scene,camera); // Grass and ground now sample the same depth attachment.
  // END render-passes
  if($('shadow-map-panel').open&&mapVisible&&now-mapLast>200){drawDepthPreview();mapLast=now;}
  frames++;fpsElapsed+=dt;if(fpsElapsed>.7){$('grass-stats').textContent=`${canvas.width} × ${canvas.height} · ${Math.round(frames/fpsElapsed)} FPS`;frames=0;fpsElapsed=0;}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;canvas.dataset.state='error';$('grass-status').hidden=false;$('grass-status').textContent='图形上下文丢失，请刷新页面。说明与代码仍可阅读。';});
applyStage(hashStage(),false);
init().catch(e=>{console.error(e);canvas.dataset.state='error';$('grass-status').hidden=false;$('grass-status').textContent='演示启动失败，请使用支持 WebGL 2 的浏览器。下方仍可阅读说明和代码。';});
