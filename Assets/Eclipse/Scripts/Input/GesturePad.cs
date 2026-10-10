using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    public sealed class GesturePad : MonoBehaviour,IPointerDownHandler,IDragHandler,IPointerUpHandler,ICancelHandler
    {
        public GameController game;
        public bool worldSurface;
        public Image charge;
        int pointer=int.MinValue;
        Vector2 began,latest;
        float time;
        bool fired;
        float Scale=>GetComponentInParent<Canvas>().scaleFactor;
        public void OnPointerDown(PointerEventData e)
        {
            if(pointer!=int.MinValue||game.State.Mode!=RunMode.Playing||game.IsPortrait)return;
            if(worldSurface&&!game.IsMobile)return;
            pointer=e.pointerId;began=latest=e.position;time=Time.unscaledTime;fired=false;
        }
        public void OnDrag(PointerEventData e){if(e.pointerId==pointer)latest=e.position;}
        void Update()
        {
            if(pointer==int.MinValue)return;
            if(game.State.Mode!=RunMode.Playing||game.IsPortrait){Cancel();return;}
            float progress=(Time.unscaledTime-time)/game.config.heavyHoldSeconds;
            bool still=Vector2.Distance(began,latest)/Scale<=18;
            if(charge)charge.fillAmount=still?Mathf.Clamp01(progress):0;
            if(!fired&&still&&progress>=1){game.Attack(true);fired=true;}
        }
        public void OnPointerUp(PointerEventData e)
        {
            if(pointer!=e.pointerId)return;
            var delta=(e.position-began)/Scale;
            bool consumed=fired;Cancel();
            if(consumed||game.State.Mode!=RunMode.Playing)return;
            if(delta.magnitude>=42)
            {
                if(Mathf.Abs(delta.y)>Mathf.Abs(delta.x)*1.15f){if(delta.y<0)game.Dodge();}
                else if(Mathf.Abs(delta.x)>Mathf.Abs(delta.y)*1.15f)
                {var face=game.State.Player.Face;Simulation.Dodge(game.State,delta.x<0?new V2(face.Y,-face.X):new V2(-face.Y,face.X));}
            }
            else if(delta.magnitude<=18)
            {
                if(worldSurface && Simulation.TapLoot(game.State,Iso.Logical(game.View.Main.ScreenToWorldPoint(e.position))))return;
                game.Attack(false);
            }
        }
        public void OnCancel(BaseEventData e)=>Cancel();
        void OnDisable()=>Cancel();
        void Cancel(){pointer=int.MinValue;fired=false;if(charge)charge.fillAmount=0;}
    }
}
