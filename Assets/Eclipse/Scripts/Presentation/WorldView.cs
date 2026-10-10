using System.Collections.Generic;
using UnityEngine;
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
        SpriteRenderer targetRing;
        VisibilityRing visibility;
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
            SetHeight(player,1.95f);
            playerBody=player.GetComponent<Rigidbody2D>();if(!playerBody)playerBody=player.gameObject.AddComponent<Rigidbody2D>();playerBody.bodyType=RigidbodyType2D.Kinematic;playerBody.gravityScale=0;playerBody.interpolation=RigidbodyInterpolation2D.Interpolate;
            var body=player.GetComponent<CircleCollider2D>();if(!body)body=player.gameObject.AddComponent<CircleCollider2D>();body.radius=.06f;body.isTrigger=true;
            if(game.config.locomotion){animator=player.GetComponent<Animator>();if(!animator)animator=player.gameObject.AddComponent<Animator>();animator.runtimeAnimatorController=game.config.locomotion;}
            targetRing=Sprite("Soft aim target",PixelArt.Get("shadow"),actors);targetRing.color=new Color(1,.8f,.25f,.6f);
            visibility=new GameObject("Visibility ring").AddComponent<VisibilityRing>();visibility.transform.SetParent(actors,false);visibility.Initialize(spriteMaterial);
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
                V2[] props={new V2(.25f,.5f),new V2(9.2f,1.2f),new V2(.3f,4.8f),new V2(9.3f,9.2f),new V2(2.2f,4.15f),new V2(7.6f,3.5f),new V2(5.5f,8.5f),new V2(3.2f,2.7f),new V2(.8f,7.85f)};
                for(int i=0;i<props.Length;i++){var r=Sprite("Prop "+i,PixelArt.Get(i<4?"tree":i<7?"car":"crate"),scenery);r.transform.position=Iso.World(props[i]);r.sortingOrder=Iso.Sort(props[i]);if(i<4)SetHeight(r,2.3f);}
            }
            else
            {
                AddWall(new V2(-.2f,-.2f),6.4f,.2f);AddWall(new V2(-.2f,-.2f),.2f,6.4f);
                Label(area.ToUpperInvariant(),Iso.World(new V2(3,0))+Vector3.up*.6f,scenery);
                Label("EXIT",Iso.World(new V2(3,5.5f)),scenery);
                var bench=Sprite("Workbench",PixelArt.Get("crate"),scenery);bench.transform.position=Iso.World(new V2(3,.7f));bench.sortingOrder=400;bench.transform.localScale=new Vector3(2,1,1);
                if(area=="shelter")Label("STRENGTHEN WALLS · 1 TOOL EACH",Iso.World(new V2(3,.5f))+Vector3.up*.5f,scenery);
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
            RefreshArea();var s=game.State;var p=s.Player;
            playerBody.position=Iso.World(p.Position);player.sortingOrder=Depth.ActorOrder(p.Position,area=="street");
            float h=p.Stance==Stance.Crawl?.8f:p.Stance==Stance.Crouch?1.3f:1.95f;SetHeight(player,h);
            if(p.Posture==Posture.Stand)visibility.Hide();
            else visibility.Show(p.Position,s.Data.Player.VisibilityOf(p.Stance)+(p.Noise>0f?s.Data.Player.NoiseDetectBonus:0f));
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
        void OnDestroy(){if(grass)Destroy(grass);if(road)Destroy(road);if(floor)Destroy(floor);}
    }
}
