using UnityEngine;
using UnityEngine.EventSystems;
namespace EclipseSurvival
{
    public sealed class TouchStick : MonoBehaviour,IPointerDownHandler,IDragHandler,IPointerUpHandler
    {
        public GameController game;
        public RectTransform knob;
        int pointer=int.MinValue;
        public void OnPointerDown(PointerEventData e)
        {if(pointer!=int.MinValue)return;pointer=e.pointerId;OnDrag(e);}
        public void OnDrag(PointerEventData e)
        {
            if(pointer!=e.pointerId)return;
            RectTransformUtility.ScreenPointToLocalPointInRectangle((RectTransform)transform,e.position,e.pressEventCamera,out var p);
            p-=((RectTransform)transform).rect.center;
            float radius=((RectTransform)transform).rect.width*.35f;
            Vector2 d=Vector2.ClampMagnitude(p/radius,1);
            knob.anchoredPosition=d*radius;
            float m=d.magnitude,dead=game.config.joystickDeadzone;
            game.Input.Stick=m<=dead?Vector2.zero:d.normalized*((m-dead)/(1-dead)); // linear, so the guide rings sit where the speed bands change
        }
        public void OnPointerUp(PointerEventData e){if(pointer==e.pointerId)ResetStick();}
        void ResetStick(){pointer=int.MinValue;if(knob)knob.anchoredPosition=Vector2.zero;if(game&&game.Input)game.Input.Stick=Vector2.zero;}
        void Update(){if(game.State.Mode!=Core.RunMode.Playing)ResetStick();}
        void OnDisable()=>ResetStick();
    }
}
