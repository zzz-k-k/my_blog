uniform sampler2D uLeaf;
uniform sampler2D uAccent;
varying vec2 vUv;
varying vec3 vRoot;
varying vec3 vNormal;
varying float vWind;
varying float vPushForward;
varying float vAccent;
void main() {
  // BEGIN perspective
  vec2 leafUV = vUv;
  if (uStage >= 5.0) {
    vec2 windDirection = normalize(vec2(0.6, 1.0));
    float facing = dot(normalize(uCamForward.xz), windDirection);
    float taper = vWind * 0.3 * facing;
    if (uStage >= 7.0) taper -= vPushForward;
    // In this mesh UV.y=1 is the blade tip; Godot's original UV has opposite Y.
    leafUV.x = (leafUV.x - 0.5) * (1.0 + leafUV.y * taper) + 0.5;
  }
  // Discard outside the sprite so the edge cannot wrap to the next tile.
  if (leafUV.x < 0.0 || leafUV.x > 1.0) discard;
  // END perspective
  // BEGIN leaf-color
  vec4 leaf = texture2D(uLeaf, leafUV);
  if (vAccent > 1.5) leaf = texture2D(uAccent, leafUV);
  if (leaf.a < 0.99) discard; // Crisp silhouette, no translucent rectangles.
  vec3 color = vec3(0.44,0.62,0.16);
  if (uStage >= 3.0) color = patchColor(vRoot.xz);
  if (vAccent > 0.5) color = vAccent > 1.5 ? vec3(0.33,0.49,0.13) : vec3(0.67,0.76,0.31);
  // Original sprites contain tonal detail as well as the alpha silhouette.
  color *= leaf.rgb;
  color = shadeGrass(color, vNormal, vRoot, 1.0);
  gl_FragColor = vec4(debugColor(vRoot,color),1.0);
  // END leaf-color
}
