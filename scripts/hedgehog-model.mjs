import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Собственная процедурная модель; все предметы имеют постоянные места крепления.
export function hedgehog(){
 const root=new T.Group();root.name='FyrFyrych';
 const mat=(color,roughness=.72)=>new T.MeshStandardMaterial({color,roughness});
 const fur=mat('#bb8650'),cream=mat('#efd4a0'),pink=mat('#c67a61'),dark=mat('#271814',.25),white=mat('#fff9e8',.24),amber=mat('#986323',.3);
 const mesh=(g,m,parent=root)=>{const o=new T.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const ball=(p,scale,m,parent=root)=>{const o=mesh(new T.SphereGeometry(1,32,24),m,parent);o.position.set(...p);o.scale.set(...scale);return o;};
 const cyl=(p,rt,rb,height,m,parent=root)=>{const o=mesh(new T.CylinderGeometry(rt,rb,height,48),m,parent);o.position.set(...p);return o;};
 const curve=(points,r,m,parent=root)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,8,false),m,parent);
 ball([0,1.2,-.1],[.82,1.06,.72],mat('#775032'));
 // Fibonacci distribution: иголки на спине, по бокам и на затылке. Геометрии объединены.
 const spikes=[[],[],[]],col=['#916138','#b0824e','#d2ac70'];
 for(let i=0;i<470;i++){
  const y=1-(i/469)*2,rad=Math.sqrt(1-y*y),a=i*2.3999632,n=new T.Vector3(Math.cos(a)*rad,y,Math.sin(a)*rad);
  if(n.z>.33 && n.y<.8)continue;
  const length=.23+(.5+.5*Math.sin(i*17.3))*.16;
  const geo=new T.ConeGeometry(.071,length,6);geo.translate(0,length/2-.02,0);
  const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),n);
  const pos=new T.Vector3(n.x*.79,1.44+n.y*1.08,n.z*.65-.07);
  geo.applyMatrix4(new T.Matrix4().compose(pos,q,new T.Vector3(1,1,1)));spikes[i%3].push(geo);
 }
 spikes.forEach((parts,i)=>{mesh(mergeGeometries(parts),mat(col[i]));parts.forEach(g=>g.dispose());});
 ball([0,1.10,.33],[.66,.77,.48],fur).name='base_torso';ball([0,1.04,.63],[.48,.62,.22],cream).name='base_tummy';
 for(const x of [-1,1]){
  ball([x*.39,.25,.24],[.29,.20,.42],fur);
  for(let j=0;j<3;j++)ball([x*.39+(j-1)*.13,.24,.55],[.073,.09,.14],cream);
  const arm=ball([x*.64,1.20,.42],[.19,.47,.20],fur);arm.rotation.z=x*.29;arm.name='base_arm_'+(x>0?'right':'left');
  ball([x*.74,.89,.53],[.19,.19,.17],fur);
 }
 ball([0,1.96,.35],[.68,.67,.54],cream);
 for(const x of [-1,1]){
  ball([x*.60,2.35,.25],[.22,.26,.13],fur);ball([x*.60,2.35,.37],[.14,.17,.04],pink);
  ball([x*.31,2.05,.794],[.22,.26,.08],white);
  ball([x*.30,2.035,.869],[.166,.211,.061],amber);
  ball([x*.292,2.05,.918],[.125,.163,.025],dark);
  ball([x*.27-.035,2.13,.94],[.04,.05,.01],white);
  ball([x*.31+.05,2.01,.947],[.016,.019,.008],white);
  curve([[x*.47,2.35,.76],[x*.35,2.40,.82],[x*.23,2.37,.84]],.026,fur);
  ball([x*.40,1.81,.79],[.16,.12,.034],mat('#e5b78a'));
 }
 ball([0,1.81,.80],[.32,.24,.28],cream);
 ball([0,1.88,1.065],[.137,.105,.095],dark);
 ball([-.035,1.926,1.14],[.035,.018,.007],mat('#fff4d5',.2));
 curve([[-.21,1.69,.94],[-.12,1.61,1.005],[0,1.59,1.033],[.12,1.61,1.005],[.21,1.69,.94]],.019,mat('#71462c'));
 const group=name=>{const g=new T.Group();g.name='wear_'+name;root.add(g);return g;};
 const garment=color=>{const m=mat(color,.84);m.name='fabric';return m;};
 const bow=(parent,color)=>{const m=garment(color);ball([-.18,1.46,.795],[.23,.14,.08],m,parent).rotation.z=-.26;ball([.18,1.46,.795],[.23,.14,.08],m,parent).rotation.z=.26;ball([0,1.46,.90],[.08,.10,.045],m,parent);};
 const defaultBow=new T.Group();defaultBow.name='default_bow';root.add(defaultBow);bow(defaultBow,'#dd782d');
 const panama=group('panama'),blue=garment('#81bddd');
 cyl([0,2.66,.17],.52,.75,.075,blue,panama);cyl([0,2.85,.17],.40,.51,.35,blue,panama);cyl([0,2.73,.17],.493,.507,.07,mat('#356d8b'),panama);
 ball([.01,2.79,.648],[.08,.07,.02],mat('#fff5cf'),panama);
 const beanie=group('beanie'),navy=garment('#398b9d');
 ball([0,2.67,.18],[.60,.49,.53],navy,beanie);
 const brim=mesh(new T.TorusGeometry(.52,.075,12,56),navy,beanie);brim.rotation.x=Math.PI/2;brim.position.set(0,2.60,.18);
 ball([0,3.10,.18],[.16,.16,.16],cream,beanie);
 const glasses=group('glasses'),frame=garment('#25425b'),lens=new T.MeshStandardMaterial({color:'#304550',metalness:.12,roughness:.24});
 for(const x of [-1,1]){
  const ring=mesh(new T.TorusGeometry(.227,.034,12,48),frame,glasses);ring.position.set(x*.303,2.052,.986);ring.scale.y=1.03;
  ball([x*.303,2.052,.990],[.20,.204,.025],lens,glasses);
  curve([[x*.529,2.086,.991],[x*.63,2.11,.8],[x*.64,2.12,.3]],.024,frame,glasses);
  curve([[x*.37,2.17,1.013],[x*.29,2.21,1.019]],.015,mat('#aac9ce'),glasses);
 }
 curve([[-.067,2.08,1],[0,2.12,1.027],[.067,2.08,1]],.028,frame,glasses);
 const tie=group('tie'),satin=garment('#73b5e7');
 const band=mesh(new T.TorusGeometry(.40,.075,12,56),satin,tie);band.rotation.x=Math.PI/2;band.position.set(0,1.45,.40);
 ball([0,1.40,.84],[.10,.09,.07],satin,tie);
 for(const x of [-1,1]){const ends=ball([x*.14,1.21,.81],[.12,.24,.05],satin,tie);ends.rotation.z=x*.48;}
 const scarf=group('scarf'),red=garment('#a74f4a');
 const scarfRing=mesh(new T.TorusGeometry(.415,.11,12,56),red,scarf);scarfRing.rotation.x=Math.PI/2;scarfRing.position.set(0,1.48,.4);scarfRing.scale.z=.8;
 ball([.23,1.16,.81],[.11,.34,.07],red,scarf).rotation.z=.13;
 const hoodie=group('hoodie'),cloth=garment('#659da7');
 ball([0,1.01,.32],[.68,.68,.55],cloth,hoodie);
 for(const x of [-1,1])ball([x*.66,1.19,.42],[.225,.39,.23],cloth,hoodie).rotation.z=x*.29;
 const collar=mesh(new T.TorusGeometry(.40,.092,12,56),cloth,hoodie);collar.rotation.x=Math.PI/2;collar.position.set(0,1.48,.36);
 ball([0,.92,.856],[.29,.15,.035],cloth,hoodie);
 for(const x of [-1,1])curve([[x*.10,1.49,.825],[x*.12,1.30,.87],[x*.12,1.18,.89]],.017,white,hoodie);
 ball([-.22,1.31,.823],[.085,.07,.019],white,hoodie);
 root.userData={description:'Фыр-Фырыч — оригинальная стилизованная модель для «Юности»',slots:['head','eyes','neck','body'],garments:['panama','beanie','glasses','tie','scarf','hoodie']};
 return root;
}
