using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.EventSystems;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    [DefaultExecutionOrder(-110)]
    public sealed class InputRouter : MonoBehaviour
    {
        public bool forceTouch;
        public Vector2 Move {get;private set;}
        public Vector2 Aim {get;private set;}
        public bool Run {get;private set;}
        public Vector2 Stick {get;set;}
        GameController game;
        InputActionAsset actions;
        InputAction move,aim,run,attack,heavy,dodge,interact,pause,stance;
        readonly InputAction[] slots=new InputAction[6];
        Vector2 smoothed;
        PointerEventData pointer;
        readonly List<RaycastResult> hits=new List<RaycastResult>(16);
        public void Initialize(GameController controller)
        {
            game=controller;
            var source=Resources.Load<InputActionAsset>("Config/EclipseControls");
            if(!source){Debug.LogError("Eclipse input actions missing. Run Eclipse > Set up project assets.");enabled=false;return;}
            actions=Instantiate(source);
            move=actions.FindAction("Gameplay/Move",true);aim=actions.FindAction("Gameplay/Aim",true);
            run=actions.FindAction("Gameplay/Run",true);attack=actions.FindAction("Gameplay/Attack",true);
            heavy=actions.FindAction("Gameplay/Heavy",true);dodge=actions.FindAction("Gameplay/Dodge",true);
            interact=actions.FindAction("Gameplay/Interact",true);pause=actions.FindAction("Gameplay/Pause",true);
            stance=actions.FindAction("Gameplay/Stance",true);
            for(int i=0;i<6;i++)slots[i]=actions.FindAction("Gameplay/Slot"+(i+1),true);
            actions.Enable();
        }
        void Update()
        {
            if(!actions || game.State==null)return;
            if(pause.WasPressedThisFrame())game.TogglePause();
            if(game.State.Mode!=RunMode.Playing||game.IsPortrait){Clear();return;}
            smoothed=Stick==Vector2.zero?Vector2.zero:Vector2.Lerp(smoothed,Stick,1-Mathf.Exp(-20*Time.unscaledDeltaTime));
            // The simulation turns stick travel into walk, jog or run. Keys are all-or-nothing, so they jog, and the run key runs.
            Vector2 keys=move.ReadValue<Vector2>();
            if(keys.sqrMagnitude>.98f)keys=keys.normalized*(run.IsPressed()?1f:game.State.Data.Player.JogTilt);
            Move=Vector2.ClampMagnitude(keys+smoothed,1);
            Run=run.IsPressed();
            if(!game.IsMobile&&Mouse.current!=null)
            {
                var point=game.View.Main.ScreenToWorldPoint(aim.ReadValue<Vector2>());
                Aim=(Vector2)(point-Iso.World(game.State.Player.Position));
            }
            else Aim=Vector2.zero;
            bool lightPressed=attack.WasPressedThisFrame(),heavyPressed=heavy.WasPressedThisFrame();
            if(!game.IsMobile&&(lightPressed||heavyPressed)&&!PointerOverUi())
            {
                if(lightPressed)game.Attack(false);
                if(heavyPressed)game.Attack(true);
            }
            if(dodge.WasPressedThisFrame())game.Dodge();
            if(interact.WasPressedThisFrame())game.Interact();
            // Crouch key: tap toggles crouch, hold goes prone (the same gesture as the on-screen button).
            if(stance.WasPressedThisFrame()){stanceDown=Time.unscaledTime;stanceHoldDone=false;}
            if(stanceDown>=0&&stance.IsPressed()&&!stanceHoldDone&&Time.unscaledTime-stanceDown>=game.State.Data.Player.ProneHoldSeconds){game.CrouchHold();stanceHoldDone=true;}
            if(stanceDown>=0&&stance.WasReleasedThisFrame()){if(!stanceHoldDone)game.CrouchTap();stanceDown=-1f;}
            for(int i=0;i<6;i++)if(slots[i].WasPressedThisFrame())game.Use((Item)i);
        }
        bool PointerOverUi()
        {
            if(!EventSystem.current||Mouse.current==null)return false;
            if(pointer==null)pointer=new PointerEventData(EventSystem.current);
            pointer.Reset();pointer.position=Mouse.current.position.ReadValue();hits.Clear();EventSystem.current.RaycastAll(pointer,hits);return hits.Count>0;
        }
        float stanceDown=-1f;
        bool stanceHoldDone;
        public void Clear(){Stick=smoothed=Move=Aim=Vector2.zero;Run=false;stanceDown=-1f;}
        void OnDisable(){actions?.Disable();Clear();}
        void OnEnable(){actions?.Enable();}
        void OnDestroy(){if(actions)Destroy(actions);}
    }
}
