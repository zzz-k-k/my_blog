varying vec3 vWorld;
varying vec3 vNormal;
uniform float uIsGround;
uniform vec3 uObjectColor;
void main() {
  vec3 color = uIsGround > 0.5 ? patchColor(vWorld.xz) : uObjectColor;
  gl_FragColor = vec4(shadowLighting(color,vNormal,vWorld,vWorld,0.0),1.0);
  #include <colorspace_fragment>
}
