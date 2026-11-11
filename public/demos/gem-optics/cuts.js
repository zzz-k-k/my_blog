import { BufferGeometry, Float32BufferAttribute, Vector3, Vector4 } from '../pixel-grass/vendor/three.module.js';

// BEGIN outline
function cutVertices(emerald) {
  const points = [];
  if (emerald) {
    const outline = [[.78,.54],[.55,.77],[-.55,.77],[-.78,.54],
                     [-.78,-.54],[-.55,-.77],[.55,-.77],[.78,-.54]];
    // Radius and height of each step, from the table to the keel.
    for (const [radius,y] of [[.64,.46],[.85,.32],[1,.09],[1,.02],[.83,-.26],[.55,-.53],[.20,-.72]]) {
      for (const [x,z] of outline) points.push(new Vector3(x*radius, y, z*radius*1.48));
    }
  } else {
    for (const [count,radius,y,offset] of [[8,.57,.46,.5],[8,.81,.32,0],[16,1,.06,0],[8,.58,-.32,.5]]) {
      for (let i = 0; i < count; i++) {
        const angle = (i + offset) * 2 * Math.PI / count;
        points.push(new Vector3(radius*Math.cos(angle), y, radius*Math.sin(angle)));
      }
    }
    points.push(new Vector3(0,-.83,0));
  }
  return points;
}
// END outline

// Each supporting plane of the convex point set bounds one optical facet.
export function buildCut(emerald) {
  const points = cutVertices(emerald), tolerance = 1e-5;
  const planes = [], positions = [], normals = [];
  const edge = new Vector3(), normal = new Vector3();
  for (let a = 0; a < points.length; a++) {
    for (let b = a+1; b < points.length; b++) {
      edge.subVectors(points[b], points[a]);
      for (let c = b+1; c < points.length; c++) {
        normal.subVectors(points[c], points[a]).cross(edge);
        if (normal.lengthSq() < tolerance*tolerance) continue;
        normal.normalize();
        let height = normal.dot(points[a]);
        if (height < 0) { normal.negate(); height = -height; }
        if (points.some(p => normal.dot(p) > height+tolerance)) continue;
        if (planes.some(p => Math.abs(p.w-height)<tolerance &&
            Math.abs(p.x-normal.x)+Math.abs(p.y-normal.y)+Math.abs(p.z-normal.z)<tolerance)) continue;
        planes.push(new Vector4(normal.x,normal.y,normal.z,height));
        const face = points.filter(p => Math.abs(normal.dot(p)-height)<tolerance);
        const center = new Vector3();
        for (const p of face) center.add(p);
        center.divideScalar(face.length);
        const x = face[0].clone().sub(center).normalize(), y = normal.clone().cross(x);
        const angle = p => Math.atan2(p.dot(y)-center.dot(y),p.dot(x)-center.dot(x));
        face.sort((left,right) => angle(left)-angle(right));
        for (let i=1; i<face.length-1; i++) {
          for (const p of [face[0],face[i],face[i+1]]) {
            positions.push(p.x,p.y,p.z);
            normals.push(normal.x,normal.y,normal.z);
          }
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
  return { geometry, planes };
}
