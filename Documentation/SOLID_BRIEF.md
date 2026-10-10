# Brief for Solid's agent

Paste this with the project zip.

---

This zip is the current Eclipse Survival Unity project (Unity 6000.3.12f1, URP, Input System). It replaces the copy you have. Please:

1. Replace the project with the contents of the zip, keeping nothing from the old copy that conflicts. Do not merge by hand; if you must keep a file, tell me which and why.
2. Open it in Unity and report whether it compiles. If there are errors, paste the first three exactly as Unity prints them and stop there.
3. Run **Eclipse, Set up project assets**. Confirm that `Assets/Eclipse/Resources/Config/GameData.asset` exists.
4. Run the EditMode tests (Window, General, Test Runner). Report the totals and the name of any failure. In particular `GameDataAssetLoadsValidAndIsCopiedPerRun` must pass.
5. Build for the web (WebGL) if that is how you host it, and send me the link. I will open it on an iPhone in Safari, in landscape. If a web build is not possible, say so and tell me what you can host instead.
6. Tell me in one line each: Unity version used, build target, and any setting you changed to get a build.

What changed since your last copy (so you can spot problems): a movement rework (new files `CrouchButton.cs`, `StickGuide.cs`, `VisibilityRing.cs`; edits to `InputRouter.cs`, `TouchStick.cs`, `GameController.cs`, `GameHud.cs`, `WorldView.cs`; `StanceNext` is gone), a data model (`Assets/Eclipse/Core/Data.cs`, `GameDataAsset.cs`), a draw-order fix (`Core/Depth.cs`, used in `WorldView.cs`), a winded-swing rule, and the removal of the day and Eclipse length fields from `SurvivalConfig` (they now live in the Game data asset under Clock). `Documentation/CORE.md` explains each.

Do not change gameplay numbers or code unless a compile error requires it, and list every edit you make.

## Update: cloud build (replaces the Solid Unity build attempt)
Solid's machine has no Unity license, so the Unity project cannot be built there. The Unity WebGL build now goes through GitHub Actions: see `Documentation/CLOUD_BUILD.md`. Solid continues to host only the earlier browser prototype.
