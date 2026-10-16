import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const loader=new GLTFLoader();let modelPromise;const active=new Map();
function renderPet(host){
 if(active.has(host))return;
 const fallback=host.querySelector('img'),status=host.querySelector('.pet3d-status');let renderer;
 try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{status.textContent='3D недоступна в этом браузере. Показана иллюстрация.';return;}
 let disposed=false;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,30);
 camera.position.set(3,2.45,6);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','3D-ёжик. Вращай мышью или стрелками клавиатуры.');host.prepend(canvas);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.50,.15);controls.enableZoom=false;controls.enablePan=false;controls.minPolarAngle=.45;controls.maxPolarAngle=1.88;controls.update();
 scene.add(new T.HemisphereLight('#fff0d7','#749caa',2.0));
 for(const [position,color,intensity] of [[[3,5,5],'#fff0d5',2.8],[[-4,3,1],'#d5edff',2],[[1,4,-3],'#f5bd81',1.6]]){const light=new T.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
 // Мягкая тень остаётся декоративной и не меняет модель.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
 const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(21,44,51,.24)');gradient.addColorStop(1,'rgba(21,44,51,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const shadow=new T.Mesh(new T.PlaneGeometry(2.9,2.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.03,.1);scene.add(shadow);
 const draw=()=>{if(!disposed)renderer.render(scene,camera);};
 const resize=()=>{const {width,height}=host.getBoundingClientRect();if(width<1||height<1)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();};
 const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',draw);
 const onKey=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const offset=camera.position.clone().sub(controls.target).applyAxisAngle(new T.Vector3(0,1,0),e.key==='ArrowLeft'?.2:-.2);camera.position.copy(controls.target).add(offset);controls.update();}};
 canvas.addEventListener('keydown',onKey);
 host.querySelector('[data-pet-reset]')?.addEventListener('click',()=>{camera.position.set(3,2.45,6);controls.update();});
 active.set(host,()=>{disposed=true;observer.disconnect();controls.dispose();renderer.dispose();renderer.forceContextLoss();scene.traverse(o=>{if(o.material && o.userData.clonedMaterial)o.material.dispose();});shadow.geometry.dispose();shadow.material.map.dispose();shadow.material.dispose();canvas.remove();});
 (modelPromise??=loader.loadAsync('/assets/models/hedgehog.glb').catch(e=>{modelPromise=null;throw e;})).then(gltf=>{
  if(disposed)return;const model=gltf.scene.clone(true);scene.add(model);
  let items=[];try{items=JSON.parse(host.dataset.items);}catch{}
  const selected=new Map(items.map(p=>[p.modelKey,p]));
  model.traverse(o=>{
   if(o.name.startsWith('wear_')){const item=selected.get(o.name.slice(5));o.visible=!!item;
    if(item && /^#[0-9a-f]{6}$/i.test(item.color))o.traverse(m=>{if(m.material?.name==='fabric'){m.material=m.material.clone();m.userData.clonedMaterial=true;m.material.color.set(item.color);}});
   }
   if(o.name.startsWith('base_'))o.visible=!selected.has('hoodie');
   if(o.name==='default_bow')o.visible=!items.some(p=>['neck','body'].includes(p.slot));
  });
  host.classList.add('pet3d-ready');fallback.hidden=true;status.textContent='Поверни ёжика пальцем или мышью';resize();
 }).catch(()=>{if(!disposed){active.get(host)?.();active.delete(host);status.textContent='3D-модель не загрузилась. Обнови страницу.';}});
 resize();
}
window.YunostPet3D={mount(root=document){root.querySelectorAll('[data-pet3d]').forEach(renderPet);},cleanup(){for(const [host,dispose]of active)if(!document.contains(host) || host.closest('dialog')&&!host.closest('dialog').open){dispose();active.delete(host);}},disposeAll(){for(const dispose of active.values())dispose();active.clear();}};
