uniform sampler2D sceneImage, brightImage;
uniform vec2 texel;
uniform float sparkle;
uniform bool antialias;
varying vec2 coord;
vec3 unpackLight(vec2 uv) {
  vec3 encoded = texture2D(sceneImage,uv).rgb;
  return 8.0*encoded*encoded;
}
float luma(vec3 rgb) { return dot(rgb,vec3(.2126,.7152,.0722)); }
vec3 base(vec2 uv) {
  vec4 sampleColor = texture2D(sceneImage,uv);
  vec2 centered = vec2(fract(uv.x*2.0)-.5,uv.y-.5);
  vec3 background = mix(vec3(.012,.019,.025),vec3(.046,.065,.078),
                        exp(-6.0*dot(centered,centered)));
  return 8.0*sampleColor.rgb*sampleColor.rgb + (1.0-sampleColor.a)*background;
}
// BEGIN fxaa
vec3 smoothEdge(vec2 uv) {
  vec3 center = base(uv);
  float nw=luma(base(uv+texel*vec2(-1,1))), ne=luma(base(uv+texel));
  float sw=luma(base(uv-texel)), se=luma(base(uv+texel*vec2(1,-1)));
  float low=min(min(nw,ne),min(sw,se)), high=max(max(nw,ne),max(sw,se));
  if (high-low < max(.035,.12*high)) return center;
  vec2 tangent = vec2(sw+se-nw-ne,nw+sw-ne-se);
  tangent /= max(max(abs(tangent.x),abs(tangent.y)),.001);
  return .5*center + .25*(base(uv+.75*texel*tangent)+base(uv-.75*texel*tangent));
}
// END fxaa
// BEGIN sparkle
vec3 star(vec2 uv) {
  vec3 sum = vec3(0.0);
  for (int i=-8; i<=8; i++) {
    float k = float(i), weight = exp(-abs(k)*.32);
    vec2 stepUV = 2.4*k*texel;
    sum += weight * (texture2D(brightImage,uv+stepUV*vec2(.94,.34)).rgb
                   + texture2D(brightImage,uv+stepUV*vec2(-.34,.94)).rgb);
  }
  return sum * (6.0/12.65);
}
// END sparkle
void main() {
#ifdef EXTRACT_HIGHLIGHTS
  // BEGIN threshold
  vec3 light = .25*(unpackLight(coord+.5*texel)+unpackLight(coord-.5*texel)
                  + unpackLight(coord+.5*texel*vec2(-1,1))+unpackLight(coord+.5*texel*vec2(1,-1)));
  float intensity = luma(light);
  gl_FragColor = vec4(light * max(0.0,intensity-1.05)/max(intensity,.001)/6.0,1.0);
  // END threshold
#else
  vec3 color = antialias ? smoothEdge(coord) : base(coord);
  if (sparkle > 0.0) color += sparkle*star(coord);
  color = color / (1.0+color);
  gl_FragColor = vec4(pow(color,vec3(1.0/2.2)),1.0);
#endif
}
