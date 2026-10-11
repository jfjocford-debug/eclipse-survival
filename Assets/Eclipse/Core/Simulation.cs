using System;
using System.Collections.Generic;

namespace EclipseSurvival.Core
{
    /// <summary>Authored logical-world simulation. No Unity, physics, clock or global RNG dependencies.</summary>
    public static class Simulation
    {
        public const float AutoLootRadius = 1.75f;
        // Combat assist tuning. Every value here is a feel dial; change them without touching the logic.
        /// <summary>Time before a swing's cooldown ends in which a new press is remembered, not dropped.</summary>
        public const float AttackBufferWindow = .2f;
        private const float PointBlank = .5f;                   // Melee targets this close are acquired from any direction.
        // Numbers a designer tunes (weapons, enemies, walls, clock) live in GameData. What stays here are feel
        // constants of the aim assist and one safety net.
        private const float SiegeSnapAfter = 10f;        // seconds of travel before a stuck Apostle is placed at the door
        private const float AngleWeight = 1.5f;                // Higher favours the enemy you face over a nearer one off to the side.
        private const float LockBonus = .6f;                    // Score multiplier that keeps the current target from flickering.
        private const float LockRangeSlack = 1.15f;             // A locked target may drift this much farther out before it is dropped.
        private const float LockAngleSlack = .2f;               // ...and this much wider in angle (as a cosine).

        // Stealth feel dials. Numbers a designer tunes per enemy live in GameData; these are shared rules of the world.
        private const float CloseSense = .9f;                   // Inside this range an enemy senses you from any direction.
        private const float PointBlankNotice = .6f;             // Inside this range it notices you at once.
        private const float AwarenessFade = 1.5f;               // Seconds for full suspicion to drain once you are out of sight.
        private const float StillFactor = .8f;                  // Standing still shrinks the range at which you are seen.
        private const float GrassFactor = .65f;                 // Low in the grass shrinks it further.
        private const float ArriveDistance = .4f;
        private const float PostTolerance = .15f;               // How close to its post at the door the Apostle must be to count as there.
        private const float WallHitInterval = 1.4f;             // Seconds between blows on the safehouse walls.
        private const float SearchRadius = 1.6f;
        /// <summary>The way out of the safehouse that does not pass the front door: a window on the north wall, reached from the workbench room.</summary>
        public static readonly V2 RearExit = new V2(1.65f, .36f);
        public static readonly V2 RearWindow = new V2(5.1f, 1.4f);

        /// <summary>Solid objects on the street. They block walking and sight, so a crouched player can break line of sight behind them.</summary>
        public static readonly IReadOnlyList<Prop> Props = Array.AsReadOnly(new[]
        {
            new Prop { Kind=PropKind.Tree, Position=new V2(3.2f,5.4f), HalfWidth=.15f, HalfHeight=.15f },
            new Prop { Kind=PropKind.Tree, Position=new V2(9.2f,1.2f), HalfWidth=.15f, HalfHeight=.15f },
            new Prop { Kind=PropKind.Tree, Position=new V2(.3f,4.8f), HalfWidth=.15f, HalfHeight=.15f },
            new Prop { Kind=PropKind.Tree, Position=new V2(9.3f,9.2f), HalfWidth=.15f, HalfHeight=.15f },
            new Prop { Kind=PropKind.Car, Position=new V2(2.2f,4.65f), HalfWidth=.38f, HalfHeight=.2f },
            new Prop { Kind=PropKind.Car, Position=new V2(7.6f,4.65f), HalfWidth=.38f, HalfHeight=.2f },
            new Prop { Kind=PropKind.Car, Position=new V2(4.2f,8.6f), HalfWidth=.38f, HalfHeight=.2f },
            new Prop { Kind=PropKind.Crate, Position=new V2(3.4f,4.7f), HalfWidth=.2f, HalfHeight=.2f },
            new Prop { Kind=PropKind.Crate, Position=new V2(.8f,7.85f), HalfWidth=.2f, HalfHeight=.2f }
        });

        /// <summary>The data this run uses; a state built without data (for example by hand) gets the shipped defaults.</summary>
        private static GameData Dat(GameState state) { return state.Data ?? (state.Data = GameData.Default); }

        /// <summary>Optional external solid-wall query. TRUE means blocked; null means core geometry only.</summary>
        public static Func<V2, string, bool> CollisionProbe { get; set; }

        public static readonly IReadOnlyList<Building> Buildings = Array.AsReadOnly(new[]
        {
            new Building { Id="shelter", Name="SAFEHOUSE", Position=new V2(.65f,.65f), Width=2f, Height=1.7f,
                Door=new V2(1.65f,2.57f), Hint="Reinforce with 3 tools", Color="#89927c", Roof="#4c6362" },
            new Building { Id="clinic", Name="CLINIC", Position=new V2(3.4f,.35f), Width=1.7f, Height=1.65f,
                Door=new V2(4.25f,2.22f), Hint="Medicine & supplies", Color="#a29c82", Roof="#796c60" },
            new Building { Id="market", Name="CORNER STORE", Position=new V2(6.65f,.6f), Width=2f, Height=1.75f,
                Door=new V2(7.65f,2.57f), Hint="Food & ammunition", Color="#a7a184", Roof="#765c50" },
            new Building { Id="workshop", Name="WORKSHOP", Position=new V2(.65f,5.6f), Width=2f, Height=1.8f,
                Door=new V2(1.65f,7.62f), Hint="Tools & crowbar", Color="#7f8d82", Roof="#52666c" },
            new Building { Id="house", Name="ABANDONED HOME", Position=new V2(6.7f,5.8f), Width=2f, Height=1.8f,
                Door=new V2(7.7f,7.82f), Hint="Weapon & supplies", Color="#8c8679", Roof="#616064" }
        });

        public static GameState Create(uint seed = 1, bool quick = false, GameData data = null)
        {
            if (data == null) data = GameData.CreateDefault();
            List<string> problems = data.Validate();
            if (problems.Count > 0) throw new ArgumentException("Invalid game data: " + problems[0] + (problems.Count > 1 ? " (+" + (problems.Count - 1) + " more)" : ""), "data");
            data.Prepare();
            var state = new GameState
            {
                Data = data,
                Seed = seed,
                DayDuration = quick ? data.Clock.QuickDaySeconds : data.Clock.DaySeconds,
                NightDuration = quick ? data.Clock.QuickEclipseSeconds : data.Clock.EclipseSeconds,
                Message = "Search the workshop for tools. Reinforce the safehouse before dark.",
                MessageTime = 7f
            };
            state.Time = state.Duration = state.DayDuration;
            state.Player.Health = data.Player.MaxHealth; state.Player.Stamina = data.Player.MaxStamina;
            state.Inventory[(int)Item.Food] = 1;
            state.WallIntegrity = WallCapacity(state);
            Populate(state);
            return state;
        }

        public static void Start(GameState state) { state.Mode = RunMode.Playing; Emit(state, GameEventKind.Start); }
        /// <summary>You are safe indoors only in the safehouse and only while its walls still stand.</summary>
        public static bool IsSafe(GameState state) { return state.Area == "shelter" && state.WallIntegrity > 0f; }
        public static float WallCapacity(GameState state) { SafehouseDef h = Dat(state).Safehouse; return h.BaseIntegrity + h.IntegrityPerTool * state.WallTools; }
        public static float WallPressure(GameState state)
        {
            EclipseProfile e = Dat(state).EclipseFor(state.Cycle);
            return e.WallPressure * (1f + e.WallPressureGrowth * (state.Cycle - 1));
        }
        public static string ItemName(GameState state, Item item) { return Dat(state).ItemOf(item).Name; }
        /// <summary>The shipped name of an item, for code with no game state to ask.</summary>
        public static string ItemName(Item item) { return GameData.Default.ItemOf(item).Name; }

        public static Building FindBuilding(string id)
        {
            for (int i = 0; i < Buildings.Count; i++) if (Buildings[i].Id == id) return Buildings[i];
            return null;
        }

        private static double Random(GameState state)
        {
            state.Seed = unchecked(state.Seed * 1664525u + 1013904223u);
            return state.Seed / 4294967296.0;
        }

        private static void AddLoot(GameState state, string area, Item item, int count, float x, float y)
        {
            // The same two RNG draws, in the same order, as the browser engine.
            float px = x + (float)((Random(state) - .5) * .7);
            float py = y + (float)((Random(state) - .5) * .7);
            state.Loot.Add(new Loot { Id = state.Loot.Count, Area = area, Item = item, Count = count,
                Position = new V2(px, py) });
        }

        public static Enemy CreateEnemy(int id, EnemyKind kind, V2 position, GameData data = null)
        {
            return new Enemy { Id = id, Kind = kind, Position = position,
                Health = (data ?? GameData.Default).EnemyOf(kind).Health,
                State = AiState.Patrol, Target = new V2(5f, 5f) };
        }

        public static void Populate(GameState state)
        {
            state.Loot.Clear();
            AddLoot(state, "workshop", Item.Tools, 3, 1.45f, 1.5f);
            AddLoot(state, "workshop", Item.Crowbar, 1, 4.3f, 1.5f);
            AddLoot(state, "workshop", Item.Tools, 1, 4.5f, 3.2f);
            AddLoot(state, "clinic", Item.Medicine, 2, 1.5f, 1.5f);
            AddLoot(state, "clinic", Item.Food, 1, 4.3f, 2f);
            AddLoot(state, "market", Item.Food, 3, 1.5f, 1.5f);
            AddLoot(state, "market", Item.Ammo, 8, 4.4f, 1.5f);
            AddLoot(state, "house", Item.Pistol, 1, 1.4f, 1.5f);
            AddLoot(state, "house", Item.Ammo, 6, 4.3f, 1.7f);
            AddLoot(state, "house", Item.Medicine, 1, 4.3f, 3.3f);
            AddLoot(state, "street", Item.Tools, 1, 3.4f, 6.7f);
            AddLoot(state, "street", Item.Food, 1, 6.3f, 3.25f);
            AddLoot(state, "street", Item.Ammo, 4, 5.8f, 8.4f);
            state.Enemies.Clear();
            GameData data = Dat(state);
            state.Enemies.Add(CreateEnemy(1, EnemyKind.Bandit, new V2(8.8f, 4.4f), data));
            state.Enemies.Add(CreateEnemy(2, EnemyKind.Scavenger, new V2(3.2f, 8.5f), data));
            state.Enemies.Add(CreateEnemy(3, EnemyKind.Bandit, new V2(5.6f, 1.2f), data));
        }

        // The legacy name for each kind. Two kinds share "dawn" because the old single-string event could not tell them apart.
        private static readonly string[] EventNames =
        {
            "start", "door", "build", "loot", "equip", "heal", "dodge", "empty",
            "swing", "shot", "heavy", "hit", "heavyHit", "shotHit", "hurt", "dead",
            "warning", "eclipse", "dawn", "dawn", "snarl", "siege", "cracking", "breach", "enemyState", "winded", "posture",
            "injured", "treated", "wallHit", "noticed", "lostTrack"
        };

        private static void Emit(GameState state, GameEventKind kind, EventSource source = EventSource.None, int subject = -1,
            int value = 0, float amount = 0f, V2? position = null)
        {
            state.Event = EventNames[(int)kind]; state.EventId++;
            state.Events.Add(new GameEvent { Id = state.EventId, Kind = kind, Source = source, Subject = subject, Value = value,
                Amount = amount, Position = position ?? state.Player.Position });
            if (state.Events.Count > GameState.EventLogCapacity)
                state.Events.RemoveRange(0, state.Events.Count - GameState.EventLogCapacity);
        }

        private static EventSource SourceOf(EnemyKind kind)
        {
            return kind == EnemyKind.Apostle ? EventSource.Apostle : kind == EnemyKind.Scavenger ? EventSource.Scavenger : EventSource.Bandit;
        }

        /// <summary>Changes an enemy's AI state and announces it, but only when the state actually changes.</summary>
        private static void SetAi(GameState state, Enemy enemy, AiState next)
        {
            if (enemy.State == next) return;
            enemy.State = next;
            Emit(state, GameEventKind.EnemyState, SourceOf(enemy.Kind), enemy.Id, (int)next, 0f, enemy.Position);
        }
        private static void Say(GameState state, string message) { state.Message = message; state.MessageTime = 4f; }

        public static bool CanWalk(V2 position, string area, float radius = .13f)
        {
            if (!Finite(position.X) || !Finite(position.Y)) return false;
            if (area != "street")
            {
                if (position.X < .35f || position.Y < .35f || position.X > 5.65f || position.Y > 5.65f) return false;
            }
            else
            {
                if (position.X < .2f || position.Y < .2f || position.X > 9.8f || position.Y > 9.8f) return false;
                for (int i = 0; i < Buildings.Count; i++)
                {
                    Building b = Buildings[i];
                    if (position.X > b.Position.X - radius && position.X < b.Position.X + b.Width + radius &&
                        position.Y > b.Position.Y - radius && position.Y < b.Position.Y + b.Height + radius) return false;
                }
                for (int i = 0; i < Props.Count; i++)
                {
                    Prop prop = Props[i];
                    if (position.X > prop.Position.X - prop.HalfWidth - radius && position.X < prop.Position.X + prop.HalfWidth + radius &&
                        position.Y > prop.Position.Y - prop.HalfHeight - radius && position.Y < prop.Position.Y + prop.HalfHeight + radius) return false;
                }
            }
            return CollisionProbe == null || !CollisionProbe(position, area);
        }

        /// <summary>Subdivided axis-separated motion, preserving wall sliding without tunneling.</summary>
        public static V2 Move(V2 position, V2 displacement, string area)
        {
            if (!Finite(displacement.X) || !Finite(displacement.Y)) return position;
            int steps = Math.Max(1, (int)Math.Ceiling(displacement.Magnitude / .09f));
            V2 delta = displacement * (1f / steps);
            for (int i = 0; i < steps; i++)
            {
                V2 candidate = new V2(position.X + delta.X, position.Y);
                if (CanWalk(candidate, area)) position.X = candidate.X;
                candidate = new V2(position.X, position.Y + delta.Y);
                if (CanWalk(candidate, area)) position.Y = candidate.Y;
            }
            return position;
        }

        public static bool LineClear(V2 from, V2 to)
        {
            V2 difference = to - from;
            for (int i = 1; i < 20; i++) if (!CanWalk(from + difference * (i / 20f), "street", 0f)) return false;
            return true;
        }

        public static Loot NearestLoot(GameState state)
        {
            Loot closest = null;
            float best = .85f * .85f;
            for (int i = 0; i < state.Loot.Count; i++)
            {
                Loot loot = state.Loot[i];
                if (loot.Taken || loot.Area != state.Area) continue;
                float squared = (loot.Position - state.Player.Position).SqrMagnitude;
                if (squared < best) { best = squared; closest = loot; }
            }
            return closest;
        }

        private static Building NearbyDoor(GameState state)
        {
            for (int i = 0; i < Buildings.Count; i++)
                if ((Buildings[i].Door - state.Player.Position).SqrMagnitude < .8f * .8f) return Buildings[i];
            return null;
        }

        public static string Context(GameState state)
        {
            if (state.Area == "street")
            {
                Building b = NearbyDoor(state);
                if (b != null) return "Enter " + b.Name.ToLowerInvariant();
                if (V2.Distance(state.Player.Position, RearExit) < .8f) return "Climb in through the back window";
            }
            else
            {
                if (V2.Distance(state.Player.Position, new V2(3f, 5.3f)) < .8f) return "Leave building";
                if (state.Area == "shelter" && V2.Distance(state.Player.Position, new V2(3f, 1.3f)) < 1.1f)
                    return state.WallTools >= Dat(state).Safehouse.MaxTools ? "Walls fully reinforced" : "Reinforce walls (1 tool)";
                if (state.Area == "shelter" && V2.Distance(state.Player.Position, RearWindow) < .8f) return "Climb out the back window (quiet)";
            }
            Loot loot = NearestLoot(state);
            if (loot == null) return null;
            return loot.Item == Item.Tools ? "Search toolbox" : loot.Item == Item.Crowbar ? "Search workbench" :
                loot.Item == Item.Pistol ? "Search gun case" : "Search supplies";
        }

        public static void Interact(GameState state)
        {
            if (state.Mode != RunMode.Playing || state.InteractCooldown > 0f) return;
            state.InteractCooldown = .28f;
            if (state.Area == "street")
            {
                Building b = NearbyDoor(state);
                if (b != null)
                {
                    state.Area = b.Id; state.Player.Position = new V2(3f, 4.4f); state.Target = null;
                    Emit(state, GameEventKind.Door);
                    Say(state, b.Id == "shelter" ? (state.WallTools > 0 ? "The walls hold. Spend spare tools at the workbench to strengthen them." :
                        "Reach the workbench. Each tool you spend makes these walls stronger.") : b.Hint + ". Search the glowing containers.");
                    return;
                }
                if (V2.Distance(state.Player.Position, RearExit) < .8f)
                {
                    state.Area = "shelter"; state.Player.Position = RearWindow + new V2(-.5f, .1f); state.Target = null;
                    Emit(state, GameEventKind.Door); Say(state, "You slip in through the back window.");
                    return;
                }
            }
            else
            {
                if (V2.Distance(state.Player.Position, new V2(3f, 5.3f)) < .8f)
                {
                    Building b = FindBuilding(state.Area);
                    if (b == null) return;
                    state.Area = "street"; state.Player.Position = b.Door + new V2(0f, .15f); state.Target = null;
                    Emit(state, GameEventKind.Door); return;
                }
                if (state.Area == "shelter" && V2.Distance(state.Player.Position, RearWindow) < .8f)
                {
                    state.Area = "street"; state.Player.Position = RearExit; state.Target = null;
                    SetPosture(state, Posture.Crouch);   // you drop out low and quiet
                    Emit(state, GameEventKind.Door); Say(state, "Out the back, low and quiet. The front door is on the other side.");
                    return;
                }
                if (state.Area == "shelter" && V2.Distance(state.Player.Position, new V2(3f, 1.3f)) < 1.1f)
                {
                    if (state.Phase == DayPhase.Eclipse) { Say(state, "The Eclipse is here. Walls cannot be built now."); return; }
                    if (state.WallTools >= Dat(state).Safehouse.MaxTools) { Say(state, "The walls are as strong as they can be for now."); return; }
                    if (state.Inventory[(int)Item.Tools] < 1) { Say(state, "Need a tool. The workshop has a full set."); return; }
                    state.Inventory[(int)Item.Tools]--; state.WallTools++; state.WallIntegrity = WallCapacity(state);
                    Emit(state, GameEventKind.Build, EventSource.Player, -1, state.WallTools, state.WallIntegrity);
                    Say(state, "WALLS REINFORCED · integrity " + (int)state.WallIntegrity + (state.WallTools < Dat(state).Safehouse.MaxTools ? ". More tools make them stronger." : ". As strong as they can be."));
                    return;
                }
            }
            Loot loot = NearestLoot(state);
            if (loot != null) CollectLoot(state, loot);
            else Say(state, "Move closer to a doorway or glowing supplies.");
        }

        public static bool CollectLoot(GameState state, Loot loot, bool automatic = false)
        {
            if (state.Mode != RunMode.Playing || loot == null || loot.Taken || loot.Area != state.Area) return false;
            loot.Taken = true; state.Inventory[(int)loot.Item] += loot.Count; state.Collected += loot.Count;
            Emit(state, GameEventKind.Loot, EventSource.Player, loot.Id, (int)loot.Item, loot.Count, loot.Position); Say(state, "+" + loot.Count + " " + ItemName(state, loot.Item) + (automatic ? " · collected" : ""));
            ItemDef def = Dat(state).ItemOf(loot.Item);
            if (def.Use == ItemUse.Weapon && (!automatic || state.Equipped == Weapon.Fists)) state.Equipped = def.Weapon;
            state.Effects.Add(new Effect { Position = loot.Position, Kind = EffectKind.Loot, Time = .65f });
            return true;
        }

        public static Loot AutoLoot(GameState state)
        {
            if (!state.AutoLoot || state.Mode != RunMode.Playing || state.LootCooldown > 0f) return null;
            Loot selected = null; int bestPriority = int.MaxValue; float bestDistance = float.MaxValue;
            for (int i = 0; i < state.Loot.Count; i++)
            {
                Loot loot = state.Loot[i];
                if (loot.Taken || loot.Area != state.Area) continue;
                float squared = (loot.Position - state.Player.Position).SqrMagnitude;
                if (squared > AutoLootRadius * AutoLootRadius || (state.Area == "street" && !LineClear(state.Player.Position, loot.Position))) continue;
                int priority = Dat(state).ItemOf(loot.Item).LootPriority;
                if (priority < bestPriority || (priority == bestPriority && squared < bestDistance))
                { selected = loot; bestPriority = priority; bestDistance = squared; }
            }
            if (selected == null || !CollectLoot(state, selected, true)) return null;
            state.LootCooldown = .38f;
            return selected;
        }

        public static bool TapLoot(GameState state, V2 point)
        {
            Loot selected = null; float bestDistance = .5f * .5f;
            for (int i = 0; i < state.Loot.Count; i++)
            {
                Loot loot = state.Loot[i];
                if (loot.Taken || loot.Area != state.Area || (loot.Position - state.Player.Position).SqrMagnitude > AutoLootRadius * AutoLootRadius) continue;
                float squared = (loot.Position - point).SqrMagnitude;
                if (squared >= bestDistance || (state.Area == "street" && !LineClear(state.Player.Position, loot.Position))) continue;
                selected = loot; bestDistance = squared;
            }
            return selected != null && CollectLoot(state, selected);
        }

        public static void UseItem(GameState state, Item item)
        {
            if (state.Mode != RunMode.Playing) return;
            GameData data = Dat(state); ItemDef def = data.ItemOf(item);
            if (state.Inventory[(int)item] <= 0) { Say(state, "No " + def.Name.ToLowerInvariant() + ". Search the buildings."); return; }
            if (def.Use == ItemUse.Weapon)
            {
                state.Equipped = state.Equipped == def.Weapon ? Weapon.Fists : def.Weapon; Emit(state, GameEventKind.Equip, EventSource.Player, -1, (int)state.Equipped); return;
            }
            if (def.Use == ItemUse.Consumable)
            {
                Actor p = state.Player;
                if (def.RefuseAtFullHealth && p.Health >= data.Player.MaxHealth && state.Injuries.Count == 0) { Say(state, "You are not hurt."); return; }
                p.Stamina = Math.Min(data.Player.MaxStamina, p.Stamina + def.StaminaRestore);
                p.Health = Math.Min(data.Player.MaxHealth, p.Health + def.HealthRestore); state.Inventory[(int)item]--;
                string effects = (def.StaminaRestore > 0f ? "+" + (int)def.StaminaRestore + " stamina" : "") +
                    (def.StaminaRestore > 0f && def.HealthRestore > 0f ? " \u00b7 " : "") + (def.HealthRestore > 0f ? "+" + (int)def.HealthRestore + " health" : "");
                string treated = item == Item.Medicine ? Treat(state) : null;
                Say(state, def.UseText + " " + effects + (treated != null ? " \u00b7 " + treated : "")); Emit(state, GameEventKind.Heal, EventSource.Player, -1, (int)item);
                return;
            }
            if (item == Item.Tools) Say(state, "Spend tools at the safehouse workbench.");
            if (item == Item.Ammo) Say(state, state.Inventory[(int)Item.Pistol] > 0 ? "Equip the pistol to use ammunition." : "Find a pistol in the abandoned home.");
        }

        private static void SetPosture(GameState state, Posture posture)
        {
            if (state.Player.Posture == posture) return;
            state.Player.Posture = posture;
            Emit(state, GameEventKind.Posture, EventSource.Player, -1, (int)posture);
        }

        /// <summary>Tap of the crouch button: stand becomes crouch, crouch becomes stand, prone becomes crouch.</summary>
        public static void ToggleCrouch(GameState state)
        {
            if (state.Mode != RunMode.Playing || state.Player.Dodge > 0f) return;
            SetPosture(state, state.Player.Posture == Posture.Crouch ? Posture.Stand : Posture.Crouch);
        }

        /// <summary>Hold of the crouch button: go prone from standing or crouching.</summary>
        public static void GoProne(GameState state)
        {
            if (state.Mode != RunMode.Playing || state.Player.Dodge > 0f) return;
            SetPosture(state, Posture.Prone);
        }

        public static void Dodge(GameState state, V2? direction = null)
        {
            Actor p = state.Player;
            PlayerDef pd = Dat(state).Player;
            if (state.Mode != RunMode.Playing || p.Dodge > 0f || p.Stamina < pd.DodgeStaminaCost) return;
            if (direction.HasValue && direction.Value.Magnitude > .01f) p.Face = direction.Value.Normalized;
            SetPosture(state, Posture.Stand);   // a dodge always gets the player up
            p.Stamina -= pd.DodgeStaminaCost; p.Dodge = pd.DodgeDuration; p.Invulnerable = pd.DodgeInvulnerable; state.Target = null; state.AttackBuffered = false; Emit(state, GameEventKind.Dodge, EventSource.Player);
            state.Effects.Add(new Effect { Position = p.Position, Kind = EffectKind.Dodge, Time = .4f });
        }

        /// <summary>
        /// Soft-lock target selection. Every living enemy in range and in line of sight is scored by distance,
        /// with a penalty for being off to the side, and the lowest score wins. Melee uses a wide cone and
        /// always sees enemies at point-blank range; the current lock gets a bonus so it does not flicker.
        /// </summary>
        public static Enemy AimTarget(GameState state)
        {
            if (state.Area != "street") return null;
            Actor p = state.Player; WeaponDef weapon = Dat(state).WeaponOf(state.Equipped); bool ranged = weapon.Ranged;
            float range = weapon.AcquireRange;
            float cosine = weapon.AimCosine;
            float faceLength = p.Face.Magnitude; if (faceLength == 0f) faceLength = 1f;
            Enemy chosen = null; float bestScore = float.MaxValue;
            for (int i = 0; i < state.Enemies.Count; i++)
            {
                Enemy e = state.Enemies[i]; if (e.Health <= 0f) continue;
                bool locked = e.Id == state.LockId;
                float limit = locked ? range * LockRangeSlack : range;
                V2 delta = e.Position - p.Position; float squared = delta.SqrMagnitude;
                if (squared > limit * limit || !LineClear(p.Position, e.Position)) continue;
                float distance = (float)Math.Sqrt(squared);
                float dot = V2.Dot(delta, p.Face) / (Math.Max(.0001f, distance) * faceLength);
                if (!Finite(dot)) continue;
                dot = Math.Max(-1f, Math.Min(1f, dot));
                bool pointBlank = !ranged && distance <= PointBlank;
                if (dot < (locked ? cosine - LockAngleSlack : cosine) && !pointBlank) continue;
                float score = distance * (1f + AngleWeight * (1f - dot));
                if (locked) score *= LockBonus;
                if (score < bestScore) { bestScore = score; chosen = e; }
            }
            return chosen;
        }

        public static bool Attack(GameState state, bool heavy = false)
        {
            Actor p = state.Player;
            if (state.Mode != RunMode.Playing || p.Dodge > 0f) return false;
            if (p.Posture == Posture.Prone) { Say(state, "Get up to fight. You cannot attack while prone."); return false; }
            if (p.Cooldown > 0f)
            {
                // A press just before the previous swing recovers is remembered and fired by Step, not dropped.
                if (p.Cooldown <= AttackBufferWindow) { state.AttackBuffered = true; state.BufferedHeavy = heavy; state.AttackBufferTime = AttackBufferWindow; }
                return false;
            }
            state.AttackBuffered = false;
            GameData data = Dat(state); WeaponDef weapon = data.WeaponOf(state.Equipped); bool ranged = weapon.Ranged;
            int ammoCost = heavy ? weapon.HeavyAmmoCost : weapon.AmmoCost; float staminaCost = heavy ? weapon.HeavyStaminaCost : weapon.StaminaCost;
            if (ranged && state.Inventory[(int)Item.Ammo] < ammoCost)
            { Say(state, heavy ? "Heavy shot needs " + ammoCost + " rounds." : "Out of ammo. Equip your crowbar or fists."); Emit(state, GameEventKind.Empty, EventSource.Player); return false; }
            // A heavy attack needs its stamina. A light swing never silently fails: out of breath, it still goes out, weaker.
            bool winded = staminaCost > 0f && p.Stamina < staminaCost;
            if (winded && heavy) { Say(state, "Catch your breath. Stamina is low."); return false; }
            p.Cooldown = heavy ? weapon.HeavyCooldown : weapon.Cooldown;
            p.Noise = heavy ? weapon.HeavyNoise : weapon.Noise;
            if (ranged) state.Inventory[(int)Item.Ammo] -= ammoCost;
            p.Stamina = Math.Max(0f, p.Stamina - staminaCost);
            if (winded) p.Winded = .5f;
            Enemy target = AimTarget(state); state.LockId = target == null ? -1 : target.Id;
            if (target != null && !ranged)
            {
                // Attack magnetism: a swing pulls the player toward the target so near misses still land.
                float gap = V2.Distance(p.Position, target.Position);
                float pull = Math.Min(weapon.Lunge, gap - .7f);
                if (pull > 0f)
                {
                    V2 toward = (target.Position - p.Position) * (1f / Math.Max(.01f, gap));
                    p.Position = Move(p.Position, toward * pull, state.Area);
                }
                p.Face = (target.Position - p.Position).Normalized;
            }
            state.LastAttack = heavy ? "heavy" : "light";
            Emit(state, heavy ? GameEventKind.Heavy : ranged ? GameEventKind.Shot : GameEventKind.Swing, EventSource.Player);
            if (winded) { Emit(state, GameEventKind.Winded, EventSource.Player, -1, 0, weapon.WindedDamageScale); Say(state, "Winded. Your swing is weaker."); }
            // A lunge that a wall cut short can still leave the target out of reach; that swing whiffs.
            bool connects = target != null && (ranged || V2.Distance(p.Position, target.Position) <= weapon.Reach + .02f);
            state.Effects.Add(new Effect { Position = p.Position, Kind = ranged ? EffectKind.Shot : heavy ? EffectKind.Heavy : EffectKind.Hit,
                Time = heavy ? .35f : .22f, HasTarget = true,
                Target = target == null ? p.Position + p.Face * (ranged ? 3f : .65f) : target.Position });
            if (connects)
            {
                float distance = Math.Max(.01f, V2.Distance(p.Position, target.Position));
                p.Face = (target.Position - p.Position) * (1f / distance);
                float damage = weapon.Damage * (heavy ? weapon.HeavyMultiplier : 1f) * (winded ? weapon.WindedDamageScale : 1f);
                target.Health -= damage;
                target.Flash = .2f; state.Shake = heavy ? .2f : .11f;
                SetAi(state, target, target.Kind == EnemyKind.Scavenger ? AiState.Flee : AiState.Chase);
                target.Awareness = 1f; target.LastKnown = p.Position; target.HasLastKnown = true;
                Emit(state, heavy ? GameEventKind.HeavyHit : ranged ? GameEventKind.ShotHit : GameEventKind.Hit, EventSource.Player, target.Id, 0, damage, target.Position);
                if (target.Health <= 0f)
                {
                    state.Kills++; state.Inventory[(int)Item.Tools] += target.Stolen;
                    EnemyDef def = data.EnemyOf(target.Kind);
                    for (int i = 0; i < def.Drops.Count; i++) state.Inventory[(int)def.Drops[i].Item] += def.Drops[i].Count;
                    if (!string.IsNullOrEmpty(def.DefeatText)) Say(state, def.DefeatText);
                }
            }
            return true;
        }

        private static void Hurt(GameState state, float amount, EventSource source)
        {
            Actor p = state.Player; if (p.Invulnerable > 0f || IsSafe(state)) return;
            p.Health = Math.Max(0f, p.Health - amount); p.Invulnerable = Dat(state).Player.HurtInvulnerable; state.Shake = .2f; Emit(state, GameEventKind.Hurt, source, -1, 0, amount);
            Wound(state, source, amount);
            state.Effects.Add(new Effect { Position = p.Position, Kind = EffectKind.Hurt, Time = .5f });
            if (p.Health <= 0f)
            {
                state.Mode = RunMode.Dead;
                Say(state, state.Phase == DayPhase.Eclipse ? "The Eclipse claimed another survivor." : "The neighborhood claimed another survivor.");
                Emit(state, GameEventKind.Dead, source);
            }
        }

        public static void NextCycle(GameState state)
        {
            state.Cycle++; state.Mode = RunMode.Playing; state.Phase = DayPhase.Day;
            state.Time = state.Duration = state.DayDuration; state.WallIntegrity = WallCapacity(state);
            state.WallWarned = false; state.SiegeStarted = false; state.SiegeTravel = 0f;
            state.Player.Health = Math.Min(Dat(state).Player.MaxHealth, state.Player.Health + Dat(state).Player.DawnHealing);
            for (int i = state.Injuries.Count - 1; i >= 0; i--) if (state.Injuries[i].Kind == InjuryKind.Bruise) state.Injuries.RemoveAt(i);
            Populate(state); state.Target = null; state.WallHitTimer = 0f;
            Say(state, state.WallTools > 0 ? "Dawn. The walls are standing again. Supplies have shifted." :
                "Dawn. Supplies have shifted. Strengthen the walls before dark."); Emit(state, GameEventKind.DayStarted);
        }

        private static bool Finite(float value) { return !float.IsNaN(value) && !float.IsInfinity(value); }

        public static void Step(GameState state, float dt, V2 move = default(V2), bool run = false)
        {
            if (state.Mode != RunMode.Playing || !Finite(dt)) return;
            dt = Math.Max(0f, Math.Min(dt, .1f));
            if (!Finite(move.X) || !Finite(move.Y)) move = new V2();
            state.Elapsed += dt; state.Time = Math.Max(0f, state.Time - dt);
            state.MessageTime = Math.Max(0f, state.MessageTime - dt);
            state.InteractCooldown = Math.Max(0f, state.InteractCooldown - dt);
            state.LootCooldown = Math.Max(0f, state.LootCooldown - dt); state.Shake = Math.Max(0f, state.Shake - dt);
            Actor p = state.Player; GameData data = Dat(state); PlayerDef pd = data.Player; EclipseProfile eclipse = data.EclipseFor(state.Cycle);
            for (int i = 0; i < state.Injuries.Count; i++) { Injury hurt = state.Injuries[i]; hurt.Age += dt; state.Injuries[i] = hurt; }
            p.Winded = Math.Max(0f, p.Winded - dt); p.Cooldown = Math.Max(0f, p.Cooldown - dt); p.Invulnerable = Math.Max(0f, p.Invulnerable - dt); p.Noise = Math.Max(0f, p.Noise - dt);
            if (state.AttackBuffered)
            {
                state.AttackBufferTime -= dt;
                if (state.AttackBufferTime <= 0f) state.AttackBuffered = false;
                else if (p.Cooldown <= 0f && p.Dodge <= 0f) { state.AttackBuffered = false; Attack(state, state.BufferedHeavy); }
            }
            // Stable in-place compaction, including value-type effect updates.
            int liveEffects = 0;
            for (int i = 0; i < state.Effects.Count; i++)
            {
                Effect effect = state.Effects[i]; effect.Time -= dt;
                if (effect.Time > 0f) state.Effects[liveEffects++] = effect;
            }
            if (liveEffects < state.Effects.Count) state.Effects.RemoveRange(liveEffects, state.Effects.Count - liveEffects);
            if (state.Phase == DayPhase.Day && state.Time <= Math.Min(eclipse.WarningSeconds, state.DayDuration * eclipse.WarningMaxDayFraction))
            { state.Phase = DayPhase.Warning; Say(state, "THE SKY IS CHANGING · reach reinforced shelter."); Emit(state, GameEventKind.Warning); }
            if (state.Time <= 0f)
            {
                if (state.Phase != DayPhase.Eclipse)
                {
                    state.Phase = DayPhase.Eclipse; state.Time = state.Duration = state.NightDuration * eclipse.DurationScale;
                    for (int i = state.Enemies.Count - 1; i >= 0; i--) if (state.Enemies[i].Kind != EnemyKind.Apostle) state.Enemies.RemoveAt(i);
                    for (int i = 0; i < eclipse.Spawns.Count; i++)
                        state.Enemies.Add(CreateEnemy(eclipse.Spawns[i].Id, eclipse.Spawns[i].Kind, eclipse.Spawns[i].Position, data));
                    state.WallWarned = false; state.SiegeStarted = false; state.SiegeTravel = 0f;
                    Say(state, "ECLIPSE · the Apostle is hunting."); Emit(state, GameEventKind.Eclipse, EventSource.Apostle);
                }
                else
                { state.Mode = RunMode.Survived; state.Best = Math.Max(state.Best, state.Cycle); Emit(state, GameEventKind.EclipseEnded); return; }
            }
            float magnitude = move.Magnitude, tilt = magnitude;
            if (magnitude > .05f) state.Target = null;
            else if (state.Target.HasValue)
            {
                V2 difference = state.Target.Value - p.Position; float distance = difference.Magnitude;
                if (distance < .12f) state.Target = null;
                else { move = difference * (1f / distance); tilt = pd.JogTilt; }   // walking to a tapped point is a jog
            }
            bool moving = move.Magnitude > .05f;
            tilt = Math.Min(1f, tilt);
            // The stick picks the speed within the posture. Pushing to run while low stands the player up, once.
            bool wantsRun = moving && (run || tilt >= pd.RunBandMin);
            if (wantsRun && p.Posture != Posture.Stand && !p.RunBlocked) { SetPosture(state, Posture.Stand); p.RunBlocked = true; }
            if (p.RunBlocked)
            {
                wantsRun = false;
                if (!moving || (!run && tilt < pd.RunBandMin)) p.RunBlocked = false;
            }
            p.Stance = p.Posture == Posture.Crouch ? Stance.Crouch : p.Posture == Posture.Prone ? Stance.Crawl :
                !moving || tilt <= pd.WalkBandMax ? Stance.Walk : Stance.Jog;
            p.Running = wantsRun && p.Stamina > 1f && p.Posture == Posture.Stand;
            float speed = pd.SpeedOf(p.Stance);
            if (p.Running) { speed = pd.RunSpeed; p.Stamina = Math.Max(0f, p.Stamina - dt * pd.RunStaminaDrain); p.Noise = pd.RunNoise; }
            else p.Stamina = Math.Min(pd.MaxStamina, p.Stamina + dt * (moving ? pd.StaminaRegenMoving : pd.StaminaRegenIdle));
            if (p.Dodge > 0f) { p.Dodge -= dt; move = p.Face; speed = pd.DodgeSpeed; moving = true; }
            if (moving)
            {
                move *= 1f / Math.Max(.0001f, move.Magnitude);   // speed comes from the band, not from how far the stick is pushed
                p.Position = Move(p.Position, move * (speed * dt), state.Area);
                if (move.Magnitude > .00001f) p.Face = move.Normalized;
                p.Step += dt * speed * 6f;
            }
            p.Moving = moving;
            AutoLoot(state); Enemy locked = AimTarget(state); state.LockId = locked == null ? -1 : locked.Id;
            state.Threat = 0f;
            if (state.Area != "street")
            {
                if (state.Phase == DayPhase.Eclipse) StepSiege(state, dt);
                return;
            }
            StepEnemies(state, dt);
        }

        /// <summary>Records a wound on a random part of the body. Effects and the fuse are Milestone 2; for now it is shown and can be treated.</summary>
        private static void Wound(GameState state, EventSource source, float amount)
        {
            double roll = Random(state);
            BodyPart part = roll < .08 ? BodyPart.Head : roll < .45 ? BodyPart.Torso : roll < .6 ? BodyPart.LeftArm : roll < .75 ? BodyPart.RightArm : roll < .88 ? BodyPart.LeftLeg : BodyPart.RightLeg;
            InjuryKind kind = amount >= 20f ? InjuryKind.Deep : amount >= 10f ? InjuryKind.Cut : InjuryKind.Bruise;
            if (state.Injuries.Count >= 12) state.Injuries.RemoveAt(0);
            state.Injuries.Add(new Injury { Part = part, Kind = kind, Source = source });
            Emit(state, GameEventKind.Injured, source, -1, (int)part, (int)kind);
        }

        /// <summary>Treats the worst wound and says which. Returns null when there was nothing to treat.</summary>
        public static string Treat(GameState state)
        {
            int worst = -1;
            for (int i = 0; i < state.Injuries.Count; i++) if (worst < 0 || state.Injuries[i].Kind > state.Injuries[worst].Kind) worst = i;
            if (worst < 0) return null;
            Injury injury = state.Injuries[worst]; state.Injuries.RemoveAt(worst);
            Emit(state, GameEventKind.Treated, EventSource.Player, -1, (int)injury.Part);
            return "treated the " + PartName(injury.Part).ToLowerInvariant();
        }

        public static string PartName(BodyPart part)
        {
            switch (part)
            {
                case BodyPart.Head: return "Head"; case BodyPart.Torso: return "Torso";
                case BodyPart.LeftArm: return "Left arm"; case BodyPart.RightArm: return "Right arm";
                case BodyPart.LeftLeg: return "Left leg"; default: return "Right leg";
            }
        }

        public static string KindName(InjuryKind kind) { return kind == InjuryKind.Deep ? "Deep wound" : kind == InjuryKind.Cut ? "Cut" : "Bruise"; }
        public static string SourceName(EventSource source)
        {
            return source == EventSource.Apostle ? "the Apostle" : source == EventSource.Bandit ? "a bandit" : source == EventSource.Scavenger ? "a scavenger" : "unknown";
        }

        /// <summary>One line telling the player what an item is and what it does, built from the data so it never goes stale.</summary>
        public static string Describe(GameState state, Item item)
        {
            GameData data = Dat(state); ItemDef def = data.ItemOf(item);
            if (def.Use == ItemUse.Weapon)
            {
                WeaponDef w = data.WeaponOf(def.Weapon);
                return (w.Ranged ? "Ranged" : "Melee") + " weapon · damage " + (int)w.Damage + (w.Ranged ? " · uses ammo" : "") + " · loud " + (w.Noise >= 3f ? "(carries far)" : "(some noise)");
            }
            if (def.Use == ItemUse.Consumable)
            {
                string text = def.StaminaRestore > 0f ? "+" + (int)def.StaminaRestore + " stamina" : "";
                if (def.HealthRestore > 0f) text += (text.Length > 0 ? ", " : "") + "+" + (int)def.HealthRestore + " health";
                if (item == Item.Medicine) text += ", treats your worst wound";
                return text;
            }
            return item == Item.Tools ? "Spend at the safehouse workbench to strengthen the walls" : item == Item.Ammo ? "Ammunition for the pistol" : "";
        }

        // Where a point is on the ground: road tiles are bare, everything else is grass that a low player can hide in.
        private static bool InGrass(V2 p)
        {
            int x = (int)Math.Floor(p.X), y = (int)Math.Floor(p.Y);
            return !((y >= 3 && y < 5) || x == 5);
        }

        /// <summary>True when the player is low in the grass on the street, where they are harder to see.</summary>
        public static bool InCover(GameState state)
        {
            return state.Area == "street" && state.Player.Posture != Posture.Stand && InGrass(state.Player.Position);
        }

        /// <summary>
        /// How far away this kind of enemy can see the player right now. Stance sets the base; standing still and
        /// lying low in the grass shrink it; noise grows it. The visibility ring on the ground shows this number.
        /// </summary>
        public static float DetectionRadius(GameState state, EnemyKind kind)
        {
            GameData data = Dat(state); PlayerDef pd = data.Player; Actor p = state.Player; EnemyDef def = data.EnemyOf(kind);
            float radius = pd.VisibilityOf(p.Stance);
            if (def.DetectRadius > 0f) radius = def.DetectRadius * radius / Math.Max(.01f, pd.WalkVisibility);
            if (!p.Moving) radius *= StillFactor;
            if (InCover(state)) radius *= GrassFactor;
            if (p.Noise > 0f) radius += pd.NoiseDetectBonus;
            return radius;
        }

        /// <summary>The detection radius of ordinary people, which is what the ring shows.</summary>
        public static float DetectionRadius(GameState state) { return DetectionRadius(state, EnemyKind.Bandit); }

        /// <summary>Whether an enemy can see the player now: in range, in front of it (or very close), and with nothing solid between.</summary>
        private static bool CanSee(GameState state, Enemy e, EnemyDef def, float radius, float distance)
        {
            if (distance > radius) return false;
            V2 target = state.Player.Position;
            if (distance > CloseSense)
            {
                float half = def.ViewHalfAngle > 0f ? def.ViewHalfAngle : 65f;
                V2 to = target - e.Position;
                float cosine = V2.Dot(to, e.Face) / (Math.Max(.0001f, to.Magnitude) * Math.Max(.0001f, e.Face.Magnitude));
                if (cosine < (float)Math.Cos(half * Math.PI / 180.0)) return false;
            }
            return LineClear(e.Position, target);
        }

        private static float HearRadius(GameState state)
        {
            Actor p = state.Player; PlayerDef pd = Dat(state).Player;
            return p.Noise > 0f ? pd.HearBase + p.Noise * pd.HearPerNoise : 0f;
        }

        /// <summary>The worst thing any enemy is doing about the player, for the HUD.</summary>
        public static Stealth StealthOf(GameState state)
        {
            if (state.Area != "street") return Stealth.Hidden;
            GameData data = Dat(state); Stealth result = Stealth.Hidden;
            for (int i = 0; i < state.Enemies.Count; i++)
            {
                Enemy e = state.Enemies[i]; if (e.Health <= 0f) continue;
                Stealth now;
                if (e.State == AiState.Chase || e.State == AiState.Attack) now = Stealth.Hunted;
                else if (e.State == AiState.Search) now = Stealth.Searching;
                else if (e.Awareness > 0f) now = Stealth.Noticed;
                else
                {
                    EnemyDef def = data.EnemyOf(e.Kind);
                    float distance = V2.Distance(e.Position, state.Player.Position);
                    now = CanSee(state, e, def, DetectionRadius(state, e.Kind), distance) ? Stealth.Exposed : Stealth.Hidden;
                }
                if (now > result) result = now;
            }
            return result;
        }

        private static V2 SiegePost { get { return FindBuilding("shelter").Door + new V2(0f, .43f); } }

        /// <summary>What the player can tell about the safehouse's surroundings. While indoors it is only sound: how near, and from which side.</summary>
        public static BaseWatch Watch(GameState state)
        {
            var watch = new BaseWatch();
            float capacity = Math.Max(1f, WallCapacity(state));
            watch.WallFraction = Math.Max(0f, Math.Min(1f, state.WallIntegrity / capacity));
            V2 door = FindBuilding("shelter").Door; V2 post = SiegePost;
            float best = 8f; Enemy nearest = null;
            for (int i = 0; i < state.Enemies.Count; i++)
            {
                Enemy e = state.Enemies[i]; if (e.Health <= 0f) continue;
                if (e.Kind == EnemyKind.Apostle && state.SiegeStarted && state.WallIntegrity > 0f && V2.Distance(e.Position, post) < 1f) watch.UnderAttack = true;
                float d = V2.Distance(e.Position, door);
                if (d < best) { best = d; nearest = e; }
            }
            if (state.Area != "shelter" || nearest == null) return watch;
            watch.Active = true; watch.Distance = best; watch.AtDoor = best < 1f;
            watch.Direction = (nearest.Position - door).Normalized;
            return watch;
        }

        /// <summary>Walks the Apostle toward the safehouse door: clear the row of buildings first, then along the open lane.</summary>
        private static void WalkToPost(GameState state, Enemy apostle, V2 post, float dt)
        {
            V2 goal = apostle.Position.Y < 2.9f && Math.Abs(apostle.Position.X - post.X) > 1.2f ? new V2(apostle.Position.X, 3f) : post;
            V2 way = goal - apostle.Position; float length = Math.Max(.01f, way.Magnitude);
            apostle.Face = way * (1f / length);
            apostle.Position = Move(apostle.Position, way * (Math.Min(length, Dat(state).EnemyOf(EnemyKind.Apostle).ChaseSpeed * dt) / length), "street");
        }

        /// <summary>The Apostle at the door wears the walls down and, every so often, strikes them. Works whether or not the player is inside.</summary>
        private static void PressWalls(GameState state, Enemy apostle, float dt)
        {
            apostle.Face = new V2(0f, -1f);
            if (!state.SiegeStarted)
            {
                state.SiegeStarted = true; state.WallHitTimer = WallHitInterval;
                Emit(state, GameEventKind.Siege, EventSource.Apostle, apostle.Id, 0, state.WallIntegrity, apostle.Position);
                if (state.Area == "shelter") Say(state, "Something is at the door.");
            }
            state.WallHitTimer -= dt;
            if (state.WallHitTimer <= 0f)
            {
                state.WallHitTimer = WallHitInterval; state.Shake = Math.Max(state.Shake, .1f);
                Emit(state, GameEventKind.WallHit, EventSource.Apostle, apostle.Id, 0, state.WallIntegrity, apostle.Position);
            }
            state.WallIntegrity = Math.Max(0f, state.WallIntegrity - WallPressure(state) * dt);
            if (state.WallIntegrity <= 0f)
            { Emit(state, GameEventKind.Breach, EventSource.Apostle, apostle.Id, 0, state.WallIntegrity, apostle.Position); Say(state, "BREACH · the walls have failed."); }
            else if (!state.WallWarned && state.WallIntegrity <= WallCapacity(state) * Dat(state).Safehouse.WarnFraction)
            { state.WallWarned = true; Emit(state, GameEventKind.Cracking, EventSource.Apostle, apostle.Id, 0, state.WallIntegrity, apostle.Position); Say(state, "THE WALLS ARE CRACKING"); }
        }

        /// <summary>
        /// The Eclipse while the player is indoors. In the safehouse the Apostle walks to the door and wears the
        /// walls down at a steady rate; the player has nothing to do but wait, so the outcome is decided by how well
        /// the walls were built during the day. Once the walls are gone, or anywhere else indoors, the old exposure
        /// damage applies.
        /// </summary>
        private static void StepSiege(GameState state, float dt)
        {
            Enemy apostle = null;
            for (int i = 0; i < state.Enemies.Count; i++)
                if (state.Enemies[i].Kind == EnemyKind.Apostle && state.Enemies[i].Health > 0f) { apostle = state.Enemies[i]; break; }
            if (apostle == null) return;
            if (state.Area == "shelter" && state.WallIntegrity > 0f)
            {
                V2 post = SiegePost;
                if (V2.Distance(apostle.Position, post) >= PostTolerance)
                {
                    // Whatever it was doing, it comes for the occupied safehouse.
                    apostle.Awareness = 0f; apostle.HasLastKnown = false; apostle.State = AiState.Patrol;
                    state.SiegeTravel += dt;
                    if (state.SiegeTravel >= SiegeSnapAfter) apostle.Position = post; // never leave the walls un-pressed because of a blocked path
                    else WalkToPost(state, apostle, post, dt);
                    return;
                }
                state.SiegeTravel = 0f;
                PressWalls(state, apostle, dt);
                return;
            }
            if (IsSafe(state)) return;
            state.Threat = 1f;
            apostle.Cooldown -= dt;
            if (apostle.Cooldown <= 0f)
            {
                EclipseProfile eclipse = Dat(state).EclipseFor(state.Cycle);
                Hurt(state, eclipse.ExposureDamage, EventSource.Apostle); apostle.Cooldown = eclipse.ExposureInterval;
                Say(state, state.Area == "shelter" ? "THE WALLS HAVE FAILED · the Apostle is inside." : "THE WALLS ARE FAILING · only the safehouse can hold.");
            }
        }

        private static void StepEnemies(GameState state, float dt)
        {
            Actor p = state.Player; GameData data = Dat(state);
            float hear = HearRadius(state);
            for (int i = 0; i < state.Enemies.Count; i++)
            {
                Enemy e = state.Enemies[i]; if (e.Health <= 0f) continue;
                EnemyDef def = data.EnemyOf(e.Kind);
                e.Cooldown = Math.Max(0f, e.Cooldown - dt); e.Flash = Math.Max(0f, e.Flash - dt);
                float distance = V2.Distance(e.Position, p.Position);
                float radius = DetectionRadius(state, e.Kind);
                bool sees = e.State != AiState.Attack && CanSee(state, e, def, radius, distance);
                bool hears = hear > 0f && distance < hear;
                float search = def.SearchSeconds > 0f ? def.SearchSeconds : 6f;

                // Suspicion builds while it can see you (faster the closer you are) and drains once you are out of sight.
                if (e.State != AiState.Attack)
                {
                    if (sees)
                    {
                        float notice = def.NoticeSeconds > 0f ? def.NoticeSeconds : .6f;
                        e.Awareness = distance <= PointBlankNotice ? 1f :
                            Math.Min(1f, e.Awareness + dt / notice * (1f + 2f * (1f - distance / Math.Max(.01f, radius))));
                        e.LastKnown = p.Position; e.HasLastKnown = true;
                    }
                    else
                    {
                        e.Awareness = Math.Max(0f, e.Awareness - dt / AwarenessFade);
                        if (hears) { e.LastKnown = p.Position; e.HasLastKnown = true; }
                    }
                }

                bool deciding = e.State != AiState.Attack && e.State != AiState.Chase && !(e.State == AiState.Flee && e.Cooldown > 0f);
                if (deciding && e.Awareness >= 1f)
                {
                    SetAi(state, e, e.Kind == EnemyKind.Scavenger ? (e.Health < def.FleeBelowHealth || state.Inventory[(int)Item.Tools] == 0 ? AiState.Flee : AiState.Chase) : AiState.Chase);
                    Emit(state, GameEventKind.Noticed, SourceOf(e.Kind), e.Id, 0, 0f, e.Position);
                }
                else if (hears && !sees && e.State == AiState.Patrol)
                {
                    // A noise it cannot place: go and look at where it came from.
                    SetAi(state, e, AiState.Search); e.Arrived = false; e.SearchLeft = 0f;
                }
                else if (hears && !sees && e.State == AiState.Search && e.Arrived) { e.Arrived = false; e.SearchLeft = 0f; }

                if (e.State == AiState.Flee && distance > radius + 1.2f) { SetAi(state, e, AiState.Patrol); e.Windup = 0f; e.Awareness = 0f; }

                if (e.State == AiState.Chase && !sees && e.HasLastKnown && V2.Distance(e.Position, e.LastKnown) < ArriveDistance)
                { SetAi(state, e, AiState.Search); e.Arrived = true; e.SearchLeft = search; e.WanderTimer = 0f; }
                if (e.State == AiState.Search)
                {
                    if (!e.Arrived)
                    {
                        if (!e.HasLastKnown || V2.Distance(e.Position, e.LastKnown) < ArriveDistance) { e.Arrived = true; e.SearchLeft = search; e.WanderTimer = 0f; }
                    }
                    else
                    {
                        e.SearchLeft -= dt;
                        if (e.SearchLeft <= 0f)
                        { SetAi(state, e, AiState.Patrol); e.HasLastKnown = false; e.Awareness = 0f; Emit(state, GameEventKind.LostTrack, SourceOf(e.Kind), e.Id, 0, 0f, e.Position); }
                    }
                }

                if (e.State == AiState.Chase || e.State == AiState.Attack) state.Threat = Math.Max(state.Threat, 1f - distance / 6f);
                if (e.State == AiState.Chase && distance < def.AttackStartRange && e.Cooldown <= 0f)
                {
                    if (e.Kind == EnemyKind.Scavenger)
                    {
                        int count = Math.Min(1, state.Inventory[(int)Item.Tools]); state.Inventory[(int)Item.Tools] -= count; e.Stolen += count;
                        if (count > 0) Say(state, "A scavenger stole a tool. Catch them to recover it.");
                        SetAi(state, e, AiState.Flee); e.Cooldown = 3f;
                    }
                    else { SetAi(state, e, AiState.Attack); e.Windup = def.AttackWindup; Emit(state, GameEventKind.Snarl, SourceOf(e.Kind), e.Id, 0, 0f, e.Position); }
                }
                if (e.State == AiState.Attack)
                {
                    e.Windup -= dt;
                    if (e.Windup <= 0f)
                    {
                        if (distance < def.AttackHitRange) Hurt(state, def.AttackDamage, SourceOf(e.Kind));
                        e.Cooldown = def.AttackCooldown; SetAi(state, e, AiState.Chase);
                        e.LastKnown = p.Position; e.HasLastKnown = true;
                    }
                    continue;
                }

                // An Apostle that has reached the door and not noticed anyone stays there, wearing the walls down, even with nobody inside.
                if (e.Kind == EnemyKind.Apostle && e.State == AiState.Patrol && e.Awareness <= 0f && state.SiegeStarted && state.WallIntegrity > 0f &&
                    V2.Distance(e.Position, SiegePost) < PostTolerance)
                { PressWalls(state, e, dt); continue; }

                if (e.State == AiState.Patrol && e.Awareness > 0f)
                {
                    // Something caught its eye: it stops and looks, which is the player's cue to freeze or break line of sight.
                    V2 look = e.LastKnown - e.Position;
                    if (look.SqrMagnitude > .0001f) e.Face = look.Normalized;
                    continue;
                }
                if (e.State == AiState.Patrol && V2.Distance(e.Position, e.Target) < .4f)
                {
                    V2 target = new V2((float)(1 + Random(state) * 8), (float)(1 + Random(state) * 8));
                    if (CanWalk(target, "street")) e.Target = target;
                }
                V2 destination; float speed;
                if (e.State == AiState.Flee) { destination = e.Position + (e.Position - p.Position); speed = def.FleeSpeed; }
                else if (e.State == AiState.Chase) { destination = e.HasLastKnown ? e.LastKnown : e.Position; speed = def.ChaseSpeed; }
                else if (e.State == AiState.Search)
                {
                    if (!e.Arrived) { destination = e.LastKnown; speed = def.ChaseSpeed * .55f; }
                    else
                    {
                        e.WanderTimer -= dt;
                        if (e.WanderTimer <= 0f)
                        {
                            V2 spot = e.LastKnown + new V2((float)((Random(state) - .5) * 2 * SearchRadius), (float)((Random(state) - .5) * 2 * SearchRadius));
                            if (CanWalk(spot, "street")) e.Target = spot;
                            e.WanderTimer = 1.1f + (float)Random(state);
                        }
                        destination = e.Target; speed = def.PatrolSpeed;
                    }
                }
                else { destination = e.Target; speed = def.PatrolSpeed; }
                float remaining = Math.Max(.01f, V2.Distance(e.Position, destination));
                V2 previous = e.Position;
                if (remaining > .05f)
                {
                    V2 heading = (destination - e.Position) * (1f / remaining);
                    e.Face = heading;
                    e.Position = Move(e.Position, heading * Math.Min(remaining, speed * dt), "street");
                }
                if (V2.Distance(previous, e.Position) < .002f && e.State == AiState.Patrol)
                    e.Target = new V2((float)(1 + Random(state) * 8), (float)(1 + Random(state) * 8));
            }
        }
    }
}
