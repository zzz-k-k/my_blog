# Sources and changes

- Grass shader algorithms adapted from Dylearn, https://github.com/DylearnDev/Dylearn-3D-Pixel-Art-Grass-Demo . Code: MIT, copyright (c) 2026 Dylearn. Full supplied license: DYLEARN-LICENSE.txt.
- Grass assets by Dylearn: textures/grassleaf.png and textures/accentleaf.png, unmodified. CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . No Waterfowl logo or branding assets are included.
- This educational browser adaptation changes shader APIs, instance distribution, sprite pivot, accent frequency, noise generator, lighting normal, ambient light and the character path. It is not a pixel-identical Godot port.
- Four noise fields are generated locally by noise.js using deterministic periodic value noise, not Godot FastNoiseLite. The preview images show the exact data uploaded to the GPU.
- Three.js 0.180.0, MIT; local unmodified ES modules downloaded from the npm package. See vendor/THREE-LICENSE.txt.
- The article's code panels read marked regions from the actual source files at Hugo build time.
