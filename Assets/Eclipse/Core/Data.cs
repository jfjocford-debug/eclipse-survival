using System;
using System.Collections.Generic;

namespace EclipseSurvival.Core
{
    // Game data: every number a designer tunes, in one place. The simulation reads these definitions from
    // GameState.Data and never from literals, so a game can be rebalanced without touching its logic.
    // The classes are plain serializable data with public fields, so Unity can show them in the Inspector.
    // Behaviour that depends on a kind (a scavenger steals, a bandit drops loot) still lives in code; the
    // definitions hold the numbers and names those behaviours use.

    public enum ItemUse { Material, Weapon, Consumable }

    [Serializable]
    public sealed class ItemStack
    {
        public Item Item;
        public int Count;
        public ItemStack() { }
        public ItemStack(Item item, int count) { Item = item; Count = count; }
    }

    [Serializable]
    public sealed class ItemDef
    {
        public Item Id;
        public string Name = "";
        public ItemUse Use;
        /// <summary>For weapons: the weapon this item equips.</summary>
        public Weapon Weapon;
        /// <summary>For consumables: the sentence shown when used. The effects are appended from the numbers below.</summary>
        public string UseText = "";
        public float HealthRestore;
        public float StaminaRestore;
        public bool RefuseAtFullHealth;
        /// <summary>Auto-loot order: lower is picked up first.</summary>
        public int LootPriority;
    }

    [Serializable]
    public sealed class WeaponDef
    {
        public Weapon Id;
        public string Name = "";
        public bool Ranged;
        public float Damage;
        public float HeavyMultiplier = 1f;
        /// <summary>Melee: the distance at which a swing connects, measured after any lunge.</summary>
        public float Reach;
        /// <summary>Melee: how far a swing may pull the player toward a target.</summary>
        public float Lunge;
        /// <summary>Ranged: the farthest distance a shot reaches.</summary>
        public float Range;
        /// <summary>Half-width, in degrees, of the cone in which targets are acquired.</summary>
        public float AimHalfAngle;
        public float Cooldown;
        public float HeavyCooldown;
        public float StaminaCost;
        public float HeavyStaminaCost;
        /// <summary>A light swing with too little stamina still goes through, at this share of its damage. Heavy attacks do not.</summary>
        public float WindedDamageScale = .5f;
        public int AmmoCost;
        public int HeavyAmmoCost;
        public float Noise;
        public float HeavyNoise;

        /// <summary>How far away a target can be and still be acquired.</summary>
        public float AcquireRange { get { return Ranged ? Range : Reach + Lunge; } }
        public float AimCosine { get { return (float)Math.Cos(AimHalfAngle * Math.PI / 180.0); } }
    }

    [Serializable]
    public sealed class PlayerDef
    {
        public float MaxHealth = 100f;
        public float MaxStamina = 100f;
        public float WalkSpeed = .95f, JogSpeed = 1.45f, CrouchSpeed = .66f, CrawlSpeed = .38f, RunSpeed = 2.45f;
        /// <summary>How far away enemies notice you, by stance.</summary>
        public float WalkVisibility = 1.4f, JogVisibility = 2.25f, CrouchVisibility = .95f, CrawlVisibility = .65f;
        /// <summary>Extra detection distance while you are making noise.</summary>
        public float NoiseDetectBonus = 2f;
        /// <summary>Noise carries without a line of sight: this far, plus this much for every second of noise left. A stand-in until sound propagation (Milestone 2).</summary>
        public float HearBase = 2.5f, HearPerNoise = 1.5f;
        public float RunStaminaDrain = 15f;
        public float RunNoise = .7f;
        public float StaminaRegenMoving = 7f;
        public float StaminaRegenIdle = 15f;
        public float DodgeStaminaCost = 22f;
        public float DodgeDuration = .3f;
        public float DodgeInvulnerable = .42f;
        public float DodgeSpeed = 4.6f;
        public float HurtInvulnerable = .75f;
        /// <summary>Stick travel (0 to 1, after the dead zone) up to which a standing player walks; above it they jog.</summary>
        public float WalkBandMax = .4f;
        /// <summary>Stick travel at which a standing player runs.</summary>
        public float RunBandMin = .9f;
        /// <summary>How long the crouch button is held to go prone. Used by the input layer.</summary>
        public float ProneHoldSeconds = .5f;
        /// <summary>The stick travel used when the player is walked to a tapped point: the middle of the jog band.</summary>
        public float JogTilt { get { return (WalkBandMax + RunBandMin) * .5f; } }
        /// <summary>Health restored at dawn.</summary>
        public float DawnHealing = 20f;

        public float SpeedOf(Stance stance)
        {
            return stance == Stance.Walk ? WalkSpeed : stance == Stance.Crouch ? CrouchSpeed : stance == Stance.Crawl ? CrawlSpeed : JogSpeed;
        }

        public float VisibilityOf(Stance stance)
        {
            return stance == Stance.Walk ? WalkVisibility : stance == Stance.Crouch ? CrouchVisibility : stance == Stance.Crawl ? CrawlVisibility : JogVisibility;
        }
    }

    [Serializable]
    public sealed class EnemyDef
    {
        public EnemyKind Id;
        public string Name = "";
        public float Health;
        public float PatrolSpeed, ChaseSpeed, FleeSpeed;
        /// <summary>How far away it notices you when you walk. Zero means it follows your stance visibility, as humans do. Crouching, crawling, running and standing still change it for both.</summary>
        public float DetectRadius;
        /// <summary>Seconds of clear sight it needs, at the edge of its range, before it commits to the chase. Closer is faster. Zero or less uses 0.6.</summary>
        public float NoticeSeconds = .6f;
        /// <summary>Half-width, in degrees, of the cone in front of it in which it sees you. Zero or less uses 65.</summary>
        public float ViewHalfAngle = 65f;
        /// <summary>How long it searches around the last place it knew you were before it gives up. Zero or less uses 6.</summary>
        public float SearchSeconds = 6f;
        /// <summary>It begins an attack when closer than this.</summary>
        public float AttackStartRange;
        /// <summary>The attack lands only if you are still closer than this when the windup ends.</summary>
        public float AttackHitRange;
        public float AttackDamage;
        public float AttackWindup;
        public float AttackCooldown;
        /// <summary>It runs away when its health falls below this. Zero means never.</summary>
        public float FleeBelowHealth;
        /// <summary>What it leaves behind when it dies.</summary>
        public List<ItemStack> Drops = new List<ItemStack>();
        /// <summary>Shown when the player kills it. Empty shows nothing.</summary>
        public string DefeatText = "";
    }

    [Serializable]
    public sealed class SafehouseDef
    {
        /// <summary>Wall integrity with no tools spent.</summary>
        public float BaseIntegrity = 40f;
        /// <summary>Integrity each tool adds, permanently.</summary>
        public float IntegrityPerTool = 20f;
        public int MaxTools = 3;
        /// <summary>The cracking warning fires at this share of capacity.</summary>
        public float WarnFraction = .25f;
    }

    [Serializable]
    public sealed class ClockDef
    {
        public float DaySeconds = 150f;
        public float EclipseSeconds = 90f;
        public float QuickDaySeconds = 35f;
        public float QuickEclipseSeconds = 25f;
    }

    [Serializable]
    public sealed class EclipseSpawn
    {
        public int Id;
        public EnemyKind Kind;
        public V2 Position;
        public EclipseSpawn() { }
        public EclipseSpawn(int id, EnemyKind kind, V2 position) { Id = id; Kind = kind; Position = position; }
    }

    /// <summary>
    /// How one kind of Eclipse behaves. The profile in force is the one with the highest <see cref="FromCycle"/>
    /// that is not above the current cycle, so later cycles can bring a harsher Eclipse.
    /// </summary>
    [Serializable]
    public sealed class EclipseProfile
    {
        public string Name = "";
        public int FromCycle = 1;
        /// <summary>Multiplies the run's Eclipse length.</summary>
        public float DurationScale = 1f;
        /// <summary>The warning begins this many seconds before dusk, but never earlier than this share of the day.</summary>
        public float WarningSeconds = 20f;
        public float WarningMaxDayFraction = .3f;
        public List<EclipseSpawn> Spawns = new List<EclipseSpawn>();
        /// <summary>Damage dealt, and how often, to a player who is indoors without protection.</summary>
        public float ExposureDamage = 13f;
        public float ExposureInterval = 2.5f;
        /// <summary>Wall integrity lost per second while the Apostle is at the door, in cycle 1.</summary>
        public float WallPressure = .6f;
        /// <summary>Extra pressure per cycle after the first, as a share of the base.</summary>
        public float WallPressureGrowth = .15f;
    }

    [Serializable]
    public sealed class GameData
    {
        public List<ItemDef> Items = new List<ItemDef>();
        public List<WeaponDef> Weapons = new List<WeaponDef>();
        public PlayerDef Player = new PlayerDef();
        public List<EnemyDef> Enemies = new List<EnemyDef>();
        public SafehouseDef Safehouse = new SafehouseDef();
        public ClockDef Clock = new ClockDef();
        public List<EclipseProfile> Eclipses = new List<EclipseProfile>();

        [NonSerialized] private ItemDef[] itemById;
        [NonSerialized] private WeaponDef[] weaponById;
        [NonSerialized] private EnemyDef[] enemyById;
        [NonSerialized] private EclipseProfile[] eclipsesByCycle;

        private static GameData shared;
        /// <summary>A shared, read-only copy of the defaults, for code that has no game state to ask. Do not modify it.</summary>
        public static GameData Default { get { return shared ?? (shared = CreateDefault()); } }

        /// <summary>Builds the lookup tables. Call again after adding, removing or reordering definitions.</summary>
        public void Prepare()
        {
            itemById = new ItemDef[Enum.GetValues(typeof(Item)).Length];
            weaponById = new WeaponDef[Enum.GetValues(typeof(Weapon)).Length];
            enemyById = new EnemyDef[Enum.GetValues(typeof(EnemyKind)).Length];
            for (int i = 0; i < Items.Count; i++) if (Items[i] != null && (int)Items[i].Id < itemById.Length) itemById[(int)Items[i].Id] = Items[i];
            for (int i = 0; i < Weapons.Count; i++) if (Weapons[i] != null && (int)Weapons[i].Id < weaponById.Length) weaponById[(int)Weapons[i].Id] = Weapons[i];
            for (int i = 0; i < Enemies.Count; i++) if (Enemies[i] != null && (int)Enemies[i].Id < enemyById.Length) enemyById[(int)Enemies[i].Id] = Enemies[i];
            int last = 1;
            for (int i = 0; i < Eclipses.Count; i++) if (Eclipses[i] != null && Eclipses[i].FromCycle > last) last = Eclipses[i].FromCycle;
            // One entry per cycle up to the last profile change; later cycles reuse the final entry.
            eclipsesByCycle = new EclipseProfile[last];
            for (int cycle = 1; cycle <= last; cycle++)
            {
                EclipseProfile chosen = null;
                for (int i = 0; i < Eclipses.Count; i++)
                {
                    EclipseProfile profile = Eclipses[i];
                    if (profile != null && profile.FromCycle <= cycle && (chosen == null || profile.FromCycle >= chosen.FromCycle)) chosen = profile;
                }
                eclipsesByCycle[cycle - 1] = chosen;
            }
        }

        public ItemDef ItemOf(Item id) { if (itemById == null) Prepare(); return itemById[(int)id]; }
        public WeaponDef WeaponOf(Weapon id) { if (weaponById == null) Prepare(); return weaponById[(int)id]; }
        public EnemyDef EnemyOf(EnemyKind id) { if (enemyById == null) Prepare(); return enemyById[(int)id]; }

        public EclipseProfile EclipseFor(int cycle)
        {
            if (eclipsesByCycle == null) Prepare();
            int index = Math.Max(1, Math.Min(cycle, eclipsesByCycle.Length)) - 1;
            return eclipsesByCycle[index];
        }

        /// <summary>Returns a description of every problem that would stop the game running, or an empty list.</summary>
        public List<string> Validate()
        {
            var problems = new List<string>();
            if (Player == null || Safehouse == null || Clock == null) { problems.Add("Player, Safehouse and Clock must all be present."); return problems; }
            foreach (Item id in Enum.GetValues(typeof(Item)))
            {
                int count = 0; ItemDef def = null;
                for (int i = 0; i < Items.Count; i++) if (Items[i] != null && Items[i].Id == id) { count++; def = Items[i]; }
                if (count != 1) { problems.Add("Item " + id + " must be defined exactly once (found " + count + ")."); continue; }
                if (string.IsNullOrEmpty(def.Name)) problems.Add("Item " + id + " needs a name.");
                if (def.Use == ItemUse.Weapon && def.Weapon == Weapon.Fists) problems.Add("Item " + id + " is a weapon but names no weapon to equip.");
                if (def.Use == ItemUse.Consumable && def.HealthRestore <= 0f && def.StaminaRestore <= 0f) problems.Add("Item " + id + " is a consumable that restores nothing.");
            }
            foreach (Weapon id in Enum.GetValues(typeof(Weapon)))
            {
                int count = 0; WeaponDef def = null;
                for (int i = 0; i < Weapons.Count; i++) if (Weapons[i] != null && Weapons[i].Id == id) { count++; def = Weapons[i]; }
                if (count != 1) { problems.Add("Weapon " + id + " must be defined exactly once (found " + count + ")."); continue; }
                if (def.Damage <= 0f) problems.Add("Weapon " + id + " must deal damage.");
                if (def.Cooldown <= 0f || def.HeavyCooldown <= 0f) problems.Add("Weapon " + id + " needs positive cooldowns.");
                if (def.HeavyMultiplier <= 0f) problems.Add("Weapon " + id + " needs a positive heavy multiplier.");
                if (def.WindedDamageScale <= 0f || def.WindedDamageScale > 1f) problems.Add("Weapon " + id + " needs a winded damage scale above 0 and at most 1.");
                if (def.Ranged ? def.Range <= 0f : def.Reach <= 0f) problems.Add("Weapon " + id + " needs a positive " + (def.Ranged ? "range." : "reach."));
                if (def.AimHalfAngle <= 0f || def.AimHalfAngle > 180f) problems.Add("Weapon " + id + " needs an aim angle between 0 and 180 degrees.");
                if ((def.AmmoCost > 0 || def.HeavyAmmoCost > 0) && !def.Ranged) problems.Add("Weapon " + id + " uses ammunition but is not ranged.");
            }
            foreach (EnemyKind id in Enum.GetValues(typeof(EnemyKind)))
            {
                int count = 0; EnemyDef def = null;
                for (int i = 0; i < Enemies.Count; i++) if (Enemies[i] != null && Enemies[i].Id == id) { count++; def = Enemies[i]; }
                if (count != 1) { problems.Add("Enemy " + id + " must be defined exactly once (found " + count + ")."); continue; }
                if (def.Health <= 0f) problems.Add("Enemy " + id + " needs positive health.");
                if (def.PatrolSpeed <= 0f || def.ChaseSpeed <= 0f || def.FleeSpeed <= 0f) problems.Add("Enemy " + id + " needs positive speeds.");
                if (def.AttackWindup <= 0f || def.AttackCooldown <= 0f) problems.Add("Enemy " + id + " needs a positive attack windup and cooldown.");
            }
            if (Player.MaxHealth <= 0f || Player.MaxStamina <= 0f) problems.Add("The player needs positive maximum health and stamina.");
            if (Player.WalkBandMax <= 0f || Player.RunBandMin <= Player.WalkBandMax || Player.RunBandMin > 1f) problems.Add("The speed bands need 0 < walk band max < run band min <= 1.");
            if (Player.ProneHoldSeconds <= 0f) problems.Add("The prone hold time must be positive.");
            if (Player.WalkSpeed <= 0f || Player.JogSpeed <= 0f || Player.CrouchSpeed <= 0f || Player.CrawlSpeed <= 0f || Player.RunSpeed <= 0f) problems.Add("The player needs positive speeds.");
            if (Safehouse.BaseIntegrity <= 0f) problems.Add("The safehouse needs positive base integrity, or it is breached before the Eclipse.");
            if (Safehouse.IntegrityPerTool < 0f || Safehouse.MaxTools < 0) problems.Add("The safehouse cannot have negative tool values.");
            if (Safehouse.WarnFraction < 0f || Safehouse.WarnFraction > 1f) problems.Add("The safehouse warning fraction must be between 0 and 1.");
            if (Clock.DaySeconds <= 0f || Clock.EclipseSeconds <= 0f || Clock.QuickDaySeconds <= 0f || Clock.QuickEclipseSeconds <= 0f) problems.Add("The clock needs positive durations.");
            bool first = false;
            for (int i = 0; i < Eclipses.Count; i++)
            {
                EclipseProfile profile = Eclipses[i];
                if (profile == null) { problems.Add("Eclipse profile " + i + " is empty."); continue; }
                if (profile.FromCycle == 1) first = true;
                if (profile.FromCycle < 1) problems.Add("Eclipse profile '" + profile.Name + "' must start at cycle 1 or later.");
                if (profile.DurationScale <= 0f) problems.Add("Eclipse profile '" + profile.Name + "' needs a positive duration scale.");
                if (profile.ExposureInterval <= 0f) problems.Add("Eclipse profile '" + profile.Name + "' needs a positive exposure interval.");
                if (profile.WallPressure < 0f || profile.WallPressureGrowth < 0f) problems.Add("Eclipse profile '" + profile.Name + "' cannot have negative wall pressure.");
                for (int j = 0; j < i; j++) if (Eclipses[j] != null && Eclipses[j].FromCycle == profile.FromCycle) problems.Add("Two Eclipse profiles start at cycle " + profile.FromCycle + ".");
            }
            if (!first) problems.Add("There must be an Eclipse profile that starts at cycle 1.");
            return problems;
        }

        /// <summary>A fresh copy of the shipped game data. Every value here is the behaviour the game had before data existed.</summary>
        public static GameData CreateDefault()
        {
            var data = new GameData();
            data.Items.Add(new ItemDef { Id = Item.Crowbar, Name = "Crowbar", Use = ItemUse.Weapon, Weapon = Weapon.Crowbar, LootPriority = 4 });
            data.Items.Add(new ItemDef { Id = Item.Pistol, Name = "Pistol", Use = ItemUse.Weapon, Weapon = Weapon.Pistol, LootPriority = 4 });
            data.Items.Add(new ItemDef { Id = Item.Food, Name = "Food", Use = ItemUse.Consumable, UseText = "A quick meal.", StaminaRestore = 35f, HealthRestore = 8f, LootPriority = 0 });
            data.Items.Add(new ItemDef { Id = Item.Medicine, Name = "Medicine", Use = ItemUse.Consumable, UseText = "Bandaged up.", HealthRestore = 40f, RefuseAtFullHealth = true, LootPriority = 1 });
            data.Items.Add(new ItemDef { Id = Item.Tools, Name = "Tools", Use = ItemUse.Material, LootPriority = 2 });
            data.Items.Add(new ItemDef { Id = Item.Ammo, Name = "Ammo", Use = ItemUse.Material, LootPriority = 3 });

            data.Weapons.Add(new WeaponDef { Id = Weapon.Fists, Name = "Fists", Damage = 13f, HeavyMultiplier = 1.9f, Reach = .95f, Lunge = .6f,
                AimHalfAngle = 75f, Cooldown = .46f, HeavyCooldown = .95f, StaminaCost = 9f, HeavyStaminaCost = 24f, Noise = 1.2f, HeavyNoise = 2f });
            data.Weapons.Add(new WeaponDef { Id = Weapon.Crowbar, Name = "Crowbar", Damage = 28f, HeavyMultiplier = 1.9f, Reach = .95f, Lunge = .6f,
                AimHalfAngle = 75f, Cooldown = .46f, HeavyCooldown = .95f, StaminaCost = 9f, HeavyStaminaCost = 24f, Noise = 1.2f, HeavyNoise = 2f });
            data.Weapons.Add(new WeaponDef { Id = Weapon.Pistol, Name = "Pistol", Ranged = true, Damage = 42f, HeavyMultiplier = 1.9f, Range = 5f,
                AimHalfAngle = 40f, Cooldown = .42f, HeavyCooldown = .95f, StaminaCost = 0f, HeavyStaminaCost = 24f, AmmoCost = 1, HeavyAmmoCost = 2,
                Noise = 4f, HeavyNoise = 4f });

            data.Enemies.Add(new EnemyDef { Id = EnemyKind.Bandit, Name = "Bandit", Health = 65f, PatrolSpeed = .45f, ChaseSpeed = 1.2f, FleeSpeed = 1.65f,
                AttackStartRange = .5f, AttackHitRange = .7f, AttackDamage = 11f, AttackWindup = .4f, AttackCooldown = 1.2f,
                Drops = new List<ItemStack> { new ItemStack(Item.Food, 1), new ItemStack(Item.Ammo, 2) },
                DefeatText = "Bandit down. Recovered food and 2 rounds." });
            data.Enemies.Add(new EnemyDef { Id = EnemyKind.Scavenger, Name = "Scavenger", Health = 40f, PatrolSpeed = .45f, ChaseSpeed = 1.2f, FleeSpeed = 1.65f,
                AttackStartRange = .5f, AttackHitRange = .7f, AttackDamage = 11f, AttackWindup = .4f, AttackCooldown = 1.2f, FleeBelowHealth = 40f });
            data.Enemies.Add(new EnemyDef { Id = EnemyKind.Apostle, Name = "Apostle", Health = 260f, PatrolSpeed = .65f, ChaseSpeed = 1.83f, FleeSpeed = .65f,
                DetectRadius = 4.8f, NoticeSeconds = .9f, ViewHalfAngle = 50f, SearchSeconds = 10f, AttackStartRange = .72f, AttackHitRange = 1f, AttackDamage = 28f, AttackWindup = .75f, AttackCooldown = 1.7f,
                DefeatText = "The Apostle falls. Hold out until dawn." });

            var eclipse = new EclipseProfile { Name = "The first Eclipse", FromCycle = 1 };
            eclipse.Spawns.Add(new EclipseSpawn(10, EnemyKind.Apostle, new V2(9.2f, 1.9f)));
            data.Eclipses.Add(eclipse);
            return data;
        }
    }
}
