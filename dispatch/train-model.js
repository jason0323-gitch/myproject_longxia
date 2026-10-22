/* Body geometry and makeCar reused from ../index.html; no weapons mounted. */
window.createDispatchTrain = function(THREE) {
const mat=(color,metal=.15,rough=.55)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
const emissive=(color,intensity=1)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity});
const whiteMat=mat(0xf4faff,.18,.42),armorMat=mat(0x176d96,.25,.38),darkMat=mat(0x122938),limeMat=mat(0x25bbd1);
function box(w,h,d,material,x=0,y=0,z=0,parent){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function cylinder(rt,rb,h,material,x,y,z,parent){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,10),material);m.position.set(x,y,z);parent.add(m);return m;}
function bodyGeometry(){const rows=[[-3.5,1.25,1.0,1.25],[-2.9,1.47,1.15,1.35],[1.4,1.47,1.15,1.35],[2.35,1.25,.98,1.23],[3.4,.85,.7,1.0],[4.5,.18,.25,.64]],v=[],idx=[],steps=16;for(const [x,w,h,cy]of rows)for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2;v.push(x,cy+Math.sin(a)*h,Math.cos(a)*w);}for(let row=0;row<rows.length-1;row++)for(let i=0;i<steps;i++){const a=row*steps+i,b=row*steps+(i+1)%steps,c=a+steps,d=b+steps;idx.push(a,c,b,b,c,d);}for(let i=1;i<steps-1;i++){idx.push(0,i,i+1);const o=(rows.length-1)*steps;idx.push(o,o+i+1,o+i);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;}
const trainBodyGeometry=bodyGeometry(),wheelGeometry=new THREE.CylinderGeometry(.45,.45,.18,12),windGeometry=new THREE.BufferGeometry();windGeometry.setAttribute('position',new THREE.Float32BufferAttribute([1.8,2.25,-.85,1.8,2.25,.85,3.25,1.53,-.58,3.25,1.53,.58],3));windGeometry.setIndex([0,1,2,1,3,2]);windGeometry.computeVertexNormals();const headlightMat=emissive(0xe7fcff,4);const glass=new THREE.MeshStandardMaterial({color:0x0b2d46,metalness:.8,roughness:.15,side:THREE.DoubleSide});

function makeCar(target,head){
 const g=new THREE.Group(),body=new THREE.Mesh(trainBodyGeometry,whiteMat);body.scale.set(head?1.16:1.02,1.28,1.18);body.castShadow=true;body.userData.trainBody=true;g.add(body);
 const windshield=new THREE.Mesh(windGeometry,glass);windshield.scale.copy(body.scale);g.add(windshield);
 for(const side of [-1,1]){
  box(5.4,.55,.07,glass,-.65,2.15,side*1.68,g);box(6.5,.24,.10,limeMat,-.65,1.15,side*1.73,g);
  box(5.5,.6,.2,armorMat,-.8,.62,side*1.64,g);
  for(const x of [-2.4,1.9]){const wheel=new THREE.Mesh(wheelGeometry,darkMat);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.25,side*1.35);g.add(wheel);}
  box(1.35,.17,.18,headlightMat,3.18,1.2,side*.8,g);
  const fin=box(2.8,.11,.68,armorMat,-1,2.95,side*1.05,g);fin.rotation.x=side*.2;
 }
 // A broad armored nose and roof spine distinguish the heavy green variant.
 box(2.0,.32,1.7,armorMat,3.25,.54,0,g);box(3.6,.18,.65,limeMat,-.8,2.98,0,g);
 if(!head){for(const z of [-.97,.97]){const nozzle=cylinder(.62,.69,1.6,armorMat,-3.25,1.5,z,g);nozzle.rotation.z=Math.PI/2;const rim=new THREE.Mesh(new THREE.TorusGeometry(.6,.11,6,20),limeMat);rim.rotation.y=Math.PI/2;rim.position.set(-4.08,1.5,z);g.add(rim);}}
 return g;
}

const group=new THREE.Group(),cars=[makeCar("G01",true),makeCar("G01",false)];
group.add(...cars);return {group,cars};
};
