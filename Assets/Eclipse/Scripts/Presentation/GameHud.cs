using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    public sealed class GameHud : MonoBehaviour
    {
        GameController game;
        Canvas canvas;
        CanvasScaler scaler;
        Sprite white;
        Texture2D whiteTexture;
        RectTransform safe,prompt,timer,inventory,reticle;
        Text health,stamina,time,phase,notice,promptText,stanceText,place,equipped,stealthText,injuryText,alert;
        SurvivorPanel panel;
        Image flash;
        Texture2D vignetteTexture;
        Sprite vignette;
        float flashAlpha;
        Color flashColor=Color.clear;
        readonly Image[] slotImages=new Image[6];
        readonly Text[] counts=new Text[6];
        Image healthFill,staminaFill,fog;
        GameObject mobileControls,desktopHint,modal,rotateGate;
        Transform modalContent;
        Material fogMaterial;
        Text rotateText;
        RunMode lastMode=(RunMode)(-1);
        bool lastMenu,help;
        int width,height;
        float uiClock;
        float joySize,attackSize,actionSize,slotSize;
        Font font;
        static readonly Color Panel=new Color(.055f,.12f,.09f,.93f),Ink=new Color(.93f,.91f,.75f),Accent=new Color(.85f,.74f,.46f);
        public void Initialize(GameController controller)
        {
            game=controller;joySize=game.config.joystickSize;attackSize=game.config.attackSize;actionSize=game.config.actionSize;slotSize=game.config.inventorySize;whiteTexture=new Texture2D(1,1);whiteTexture.SetPixel(0,0,Color.white);whiteTexture.Apply();white=Sprite.Create(whiteTexture,new UnityEngine.Rect(0,0,1,1),Vector2.one*.5f);font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            gameObject.layer=5;canvas=gameObject.AddComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=game.View.Ui;canvas.planeDistance=1;canvas.sortingOrder=10;
            var scale=scaler=gameObject.AddComponent<CanvasScaler>();scale.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scale.referenceResolution=new Vector2(844,390);scale.screenMatchMode=CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;scale.matchWidthOrHeight=1;
            gameObject.AddComponent<GraphicRaycaster>();
            if(!EventSystem.current){var ev=new GameObject("Event system",typeof(EventSystem),typeof(InputSystemUIInputModule));ev.transform.SetParent(transform,false);ev.GetComponent<InputSystemUIInputModule>().AssignDefaultActions();}
            var surface=Rect("World gestures",transform,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);var surfaceImage=surface.gameObject.AddComponent<Image>();surfaceImage.color=Color.clear;surface.gameObject.AddComponent<GesturePad>().game=game;surface.GetComponent<GesturePad>().worldSurface=true;
            vignetteTexture=new Texture2D(64,64,TextureFormat.RGBA32,false){wrapMode=TextureWrapMode.Clamp};
            for(int y=0;y<64;y++)for(int x=0;x<64;x++){float dx=(x-31.5f)/31.5f,dy=(y-31.5f)/31.5f;float edge=Mathf.SmoothStep(.35f,1.15f,Mathf.Sqrt(dx*dx+dy*dy));vignetteTexture.SetPixel(x,y,new Color(1,1,1,edge));}
            vignetteTexture.Apply();vignette=Sprite.Create(vignetteTexture,new UnityEngine.Rect(0,0,64,64),Vector2.one*.5f);
            var effect=Rect("Eclipse fog",transform,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);fog=effect.gameObject.AddComponent<Image>();fog.raycastTarget=false;
            if(game.config.fogMaterial){fogMaterial=new Material(game.config.fogMaterial);fog.material=fogMaterial;}fog.color=Color.clear;
            var flashRect=Rect("Alarm flash",transform,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);flash=flashRect.gameObject.AddComponent<Image>();flash.sprite=vignette;flash.raycastTarget=false;flash.color=Color.clear;
            safe=Rect("Safe area",transform,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);
            var vitals=Box("Vitals",safe,new Vector2(0,1),new Vector2(0,1),new Vector2(180,100),Vector2.zero);
            Label("SURVIVOR",vitals,18,new Vector2(16,-14),new Vector2(120,24),new Vector2(0,1));
            health=Label("100",vitals,18,new Vector2(-10,-39),new Vector2(42,24),new Vector2(1,1));
            stamina=Label("100",vitals,18,new Vector2(-10,-69),new Vector2(42,24),new Vector2(1,1));
            healthFill=Bar(vitals,new Vector2(12,-44),new Color(.85f,.43f,.3f));staminaFill=Bar(vitals,new Vector2(12,-74),new Color(.64f,.74f,.42f));
            Button("Ⅱ",safe,new Vector2(0,1),new Vector2(192,-4),new Vector2(44,44),()=>game.TogglePause());
            inventory=Rect("Inventory",safe,Vector2.one,Vector2.one,new Vector2(1,1),new Vector2(430,slotSize));inventory.anchoredPosition=Vector2.zero;
            var viewport=Rect("Viewport",inventory,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);viewport.gameObject.AddComponent<RectMask2D>();
            var content=Rect("Slots",viewport,new Vector2(0,1),new Vector2(0,1),new Vector2(0,1),new Vector2(6*(slotSize+12)-12,slotSize));
            string[] names={"Crowbar","Pistol","Food","Meds","Tools","Ammo"};
            for(int i=0;i<6;i++){int slot=i;var button=Button(names[i],content,new Vector2(0,1),new Vector2(i*(slotSize+12),0),new Vector2(slotSize,slotSize),()=>game.Use((Item)slot));button.GetComponentInChildren<Text>().rectTransform.offsetMin=new Vector2(2,4);button.GetComponentInChildren<Text>().rectTransform.offsetMax=new Vector2(-2,-28);button.GetComponentInChildren<Text>().fontSize=15;button.GetComponentInChildren<Text>().text="["+(i+1)+"] "+names[i];slotImages[i]=button.GetComponent<Image>();counts[i]=Label("0",button.transform,22,new Vector2(0,-5),new Vector2(slotSize-8,26),new Vector2(.5f,1));counts[i].alignment=TextAnchor.MiddleCenter;}
            var scroll=inventory.gameObject.AddComponent<ScrollRect>();scroll.viewport=viewport;scroll.content=content;scroll.horizontal=true;scroll.vertical=false;scroll.movementType=ScrollRect.MovementType.Clamped;scroll.scrollSensitivity=28;
            timer=Box("Timer",safe,new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(160,70),new Vector2(-37,0));
            phase=Label("Until Eclipse",timer,18,new Vector2(0,-8),new Vector2(158,24),new Vector2(.5f,1));phase.alignment=TextAnchor.MiddleCenter;
            time=Label("02:30",timer,28,new Vector2(0,-31),new Vector2(158,32),new Vector2(.5f,1));time.alignment=TextAnchor.MiddleCenter;
            mobileControls=Rect("Mobile controls",safe,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero).gameObject;
            var stick=Box("Joystick",mobileControls.transform,Vector2.zero,Vector2.zero,new Vector2(joySize,joySize),Vector2.zero);
            var thumb=Box("Thumb",stick,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(52,52),Vector2.zero);thumb.GetComponent<Image>().color=Accent;thumb.GetComponent<Image>().raycastTarget=false;
            var control=stick.gameObject.AddComponent<TouchStick>();control.game=game;control.knob=thumb;StickGuide.Build(stick,game.config.joystickDeadzone,game.State.Data.Player.WalkBandMax,game.State.Data.Player.RunBandMin);
            var stand=Button("Crouch",mobileControls.transform,Vector2.zero,new Vector2(0,joySize+16),new Vector2(joySize,48),()=>{});stand.gameObject.AddComponent<CrouchButton>().game=game;stanceText=stand.GetComponentInChildren<Text>();
            var actions=Rect("Actions",safe,new Vector2(1,0),new Vector2(1,0),new Vector2(1,0),Vector2.one*(attackSize+actionSize+16));
            var attack=Box("Attack",actions,new Vector2(1,0),new Vector2(1,0),Vector2.one*attackSize,Vector2.zero);attack.GetComponent<Image>().color=Accent;
            var attackLabel=Label("Attack\nHold: heavy",attack,20,Vector2.zero,new Vector2(attackSize,attackSize-12),new Vector2(.5f,.5f));attackLabel.alignment=TextAnchor.MiddleCenter;attackLabel.color=Panel;
            var chargeRect=Rect("Charge",attack,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);var charge=chargeRect.gameObject.AddComponent<Image>();charge.sprite=white;charge.color=new Color(1,.93f,.64f,.4f);charge.type=Image.Type.Filled;charge.fillMethod=Image.FillMethod.Radial360;charge.fillAmount=0;charge.raycastTarget=false;
            var gesture=attack.gameObject.AddComponent<GesturePad>();gesture.game=game;gesture.charge=charge;
            Button("Dodge",actions,Vector2.zero,Vector2.zero,Vector2.one*actionSize,game.Dodge);
            Button("Use",actions,new Vector2(1,1),Vector2.zero,Vector2.one*actionSize,game.Interact);
            desktopHint=Label("W A S D  Move\nShift  Run · Space  Dodge\nLMB  Attack · RMB  Heavy\nE  Use · C  Crouch (hold: prone)\nTab  Survivor screen (body, backpack)",safe,18,Vector2.zero,new Vector2(340,140),Vector2.zero).gameObject;
            equipped=Label("",safe,18,new Vector2(16,-110),new Vector2(320,26),new Vector2(0,1));
            stealthText=Label("",safe,18,new Vector2(16,-136),new Vector2(320,26),new Vector2(0,1));
            injuryText=Label("",safe,18,new Vector2(16,-162),new Vector2(320,26),new Vector2(0,1));
            alert=Label("",safe,22,new Vector2(0,-142),new Vector2(640,60),new Vector2(.5f,1));alert.alignment=TextAnchor.UpperCenter;alert.gameObject.AddComponent<Outline>().effectColor=Color.black;
            reticle=Label("+",transform,26,Vector2.zero,new Vector2(32,32),new Vector2(.5f,.5f)).rectTransform;reticle.GetComponent<Text>().alignment=TextAnchor.MiddleCenter;
            place=Label("",safe,18,new Vector2(0,-105),new Vector2(320,28),new Vector2(.5f,1));place.alignment=TextAnchor.MiddleCenter;
            notice=Label("",safe,18,new Vector2(-37,88),new Vector2(320,60),new Vector2(.5f,0));notice.alignment=TextAnchor.MiddleCenter;notice.gameObject.AddComponent<Outline>().effectColor=Color.black;
            prompt=Box("Nearby interaction",transform,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(270,52),Vector2.zero);promptText=Label("",prompt,18,Vector2.zero,new Vector2(260,48),new Vector2(.5f,.5f));promptText.alignment=TextAnchor.MiddleCenter;prompt.gameObject.AddComponent<Button>().onClick.AddListener(game.Interact);
            modal=Box("Menu",transform,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(610,310),Vector2.zero).gameObject;modalContent=modal.transform;
            panel=new GameObject("Survivor panel",typeof(RectTransform)).AddComponent<SurvivorPanel>();panel.transform.SetParent(transform,false);panel.Initialize(game,font);
            game.Bus.Subscribe(OnGameEvent);
            rotateGate=Box("Rotate gate",transform,Vector2.zero,Vector2.zero,Vector2.zero,Vector2.zero).gameObject;var rotateRect=(RectTransform)rotateGate.transform;rotateRect.anchorMax=Vector2.one;rotateRect.offsetMin=rotateRect.offsetMax=Vector2.zero;rotateGate.GetComponent<Image>().color=Panel;
            rotateText=Label("Rotate to landscape\n\nYour game is paused.",rotateGate.transform,26,Vector2.zero,new Vector2(380,180),new Vector2(.5f,.5f));rotateText.alignment=TextAnchor.MiddleCenter;
            Layout();
            surfaceImage.raycastTarget=game.IsMobile;
        }
        RectTransform Rect(string name,Transform parent,Vector2 min,Vector2 max,Vector2 pivot,Vector2 size)
        {var go=new GameObject(name,typeof(RectTransform));go.layer=5;var r=(RectTransform)go.transform;r.SetParent(parent,false);r.anchorMin=min;r.anchorMax=max;r.pivot=pivot;r.sizeDelta=size;r.anchoredPosition=Vector2.zero;return r;}
        RectTransform Box(string name,Transform parent,Vector2 anchor,Vector2 pivot,Vector2 size,Vector2 position)
        {var r=Rect(name,parent,anchor,anchor,pivot,size);r.anchoredPosition=position;var image=r.gameObject.AddComponent<Image>();image.color=Panel;return r;}
        Text Label(string value,Transform parent,int size,Vector2 position,Vector2 dimensions,Vector2 anchor)
        {var r=Rect(value,parent,anchor,anchor,anchor,dimensions);r.anchoredPosition=position;var t=r.gameObject.AddComponent<Text>();t.font=font;t.fontSize=size;t.color=Ink;t.text=value;t.raycastTarget=false;t.horizontalOverflow=HorizontalWrapMode.Wrap;t.verticalOverflow=VerticalWrapMode.Truncate;return t;}
        Button Button(string label,Transform parent,Vector2 anchor,Vector2 position,Vector2 size,UnityEngine.Events.UnityAction action)
        {RectTransform r;Button b;
            if(game.config.buttonPrefab){var go=Instantiate(game.config.buttonPrefab,parent);go.name=label;r=(RectTransform)go.transform;r.anchorMin=r.anchorMax=r.pivot=anchor;r.sizeDelta=size;r.anchoredPosition=position;go.GetComponent<Image>().color=Panel;b=go.GetComponent<Button>();}
            else{r=Box(label,parent,anchor,anchor,size,position);b=r.gameObject.AddComponent<Button>();}b.onClick.AddListener(action);var text=Label(label,r,20,Vector2.zero,size,new Vector2(.5f,.5f));text.alignment=TextAnchor.MiddleCenter;var colors=b.colors;colors.normalColor=Color.white;colors.highlightedColor=new Color(1,.95f,.77f);b.colors=colors;return b;}
        Image Bar(Transform parent,Vector2 pos,Color color)
        {var box=Box("Meter",parent,new Vector2(0,1),new Vector2(0,1),new Vector2(110,10),pos);box.GetComponent<Image>().color=new Color(.1f,.16f,.11f);var fill=Box("Fill",box,new Vector2(0,.5f),new Vector2(0,.5f),new Vector2(110,10),Vector2.zero).GetComponent<Image>();fill.sprite=white;fill.color=color;fill.type=Image.Type.Filled;fill.fillMethod=Image.FillMethod.Horizontal;fill.raycastTarget=false;return fill;}
        void Layout()
        {
            width=Screen.width;height=Screen.height;var area=Screen.safeArea;float margin=game.config.safeMargin;
            scaler.referenceResolution=game.IsMobile?new Vector2(844,390):new Vector2(1440,900);scaler.matchWidthOrHeight=game.IsMobile?1:.5f;
            float padX=area.width*margin,padY=area.height*margin;area.xMin+=padX;area.xMax-=padX;area.yMin+=padY;area.yMax-=padY;
            safe.anchorMin=new Vector2(area.xMin/width,area.yMin/height);safe.anchorMax=new Vector2(area.xMax/width,area.yMax/height);safe.offsetMin=safe.offsetMax=Vector2.zero;
            Canvas.ForceUpdateCanvases();inventory.sizeDelta=new Vector2(Mathf.Clamp(safe.rect.width-250,slotSize*2,6*(slotSize+12)-12),slotSize);
            mobileControls.SetActive(game.IsMobile);desktopHint.SetActive(!game.IsMobile);reticle.gameObject.SetActive(!game.IsMobile);
            ((RectTransform)modal.transform).sizeDelta=new Vector2(Mathf.Min(610,width/canvas.scaleFactor-32),Mathf.Min(310,height/canvas.scaleFactor-24));
            transform.Find("World gestures").GetComponent<Image>().raycastTarget=game.IsMobile;
        }
        void Update()
        {
            if(game==null||game.State==null)return;
            if(width!=Screen.width||height!=Screen.height)Layout();
            var s=game.State;bool playing=s.Mode==RunMode.Playing&&!game.Menu;
            rotateGate.SetActive(game.IsPortrait);
            if(lastMode!=s.Mode||lastMenu!=game.Menu){lastMode=s.Mode;lastMenu=game.Menu;BuildModal();}
            modal.SetActive(!playing&&!game.IsPortrait);
            mobileControls.SetActive(game.IsMobile&&playing);desktopHint.SetActive(!game.IsMobile&&playing);
            if(panel.Visible!=game.PanelOpen)panel.SetOpen(game.PanelOpen);
            reticle.gameObject.SetActive(!game.IsMobile&&playing&&!game.PanelOpen);
            flashAlpha=Mathf.MoveTowards(flashAlpha,0f,Time.unscaledDeltaTime*1.4f);flash.color=new Color(flashColor.r,flashColor.g,flashColor.b,flashAlpha);
            if(!game.IsMobile&&Mouse.current!=null){RectTransformUtility.ScreenPointToLocalPointInRectangle((RectTransform)transform,Mouse.current.position.ReadValue(),canvas.worldCamera,out var point);reticle.anchoredPosition=point;}
            var ctx=playing?Simulation.Context(s):null;prompt.gameObject.SetActive(ctx!=null);
            if(ctx!=null){promptText.text=ctx;var screen=game.View.Main.WorldToScreenPoint(Iso.World(s.Player.Position));screen.y-=32*canvas.scaleFactor;RectTransformUtility.ScreenPointToLocalPointInRectangle((RectTransform)transform,screen,canvas.worldCamera,out var at);prompt.anchoredPosition=at;}
            float night=s.Phase==DayPhase.Eclipse?1:0;fog.color=new Color(1,1,1,night>.5f?1:s.Phase==DayPhase.Warning?.18f:0);
            if(fogMaterial){fogMaterial.SetFloat("_Night",night);fogMaterial.SetFloat("_Safe",Simulation.IsSafe(s)?1:0);fogMaterial.SetFloat("_Clock",game.config.reducedMotion?0:s.Elapsed);}
            uiClock+=Time.unscaledDeltaTime;if(uiClock<.1f)return;uiClock=0;
            health.text=Mathf.CeilToInt(s.Player.Health).ToString();stamina.text=Mathf.CeilToInt(s.Player.Stamina).ToString();healthFill.fillAmount=s.Player.Health/s.Data.Player.MaxHealth;staminaFill.fillAmount=s.Player.Stamina/s.Data.Player.MaxStamina;staminaFill.color=s.Player.Winded>0f?new Color(.95f,.35f,.25f):Color.white;
            for(int i=0;i<6;i++)
            {
                counts[i].text=s.Inventory[i].ToString();
                bool inHand=(i==(int)Item.Crowbar&&s.Equipped==Weapon.Crowbar)||(i==(int)Item.Pistol&&s.Equipped==Weapon.Pistol);
                slotImages[i].color=inHand?new Color(.5f,.42f,.16f,.97f):Panel;
            }
            string inHandText=s.Equipped==Weapon.Fists?"In hand: fists":"In hand: "+s.Data.WeaponOf(s.Equipped).Name+(s.Equipped==Weapon.Pistol?"  ·  "+s.Inventory[(int)Item.Ammo]+" rounds":"");
            equipped.text=inHandText;equipped.color=s.Equipped==Weapon.Fists?Dim:Accent;
            UpdateStealth(s,playing);
            UpdateBaseAlert(s,playing);
            int seconds=Mathf.CeilToInt(s.Time);time.text=(seconds/60).ToString("00")+":"+(seconds%60).ToString("00");
            phase.text=s.Phase==DayPhase.Eclipse?"Until dawn":s.Phase==DayPhase.Warning?"Eclipse incoming":"Until Eclipse";
            time.color=s.Phase==DayPhase.Day?Ink:new Color(1,.6f,.4f);
            notice.text=playing&&ctx==null&&s.MessageTime>1.5f?s.Message:"";
            place.text=s.Area=="shelter"?"SAFEHOUSE · WALLS "+Mathf.CeilToInt(s.WallIntegrity)+" / "+Mathf.CeilToInt(Simulation.WallCapacity(s)):game.IsMobile?"":s.Area.ToUpperInvariant();stanceText.text=s.Player.Posture==Posture.Crouch?"Stand up":"Crouch";
        }
        static readonly Color Dim=new Color(.62f,.66f,.56f);
        static readonly string[] Compass={"right","top-right","top","top-left","left","bottom-left","bottom","bottom-right"};
        void OnGameEvent(GameEvent e)
        {
            switch(e.Kind)
            {
                case GameEventKind.WallHit:flashColor=new Color(1f,.45f,.12f);flashAlpha=.7f;break;
                case GameEventKind.Hurt:flashColor=new Color(.9f,.1f,.08f);flashAlpha=.75f;break;
                case GameEventKind.Treated:flashColor=new Color(.4f,.9f,.45f);flashAlpha=.35f;break;
            }
        }
        // How well hidden you are right now, and the wounds you carry.
        void UpdateStealth(GameState s,bool playing)
        {
            if(!playing||s.Area!="street"){stealthText.text="";}
            else
            {
                switch(Simulation.StealthOf(s))
                {
                    case Stealth.Hidden:stealthText.text="● Hidden"+(Simulation.InCover(s)?" (low in the grass)":"");stealthText.color=new Color(.55f,.85f,.5f);break;
                    case Stealth.Exposed:stealthText.text="● Exposed: something could see you";stealthText.color=new Color(.95f,.88f,.4f);break;
                    case Stealth.Noticed:stealthText.text="● Noticed: break line of sight";stealthText.color=new Color(1f,.65f,.25f);break;
                    case Stealth.Searching:stealthText.text="● Being searched for";stealthText.color=new Color(1f,.6f,.2f);break;
                    default:stealthText.text="● HUNTED";stealthText.color=new Color(1f,.3f,.22f);break;
                }
            }
            injuryText.text=s.Injuries.Count>0?"Wounds: "+s.Injuries.Count+" · Tab to see":"";injuryText.color=new Color(.95f,.5f,.35f);
        }
        // The safehouse can't be seen from inside, so what is outside it is reported in words, with a direction and a distance.
        void UpdateBaseAlert(GameState s,bool playing)
        {
            var watch=Simulation.Watch(s);
            if(!playing||(!watch.UnderAttack&&!watch.Active)||s.Phase==DayPhase.Day&&!watch.Active){alert.text="";return;}
            int walls=Mathf.CeilToInt(watch.WallFraction*100f);
            if(watch.UnderAttack)
            {
                alert.text=s.Area=="shelter"?"SOMETHING IS AT THE DOOR\nWalls "+walls+"%":"SAFEHOUSE UNDER ATTACK\nWalls "+walls+"%";
                alert.color=new Color(1f,.38f+.2f*Mathf.Sin(Time.unscaledTime*6f),.2f);
                return;
            }
            Vector3 screen=Iso.World(watch.Direction);int sector=Mathf.RoundToInt(((Mathf.Atan2(screen.y,screen.x)*Mathf.Rad2Deg+360f)%360f)/45f)%8;
            string how=watch.Distance<2.5f?"very close":watch.Distance<5f?"near":"far off";
            alert.text="Something outside · "+how+"\n(toward the "+Compass[sector]+" of the screen)";alert.color=new Color(1f,.82f,.4f);
        }
        void BuildModal()
        {
            foreach(Transform child in modalContent)Destroy(child.gameObject);
            var s=game.State;string title=help?"Controls":game.Menu?"ECLIPSE SURVIVAL":s.Mode==RunMode.Paused?"Paused":s.Mode==RunMode.Dead?"The silence returns.":"You saw the sunrise.";
            var t=Label(title,modalContent,30,new Vector2(0,-18),new Vector2(560,40),new Vector2(.5f,1));t.alignment=TextAnchor.MiddleCenter;
            string message=help?(game.IsMobile?"Push the stick a little to walk, further to jog, to the edge to run. Tap Crouch; hold it to go prone. You cannot attack while prone.\nTap Attack; hold for heavy. Swipe down to dodge.\nUse doors and workbench. Auto-loot range: 1.75 tiles.":"WASD: move · Mouse: aim · LMB / RMB: light / heavy\nShift: run · Space: dodge · E: use · C: crouch (hold: prone)\nTab or I: Survivor screen (body and backpack, time stops) · 1–6: quick-use · Esc: pause") : game.Menu?"Collect tools in the workshop. Spend them to strengthen the safehouse walls.\nSurvive the Eclipse, then try another cycle.":s.Mode==RunMode.Paused?"Your cycle is paused.":s.Mode==RunMode.Dead?"Strengthen the safehouse walls before the Eclipse.":"Cycle "+s.Cycle+" survived. Your walls stand, and supplies have shifted.";
            var body=Label(message,modalContent,18,new Vector2(0,-67),new Vector2(570,78),new Vector2(.5f,1));body.alignment=TextAnchor.MiddleCenter;
            string primary=help?"Back":game.Menu?"Start survival":s.Mode==RunMode.Paused?"Resume survival":s.Mode==RunMode.Dead?"Try another run":"Survive another cycle";
            Button(primary,modalContent,new Vector2(.5f,1),new Vector2(0,-150),new Vector2(280,52),()=>{if(help){help=false;BuildModal();}else if(game.Menu)game.StartGame();else if(s.Mode==RunMode.Paused)game.Pause(false);else if(s.Mode==RunMode.Survived)game.Continue();else game.NewRun();});
            if(help)return;
            Button("Controls",modalContent,new Vector2(.5f,1),new Vector2(-184,-215),new Vector2(164,44),()=>{help=true;BuildModal();});
            if(game.Menu)Button(game.Quick?"Quick: 35s / 25s":"Standard cycle",modalContent,new Vector2(.5f,1),new Vector2(0,-215),new Vector2(184,44),()=>{game.Quick=!game.Quick;BuildModal();});
            else Button("Restart",modalContent,new Vector2(.5f,1),new Vector2(0,-215),new Vector2(150,44),game.NewRun);
            Button(game.config.autoLoot?"Auto-loot on":"Auto-loot off",modalContent,new Vector2(.5f,1),new Vector2(184,-215),new Vector2(164,44),()=>{game.SetAutoLoot(!game.config.autoLoot);BuildModal();});
        }
        void OnDestroy(){if(game!=null)game.Bus.Unsubscribe(OnGameEvent);if(vignette)Destroy(vignette);if(vignetteTexture)Destroy(vignetteTexture);if(fogMaterial)Destroy(fogMaterial);if(white)Destroy(white);if(whiteTexture)Destroy(whiteTexture);}
    }
}
