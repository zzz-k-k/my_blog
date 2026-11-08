attribute vec3 aRoot;
attribute float aSeed;
attribute float aScale;
varying vec2 vUv;
varying vec3 vRoot;
varying vec3 vNormal;
varying float vWind;
varying float vPushForward;
varying float vAccent;
void main() {
  vUv = uv; vRoot = aRoot;
  vAccent = aSeed > 0.985 ? 2.0 : (aSeed > 0.94 ? 1.0 : 0.0);
  // BEGIN stepped-time
  float time = uTime;
  if (uStage >= 6.0) {
    float phase = aSeed / uFps;
    time = floor((uTime + phase) * uFps + 0.5) / uFps;
  }
  // END stepped-time
  // BEGIN billboard
  // Plane vertices start at the bottom edge: y is 0..1, not centered around zero.
  float height = aScale * (vAccent > 0.5 ? 1.25 : 1.0);
  vec3 local = vec3(position.x * height * 0.65, position.y * height, 0.0);
  // A small camera-space sway remains independent of the world-space wind.
  if (uStage >= 4.0) {
    float angle = sin((time + aSeed * 10.0) * 0.1 * 2.0 * PI) * radians(10.0);
    local.xy = rotate2(local.xy, angle);
  }
  vec3 offset = uCamRight * local.x + uCamUp * local.y;
  vec3 normal = vec3(0.0, 1.0, 0.0);
  // END billboard
  // BEGIN displacement
  vPushForward = 0.0;
  if (uStage >= 7.0) {
    vec2 delta = aRoot.xz - uActor.xz;
    float distanceToActor = length(delta);
    float strength = pow(max(0.0, 1.0 - distanceToActor / max(uRadius,0.01)), 0.9);
    vec2 direction = delta / max(distanceToActor, 0.0001);
    vec3 forward = normalize(vec3(uCamForward.x, 0.0, uCamForward.z));
    float side = dot(vec3(direction.x,0.0,direction.y),uCamRight) * strength;
    float front = dot(vec3(direction.x,0.0,direction.y),forward) * strength;
    offset = rotateAxis(offset, uCamForward, -side * radians(60.0));
    offset = rotateAxis(offset, uCamRight, front * radians(62.7));
    normal = rotateAxis(normal, uCamRight, front * 0.3);
    vPushForward = front;
  }
  // END displacement
  // BEGIN world-rotation
  vWind = windAt(aRoot.xz, time);
  if (uStage >= 4.0) {
    vec3 windDirection = normalize(vec3(0.6, 0.0, 1.0));
    vec3 axis = normalize(cross(vec3(0.0,1.0,0.0), windDirection));
    float angle = vWind * radians(60.0);
    offset = rotateAxis(offset, axis, angle);
    normal = rotateAxis(normal, axis, angle * 0.6);
  }
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(aRoot + offset, 1.0);
  // END world-rotation
}
