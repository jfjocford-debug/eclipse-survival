using UnityEngine;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    /// <summary>
    /// A faint ring on the ground showing how far away enemies can notice the player. A circle on the logical
    /// ground becomes an ellipse in the isometric view, so the ring is built from projected points.
    /// </summary>
    public sealed class VisibilityRing : MonoBehaviour
    {
        const int Points=48;
        LineRenderer line;
        readonly Vector3[] positions=new Vector3[Points];

        public void Initialize(Material material)
        {
            line=gameObject.AddComponent<LineRenderer>();
            line.useWorldSpace=true;line.loop=true;line.positionCount=Points;
            line.widthMultiplier=.035f;line.numCapVertices=0;
            line.sharedMaterial=material?material:new Material(Shader.Find("Sprites/Default"));
            line.startColor=line.endColor=new Color(1f,.9f,.55f,.4f);
            line.sortingOrder=-4900; // above the ground, below buildings, props and actors
            line.enabled=false;
        }

        public void Hide(){if(line)line.enabled=false;}

        /// <summary>Shows the ring around a logical position with a radius in logical tiles.</summary>
        public void Show(V2 center,float radius)
        {
            if(!line)return;
            for(int i=0;i<Points;i++)
            {
                float angle=i*(Mathf.PI*2f/Points);
                positions[i]=Iso.World(new V2(center.X+Mathf.Cos(angle)*radius,center.Y+Mathf.Sin(angle)*radius));
            }
            line.SetPositions(positions);line.enabled=true;
        }
    }
}
