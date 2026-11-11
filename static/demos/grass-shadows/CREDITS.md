# Grass shadow tutorial

This local browser tutorial reuses the preceding pixel-grass demo's Three.js 0.180.0, deterministic noise generator, fixed instance distribution and unmodified grass textures. See ../pixel-grass/CREDITS.md and ../pixel-grass/DYLEARN-LICENSE.txt for Dylearn attribution and licenses; Three.js MIT text is in ../pixel-grass/vendor/THREE-LICENSE.txt.

Grass assets by Dylearn: grassleaf.png and accentleaf.png (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/). Source: https://github.com/DylearnDev/Dylearn-3D-Pixel-Art-Grass-Demo . No Waterfowl branding or logo assets are used.

The supplied gameplay_prototype Godot grass shader and common include inform the animated receiving position, bandedDiffuse function, and post-banding shadow attenuation. This WebGL adaptation uses an explicit orthographic depth pass, a nine-tap PCF comparison, controllable sun/environment light, and a linear-light output pipeline. It does not reproduce Godot's full renderer. Root-only shadow lookup is intentionally retained as a labeled teaching counterexample.

Cubes and sphere use procedural geometry. Ground and grass receive but do not cast shadows. Cloud noise modulates direct lighting separately from object occlusion. The previous pixel-grass article and its shaders are unchanged.
