using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering.Universal;
using EclipseSurvival.Core;
namespace EclipseSurvival.Tests
{
    public class ProjectTests
    {
        [OneTimeSetUp] public void Setup()=>Editor.ProjectSetup.Ensure();
        [Test] public void IsometricCoordinatesRoundTrip()
        {
            foreach(var p in new[]{new V2(0,0),new V2(1,3),new V2(9,9),new V2(-2,.4f)})
            {var q=Iso.Logical(Iso.World(p));Assert.That(q.X,Is.EqualTo(p.X).Within(.0001));Assert.That(q.Y,Is.EqualTo(p.Y).Within(.0001));}
        }
        [Test] public void AnalogStrengthIsIndependentOfDirection()
        {
            foreach(float strength in new[]{0,.3f,.7f,1})foreach(var direction in new[]{Vector2.up,Vector2.right,Vector2.down,Vector2.left,new Vector2(1,1).normalized})
                Assert.That(Iso.Direction(direction*strength).Magnitude,Is.EqualTo(strength).Within(.0001));
        }
        [Test] public void SceneBuildOrderStartsAtMainMenu()
        {
            Assert.That(EditorBuildSettings.scenes[0].path,Does.EndWith("MainMenu.unity"));
            Assert.That(EditorBuildSettings.scenes[1].path,Does.EndWith("GameScene.unity"));
            Assert.IsTrue(EditorBuildSettings.scenes[0].enabled);Assert.IsTrue(EditorBuildSettings.scenes[1].enabled);
        }
        [Test] public void GameDataAssetLoadsValidAndIsCopiedPerRun()
        {
            var first=GameDataAsset.Load();var second=GameDataAsset.Load();
            Assert.That(first.Validate(),Is.Empty);Assert.AreNotSame(first,second);
            first.Weapons[0].Damage=999;Assert.AreNotEqual(999f,second.Weapons[0].Damage);
            Assert.That(first.Weapons.Count,Is.EqualTo(3));Assert.That(first.Eclipses.Count,Is.GreaterThan(0));
        }
        [Test] public void GeneratedAssetsHaveEveryRequiredReference()
        {
            var c=Resources.Load<SurvivalConfig>("Config/SurvivalConfig");Assert.IsNotNull(c);
            foreach(var asset in new Object[]{c.hero,c.apostle,c.bandit,c.scavenger,c.characterAtlas,c.locomotion,c.mixer,c.sfxGroup,c.ambienceGroup,c.eclipseGroup,c.wind,c.birds,c.heartbeat,c.distortion,c.melee,c.hurt,c.playerPrefab,c.banditPrefab,c.scavengerPrefab,c.apostlePrefab,c.lootPrefab,c.buttonPrefab,c.fogMaterial,c.spriteMaterial})Assert.IsNotNull(asset);
            Assert.That(c.hero.rect.width,Is.EqualTo(656));Assert.That(c.apostle.rect.height,Is.EqualTo(1521));
            Assert.IsInstanceOf<UniversalRenderPipelineAsset>(UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline);
        }
        [Test] public void InputBindingsAndLandscapeSettingsExist()
        {
            var input=Resources.Load<InputActionAsset>("Config/EclipseControls");Assert.IsNotNull(input);
            foreach(string name in new[]{"Move","Aim","Attack","Heavy","Dodge","Interact","Pause","Run","Stance","Slot1","Slot6"})Assert.IsNotNull(input.FindAction("Gameplay/"+name));
            Assert.IsFalse(PlayerSettings.allowedAutorotateToPortrait);Assert.IsFalse(PlayerSettings.allowedAutorotateToPortraitUpsideDown);
            Assert.IsTrue(PlayerSettings.allowedAutorotateToLandscapeLeft);Assert.IsTrue(PlayerSettings.allowedAutorotateToLandscapeRight);
        }
    }
}
