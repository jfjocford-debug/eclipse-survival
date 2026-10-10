using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.TestTools;
using UnityEngine.UI;
using EclipseSurvival.Core;
namespace EclipseSurvival.Tests
{
    public class IntegrationTests
    {
        GameObject root;
        GameController game;
        [UnitySetUp] public IEnumerator Setup()
        {
            Assert.IsNotNull(Resources.Load<SurvivalConfig>("Config/SurvivalConfig"),"Run Eclipse > Set up project assets first.");
            root=new GameObject("Eclipse integration test");root.SetActive(false);game=root.AddComponent<GameController>();game.simulateTouch=true;game.testScene=true;root.SetActive(true);yield return null;
            game.State.Mode=RunMode.Playing;
        }
        [UnityTearDown] public IEnumerator Cleanup(){Object.Destroy(root);yield return null;}
        [UnityTest] public IEnumerator HudUsesCameraAndCenteredJoystickIsNeutral()
        {
            Assert.AreEqual(RenderMode.ScreenSpaceCamera,game.Hud.GetComponent<Canvas>().renderMode);
            var stick=game.Hud.GetComponentInChildren<TouchStick>();Assert.IsNotNull(stick);
            var rect=(RectTransform)stick.transform;
            var center=RectTransformUtility.WorldToScreenPoint(game.View.Ui,rect.TransformPoint(rect.rect.center));
            var pointer=new PointerEventData(EventSystem.current){pointerId=7,position=center,pointerPressRaycast=new RaycastResult{module=game.Hud.GetComponent<GraphicRaycaster>()}};
            stick.OnPointerDown(pointer);Assert.That(game.Input.Stick.magnitude,Is.LessThan(.001));
            pointer.position=center+Vector2.right*200;stick.OnDrag(pointer);Assert.That(game.Input.Stick.x,Is.GreaterThan(.9f));
            stick.OnPointerUp(pointer);Assert.AreEqual(Vector2.zero,game.Input.Stick);yield return null;
        }
        [UnityTest] public IEnumerator PhysicsProbeChangesWithInteriorAndPauseStopsTime()
        {
            var b=Simulation.Buildings[0];Assert.IsTrue(game.World.IsBlocked(b.Position+new V2(b.Width*.5f,b.Height*.5f),"street"));
            game.State.Area="shelter";game.State.Player.Position=new V2(3,3);game.World.RefreshArea();yield return null;
            Assert.IsFalse(game.World.IsBlocked(new V2(3,3),"shelter"));
            game.Pause(true);float time=game.State.Time;yield return null;yield return null;Assert.AreEqual(time,game.State.Time);
            Assert.AreEqual(Vector2.zero,game.Input.Move);
        }
    }
}
