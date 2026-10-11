using UnityEngine;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    /// <summary>
    /// A faint wedge on the ground showing where one enemy is looking and how far it can see you. Enemies see in front
    /// of them, not all around, so the wedge is the thing to stay out of, or to get behind a building or a car to break.
    /// </summary>
    public sealed class ViewCone : MonoBehaviour
    {
        const int Arc = 10;
        LineRenderer line;
        readonly Vector3[] positions = new Vector3[Arc + 2];

        public void Initialize(Material material)
        {
            line = gameObject.AddComponent<LineRenderer>();
            line.useWorldSpace = true; line.loop = true; line.positionCount = positions.Length;
            line.widthMultiplier = .03f; line.numCapVertices = 0;
            line.sharedMaterial = material ? material : new Material(Shader.Find("Sprites/Default"));
            line.sortingOrder = -4890; // above the ground and the player's ring, below buildings, props and actors
            line.enabled = false;
        }

        public void Hide() { if (line) line.enabled = false; }

        /// <summary>Draws the wedge from a logical position, looking along face, with a half-angle in degrees and a radius in tiles.</summary>
        public void Show(V2 origin, V2 face, float halfAngleDegrees, float radius, Color color)
        {
            if (!line) return;
            float centre = Mathf.Atan2(face.Y, face.X), half = halfAngleDegrees * Mathf.Deg2Rad;
            positions[0] = Iso.World(origin);
            for (int i = 0; i <= Arc; i++)
            {
                float angle = centre - half + 2f * half * i / Arc;
                positions[i + 1] = Iso.World(new V2(origin.X + Mathf.Cos(angle) * radius, origin.Y + Mathf.Sin(angle) * radius));
            }
            line.SetPositions(positions); line.startColor = line.endColor = color; line.enabled = true;
        }
    }
}
