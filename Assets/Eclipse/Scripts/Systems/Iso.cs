using UnityEngine;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    public static class Iso
    {
        public static Vector3 World(V2 p) => new Vector3(p.X-p.Y,-(p.X+p.Y)*.5f,0);
        public static V2 Logical(Vector3 p) => new V2(p.x*.5f-p.y,-p.x*.5f-p.y);
        public static V2 Direction(Vector2 screen)
        {
            var d=Logical(screen);return d.SqrMagnitude<.000001f?new V2(0,0):d.Normalized*Mathf.Min(1,screen.magnitude);
        }
        public static int Sort(V2 p) => Depth.Of(p);
    }
}
