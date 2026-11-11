// Shadow reception for the teaching scene. Diffuse banding follows the supplied Godot implementation.
uniform sampler2D uShadowDepth;
uniform mat4 uLightMatrix;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uAmbientColor;
uniform float uSunEnergy;
uniform float uAmbientEnergy;
uniform float uShadowStage;
uniform float uBias;
uniform float uFilterRadius;
uniform float uMapSize;
uniform float uCloudEnabled;
uniform float uMaskView;
uniform float uBanded;
uniform float uRootLookup;
// BEGIN depth-compare
float visibilityAt(vec3 worldPosition) {
  vec4 projected = uLightMatrix * vec4(worldPosition, 1.0);
  vec3 uvDepth = projected.xyz / projected.w;
  // Outside the sun camera's coverage: no occluder recorded.
  if (any(lessThan(uvDepth, vec3(0.0))) || any(greaterThan(uvDepth, vec3(1.0)))) return 1.0;
  float receiverDepth = uvDepth.z - uBias;
  // PCF samples adjacent UVs: predict the receiving plane's depth there too.
  // Without this slope correction, a cube can incorrectly shadow its own slanted face.
  vec3 dx = dFdx(uvDepth), dy = dFdy(uvDepth);
  float determinant = dx.x * dy.y - dx.y * dy.x;
  vec2 depthSlope = vec2(0.0);
  if (abs(determinant) > 0.00000001) {
    depthSlope = vec2(dx.z * dy.y - dy.z * dx.y, dy.z * dx.x - dx.z * dy.x) / determinant;
  }
  float lit = 0.0;
  // PCF averages nine binary visibility tests, NOT nine depth values.
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 offset = vec2(float(x), float(y)) * uFilterRadius / uMapSize;
    float blockerDepth = texture2D(uShadowDepth, uvDepth.xy + offset).r;
    lit += step(receiverDepth + dot(depthSlope, offset), blockerDepth);
  }
  return lit / 9.0;
}
// END depth-compare
// BEGIN bands
float bandedDiffuse(float diffuse) {
  float bands = max(uCuts, 1.0);
  float value = clamp(diffuse, 0.0, 1.0) * bands;
  float boundary = floor(value);
  float blend = smoothstep(0.0, 0.255, value - boundary);
  return clamp((boundary + blend) / bands, 0.0, 1.0);
}
// END bands
// BEGIN cloud-light
float cloudAtSun(vec3 worldPosition) {
  // Same two-layer cloud recipe as the previous article, aligned with the current sun.
  float t = (8.0 - worldPosition.y) / max(uSunDirection.y, 0.001);
  vec2 uv = (worldPosition + t * uSunDirection).xz / 12.0;
  vec2 direction = normalize(vec2(-0.3, 1.0));
  float a = texture2D(uCloud, uv + rotate2(direction, 0.349066) * uTime * 0.018).r;
  float b = texture2D(uCloud, uv * 0.8 + rotate2(direction, -0.349066) * uTime * 0.018 * 0.89 * PI / 3.0).r;
  float sampleValue = clamp(a * b + 0.27, 0.0, 1.0);
  return clamp((sampleValue - 0.5) * 3.845 + 0.5 + 0.27, 0.2, 1.0);
}
// END cloud-light
vec3 decodeSRGB(vec3 color) {
  return mix(color / 12.92, pow((color + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), color));
}
vec3 shadowLighting(vec3 color, vec3 normal, vec3 worldPosition, vec3 root, float isGrass) {
  // BEGIN receiver-position
  // Stage 3 deliberately demonstrates the root-only approximation.
  vec3 receiverPosition = worldPosition;
  if (isGrass > 0.5 && (uShadowStage < 4.0 || uRootLookup > 0.5)) receiverPosition = root;
  float visibility = 1.0;
  bool receivesShadow = uShadowStage >= 2.0 && (isGrass < 0.5 || uShadowStage >= 3.0);
  if (receivesShadow) visibility = visibilityAt(receiverPosition);
  // END receiver-position
  if (uMaskView > 0.5) return vec3(visibility); // Inspection view, intentionally not lighted.
  // BEGIN composition
  float diffuse = max(dot(normalize(normal), uSunDirection), 0.0);
  if (uShadowStage >= 5.0 && uBanded > 0.5) diffuse = bandedDiffuse(diffuse);
  float cloud = (uShadowStage >= 7.0 && uCloudEnabled > 0.5) ? cloudAtSun(worldPosition) : 1.0;
  vec3 directLight = uSunColor * uSunEnergy * diffuse * visibility * cloud;
  vec3 ambientLight = uShadowStage >= 6.0 ? uAmbientColor * uAmbientEnergy : vec3(0.0);
  // No emissive term and no constant brightness floor. Both lights off => black.
  return decodeSRGB(color) * (directLight + ambientLight);
  // END composition
}
