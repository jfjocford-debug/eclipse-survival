using UnityEngine;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    // Fixed pool: no per-frame GameObjects, textures, or point arrays.
    public sealed class CombatEffects : MonoBehaviour
    {
        readonly LineRenderer[] lines=new LineRenderer[16];
        GameController game;
        public void Initialize(GameController root,Material material)
        {
            game=root;
            for(int i=0;i<lines.Length;i++)
            {
                var go=new GameObject("Combat cue "+i);go.transform.SetParent(transform,false);
                var line=lines[i]=go.AddComponent<LineRenderer>();line.sharedMaterial=material;line.useWorldSpace=true;line.sortingOrder=4500;
                line.numCapVertices=0;line.numCornerVertices=0;line.widthMultiplier=.06f;line.enabled=false;
            }
        }
        void LateUpdate()
        {
            if(game==null||game.State==null)return;
            var effects=game.State.Effects;int active=Mathf.Min(lines.Length,effects.Count);
            for(int i=0;i<lines.Length;i++)
            {
                var line=lines[i];line.enabled=i<active;if(i>=active)continue;
                var e=effects[i];var origin=Iso.World(e.Position)+Vector3.up*.5f;
                var direction=e.HasTarget?Iso.World(e.Target-e.Position):Vector3.right;
                float facing=Mathf.Atan2(direction.y,direction.x),radius=e.Kind==EffectKind.Heavy?.95f:.6f;
                bool shot=e.Kind==EffectKind.Shot,arc=e.Kind==EffectKind.Hit||e.Kind==EffectKind.Heavy;
                var color=e.Kind==EffectKind.Hurt?new Color(1,.25f,.16f):e.Kind==EffectKind.Loot?new Color(.75f,1,.55f):new Color(1,.87f,.55f);
                color.a=Mathf.Clamp01(e.Time*6);line.startColor=line.endColor=color;line.widthMultiplier=e.Kind==EffectKind.Heavy?.11f:.06f;
                if(shot){line.loop=false;line.positionCount=2;line.SetPosition(0,origin);line.SetPosition(1,Iso.World(e.Target)+Vector3.up*.5f);continue;}
                if(!arc){origin-=Vector3.up*.45f;radius=e.Kind==EffectKind.Dodge?.5f:.32f;}
                line.loop=!arc;line.positionCount=12;
                for(int j=0;j<12;j++){float angle=arc?facing-.95f+j*1.9f/11:j*2*Mathf.PI/12;line.SetPosition(j,origin+new Vector3(Mathf.Cos(angle)*radius,Mathf.Sin(angle)*radius*(arc?1:.5f),0));}
            }
        }
    }
}
