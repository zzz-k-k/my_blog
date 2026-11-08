// Adapted from Dylearn's Grass/Floor/clouds shaders (MIT), see DYLEARN-LICENSE.txt.
uniform float uTime;
uniform float uStage;
uniform float uWindSpeed;
uniform float uCloudSpeed;
uniform float uFps;
uniform float uRadius;
uniform float uCuts;
uniform float uDebug;
uniform vec3 uActor;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform sampler2D uPatchA;
uniform sampler2D uPatchB;
uniform sampler2D uWind;
uniform sampler2D uCloud;
const float PI = 3.14159265359;
vec2 rotate2(vec2 v, float a) { return mat2(cos(a), sin(a), -sin(a), cos(a)) * v; }
vec3 rotateAxis(vec3 v, vec3 axis, float a) {
  axis = normalize(axis);
  return v*cos(a) + cross(axis,v)*sin(a) + axis*dot(axis,v)*(1.0-cos(a));
}
// BEGIN patches
vec3 patchColor(vec2 worldXZ) {
  // Same world-space field on ground and blades; blades sample only at their root.
  float a = texture2D(uPatchA, worldXZ * 0.12).r;
  float b = texture2D(uPatchB, worldXZ * 0.10).r;
  vec3 color = vec3(0.44, 0.62, 0.16);
  if (a > 0.52) color = vec3(0.57, 0.69, 0.27);
  if (b > 0.57) color = vec3(0.35, 0.53, 0.17);
  return color; // B overrides A where the two masks overlap.
}
// END patches
// BEGIN wind
float windAt(vec2 rootXZ, float time) {
  vec2 direction = normalize(vec2(0.6, 1.0));
  vec2 d1 = rotate2(direction, 0.174533);
  vec2 d2 = rotate2(direction, -0.174533);
  float a = texture2D(uWind, rootXZ * 0.11 + d1 * time * 0.025 * uWindSpeed).r;
  float b = texture2D(uWind, rootXZ * 0.11 * 0.8 + d2 * time * 0.025 * uWindSpeed * 0.89 * PI / 3.0).r;
  return (clamp(a * b + 0.365, 0.0, 1.0) - 0.5) * 2.0;
}
// END wind
// BEGIN clouds
float cloudAt(vec3 worldPosition) {
  vec3 lightDirection = normalize(vec3(-0.5, 0.85, 0.3));
  float t = (8.0 - worldPosition.y) / max(lightDirection.y, 0.001);
  vec2 hit = (worldPosition + t * lightDirection).xz;
  vec2 direction = normalize(vec2(-0.3, 1.0));
  vec2 d1 = rotate2(direction, 0.349066), d2 = rotate2(direction, -0.349066);
  float a = texture2D(uCloud, hit / 12.0 + d1 * uTime * 0.018 * uCloudSpeed).r;
  float b = texture2D(uCloud, hit / 12.0 * 0.8 + d2 * uTime * 0.018 * uCloudSpeed * 0.89 * PI / 3.0).r;
  float lightValue = clamp(a * b + 0.27, 0.0, 1.0);
  return clamp((lightValue - 0.5) * 3.845 + 0.5 + 0.27, 0.2, 1.0);
}
// END clouds
// BEGIN lighting
vec3 shadeGrass(vec3 color, vec3 normal, vec3 root, float isBlade) {
  if (uStage < 8.0) return color;
  vec3 lightDirection = normalize(vec3(-0.5, 0.85, 0.3));
  float diffuse = clamp(dot(normalize(normal), lightDirection), 0.0, 1.0);
  if (uStage >= 9.0) diffuse = min(diffuse, cloudAt(root));
  float stepSize = 1.0 / uCuts;
  float level = ceil(diffuse * uCuts) * stepSize;
  // Ground keeps hard bands. Blades blend over a narrow region at each boundary.
  if (isBlade > 0.5) {
    float boundary = floor(diffuse / stepSize + 0.5) * stepSize;
    float halfWidth = stepSize * 0.255 * 0.5;
    level = mix(boundary, min(1.0, boundary + stepSize),
      smoothstep(boundary-halfWidth, boundary+halfWidth, diffuse));
  }
  // Web adaptation: small ambient term keeps the darkest band readable.
  return color * (0.35 + 0.65 * clamp(level, 0.0, 1.0));
}
// END lighting
vec3 debugColor(vec3 root, vec3 color) {
  if (uDebug == 1.0 && uStage >= 3.0) return vec3(texture2D(uPatchA, root.xz*0.12).r);
  if (uDebug == 2.0 && uStage >= 4.0) return vec3(windAt(root.xz,uTime)*0.5+0.5);
  if (uDebug == 3.0 && uStage >= 9.0) return vec3(cloudAt(root));
  return color;
}
