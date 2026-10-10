# Validation — 10 October 2026

## Executed and passed

- **Pure C# gameplay: 44 passed, 0 failed**, using .NET SDK 8.0 (re-run Oct 10, 2026 after the soft-lock aim, melee lunge, Wall Integrity, event bus and game data changes; 27 before). Includes full day/Eclipse survival, all five interiors, unreinforced-shelter failure, death/replay, inventory, heavy attack, aiming cone, autoloot priority/radius, collision-probe semantics, seeded replay and the browser RNG fixture. The warm core Step allocation scenario also passed. See [core-tests.txt](Validation/core-tests.txt).
- **Reference compilation:** all project C# runtime/editor/test source compiled as .NET Standard 2.1 with C# 9, using real Unity assemblies, with zero errors and zero warnings. See [reference-compile.txt](Validation/reference-compile.txt).
- A second reference compilation respected each project assembly definition: Core, Runtime, Editor, EditMode tests and PlayMode tests all compiled separately with zero warnings/errors. See [assembly-compile.txt](Validation/assembly-compile.txt).
- Mixer setup reflection signatures were checked by reading the installed editor's assembly metadata. All four required methods/properties exist. See [mixer-api-check.txt](Validation/mixer-api-check.txt).
- Independent source review found and corrected joystick center offset, stale mouse aim during movement, direction-dependent analog strength, lost auto-loot preference across scene changes, and missing combat cues. Removed daytime enemies are hidden when the Eclipse roster changes. Old area colliders are disabled before deferred destruction.
- JSON/assembly manifests, stable scene GUID references, included file inventory, original PNG byte identity, and shell script syntax checked before packaging.

## Scope of the reference compile

The engine/editor reference assemblies came from the official **6000.3.12f1 Linux Editor**. The renderer, input, UI and test reference assemblies came from that Editor's bundled **2D starter-template cache** (URP 17.0.3, Input 1.12.0, uGUI 2.0.0, Test Framework 1.4.5). The project pins URP **17.3.0**, Input **1.17.0**, uGUI **2.0.0**, Test Framework **1.4.6**. Relevant newer camera/pipeline APIs were checked against the current package source, and assembly-definition names against the installed packages.

This check catches C# syntax, type and many API errors. It is **not** a Unity project import, package-resolution test, shader compile, first-open asset-generation run, IL2CPP build or device test. No Unity native code was executed through the standalone compiler.

## Editor blocker

The official Editor was installed and started in batch mode with a normal Linux user account. It reached its licensing service and exited with code 198:

> No valid Unity Editor license found. Please activate your license.

It also reported no entitlement for `com.unity.editor.headless`. Project import and compilation did not complete. Activation must use a valid Unity license; this delivery includes no license, activation token, or credentials. Android Build Support was not installed while editor activation remained blocked. A larger build machine could not be provisioned because the workspace reported its recurring resource capacity was reached; lightweight checks ran on the existing auxiliary machine.

## Included but not executed

Five EditMode tests cover projection, analog strength, build scenes, generated asset references, controls and orientation. Two PlayMode tests cover the real UI joystick center/release, Screen Space–Camera canvas, area collision probe and pause timing. Their C# source passed reference compilation, but their assertions have not been run in Unity.

Still required: first-open setup, sprite slicing/atlas packing, AudioMixer asset creation, scene import, shader compile, camera stacking and fog appearance, native UI raycasts, multitouch gestures, Android IL2CPP/APK, on-device performance/memory/thermal tests, iOS export/signing/TestFlight, and desktop players. See [BUILD.md](BUILD.md).

There is no Unity screenshot, installable APK, iOS archive or measured mobile FPS claim in this delivery. The browser prototype's previous browser tests are separate and are not evidence that the Unity presentation layer runs correctly.

## Unity-side edits made Oct 10, 2026

The project was opened in Unity 6000.3.12f1 after the soft-lock, Wall Integrity and event bus edits (`AudioDirector`, `GameController`, `GameHud`, `WorldView`) and it **compiled**, as reported by the project owner. The game data edits that followed (`GameDataAsset.cs`, `GameController.cs`, `GameHud.cs`, `SurvivalConfig.cs`, `ProjectSetup.cs`, the new EditMode test; later the movement rework (`CrouchButton.cs`, `StickGuide.cs`, `VisibilityRing.cs` were compile-checked against stand-ins; the edits to `InputRouter.cs`, `TouchStick.cs`, `GameController.cs`, `GameHud.cs` and `WorldView.cs` were reviewed by eye only), and the stamina-bar tint on a winded swing in `GameHud.cs`, which was reviewed by eye only; the draw-order change in `WorldView.cs` and `Iso.cs`, also by eye only, while the `Depth` logic itself is tested) were compile-checked only against minimal stand-ins for the Unity types they use, with no errors. Not yet verified in Unity: that `JsonUtility` copies `GameData` completely (the new EditMode test `GameDataAssetLoadsValidAndIsCopiedPerRun` checks this), that the Inspector shows the lists usably, and that Set up project assets creates `GameData.asset`.
