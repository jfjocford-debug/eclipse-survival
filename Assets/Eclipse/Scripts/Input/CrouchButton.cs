using UnityEngine;
using UnityEngine.EventSystems;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    /// <summary>
    /// The crouch control. A tap toggles crouch; holding for the data's prone time goes prone. Sliding the finger
    /// off the button cancels the press so a stray drag never changes posture.
    /// </summary>
    public sealed class CrouchButton : MonoBehaviour,IPointerDownHandler,IPointerUpHandler,IPointerExitHandler
    {
        public GameController game;
        int pointer=int.MinValue;
        float down;
        bool fired;
        public void OnPointerDown(PointerEventData e)
        {
            if(pointer!=int.MinValue||game.State.Mode!=RunMode.Playing||game.IsPortrait)return;
            pointer=e.pointerId;down=Time.unscaledTime;fired=false;
        }
        void Update()
        {
            if(pointer==int.MinValue)return;
            if(game.State.Mode!=RunMode.Playing||game.IsPortrait){pointer=int.MinValue;return;}
            if(!fired&&Time.unscaledTime-down>=game.State.Data.Player.ProneHoldSeconds){game.CrouchHold();fired=true;}
        }
        public void OnPointerUp(PointerEventData e)
        {
            if(pointer!=e.pointerId)return;
            pointer=int.MinValue;
            if(!fired)game.CrouchTap();
        }
        public void OnPointerExit(PointerEventData e){if(pointer==e.pointerId)pointer=int.MinValue;}
        void OnDisable(){pointer=int.MinValue;}
    }
}
