uniform vec4 facets[FACET_COUNT];
uniform int stage, bounceLimit;
uniform float ior, lampAngle, dispersion;
uniform vec3 absorption, localEye;
uniform mat3 objectRotation;
varying vec3 facePosition, faceNormal;

// BEGIN studio
vec3 studio(vec3 direction) {
  vec3 d = objectRotation * direction;
  float c = cos(lampAngle), s = sin(lampAngle);
  d.xz = mat2(c,-s,s,c) * d.xz;
  float ceiling = smoothstep(-.2,.95,d.y);
  float band = (1.0-smoothstep(.08,.18,abs(d.y-.44))) * smoothstep(-.5,.15,d.x);
  float panel = smoothstep(.72,.84,d.z) * (1.0-smoothstep(.25,.42,abs(d.x+.11)));
  float strip = (1.0-smoothstep(.04,.11,abs(d.x-.28))) * smoothstep(.05,.35,-d.z);
  return vec3(.026 + .24*ceiling + 3.6*band + 5.0*panel + 3.0*strip);
}
// END studio

// BEGIN fresnel
float fresnel(vec3 incident, vec3 normal, float ratio) {
  float cosIn = clamp(-dot(incident,normal),0.0,1.0);
  float sinOut2 = ratio*ratio*(1.0-cosIn*cosIn);
  if (sinOut2 >= 1.0) return 1.0;
  float cosOut = sqrt(1.0-sinOut2);
  float rs = (ratio*cosIn-cosOut) / max(ratio*cosIn+cosOut,.00001);
  float rp = (cosIn-ratio*cosOut) / max(cosIn+ratio*cosOut,.00001);
  return .5*(rs*rs+rp*rp);
}
// END fresnel

// BEGIN intersect
float nextFacet(vec3 origin, vec3 direction, out vec3 normal) {
  float closest = 1e5;
  normal = vec3(0.0);
  for (int i=0; i<FACET_COUNT; i++) {
    vec4 plane = facets[i];
    float approach = dot(direction,plane.xyz);
    if (approach <= .00001) continue;
    float t = (plane.w-dot(origin,plane.xyz))/approach;
    if (t > .00001 && t < closest) { closest=t; normal=plane.xyz; }
  }
  return closest;
}
// END intersect

vec3 traceGem(vec3 incident, vec3 normal, float n) {
  // BEGIN entry
  float surfaceShare = fresnel(incident,normal,1.0/n);
  vec3 result = surfaceShare * studio(reflect(incident,normal));
  vec3 weight = vec3(1.0-surfaceShare);
  vec3 dir = refract(incident,normal,1.0/n);
  vec3 origin = facePosition + .0001*dir;
  // END entry
  for (int i=0; i<12; i++) {
    if (i >= bounceLimit || (stage == 4 && i > 0)) break;
    vec3 outward;
    float distanceToFace = nextFacet(origin,dir,outward);
    if (distanceToFace > 1e4) break;
    // BEGIN beer
    if (stage >= 6) weight *= exp(-absorption*distanceToFace);
    // END beer
    // BEGIN split
    vec3 hit = origin + distanceToFace*dir;
    vec3 exitDir = refract(dir,-outward,n);
    if (dot(exitDir,exitDir) > 0.0) {
      float reflected = fresnel(dir,-outward,n);
      result += weight * (1.0-reflected) * studio(exitDir);
      weight *= reflected;
    }
    // Total internal reflection has no exit contribution and retains all weight.
    dir = reflect(dir,-outward);
    origin = hit + .0001*dir;
    if (max(max(weight.r,weight.g),weight.b)<.001) break;
    // END split
  }
  return result;
}
void main() {
  vec3 normal = normalize(faceNormal);
  vec3 incident = normalize(facePosition-localEye);
  // BEGIN diffuse-light
  vec3 worldNormal = objectRotation*normal;
  vec3 lamp = normalize(vec3(cos(lampAngle),1.1,sin(lampAngle)));
  vec3 diffuse = vec3(.12+.6*max(dot(worldNormal,lamp),0.0));
  // END diffuse-light
  vec3 color;
  if (stage == 1) color = vec3(.28+.13*dot(normal,normalize(vec3(.4,1.0,.2))));
  else if (stage == 2) color = diffuse;
  else if (stage == 3) {
    // BEGIN coat
    float share = fresnel(incident,normal,1.0/ior);
    color = mix(diffuse,studio(reflect(incident,normal)),share);
    // END coat
  }
  // BEGIN rgb
  else if (stage >= 7 && dispersion > 0.0) {
    color.r = traceGem(incident,normal,ior-dispersion).r;
    color.g = traceGem(incident,normal,ior).g;
    color.b = traceGem(incident,normal,ior+dispersion).b;
  } else color = traceGem(incident,normal,ior);
  // END rgb
  // Store linear intensity up to 8 in an ordinary 8-bit offscreen texture.
  gl_FragColor = vec4(sqrt(clamp(color/8.0,0.0,1.0)),1.0);
}
