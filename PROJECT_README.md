# Eclipse Survival — Unity mobile prototype

Unity **6000.3.12f1 LTS**, URP 17.3, New Input System. Android first, iOS next, desktop afterward. This is a Unity C# port of the Eclipse Survival browser prototype, with an editor setup pipeline and mobile controls.

**Delivery status:** source project, three boot scenes, original character assets, project settings, setup/build scripts, and tests. The pure gameplay core passed **27/27** scenarios. Runtime/editor code also passed a separate C# reference compilation. **Unity Editor import, asset generation, Play Mode, GPU rendering, and APK builds have not been validated:** the installed editor stopped with “No valid Unity Editor license found.” No APK or TestFlight build is included.

## Open and play

1. In Unity Hub, activate an eligible Unity license and install **6000.3.12f1** with **Android Build Support**, its SDK/NDK tools, and OpenJDK.
2. Extract this archive. Add the folder containing `Assets`, `Packages`, and `ProjectSettings` in Unity Hub.
3. Open it and let package resolution finish. Setup runs after scripts compile. If needed, choose **Eclipse → Set up project assets**. Wait for “Eclipse setup complete” in the Console.
4. Open `Assets/Eclipse/Scenes/MainMenu/MainMenu.unity` and press **Play**. Choose Start survival. `TestScene` forces touch controls and a 35s/25s cycle; normal play uses 150s/90s.
5. Choose **Eclipse → Build → Android test APK**. Output: `Builds/Android/EclipseSurvival.apk`.

The setup creates editable prefabs, a four-character atlas, an unlit 2D URP pipeline, a configuration asset, a camera fog material, an audio mixer with three groups, generated ambient/combat clips, and directional animation slots. These generated assets are intentionally created by Unity on first open; they are not pre-generated in this archive.

## Play

Collect tools in the workshop, return to the safehouse, and spend them at its workbench (one tool per step, up to three) to strengthen the walls before the Eclipse. In the Eclipse the Apostle wears the walls down; stronger walls hold until dawn. The walls you build stay between cycles. Ordinary interiors do not protect you from the Apostle.

| Action | Mobile | Desktop |
|---|---|---|
| Move | Left joystick, light tilt to walk, full tilt to run | WASD/arrows; Shift to run |
| Light/heavy attack | Tap/hold Attack; gestures also work on clear world space | Left/right mouse; mouse aim |
| Dodge | Dodge button or swipe down | Space |
| Quick-step | Swipe left/right | Space while moving |
| Interact | Use button or prompt near the survivor | E |
| Stance | Stand button cycles crouch/crawl | C |
| Inventory | Tap a slot; scroll the row for more | 1–6 or click |
| Pause | Pause button; rotation/background also pauses | Esc |

Swipe up is reserved for future vaulting. Autoloot uses a 1.75-tile radius and prioritizes food, medicine, tools, ammo, then weapons. Its preference is saved locally. Soft aim scores every enemy in range by distance and angle (wide cone for melee, narrower for the pistol), keeps the current lock sticky, lunges melee swings toward the target, and buffers an attack pressed just before the last swing recovers. See Documentation/CORE.md. The inventory has six fixed item categories.

## Contents

- [Architecture and setup](Documentation/SETUP.md)
- [Android, iOS and desktop build steps](Documentation/BUILD.md)
- [Validation results and remaining checks](Documentation/VALIDATION.md)
- [Artwork and animation scope](Documentation/ART.md)
- [Pure gameplay core](Documentation/CORE.md)
- [Gameplay contract](Documentation/CONTRACT.md)

## Prototype limits

The supplied hero is a single pose, adapted from the supplied reference; it is not a finished directional sprite sheet. The generated controller provides four direction states using that pose. Human sprites, scenery, sounds, and combat cues are original placeholders. Mobile performance, camera stacking, fog shader appearance, and touch ergonomics still need a device pass. Smooth zoom uses point-filtered sprites and snapped positions; strict integer pixel scaling is optional and can reduce the requested zoom change.

The existing browser prototype is independent of this Unity project: https://eclipse-survival-cc52t3b.solid.site
