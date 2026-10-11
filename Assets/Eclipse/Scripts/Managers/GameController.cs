using UnityEngine;
using UnityEngine.SceneManagement;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    [DefaultExecutionOrder(-100)]
    public sealed class GameController : MonoBehaviour
    {
        public bool menuScene;
        public bool testScene;
        public bool simulateTouch;
        static bool launchQuick;
        public SurvivalConfig config;
        [Tooltip("Weapons, enemies, items, walls, day length and Eclipse profiles. Defaults to Resources/Config/GameData.")] public GameDataAsset gameData;
        public GameState State {get;private set;}
        public EventBus Bus {get;}=new EventBus();
        public InputRouter Input {get;private set;}
        public WorldView World {get;private set;}
        public CameraRig View {get;private set;}
        public GameHud Hud {get;private set;}
        public bool IsMobile => Application.isMobilePlatform || (Input!=null && Input.forceTouch);
        public bool IsPortrait => IsMobile && Screen.height>Screen.width;
        public bool Menu {get;private set;}
        /// <summary>True while the Survivor screen (body and backpack) is open. The simulation does not advance.</summary>
        public bool PanelOpen {get;private set;}
        public bool Quick {get;set;}
        float accumulator;
        void Awake()
        {
            config=config?config:Resources.Load<SurvivalConfig>("Config/SurvivalConfig");
            config=config?Instantiate(config):ScriptableObject.CreateInstance<SurvivalConfig>();
            Application.targetFrameRate=60;
            Screen.orientation=ScreenOrientation.AutoRotation;
            Screen.autorotateToLandscapeLeft=true;Screen.autorotateToLandscapeRight=true;
            Screen.autorotateToPortrait=false;Screen.autorotateToPortraitUpsideDown=false;
            Physics2D.gravity=Vector2.zero;
            Input=gameObject.AddComponent<InputRouter>();Input.forceTouch=simulateTouch;Input.Initialize(this);
            config.autoLoot=PlayerPrefs.GetInt("EclipseAutoLoot",IsMobile&&config.autoLoot?1:0)==1;
            State=Simulation.Create(1,false,GameDataAsset.Load(gameData));State.AutoLoot=config.autoLoot;
            View=new GameObject("World camera").AddComponent<CameraRig>();View.transform.SetParent(transform,false);View.Initialize(this);
            World=new GameObject("Neighborhood").AddComponent<WorldView>();World.transform.SetParent(transform,false);World.Initialize(this);
            Hud=new GameObject("HUD").AddComponent<GameHud>();Hud.transform.SetParent(transform,false);Hud.Initialize(this);
            gameObject.AddComponent<AudioDirector>().Initialize(this);
            Simulation.CollisionProbe=World.IsBlocked;
            Menu=menuScene;Quick=testScene||launchQuick||config.quickCycle;
            if(!menuScene)NewRun();
        }
        public void StartGame(){if(menuScene){launchQuick=Quick;SceneManager.LoadScene("GameScene");}else NewRun();}
        public void NewRun()
        {
            Input.Clear();accumulator=0;Menu=false;PanelOpen=false;
            State=Simulation.Create(unchecked((uint)System.DateTime.UtcNow.Ticks),Quick,GameDataAsset.Load(gameData));
            State.Best=PlayerPrefs.GetInt("EclipseBest",0);
            State.AutoLoot=config.autoLoot;
            Simulation.Start(State);World.RefreshArea(true);
            if(IsPortrait)Pause(true);
        }
        void Update()
        {
            if(State==null)return;
            if(IsPortrait && State.Mode==RunMode.Playing)Pause(true);
            if(State.Mode!=RunMode.Playing){accumulator=0;PanelOpen=false;return;}
            if(PanelOpen){accumulator=0;return;}
            accumulator+=Mathf.Min(Time.unscaledDeltaTime,.1f);
            while(accumulator>=1f/60f)
            {
                Simulation.Step(State,1f/60f,Iso.Direction(Input.Move),Input.Run);
                accumulator-=1f/60f;
            }
            ApplyAim();
            if(State.Mode==RunMode.Survived && State.Cycle>PlayerPrefs.GetInt("EclipseBest",0))
            {PlayerPrefs.SetInt("EclipseBest",State.Cycle);PlayerPrefs.Save();}
        }
        // Deliver the frame's events after the simulation has finished stepping, so handlers never run mid-step.
        void LateUpdate(){if(State!=null)Bus.Pump(State);}
        public void Pause(bool pause)
        {
            if(State.Mode==RunMode.Playing&&pause){State.Mode=RunMode.Paused;PanelOpen=false;Input.Clear();}
            else if(State.Mode==RunMode.Paused&&!pause&&!IsPortrait)State.Mode=RunMode.Playing;
        }
        public void TogglePause()=>Pause(State.Mode==RunMode.Playing);
        public void TogglePanel()
        {
            if(State==null)return;
            if(PanelOpen){ClosePanel();return;}
            if(State.Mode!=RunMode.Playing||IsPortrait||Menu)return;
            PanelOpen=true;Input.Clear();
        }
        public void ClosePanel(){PanelOpen=false;}
        void ApplyAim()
        {
            if(Input.Aim.sqrMagnitude<=.01f)return;
            State.Player.Face=Iso.Direction(Input.Aim).Normalized;
            var target=Simulation.AimTarget(State);State.LockId=target==null?-1:target.Id;
        }
        public void SetAutoLoot(bool enabled){config.autoLoot=State.AutoLoot=enabled;PlayerPrefs.SetInt("EclipseAutoLoot",enabled?1:0);PlayerPrefs.Save();}
        public void Attack(bool heavy){if(!IsPortrait){ApplyAim();Simulation.Attack(State,heavy);}}
        public void Dodge(){if(!IsPortrait)Simulation.Dodge(State);}
        public void Interact(){if(!IsPortrait)Simulation.Interact(State);}
        public void CrouchTap(){if(!IsPortrait)Simulation.ToggleCrouch(State);}
        public void CrouchHold(){if(!IsPortrait)Simulation.GoProne(State);}
        public void Use(Item item)=>Simulation.UseItem(State,item);
        public void Continue(){Input.Clear();Simulation.NextCycle(State);World.RefreshArea(true);}
        public void ReturnToMenu()=>SceneManager.LoadScene("MainMenu");
        void OnApplicationFocus(bool focus){if(!focus&&State!=null)Pause(true);}
        void OnApplicationPause(bool pause){if(pause&&State!=null)Pause(true);}
        void OnDestroy(){Simulation.CollisionProbe=null;if(config)Destroy(config);}
    }
}
