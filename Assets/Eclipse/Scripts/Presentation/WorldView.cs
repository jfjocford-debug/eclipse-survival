using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Tilemaps;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    public sealed class WorldView : MonoBehaviour
    {
        GameController game;
        Transform scenery, actors;
        Tilemap ground;
        Tile grass,road,floor;
        string area="";
        readonly Dictionary<int,SpriteRenderer> enemyViews=new Dictionary<int,SpriteRenderer>();
        readonly Dictionary<int,SpriteRenderer> lootViews=new Dictionary<int,SpriteRenderer>();
        readonly List<Collider2D> walls=new List<Collider2D>();
        readonly Collider2D[] overlap=new Collider2D[1];
        SpriteRenderer player;
        Rigidbody2D playerBody;
        Animator animator;
        Sprite heroSprite;
        SpriteRenderer targetRing, heldWeapon;
        VisibilityRing visibility;
        bool debugStealth;   // F3 shows the sight ring and view cones. Off by default: the world itself should tell you, as in Project Zomboid.
        readonly Dictionary<int,ViewCone> cones=new Dictionary<int,ViewCone>();
        readonly Dictionary<int,TextMesh> alerts=new Dictionary<int,TextMesh>();
        Material spriteMaterial;
        int epoch;
        public Transform PlayerTransform=>player?player.transform:null;
        public void Initialize(GameController controller)
        {
            game=controller;spriteMaterial=game.config.spriteMaterial;
            var grid=new GameObject("Isometric grid").AddComponent<Grid>();grid.transform.SetParent(transform,false);
            grid.transform.localScale=new Vector3(1,-1,1);grid.cellLayout=GridLayout.CellLayout.Isometric;grid.cellSize=new Vector3(2,1,1);
            var go=new GameObject("Ground tilemap",typeof(Tilemap),typeof(TilemapRenderer));go.transform.SetParent(grid.transform,false);
            ground=go.GetComponent<Tilemap>();go.GetComponent<TilemapRenderer>().sortingOrder=-5000;go.GetComponent<TilemapRenderer>().sharedMaterial=spriteMaterial;
            grass=MakeTile("grass");road=MakeTile("road");floor=MakeTile("floor");
            scenery=new GameObject("Static scenery").transform;scenery.SetParent(transform,false);
            actors=new GameObject("Actors and pickups").transform;actors.SetParent(transform,false);
            spriteMaterial=game.config.spriteMaterial;
            gameObject.AddComponent<CombatEffects>().Initialize(game,spriteMaterial);
            player=Actor("Player",game.config.playerPrefab,game.config.hero?game.config.hero:PixelArt.Get("scavenger"));
            SetHeight(player,1.95f);heroSprite=player.sprite;
            playerBody=player.GetComponent<Rigidbody2D>();if(!playerBody)playerBody=player.gameObject.AddComponent<Rigidbody2D>();playerBody.bodyType=RigidbodyType2D.Kinematic;playerBody.gravityScale=0;playerBody.interpolation=RigidbodyInterpolation2D.Interpolate;
            var body=player.GetComponent<CircleCollider2D>();if(!body)body=player.gameObject.AddComponent<CircleCollider2D>();body.radius=.06f;body.isTrigger=true;
            if(game.config.locomotion){animator=player.GetComponent<Animator>();if(!animator)animator=player.gameObject.AddComponent<Animator>();animator.runtimeAnimatorController=game.config.locomotion;}
            targetRing=Sprite("Soft aim target",PixelArt.Get("shadow"),actors);targetRing.color=new Color(1,.8f,.25f,.6f);
            visibility=new GameObject("Visibility ring").AddComponent<VisibilityRing>();visibility.transform.SetParent(actors,false);visibility.Initialize(spriteMaterial);
            heldWeapon=Sprite("Held weapon",PixelArt.Get("crowbar"),actors);heldWeapon.gameObject.SetActive(false);
            RefreshArea(true);
        }
        Tile MakeTile(string name){var t=ScriptableObject.CreateInstance<Tile>();t.sprite=PixelArt.Get(name);t.colliderType=Tile.ColliderType.None;return t;}
        SpriteRenderer Sprite(string name,Sprite art,Transform parent)
        {var go=new GameObject(name);go.transform.SetParent(parent,false);var r=go.AddComponent<SpriteRenderer>();r.sprite=art;if(spriteMaterial)r.sharedMaterial=spriteMaterial;return r;}
        SpriteRenderer Actor(string name,GameObject prefab,Sprite art)
        {
            if(!prefab)return Sprite(name,art,actors);
            var go=Instantiate(prefab,actors);go.name=name;var renderer=go.GetComponent<SpriteRenderer>();
            if(!renderer)renderer=go.AddComponent<SpriteRenderer>();if(art)renderer.sprite=art;if(spriteMaterial)renderer.sharedMaterial=spriteMaterial;return renderer;
        }
        static void SetHeight(SpriteRenderer r,float height){if(r.sprite)r.transform.localScale=Vector3.one*(height/r.sprite.bounds.size.y);}
        public void RefreshArea(bool force=false)
        {
            if(!force&&area==game.State.Area&&epoch==game.State.Cycle)return;
            area=game.State.Area;epoch=game.State.Cycle;
            foreach(Transform child in scenery){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            foreach(var r in enemyViews.Values)Destroy(r.gameObject);enemyViews.Clear();
            foreach(var r in lootViews.Values)Destroy(r.gameObject);lootViews.Clear();walls.Clear();ground.ClearAllTiles();
            foreach(var c in cones.Values)Destroy(c.gameObject);cones.Clear();
            foreach(var a in alerts.Values)Destroy(a.gameObject);alerts.Clear();
            int side=area=="street"?10:6;
            for(int y=0;y<side;y++)for(int x=0;x<side;x++)
            {var tile=area!="street"?floor:((y>=3&&y<5)||x==5)?road:grass;ground.SetTile(new Vector3Int(x,y,0),tile);}
            if(area=="street")
            {
                foreach(var b in Simulation.Buildings)
                {
                    var r=Sprite(b.Name,PixelArt.Get("house"),scenery);
                    r.transform.position=Iso.World(b.Position+new V2(b.Width,b.Height));SetHeight(r,3.5f);r.sortingOrder=Depth.BuildingOrder(b);
                    AddWall(b.Position,b.Width,b.Height);
                    Label(b.Name,Iso.World(b.Door)+Vector3.down*.23f,scenery);
                }
                foreach(var prop in Simulation.Props)
                {
                    string art=prop.Kind==PropKind.Tree?"tree":prop.Kind==PropKind.Car?"car":"crate";
                    var r=Sprite("Prop "+prop.Kind,PixelArt.Get(art),scenery);
                    r.transform.position=Iso.World(prop.Position);r.sortingOrder=Iso.Sort(prop.Position);
                    if(prop.Kind==PropKind.Tree)SetHeight(r,2.3f);else r.transform.localScale=Vector3.one*(prop.Kind==PropKind.Car?.62f:.4f);
                }
                Label("BACK WINDOW",Iso.World(Simulation.RearExit)+Vector3.up*.3f,scenery);
            }
            else
            {
                AddWall(new V2(-.2f,-.2f),6.4f,.2f);AddWall(new V2(-.2f,-.2f),.2f,6.4f);
                Label(area.ToUpperInvariant(),Iso.World(new V2(3,0))+Vector3.up*.6f,scenery);
                Label("EXIT",Iso.World(new V2(3,5.5f)),scenery);
                var bench=Sprite("Workbench",PixelArt.Get("crate"),scenery);bench.transform.position=Iso.World(new V2(3,.7f));bench.sortingOrder=400;bench.transform.localScale=new Vector3(2,1,1);
                if(area=="shelter")
                {
                    Label("STRENGTHEN WALLS · 1 TOOL EACH",Iso.World(new V2(3,.5f))+Vector3.up*.5f,scenery);
                    var window=Sprite("Back window",PixelArt.Get("crate"),scenery);window.transform.position=Iso.World(Simulation.RearWindow);window.sortingOrder=400;window.transform.localScale=new Vector3(1.2f,.7f,1);window.color=new Color(.55f,.75f,.9f);
                    Label("BACK WINDOW · QUIET EXIT",Iso.World(Simulation.RearWindow)+Vector3.up*.55f,scenery);
                }
            }
            Physics2D.SyncTransforms();
        }
        void AddWall(V2 origin,float width,float height)
        {
            var go=new GameObject("Solid wall");go.layer=8;go.transform.SetParent(scenery,false);
            var c=go.AddComponent<PolygonCollider2D>();
            c.points=new Vector2[]{Iso.World(origin),Iso.World(origin+new V2(width,0)),Iso.World(origin+new V2(width,height)),Iso.World(origin+new V2(0,height))};walls.Add(c);
        }
        void Label(string text,Vector3 position,Transform parent)
        {
            var go=new GameObject(text);go.transform.SetParent(parent,false);go.transform.position=position;
            var t=go.AddComponent<TextMesh>();t.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");t.GetComponent<MeshRenderer>().sharedMaterial=t.font.material;t.text=text;t.fontSize=40;t.characterSize=.07f;t.anchor=TextAnchor.MiddleCenter;t.alignment=TextAlignment.Center;t.color=new Color(.9f,.84f,.65f);t.GetComponent<MeshRenderer>().sortingOrder=4000;
        }
        public bool IsBlocked(V2 point,string requestedArea)
        {
            if(requestedArea!=area)return false;
            var filter=new ContactFilter2D{useLayerMask=true,layerMask=1<<8,useTriggers=false};
            return Physics2D.OverlapCircle(Iso.World(point),.06f,filter,overlap)>0;
        }
        void LateUpdate()
        {
            if(game==null||game.State==null)return;
            if(Keyboard.current!=null&&Keyboard.current.f3Key.wasPressedThisFrame)debugStealth=!debugStealth;
            RefreshArea();var s=game.State;var p=s.Player;
            // The animator can overwrite the sprite with a missing reference; keep the hero visible.
            if(!player.sprite){player.sprite=heroSprite;Debug.LogWarning("Player sprite was cleared by the animator; restored.");}
            playerBody.position=Iso.World(p.Position);player.sortingOrder=Depth.ActorOrder(p.Position,area=="street");
            float h=p.Stance==Stance.Crawl?.8f:p.Stance==Stance.Crouch?1.3f:1.95f;SetHeight(player,h);
            if(area!="street"||!debugStealth)visibility.Hide();
            else visibility.Show(p.Position,Simulation.DetectionRadius(s));
            // The weapon in your hands, so you can always see whether you are armed.
            bool armed=s.Equipped!=Weapon.Fists;heldWeapon.gameObject.SetActive(armed);
            if(armed)
            {
                heldWeapon.sprite=PixelArt.Get(s.Equipped==Weapon.Pistol?"pistol":"crowbar");
                heldWeapon.transform.position=Iso.World(p.Position)+Iso.World(p.Face)*.28f+Vector3.up*h*.42f;
                heldWeapon.flipX=player.flipX;heldWeapon.sortingOrder=player.sortingOrder+1;
            }
            player.flipX=p.Face.X-p.Face.Y<0;player.color=p.Invulnerable>.2f?new Color(1,.5f,.35f):Color.white;
            if(animator){Vector2 face=Iso.World(p.Face);animator.SetFloat("MoveX",face.x);animator.SetFloat("MoveY",face.y);animator.SetFloat("Speed",p.Moving?1:0);}
            foreach(var existing in enemyViews.Values)existing.gameObject.SetActive(false);
            foreach(var e in s.Enemies)
            {
                bool visible=area=="street"&&e.Health>0;
                if(!enemyViews.TryGetValue(e.Id,out var r))
                {
                    Sprite art=e.Kind==EnemyKind.Apostle?game.config.apostle:e.Kind==EnemyKind.Bandit?game.config.bandit:game.config.scavenger;
                    var prefab=e.Kind==EnemyKind.Apostle?game.config.apostlePrefab:e.Kind==EnemyKind.Bandit?game.config.banditPrefab:game.config.scavengerPrefab;
                    r=Actor(e.Kind.ToString(),prefab,art?art:PixelArt.Get(e.Kind==EnemyKind.Scavenger?"scavenger":"bandit"));enemyViews[e.Id]=r;SetHeight(r,e.Kind==EnemyKind.Apostle?2.9f:1.6f);
                }
                r.gameObject.SetActive(visible);r.transform.position=Iso.World(e.Position);r.sortingOrder=Depth.ActorOrder(e.Position,area=="street");r.color=e.Flash>0?new Color(1,.3f,.2f):Color.white;
                ShowAwareness(s,e,visible);
            }
            foreach(var l in s.Loot)
            {
                bool visible=l.Area==area&&!l.Taken;
                if(!lootViews.TryGetValue(l.Id,out var r)){r=Actor("Loot "+l.Item,game.config.lootPrefab,PixelArt.Get("crate"));r.transform.localScale=Vector3.one*.35f;lootViews[l.Id]=r;}
                r.gameObject.SetActive(visible);r.transform.position=Iso.World(l.Position)+Vector3.up*(game.config.reducedMotion?0:Mathf.Sin(s.Elapsed*3+l.Id)*.025f);r.sortingOrder=Iso.Sort(l.Position);r.color=new Color(1,.9f,.6f);
            }
            var target=Simulation.AimTarget(s);targetRing.gameObject.SetActive(target!=null);
            if(target!=null){targetRing.transform.position=Iso.World(target.Position);targetRing.sortingOrder=Iso.Sort(target.Position)-1;}
        }
        // What each enemy is looking at, and how much it has noticed: the cone on the ground, and a question or exclamation mark overhead.
        void ShowAwareness(GameState s,Enemy e,bool visible)
        {
            if(!cones.TryGetValue(e.Id,out var cone)){cone=new GameObject("View cone "+e.Id).AddComponent<ViewCone>();cone.transform.SetParent(actors,false);cone.Initialize(spriteMaterial);cones[e.Id]=cone;}
            if(!alerts.TryGetValue(e.Id,out var mark))
            {
                var go=new GameObject("Alert "+e.Id);go.transform.SetParent(actors,false);mark=go.AddComponent<TextMesh>();
                mark.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");mark.GetComponent<MeshRenderer>().sharedMaterial=mark.font.material;
                mark.fontSize=64;mark.characterSize=.09f;mark.anchor=TextAnchor.MiddleCenter;mark.alignment=TextAlignment.Center;mark.GetComponent<MeshRenderer>().sortingOrder=4200;alerts[e.Id]=mark;
            }
            bool hunting=e.State==AiState.Chase||e.State==AiState.Attack,searching=e.State==AiState.Search,wary=e.Awareness>0f&&!hunting;
            bool near=V2.Distance(e.Position,s.Player.Position)<14f;
            if(!visible||!near||e.State==AiState.Flee){cone.Hide();mark.gameObject.SetActive(false);return;}
            var def=s.Data.EnemyOf(e.Kind);float half=def.ViewHalfAngle>0f?def.ViewHalfAngle:65f;
            Color tone=hunting?new Color(1f,.3f,.2f,.5f):searching?new Color(1f,.62f,.2f,.42f):wary?new Color(1f,.82f,.3f,.38f):new Color(1f,.92f,.6f,.2f);
            if(hunting||!debugStealth)cone.Hide();else cone.Show(e.Position,e.Face,half,Simulation.DetectionRadius(s,e.Kind),tone);
            mark.gameObject.SetActive(hunting||searching||wary);
            if(mark.gameObject.activeSelf)
            {
                mark.text=hunting?"!":"?";mark.color=hunting?new Color(1f,.3f,.2f):searching?new Color(1f,.62f,.2f):new Color(1f,.9f,.4f);
                mark.transform.position=Iso.World(e.Position)+Vector3.up*(e.Kind==EnemyKind.Apostle?3.2f:1.95f);
                mark.transform.localScale=Vector3.one*(hunting||searching?1.2f:.6f+.6f*e.Awareness);
            }
        }
        void OnDestroy(){if(grass)Destroy(grass);if(road)Destroy(road);if(floor)Destroy(floor);}
    }
}
