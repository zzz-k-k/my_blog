varying vec3 vWorld;
void main() {
  // BEGIN ground
  vec3 color = vec3(0.44,0.62,0.16);
  if (uStage >= 3.0) color = patchColor(vWorld.xz);
  color = shadeGrass(color,vec3(0.0,1.0,0.0),vWorld,0.0);
  gl_FragColor = vec4(debugColor(vWorld,color),1.0);
  // END ground
}
