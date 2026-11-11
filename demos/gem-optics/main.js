import * as THREE from '../pixel-grass/vendor/three.module.js';
import { buildCut } from './cuts.js';

const lab = document.querySelector('.gem-lab');
const canvas = lab.querySelector('canvas');
const field = name => document.getElementById('gem-'+name);
const value = name => Number(field(name).value);
const steps = [...lab.querySelectorAll('[data-gem-stage]')];
const notes = document.querySelectorAll('.grass-step');
const compare = field('compare'), spin = field('spin');
const vertex = `
  varying vec3 facePosition, faceNormal;
  void main() {
    facePosition=position;
    faceNormal=normal;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }`;
const screenVertex = `
  varying vec2 coord;
  void main(){coord=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;

let stage = 1, yaw = .42, tilt = .98, visible = true;
let render, frame = 0, previousTime = 0;
function invalidate() {
  if (!render || !visible || document.hidden || frame) return;
  frame = requestAnimationFrame(now => {
    frame = 0;
    if (spin.checked && previousTime) yaw += Math.min(now-previousTime,64)*.00032;
    previousTime = now;
    render();
    if (spin.checked) invalidate();
  });
}
function applyStep(number, updateHash) {
  stage = number;
  compare.checked = false;
  compare.disabled = stage === 1;
  steps.forEach((button,i) => button.setAttribute('aria-pressed',String(i+1===stage)));
  notes.forEach(section => section.hidden = Number(section.dataset.step)!==stage);
  lab.querySelectorAll('[data-from]').forEach(label => label.hidden = Number(label.dataset.from)>stage);
  if (updateHash) history.replaceState(null,'','#step-'+stage);
  invalidate();
}
function fromHash() {
  const match = location.hash.match(/^#step-([1-8])$/);
  applyStep(match ? Number(match[1]) : 1,false);
}
steps.forEach((button,i) => button.addEventListener('click',() => applyStep(i+1,true)));
window.addEventListener('hashchange',fromHash);
fromHash();
lab.addEventListener('input',event => {
  const output = event.target.closest('label')?.querySelector('output');
  if (output) output.value = event.target.value;
  previousTime = 0;
  invalidate();
});
field('reset').onclick = () => { yaw=.42; tilt=.98; invalidate(); };
function rotate(dx,dy) {
  yaw += dx;
  tilt = THREE.MathUtils.clamp(tilt+dy,-1.5,1.5);
  invalidate();
}
let drag;
canvas.onpointerdown = e => {
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = e => {
  if (drag?.id!==e.pointerId) return;
  rotate((e.clientX-drag.x)*.012,(e.clientY-drag.y)*.012);
  drag.x=e.clientX; drag.y=e.clientY;
};
canvas.onlostpointercapture = () => { drag=null; };
canvas.onkeydown = e => {
  const delta={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowDown:[0,.12],ArrowUp:[0,-.12]}[e.key];
  if (delta) { e.preventDefault(); rotate(...delta); }
};
new ResizeObserver(invalidate).observe(canvas);
new IntersectionObserver(([entry]) => {
  visible=entry.isIntersecting;
  previousTime=0;
  if (visible) invalidate();
}).observe(canvas);
document.addEventListener('visibilitychange',() => { previousTime=0; invalidate(); });

async function load(file) {
  const response = await fetch(new URL(file,import.meta.url));
  if (!response.ok) throw Error(file+' '+response.status);
  return response.text();
}
function fail(error) {
  console.error(error);
  render = null;
  canvas.dataset.state='error';
  field('status').hidden=false;
  field('status').textContent='实时画面需要 WebGL 2。下方可以继续切换步骤、阅读讲解和代码。';
}

async function start() {
  const [gemShader,postShader] = await Promise.all([load('gem.frag.glsl'),load('post.frag.glsl')]);
  const renderer = new THREE.WebGLRenderer({canvas,alpha:false,antialias:false});
  renderer.autoClear=false;
  renderer.debug.onShaderError=(gl,program,vert,frag) => {
    throw Error([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vert),gl.getShaderInfoLog(frag)].join('\n'));
  };
  const camera = new THREE.PerspectiveCamera(38,1,.1,20);
  camera.position.z=4.25;
  const gems=[true,false].map(emerald => {
    const {geometry,planes}=buildCut(emerald);
    const uniforms = {
      facets:{value:planes}, stage:{value:1}, ior:{value:1}, bounceLimit:{value:1},
      absorption:{value:new THREE.Vector3()}, dispersion:{value:0}, lampAngle:{value:0},
      localEye:{value:new THREE.Vector3()}, objectRotation:{value:new THREE.Matrix3()}
    };
    const material=new THREE.ShaderMaterial({uniforms,defines:{FACET_COUNT:planes.length},
      vertexShader:vertex,fragmentShader:gemShader});
    const mesh=new THREE.Mesh(geometry,material);
    const scene=new THREE.Scene();
    scene.add(mesh);
    return {scene,mesh,uniforms,emerald};
  });
  const sceneTarget=new THREE.WebGLRenderTarget(1,1);
  const brightTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
  const uniforms={
    sceneImage:{value:sceneTarget.texture},brightImage:{value:brightTarget.texture},
    texel:{value:new THREE.Vector2()},sparkle:{value:0},antialias:{value:false}
  };
  const quadCamera=new THREE.Camera(), quad=new THREE.PlaneGeometry(2,2);
  function screenPass(defines) {
    const scene=new THREE.Scene();
    scene.add(new THREE.Mesh(quad,new THREE.ShaderMaterial({defines,uniforms,
      vertexShader:screenVertex,fragmentShader:postShader,depthTest:false,depthWrite:false})));
    return scene;
  }
  const extract=screenPass({EXTRACT_HIGHLIGHTS:1}), compose=screenPass({});
  function draw() {
    const active=compare.checked ? stage-1 : stage;
    const panelWidth=value('resolution'), width=panelWidth*2;
    const height=Math.max(1,Math.round(width*canvas.clientHeight/canvas.clientWidth));
    if (canvas.width!==width || canvas.height!==height) {
      renderer.setSize(width,height,false);
      sceneTarget.setSize(width,height);
      brightTarget.setSize(panelWidth,Math.ceil(height/2));
    }
    camera.aspect=panelWidth/height;
    camera.updateProjectionMatrix();
    uniforms.texel.value.set(1/width,1/height);
    renderer.setRenderTarget(sceneTarget);
    renderer.setClearColor(0x000000,0);
    renderer.clear();
    gems.forEach(({scene,mesh,uniforms:u,emerald},i) => {
      mesh.rotation.set(tilt,yaw,0);
      mesh.updateMatrixWorld();
      u.objectRotation.value.setFromMatrix4(mesh.matrixWorld);
      mesh.worldToLocal(u.localEye.value.copy(camera.position));
      u.stage.value=active;
      u.lampAngle.value=value('lamp')*Math.PI/180;
      u.ior.value=value(emerald?'emerald-ior':'diamond-ior');
      u.bounceLimit.value=value('bounces');
      u.absorption.value.set(...(emerald?[1.35,.10,.8]:[.022,.018,.014])).multiplyScalar(value('absorb'));
      u.dispersion.value=(emerald ? .009 : .047)*value('spread');
      renderer.setViewport(i*panelWidth,0,panelWidth,height);
      renderer.render(scene,camera);
    });
    uniforms.sparkle.value=active===8 ? value('glare') : 0;
    uniforms.antialias.value=active===8 && field('aa').checked;
    if (uniforms.sparkle.value>0) {
      renderer.setRenderTarget(brightTarget);
      renderer.setViewport(0,0,brightTarget.width,brightTarget.height);
      renderer.render(extract,quadCamera);
    }
    renderer.setRenderTarget(null);
    renderer.setViewport(0,0,width,height);
    renderer.render(compose,quadCamera);
    canvas.dataset.stage=String(active);
  }
  render=() => {try { draw(); } catch(error) { fail(error); }};
  render();
  if (render) { canvas.dataset.state='ready'; field('status').hidden=true; }
}
canvas.addEventListener('webglcontextlost',() => fail(Error('WebGL context lost')));
start().catch(fail);
