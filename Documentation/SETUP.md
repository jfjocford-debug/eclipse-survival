# Project setup and architecture

## Pinned environment

- Unity 6000.3.12f1, revision fca03ac9b0d5 (Unity 6.3 LTS).
- Universal Render Pipeline 17.3.0, Input System 1.17.0, uGUI 2.0.0, Unity Test Framework 1.4.6.
- C# core has no Unity dependency. Runtime targets Unity's .NET Standard API surface.
- Built-in module dependencies are explicit in `Packages/manifest.json`. Unity resolves transitive packages on first import. A generated package lock is not fabricated or included.

## Folder map

| Folder under Assets/Eclipse | Purpose |
|---|---|
| Core | Allocation-conscious gameplay simulation, seeded world, inventory, AI, cycle |
| Scripts/Managers | Scene lifecycle, fixed simulation step, saved options |
| Scripts/Input | New Input System keyboard/mouse adapter, joystick and gestures |
| Scripts/Systems | Config, projection helpers, audio routing |
| Scripts/Presentation | Tilemap, sprites, combat effects, camera, HUD |
| Art/Characters | Supplied hero/Apostle, generated atlas and animation assets |
| Art/Tilesets, Art/Props, Art/UI | Reserved for authored replacements |
| Resources/Generated | Generated point-filtered tiles, NPC sprites and props used at runtime |
| Audio/SFX, Ambience, Eclipse | Generated mono WAV placeholders and mixer routing |
| Scenes/MainMenu, GameScene, TestScene | Included root scenes; runtime constructs the hierarchy |
| Prefabs/Player, Enemies, Props, UI | Generated prefabs used by runtime factories |
| Resources/Config | Input actions plus generated config, renderer and materials |
| ScriptableObjects | Reserved for additional authored data assets |
| Editor | Idempotent asset setup and build commands |
| Tests/EditMode, Tests/PlayMode | Unity-specific checks awaiting licensed Editor execution |

## First-open asset setup

`ProjectSetup.Ensure` runs once after compilation in the interactive Editor. Batch commands call it explicitly. It preserves existing generated prefabs/scenes/materials and writes `ProjectSettings/EclipseSetup.version` only after all setup steps finish. Existing authored scene contents are not replaced. Platform defaults are applied on initial setup only; after that, change bundle identifiers and signing settings normally.

The current AudioMixer creation API is internal to Unity. A small, editor-only reflection adapter uses the installed Unity mixer factory, creates SFX/Ambience/Eclipse children under Master, and saves a normal editable `.mixer`. It fails with a specific message if Unity changes that factory. Use the pinned editor version. This adapter has been checked against shipped metadata, but not executed in an activated Editor.

Assets/Eclipse/Resources/Config/SurvivalConfig controls cycle lengths, joystick deadzone, heavy hold threshold, safe margin, minimum render scale, pixel reference size, reduced motion, art, audio, and prefab references. Default layout targets: 150px joystick, 112px attack, 96px dodge/use, 80px inventory slots, 12–16px gaps, 18px minimum main HUD text at a 390px-high reference viewport. The touch dimensions are configurable; verify spacing on your target phone if increasing them beyond the defaults. Safe-area insets plus 8% padding are applied. The inventory scrolls horizontally on narrow screens.

## Runtime

`GameController` advances the pure core at 60 Hz, capped at 0.1 seconds of catch-up per frame. Focus loss, backgrounding and portrait orientation pause simulation and release movement input. Resuming requires explicit input. Scene-owned child objects contain cameras, world, audio and HUD; unloading a scene clears the static collision probe.

`Iso` maps logical tiles to `(x−y, −(x+y)/2)`. Movement conversion preserves analog magnitude for every direction. A Unity Isometric Grid uses cell size `(2,1,1)` and an inverted Y axis. The street is 10×10 tiles; five separate 6×6 interiors reuse the same tilemap. Static authored core geometry and Physics2D overlap probes both reject solid movement. WorldSolid is layer 8. The player has a kinematic Rigidbody2D and a trigger collider; the core resolves actor movement/contact, not Unity rigid-body forces.

The three scenes contain a boot component; their world and HUD are assembled at runtime. MainMenu offers standard/quick cycles. TestScene forces touch input for Editor checks. It is excluded from shipping build scenes.

## Camera and rendering

The base orthographic camera follows through a small deadzone. Combat multiplies size by 1.18; interiors by 0.88; Eclipse by 1.06. Factors compound. A stacked overlay camera renders a Screen Space–Camera canvas. Health is upper left, inventory upper right, timer bottom center, actions on the right, joystick on the left. Interaction prompts track the survivor.

URP PixelPerfectCamera supplies sprite snapping. Default smooth zoom deliberately uses a smoothly changing lens; it is **not strict integer pixel-perfect scaling at every zoom**. Set `strictPixelPerfectZoom` to use Unity's integer lens correction, accepting coarse/absent small zoom changes on low resolution screens. Camera shake can be disabled by reduced motion.

Sprites/tiles use a shared unlit URP material: shading and building shadows are drawn into art, with no realtime lights. The four characters share a generated SpriteAtlas. The map reuses Tile objects and rebuilds only on area/cycle changes. Combat effects use 16 preallocated LineRenderers. Fog is one analytic fullscreen UI pass with two sine bands, darkness and a red tint; there is no volumetric fog or depth dependency. No NPC Animator instances are created; only the player gets the placeholder controller.

Mobile resolution adapts from 1.0 down to 0.8 in 0.05 steps, based on a smoothed frame-time sample every two seconds. Vulkan/Metal use ScalableBufferManager; other backends use URP renderScale. Actual support and UI scaling behavior require device verification. No measured phone FPS, power or memory claim is made.

## Extending the project

Replace the four directional clips with real sprites, add doors/vaultable obstacles, and supply authored props/tiles. Preserve bottom-center sprite pivots and point filtering. The root adapter owns `Simulation.CollisionProbe`; true means blocked. See CORE.md before adding separate physics worlds or multiple game roots.

## Official references

- [Pinned Unity Editor release](https://unity.com/releases/editor/whats-new/6000.3.12f1)
- [Unity Hub license activation](https://docs.unity.com/en-us/hub/manage-license)
- [Input System touch input](https://docs.unity3d.com/Packages/com.unity.inputsystem@1.14/manual/Touch.html)
- [URP PixelPerfectCamera implementation for Unity 6.3](https://github.com/Unity-Technologies/Graphics/blob/6000.3/staging/Packages/com.unity.render-pipelines.universal/Runtime/2D/PixelPerfectCamera.cs)
