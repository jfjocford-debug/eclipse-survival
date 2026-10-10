using System;

namespace EclipseSurvival.Core
{
    /// <summary>
    /// Draw order for the isometric view. Each building is one sprite with one sort value, so ordering an actor
    /// against it by a single number (x + y) is wrong beside the building: standing just east of its northern end
    /// the sum is small, the building is drawn over the player and the player seems to walk into the wall.
    /// The correct rule for axis-aligned boxes seen from the south-east is: the actor is in front when it is
    /// east of the building or south of it, otherwise behind. <see cref="ActorOrder"/> applies that rule.
    /// </summary>
    public static class Depth
    {
        /// <summary>How far behind its front corner a building sorts, so props on its front edge draw over it.</summary>
        public const int BuildingBias = -20;

        /// <summary>The plain depth of a point: further south-east draws later.</summary>
        public static int Of(V2 p) { return (int)Math.Round((p.X + p.Y) * 100f, MidpointRounding.ToEven); }

        /// <summary>The sort value of a building's sprite, taken at its front (south-east) corner.</summary>
        public static int BuildingOrder(Building b) { return Of(b.Position + new V2(b.Width, b.Height)) + BuildingBias; }

        public enum Relation { Behind, InFront, Free }

        /// <summary>
        /// Where a point is relative to a building. East of it or south of it the point must draw over the building;
        /// north or west of it, behind. Diagonally off its north-east or south-west corner the two do not overlap on
        /// screen, so either order is right and the point is Free (otherwise two buildings could demand opposite orders).
        /// </summary>
        public static Relation RelationTo(Building b, V2 p)
        {
            bool east = p.X > b.Position.X + b.Width, south = p.Y > b.Position.Y + b.Height;
            bool west = p.X < b.Position.X, north = p.Y < b.Position.Y;
            if ((east && north) || (south && west)) return Relation.Free;
            return east || south ? Relation.InFront : Relation.Behind;
        }

        /// <summary>
        /// The sort value for a moving actor. It follows <see cref="Of"/>, raised above every building the actor is
        /// in front of and lowered below every building it is behind. Pass street = false inside interiors.
        /// </summary>
        public static int ActorOrder(V2 p, bool street)
        {
            int order = Of(p);
            if (!street) return order;
            int low = int.MinValue, high = int.MaxValue;
            for (int i = 0; i < Simulation.Buildings.Count; i++)
            {
                Building b = Simulation.Buildings[i]; int sort = BuildingOrder(b);
                Relation relation = RelationTo(b, p);
                if (relation == Relation.InFront) low = Math.Max(low, sort + 1); else if (relation == Relation.Behind) high = Math.Min(high, sort - 1);
            }
            if (order < low) order = low;
            if (order > high) order = high;
            return order;
        }
    }
}
