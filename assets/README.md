# Deadfall art provenance

All terrain textures, isometric furniture, walls, cars, trees, fallback infected figures, visual effects and lighting are original Canvas 2D drawing code in `render/`. They are generated locally; the game never loads assets from a CDN or image service.

`survivor/face-0.png` through `face-7.png` are the eight survivor views embedded in the user-supplied `/workspace/references/sprite-lighting.html`. They were extracted without modification for this project, as authorized in the project contract. The source facings are SE, SW, NW, NE, S, N, E, W. The renderer also derives cached desaturated, gray-green and bloodied infected variants from these views at runtime, retaining the same human proportions. No commercial game assets are included.

The three user reference images informed the warm lamp lighting, worn timber, muted olive palette, boarded windows, and cutaway interior composition. They are not embedded as game backgrounds.
