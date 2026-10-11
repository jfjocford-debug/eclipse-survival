using System;
using System.Collections.Generic;
using System.Text.Json;
using EclipseSurvival.Core;

internal static class Program
{
    private static int passed;
    private static int failed;
    private static readonly JsonSerializerOptions SnapshotOptions = new JsonSerializerOptions
    { IncludeFields = true, IgnoreReadOnlyProperties = true };

    private static int Main()
    {
        Test("Full 150s day, warning and 90s Eclipse survive in reinforced shelter", FullCycle);
        Test("Workshop supplies are unique, portable and reinforce the safehouse", WorkshopToShelter);
        Test("Walls are built one tool at a time, capped, and cannot be built during the Eclipse", BuildWalls);
        Test("Wall siege: pressure starts at the door; tools decide hold, warning, breach and exposure", WallSiege);
        Test("All authored doors and loot are reachable; movement cannot cross walls", Reachability);
        Test("Melee, pistol ammo, kill rewards and collision-blocked gunfire", CombatResources);
        Test("Dodge prevents a telegraphed hit; running drains and rest restores stamina", DodgeAndStamina);
        Test("Food and medicine consume inventory without inventing or overhealing", Consumables);
        Test("Pause freezes the complete state; next cycle resets barricades and loot", PauseAndNextCycle);
        Test("Scavenger steals one tool and returns stolen tools on defeat", Theft);
        Test("Apostle has a dodge window; exposure kills and death freezes the clock", ApostleAndDeath);
        Test("Auto-loot priority, radius, room boundaries and duplicate prevention", AutoLootPriority);
        Test("Auto-loot cannot cross walls; tap pickup works with automation off", PrecisionLoot);
        Test("Soft-lock aim: angle-weighted choice, sticky lock, and dead or out-of-cone exclusion", AimCone);
        Test("Heavy attacks trade resources for damage and failures spend nothing", HeavyAttacks);
        Test("Analog facing remains normalized and releasing input has no drift", AnalogMovement);
        Test("Seeded state and action sequences are deterministic", Determinism);
        Test("Collision probe adds solid walls without replacing authored bounds", CollisionProbe);
        Test("External collision probe also blocks target rays and loot rays", ProbeOcclusion);
        Test("Warm movement, AI, aiming and effect updates allocate no managed bytes", HotPathAllocations);
        Test("Delta-time clamp, invalid input defense and effect compaction", TimersAndEffects);
        Test("Movement speeds and stealth visibility preserve all four stances", StancesAndVisibility);
        Test("Melee and ranged aim obey their ranges and area boundaries", AimRanges);
        Test("Melee acquires side and point-blank targets that the old narrow cone missed", MeleeAssist);
        Test("Melee swing lunges toward a target in reach and lands the hit", MeleeLunge);
        Test("An attack pressed just before recovery is buffered, and expires or cancels correctly", AttackBuffer);
        Test("Event bus delivers every event once and in order, with payloads, by kind and to all", EventBusDelivery);
        Test("Event bus: a new game state restarts delivery and unsubscribed handlers stop hearing", EventBusLifecycle);
        Test("Event log is bounded and the bus reports events it could not deliver in time", EventLogBounded);
        Test("AI state changes are announced once per change, with enemy and new state", AiStateEvents);
        Test("A surviving Eclipse announces warning, eclipse, siege, cracking and end; a breach names the Apostle", EclipseEventSequence);
        Test("Automatic equipment pickup retains the selected weapon and is throttled", AutoEquipment);
        Test("Paused actions cannot spend resources or collect loot", PausedActions);
        Test("Every one of the five interiors can be entered and exited", AllInteriors);
        Test("Directional dodge normalizes its direction and consumes exactly 22 stamina", DirectionalDodge);
        Test("Generated loot positions and RNG sequence match browser fixture", BrowserFixture);
        Test("Actors draw over a building from its east and south sides and behind it elsewhere, across the whole street", DepthOrder);
        Test("Crouch, prone and stand: taps, holds, dodge, attacks and paused input behave as designed", PostureControls);
        Test("Pushing to run from a crouch or prone stands the player up once and jogs until the stick eases off", StandUpOnRun);
        Test("A light swing at low stamina goes through weaker with a cue; a heavy one is refused", WindedSwing);
        Test("Shipped game data is valid, complete and seeds the run", DataDefaultsValid);
        Test("Validation names every kind of broken data, and a broken set cannot start a game", DataValidation);
        Test("The Eclipse profile in force follows the cycle: spawns, length, exposure and wall pressure", EclipseProfiles);
        Test("Editing data changes behavior: damage, drops, items, walls, enemies, clock and player", DataDrivesBehavior);
        Test("Enemies see only in front of them, notice gradually, and close sense and point-blank override the cone", SightAndAwareness);
        Test("Cars, crates and buildings block sight; grass, stillness and a low posture shrink how far you are seen", CoverAndConcealment);
        Test("A pursuer goes to the last known position, searches, and gives up; it never homes in on the true position", LosingAPursuer);
        Test("Noise draws enemies to its source without line of sight", HearingNoise);
        Test("The Apostle at the door cannot see out the back; leaving by the front is noticed at once; walls keep falling while you are away", SneakingPastTheApostle);
        Test("Wounds are recorded with a body part, can be treated, and bruises fade at dawn", InjuriesAndTreatment);
        Test("The safehouse reports what is outside by sound, and the walls announce each blow", BaseWatching);
        Test("Items describe themselves, the equipped weapon is queryable, and the menu can equip, unequip and use", ItemsAndEquipment);
        Test("The stealth status the HUD shows follows hidden, exposed, noticed, searching and hunted", StealthStatus);
        Console.WriteLine("RESULT " + passed + " passed; " + failed + " failed");
        return failed == 0 ? 0 : 1;
    }

    private static void Test(string name, Action body)
    {
        Simulation.CollisionProbe = null;
        try { body(); passed++; Console.WriteLine("PASS " + name); }
        catch (Exception error) { failed++; Console.Error.WriteLine("FAIL " + name + "\n" + error); }
        finally { Simulation.CollisionProbe = null; }
    }

    private static void True(bool condition, string message = "Expected true")
    { if (!condition) throw new InvalidOperationException(message); }
    private static void Equal<T>(T actual, T expected, string message = "Values differ")
    { if (!EqualityComparer<T>.Default.Equals(actual, expected)) throw new InvalidOperationException(message + ": actual=" + actual + ", expected=" + expected); }
    private static void Near(float actual, float expected, float epsilon = .001f)
    { if (float.IsNaN(actual) || Math.Abs(actual - expected) > epsilon) throw new InvalidOperationException("actual=" + actual + ", expected=" + expected); }
    private static GameState Playing(uint seed = 1, bool quick = false)
    { GameState state = Simulation.Create(seed, quick); Simulation.Start(state); return state; }
    private static void Run(GameState state, float seconds)
    { int steps = (int)Math.Ceiling(seconds * 20f); for (int i = 0; i < steps; i++) Simulation.Step(state, .05f); }
    private static string Snapshot(GameState state) { return JsonSerializer.Serialize(state, SnapshotOptions); }
    private static Enemy OneEnemy(GameState state, EnemyKind kind, float x, float y, float health = -1f)
    {
        state.Enemies.Clear(); Enemy enemy = Simulation.CreateEnemy(1, kind, new V2(x, y));
        if (health >= 0f) enemy.Health = health;
        state.Enemies.Add(enemy); return enemy;
    }
    private static Loot AddLoot(GameState state, int id, string area, Item item, int count, float x, float y)
    {
        var loot = new Loot { Id = id, Area = area, Item = item, Count = count, Position = new V2(x, y) };
        state.Loot.Add(loot); return loot;
    }

    private static void FullCycle()
    {
        GameState s = Playing(7); s.Area = "shelter"; s.WallTools = 3; s.WallIntegrity = Simulation.WallCapacity(s);
        Run(s, 130.1f); Equal(s.Phase, DayPhase.Warning);
        Run(s, 20f); Equal(s.Phase, DayPhase.Eclipse); Equal(s.Mode, RunMode.Playing);
        Equal(s.Enemies.Count, 1); Equal(s.Enemies[0].Kind, EnemyKind.Apostle);
        Run(s, 90f); Equal(s.Mode, RunMode.Survived); Equal(s.Best, 1); Near(s.Player.Health, 100f);
        Near(s.DayDuration, 150f); Near(s.NightDuration, 90f);
    }

    private static void WorkshopToShelter()
    {
        GameState s = Playing(12); s.Player.Position = Simulation.FindBuilding("workshop").Door;
        Simulation.Interact(s); Equal(s.Area, "workshop");
        Loot tools = s.Loot.Find(l => l.Area == "workshop" && l.Item == Item.Tools);
        s.Player.Position = tools.Position; s.InteractCooldown = 0; Simulation.Interact(s);
        Equal(s.Inventory[(int)Item.Tools], 3);
        s.InteractCooldown = 0; Simulation.Interact(s); Equal(s.Inventory[(int)Item.Tools], 3);
        s.Player.Position = new V2(3f, 5.3f); s.InteractCooldown = 0; Simulation.Interact(s); Equal(s.Area, "street");
        s.Player.Position = Simulation.FindBuilding("shelter").Door; s.InteractCooldown = 0; Simulation.Interact(s); Equal(s.Area, "shelter");
        s.Player.Position = new V2(3f, 1.3f); s.InteractCooldown = 0; Simulation.Interact(s);
        Equal(s.WallTools, 1); Equal(s.Inventory[(int)Item.Tools], 2); Near(s.WallIntegrity, 60f); True(Simulation.IsSafe(s));
    }

    private static void BuildWalls()
    {
        GameState s = Playing(3); s.Area = "shelter"; s.Player.Position = new V2(3f, 1.3f); s.Inventory[(int)Item.Tools] = 4;
        Near(s.WallIntegrity, 40f); Equal(s.WallTools, 0);
        for (int built = 1; built <= 3; built++)
        { s.InteractCooldown = 0; Simulation.Interact(s); Equal(s.WallTools, built); Near(s.WallIntegrity, 40f + 20f * built); }
        Equal(s.Inventory[(int)Item.Tools], 1);
        s.InteractCooldown = 0; Simulation.Interact(s); Equal(s.WallTools, 3); Equal(s.Inventory[(int)Item.Tools], 1); // capped; the tool is kept
        GameState none = Playing(3); none.Area = "shelter"; none.Player.Position = new V2(3f, 1.3f);
        Simulation.Interact(none); Equal(none.WallTools, 0);                                                          // no tool, no wall
        GameState late = Playing(3); late.Area = "shelter"; late.Player.Position = new V2(3f, 1.3f); late.Inventory[(int)Item.Tools] = 2;
        late.Phase = DayPhase.Eclipse; Simulation.Interact(late); Equal(late.WallTools, 0); Equal(late.Inventory[(int)Item.Tools], 2); // no building mid-Eclipse
    }

    private static GameState SiegeOf(int tools)
    {
        GameState s = Playing(6); s.Area = "shelter"; s.WallTools = tools; s.WallIntegrity = Simulation.WallCapacity(s);
        s.Time = .01f; Simulation.Step(s, .05f); Equal(s.Phase, DayPhase.Eclipse); return s;
    }

    private static void WallSiege()
    {
        // Pressure does not start until the Apostle has walked to the door.
        GameState s = SiegeOf(3); Run(s, 1f); True(!s.SiegeStarted); Near(s.WallIntegrity, 100f);
        Run(s, 6f); True(s.SiegeStarted); True(s.WallIntegrity < 100f);
        // Three tools: calm. The walls hold with a wide margin and the player is never touched.
        Run(s, 83f); Equal(s.Mode, RunMode.Survived); Near(s.Player.Health, 100f); True(s.WallIntegrity > 40f && s.WallIntegrity < 60f);
        // One tool: it holds, just barely.
        GameState one = SiegeOf(1); Run(one, 90f);
        Equal(one.Mode, RunMode.Survived); Near(one.Player.Health, 100f); True(one.WallIntegrity > 0f && one.WallIntegrity < 20f);
        // No tools: a warning first, then a breach, then the exposure damage.
        GameState none = SiegeOf(0); Run(none, 60f);
        True(none.WallIntegrity > 0f); True(none.WallWarned); Near(none.Player.Health, 100f);
        Run(none, 15f); Near(none.WallIntegrity, 0f); True(none.Player.Health < 100f); Equal(none.Mode, RunMode.Playing);
        True(!Simulation.IsSafe(none));
        // The day never wears the walls down.
        GameState day = Playing(6); day.Area = "shelter"; Run(day, 100f); Near(day.WallIntegrity, 40f);
        // Pressure grows with the cycle.
        GameState c = Playing(); Near(Simulation.WallPressure(c), .6f); c.Cycle = 3; Near(Simulation.WallPressure(c), .78f);
        // Capacity follows tools; the warning threshold is a quarter of it.
        c.WallTools = 2; Near(Simulation.WallCapacity(c), 80f);
    }

    private static void Reachability()
    {
        for (uint seed = 0; seed < 50; seed++)
        {
            GameState s = Simulation.Create(seed);
            for (int i = 0; i < Simulation.Buildings.Count; i++) True(Simulation.CanWalk(Simulation.Buildings[i].Door, "street"));
            for (int i = 0; i < s.Loot.Count; i++) True(Simulation.CanWalk(s.Loot[i].Position, s.Loot[i].Area));
            V2 result = Simulation.Move(new V2(.5f, 1f), new V2(2f, 0f), "street");
            True(result.X < .65f); True(Simulation.CanWalk(result, "street"));
        }
    }

    private static void CombatResources()
    {
        GameState s = Playing(); s.Player.Position = new V2(4f, 4f);
        Enemy enemy = OneEnemy(s, EnemyKind.Bandit, 4.4f, 4f);
        True(Simulation.Attack(s)); Near(enemy.Health, 52f); Near(s.Player.Stamina, 91f);
        s.Player.Cooldown = 0; s.Equipped = Weapon.Pistol; True(!Simulation.Attack(s)); Near(enemy.Health, 52f);
        s.Inventory[(int)Item.Ammo] = 1; True(Simulation.Attack(s)); Equal(s.Inventory[(int)Item.Ammo], 0); Near(enemy.Health, 10f);
        s.Player.Cooldown = 0; s.Equipped = Weapon.Crowbar; True(Simulation.Attack(s));
        True(enemy.Health <= 0); Equal(s.Kills, 1); Equal(s.Inventory[(int)Item.Ammo], 2);
        s.Player.Position = new V2(.25f, 1.5f); s.Player.Face = new V2(1f, 0f); s.Player.Cooldown = 0;
        enemy = OneEnemy(s, EnemyKind.Bandit, 3.3f, 1.5f); s.Equipped = Weapon.Pistol;
        True(Simulation.Attack(s)); Near(enemy.Health, 65f); Equal(s.Inventory[(int)Item.Ammo], 1);
    }

    private static void DodgeAndStamina()
    {
        GameState s = Playing(2); s.Player.Position = new V2(4f, 4f);
        Enemy enemy = OneEnemy(s, EnemyKind.Bandit, 4.4f, 4f); enemy.State = AiState.Attack; enemy.Windup = .01f;
        Simulation.Dodge(s); Simulation.Step(s, .05f); Near(s.Player.Health, 100f); True(s.Player.Stamina < 100f);
        s.Enemies.Clear(); Run(s, 1f); float before = s.Player.Stamina;
        for (int i = 0; i < 15; i++) Simulation.Step(s, .05f, new V2(1f, 0f), true);
        True(s.Player.Stamina < before); float tired = s.Player.Stamina; Run(s, 1f); True(s.Player.Stamina > tired);
    }

    private static void Consumables()
    {
        GameState s = Playing(3); s.Player.Health = 75f; s.Player.Stamina = 20f;
        Simulation.UseItem(s, Item.Food); Near(s.Player.Health, 83f); Near(s.Player.Stamina, 55f); Equal(s.Inventory[(int)Item.Food], 0);
        s.Inventory[(int)Item.Medicine] = 1; Simulation.UseItem(s, Item.Medicine); Near(s.Player.Health, 100f); Equal(s.Inventory[(int)Item.Medicine], 0);
        Simulation.UseItem(s, Item.Pistol); Equal(s.Equipped, Weapon.Fists);
        s.Inventory[(int)Item.Medicine] = 1; Simulation.UseItem(s, Item.Medicine); Equal(s.Inventory[(int)Item.Medicine], 1);
    }

    private static void PauseAndNextCycle()
    {
        GameState s = Playing(5, true); s.Mode = RunMode.Paused;
        string before = Snapshot(s); Simulation.Step(s, .1f, new V2(1f, 1f)); Equal(Snapshot(s), before);
        s.Mode = RunMode.Survived; s.WallTools = 2; s.WallIntegrity = 10f; for (int i = 0; i < s.Loot.Count; i++) s.Loot[i].Taken = true;
        Simulation.NextCycle(s); Equal(s.Cycle, 2); Equal(s.Mode, RunMode.Playing); Near(s.Time, 35f);
        Equal(s.Phase, DayPhase.Day); Equal(s.WallTools, 2); Near(s.WallIntegrity, 80f); True(!s.WallWarned && !s.SiegeStarted);
        for (int i = 0; i < s.Loot.Count; i++) True(!s.Loot[i].Taken);
    }

    private static void Theft()
    {
        GameState s = Playing(4); s.Player.Position = new V2(4f, 4f); s.Inventory[(int)Item.Tools] = 3;
        Enemy enemy = OneEnemy(s, EnemyKind.Scavenger, 4.2f, 4f);
        Simulation.Step(s, .05f); Equal(s.Inventory[(int)Item.Tools], 2); Equal(enemy.State, AiState.Flee);
        s.Equipped = Weapon.Crowbar; Simulation.Attack(s); s.Player.Cooldown = 0; Simulation.Attack(s);
        Equal(s.Inventory[(int)Item.Tools], 3); True(enemy.Health <= 0f);
    }

    private static void ApostleAndDeath()
    {
        GameState s = Playing(6); s.Enemies.Clear(); s.Time = .01f; Simulation.Step(s, .05f);
        s.Player.Position = new V2(4f, 4f); s.Enemies[0].Position = new V2(4.5f, 4f);
        Simulation.Step(s, .05f); Equal(s.Enemies[0].State, AiState.Attack); Near(s.Player.Health, 100f);
        Run(s, .9f); True(s.Player.Health < 100f); s.Area = "clinic"; Run(s, 30f); Equal(s.Mode, RunMode.Dead);
        string stopped = Snapshot(s); Run(s, 5f); Equal(Snapshot(s), stopped);
    }

    private static void AutoLootPriority()
    {
        GameState s = Playing(23); s.AutoLoot = true; s.Enemies.Clear(); s.Area = "workshop"; s.Player.Position = new V2(3f, 3f); s.Loot.Clear();
        AddLoot(s, 1, "workshop", Item.Crowbar, 1, 3f, 3.2f);
        AddLoot(s, 2, "workshop", Item.Ammo, 2, 3.2f, 3f);
        AddLoot(s, 3, "workshop", Item.Tools, 3, 3.1f, 3f);
        AddLoot(s, 4, "workshop", Item.Medicine, 1, 3.3f, 3f);
        AddLoot(s, 5, "workshop", Item.Food, 1, 4.7f, 3f);
        Loot distant = AddLoot(s, 6, "workshop", Item.Food, 1, 4.8f, 3f);
        Loot otherRoom = AddLoot(s, 7, "street", Item.Food, 1, 3f, 3f);
        Item[] expected = { Item.Food, Item.Medicine, Item.Tools, Item.Ammo, Item.Crowbar };
        for (int i = 0; i < expected.Length; i++) { s.LootCooldown = 0; Equal(Simulation.AutoLoot(s).Item, expected[i]); }
        Equal(s.Inventory[(int)Item.Food], 2); True(!distant.Taken); True(!otherRoom.Taken);
        s.LootCooldown = 0; True(Simulation.AutoLoot(s) == null); Equal(s.Inventory[(int)Item.Tools], 3);
        s.Mode = RunMode.Paused; distant.Position = new V2(3f, 3f); True(Simulation.AutoLoot(s) == null);
    }

    private static void PrecisionLoot()
    {
        GameState s = Playing(4); s.AutoLoot = true; s.Player.Position = new V2(.3f, 1.4f); s.Loot.Clear();
        AddLoot(s, 1, "street", Item.Tools, 1, 1.2f, 1.4f); True(Simulation.AutoLoot(s) == null);
        s.Area = "clinic"; s.Player.Position = new V2(3f, 3f); s.AutoLoot = false; s.Loot.Clear();
        AddLoot(s, 2, "clinic", Item.Medicine, 1, 4.2f, 3f); True(Simulation.AutoLoot(s) == null);
        True(Simulation.TapLoot(s, new V2(4.2f, 3f))); Equal(s.Inventory[(int)Item.Medicine], 1);
        True(!Simulation.TapLoot(s, new V2(4.2f, 3f)));
    }

    private static Enemy AtAngle(int id, float degrees, float distance = 1f)
    {
        double angle = degrees * Math.PI / 180.0;
        return Simulation.CreateEnemy(id, EnemyKind.Bandit, new V2(4f + (float)Math.Cos(angle) * distance, 4f + (float)Math.Sin(angle) * distance));
    }

    private static void AimCone()
    {
        GameState s = Playing(2); s.Player.Position = new V2(4f, 4f); s.Player.Face = new V2(1f, 0f); s.Equipped = Weapon.Pistol;
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(1, 14)); s.Enemies.Add(AtAngle(2, 16)); s.Enemies.Add(AtAngle(3, 180));
        Equal(Simulation.AimTarget(s).Id, 1);                      // the better-aligned of two similar targets wins
        s.LockId = 2; Equal(Simulation.AimTarget(s).Id, 2);        // an existing lock holds against a near-equal rival
        s.Enemies[1].Health = 0; Equal(Simulation.AimTarget(s).Id, 1); // a dead lock is dropped
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(2, 60)); s.Enemies.Add(AtAngle(3, 180)); s.LockId = -1;
        True(Simulation.AimTarget(s) == null);                     // outside the 80-degree ranged cone, and behind
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(4, 50)); s.LockId = -1; True(Simulation.AimTarget(s) == null);
        s.LockId = 4; True(Simulation.AimTarget(s) != null);       // a locked target survives a wider angle...
        s.Enemies[0] = AtAngle(4, 70); True(Simulation.AimTarget(s) == null); // ...but not an unlimited one
    }

    private static void MeleeAssist()
    {
        GameState s = Playing(2); s.Player.Position = new V2(4f, 4f); s.Player.Face = new V2(1f, 0f); s.Equipped = Weapon.Crowbar;
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(1, 70, 1f));
        True(Simulation.AimTarget(s) != null);                     // 70 degrees off was invisible to the old 15-degree cone
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(1, 100, 1.2f)); s.LockId = -1;
        True(Simulation.AimTarget(s) == null);                     // far enough to the side stays unreachable
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(1, 100, .4f)); True(Simulation.AimTarget(s) != null); // point-blank
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(1, 180, .45f)); True(Simulation.AimTarget(s) != null); // directly behind, touching
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(1, 180, 1.2f)); True(Simulation.AimTarget(s) == null);
        // Two enemies: the near one to the side beats the far one dead ahead only when it is clearly closer.
        s.Enemies.Clear(); s.Enemies.Add(AtAngle(1, 0, 1.4f)); s.Enemies.Add(AtAngle(2, 60, .6f));
        Equal(Simulation.AimTarget(s).Id, 2);
    }

    private static void MeleeLunge()
    {
        GameState s = Playing(); s.Player.Position = new V2(4f, 4f); s.Player.Face = new V2(1f, 0f); s.Equipped = Weapon.Crowbar;
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 5.4f, 4f, 150f);  // 1.4 tiles away: beyond the 0.95 reach, within the lunge
        True(Simulation.AimTarget(s) == e);
        True(Simulation.Attack(s)); Near(s.Player.Position.X, 4.6f, .02f); Near(e.Health, 122f);
        // Beyond reach plus lunge there is nothing to target: the swing whiffs and the player does not move.
        GameState far = Playing(); far.Player.Position = new V2(4f, 4f); far.Player.Face = new V2(1f, 0f); far.Equipped = Weapon.Crowbar;
        Enemy distant = OneEnemy(far, EnemyKind.Bandit, 5.7f, 4f, 150f);
        True(Simulation.Attack(far)); Near(far.Player.Position.X, 4f); Near(distant.Health, 150f);
        // The lunge never drives the player into the target.
        GameState near = Playing(); near.Player.Position = new V2(4f, 4f); near.Player.Face = new V2(1f, 0f); near.Equipped = Weapon.Crowbar;
        OneEnemy(near, EnemyKind.Bandit, 4.6f, 4f, 150f); Simulation.Attack(near); Near(near.Player.Position.X, 4f);
    }

    private static void AttackBuffer()
    {
        GameState s = Playing(); s.Player.Position = new V2(4f, 4f); s.Player.Face = new V2(1f, 0f); s.Equipped = Weapon.Fists;
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.6f, 4f, 300f);
        True(Simulation.Attack(s)); Near(e.Health, 287f);
        True(!Simulation.Attack(s)); True(!s.AttackBuffered);       // far too early: dropped, not remembered
        for (int i = 0; i < 6; i++) Simulation.Step(s, .05f);      // 0.46 - 0.30 = 0.16 left, inside the window
        True(!Simulation.Attack(s)); True(s.AttackBuffered); Near(e.Health, 287f);
        for (int i = 0; i < 4; i++) Simulation.Step(s, .05f);
        True(!s.AttackBuffered); Near(e.Health, 274f);              // the remembered press fired on recovery
        // A buffered press that is never fired expires.
        GameState t = Playing(); t.Player.Cooldown = .1f; True(!Simulation.Attack(t)); True(t.AttackBuffered);
        t.Player.Cooldown = 5f; for (int i = 0; i < 5; i++) Simulation.Step(t, .05f); True(!t.AttackBuffered);
        // Dodging cancels it.
        GameState u = Playing(); u.Player.Cooldown = .1f; Simulation.Attack(u); True(u.AttackBuffered);
        Simulation.Dodge(u); True(!u.AttackBuffered);
    }

    private static void HeavyAttacks()
    {
        GameState s = Playing(); s.Player.Position = new V2(4f, 4f); Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.6f, 4f, 150f); s.Equipped = Weapon.Crowbar;
        True(Simulation.Attack(s, true)); Equal(s.LastAttack, "heavy"); Near(s.Player.Stamina, 76f); Near(e.Health, 96.8f);
        True(s.Shake > 0f); True(e.Flash > 0f); True(!Simulation.Attack(s, true)); Near(s.Player.Stamina, 76f);
        s.Player.Cooldown = 0; s.Player.Stamina = 20; True(!Simulation.Attack(s, true)); Near(s.Player.Stamina, 20f);
        s.Player.Stamina = 100; s.Equipped = Weapon.Pistol; s.Inventory[(int)Item.Ammo] = 1;
        True(!Simulation.Attack(s, true)); Equal(s.Inventory[(int)Item.Ammo], 1);
        s.Inventory[(int)Item.Ammo] = 2; True(Simulation.Attack(s, true)); Equal(s.Inventory[(int)Item.Ammo], 0); Near(s.Player.Stamina, 76f);
    }

    private static void AnalogMovement()
    {
        GameState s = Playing(9); s.Enemies.Clear(); s.Loot.Clear(); V2 before = s.Player.Position;
        Simulation.Step(s, .1f, new V2(.2f, 0f)); Near(s.Player.Face.Magnitude, 1f); Near(s.Player.Position.X - before.X, .095f);   // a light tilt is a walk
        float stopped = s.Player.Position.X; Simulation.Step(s, .1f); Near(s.Player.Position.X, stopped, 0f);
    }

    private static void Determinism()
    {
        GameState a = Playing(771), b = Playing(771), different = Playing(772);
        Equal(Snapshot(a), Snapshot(b)); True(Snapshot(a) != Snapshot(different));
        for (int frame = 0; frame < 300; frame++)
        {
            V2 move = new V2(frame % 60 < 30 ? .3f : -.3f, frame % 90 < 45 ? .1f : -.1f);
            if (frame % 45 == 0) { Simulation.Attack(a, true); Simulation.Attack(b, true); }
            Simulation.Step(a, .025f, move, frame % 7 == 0); Simulation.Step(b, .025f, move, frame % 7 == 0);
        }
        Equal(Snapshot(a), Snapshot(b));
    }

    private static void CollisionProbe()
    {
        int queries = 0;
        Simulation.CollisionProbe = (position, area) => { queries++; return area == "street" ? position.X > 4.2f : area == "clinic" && position.Y > 3.2f; };
        True(!Simulation.CanWalk(new V2(1f, 1f), "street")); Equal(queries, 0, "Authored walls reject before external queries");
        True(Simulation.CanWalk(new V2(4f, 4f), "street")); True(!Simulation.CanWalk(new V2(4.4f, 4f), "street"));
        V2 moved = Simulation.Move(new V2(4f, 4f), new V2(1f, 0f), "street"); True(moved.X <= 4.2f);
        True(!Simulation.CanWalk(new V2(3f, 3.3f), "clinic")); True(Simulation.CanWalk(new V2(3f, 3.3f), "workshop"));
        Simulation.CollisionProbe = (position, area) => false;
        True(!Simulation.CanWalk(new V2(-1f, 4f), "street")); True(!Simulation.CanWalk(new V2(1f, 1f), "street"));
    }

    private static void ProbeOcclusion()
    {
        GameState s = Playing(1); s.Player.Position = new V2(4f, 4f); s.Equipped = Weapon.Pistol;
        OneEnemy(s, EnemyKind.Bandit, 5f, 4f); s.AutoLoot = true; s.Loot.Clear(); AddLoot(s, 1, "street", Item.Food, 1, 5f, 4f);
        True(Simulation.AimTarget(s) != null);
        Simulation.CollisionProbe = (position, area) => position.X > 4.4f && position.X < 4.6f;
        True(!Simulation.LineClear(s.Player.Position, new V2(5f, 4f))); True(Simulation.AimTarget(s) == null);
        True(Simulation.AutoLoot(s) == null); True(!Simulation.TapLoot(s, new V2(5f, 4f)));
    }

    private static void HotPathAllocations()
    {
        GameState s = Playing(99); s.Time = s.Duration = 10000f; s.Player.Health = 10000f;
        s.Player.Position = new V2(4f, 4f); OneEnemy(s, EnemyKind.Bandit, 4.5f, 4f);
        for (int i = 0; i < 2000; i++) Simulation.Step(s, .016f, new V2(.06f, 0f));
        long before = GC.GetAllocatedBytesForCurrentThread();
        for (int i = 0; i < 1000; i++) Simulation.Step(s, .016f, new V2(.06f, 0f));
        long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
        Equal(bytes, 0L, "Warmed hot path allocated managed memory");
    }

    private static void TimersAndEffects()
    {
        GameState s = Playing(3); s.Enemies.Clear(); s.Area = "shelter"; s.WallTools = 3; s.WallIntegrity = Simulation.WallCapacity(s);
        float time = s.Time; Simulation.Step(s, .5f); Near(s.Time, time - .1f);
        string before = Snapshot(s); Simulation.Step(s, float.NaN); Equal(Snapshot(s), before);
        True(!Simulation.CanWalk(new V2(float.NaN, 2f), "street"));
        List<Effect> list = s.Effects; list.Clear(); list.Add(new Effect { Kind = EffectKind.Hit, Time = .01f });
        list.Add(new Effect { Kind = EffectKind.Heavy, Time = .4f }); s.Shake = .2f;
        Simulation.Step(s, .05f); True(ReferenceEquals(list, s.Effects)); Equal(s.Effects.Count, 1);
        Near(s.Effects[0].Time, .35f); Near(s.Shake, .15f); Run(s, .5f); Equal(s.Effects.Count, 0);
    }

    private static void StancesAndVisibility()
    {
        // posture, stick travel, expected speed, expected effective stance
        var cases = new[]
        {
            new object[] { Posture.Stand, .3f, .95f, Stance.Walk }, new object[] { Posture.Stand, .7f, 1.45f, Stance.Jog },
            new object[] { Posture.Stand, 1f, 2.45f, Stance.Jog }, new object[] { Posture.Crouch, .3f, .66f, Stance.Crouch },
            new object[] { Posture.Crouch, .7f, .66f, Stance.Crouch }, new object[] { Posture.Prone, .3f, .38f, Stance.Crawl },
            new object[] { Posture.Prone, .7f, .38f, Stance.Crawl },
        };
        foreach (object[] c in cases)
        {
            GameState s = Playing(2); s.Enemies.Clear(); s.Player.Position = new V2(4f, 4f); s.Player.Posture = (Posture)c[0];
            Simulation.Step(s, .1f, new V2((float)c[1], 0f));
            Near(s.Player.Position.X - 4f, (float)c[2] * .1f); Equal(s.Player.Stance, (Stance)c[3]);
            Equal(s.Player.Running, (float)c[1] >= 1f && (Posture)c[0] == Posture.Stand);
        }
        // Tapped-point travel is a jog, and the band edges fall where the data says.
        GameState t = Playing(2); t.Enemies.Clear(); t.Player.Position = new V2(4f, 4f); t.Target = new V2(8f, 4f);
        Simulation.Step(t, .1f); Near(t.Player.Position.X - 4f, 1.45f * .1f);
        foreach (float tilt in new[] { .4f, .41f, .89f, .9f })
        {
            GameState e = Playing(2); e.Enemies.Clear(); e.Player.Position = new V2(4f, 4f); Simulation.Step(e, .1f, new V2(tilt, 0f));
            Near(e.Player.Position.X - 4f, (tilt <= .4f ? .95f : tilt < .9f ? 1.45f : 2.45f) * .1f);
        }
        // What enemies notice: a walker at 1.4 (a still player 20% less), a jogger at 2.25, a crouched player at .95, a prone one at .65.
        foreach (object[] c in new[] {
            new object[] { Posture.Stand, 0f, 1.05f, true }, new object[] { Posture.Stand, 0f, 1.2f, false }, new object[] { Posture.Stand, .7f, 1.9f, true },
            new object[] { Posture.Stand, .3f, 1.9f, false }, new object[] { Posture.Crouch, .5f, 1.2f, false }, new object[] { Posture.Crouch, 0f, .7f, true },
            new object[] { Posture.Prone, 0f, .8f, false }, new object[] { Posture.Prone, 0f, .51f, true } })
        {
            GameState s = Playing(2); s.Player.Position = new V2(3.8f, 4f); s.Player.Posture = (Posture)c[0];
            Enemy en = OneEnemy(s, EnemyKind.Bandit, 3.8f + (float)c[2] + ((float)c[1] > 0f ? .07f : 0f), 4f);
            en.Face = new V2(-1f, 0f); en.Awareness = .99f;   // facing the player and already wary: the range alone decides
            Simulation.Step(s, .05f, new V2((float)c[1], 0f));
            Equal(en.State == AiState.Chase, (bool)c[3], "posture " + c[0] + " tilt " + c[1] + " distance " + c[2]);
        }
    }

    private static void PostureControls()
    {
        GameState s = Playing(4); s.Enemies.Clear(); s.Player.Position = new V2(4f, 4f);
        Simulation.ToggleCrouch(s); Equal(s.Player.Posture, Posture.Crouch);
        Simulation.GoProne(s); Equal(s.Player.Posture, Posture.Prone);
        Simulation.ToggleCrouch(s); Equal(s.Player.Posture, Posture.Crouch);           // a tap from prone returns to crouch
        Simulation.ToggleCrouch(s); Equal(s.Player.Posture, Posture.Stand);
        var postures = new List<int>(); foreach (GameEvent e in s.Events) if (e.Kind == GameEventKind.Posture) postures.Add(e.Value);
        Equal(string.Join(",", postures), "1,2,1,0");
        int count = s.Events.Count; Simulation.ToggleCrouch(s); Simulation.GoProne(s); Simulation.GoProne(s); s.Player.Posture = Posture.Stand;
        // Prone cannot attack and nothing is spent; crouched can.
        s.Player.Posture = Posture.Prone; s.Player.Stamina = 50f; s.Equipped = Weapon.Crowbar; s.Player.Face = new V2(1f, 0f);
        Enemy target = OneEnemy(s, EnemyKind.Bandit, 4.6f, 4f, 100f);
        True(!Simulation.Attack(s)); Near(s.Player.Stamina, 50f); Near(target.Health, 100f); True(s.Message.Contains("prone"));
        s.Player.Posture = Posture.Crouch; True(Simulation.Attack(s)); Near(target.Health, 72f);
        // A dodge gets the player up.
        s.Player.Posture = Posture.Prone; s.Player.Stamina = 100f; Simulation.Dodge(s, new V2(1f, 0f)); Equal(s.Player.Posture, Posture.Stand);
        // Posture cannot change in the middle of a dodge or while paused.
        Simulation.ToggleCrouch(s); Equal(s.Player.Posture, Posture.Stand);
        Run(s, 1f); s.Mode = RunMode.Paused; Simulation.ToggleCrouch(s); Equal(s.Player.Posture, Posture.Stand);
    }

    private static void StandUpOnRun()
    {
        foreach (Posture low in new[] { Posture.Crouch, Posture.Prone })
        {
            GameState s = Playing(5); s.Enemies.Clear(); s.Player.Position = new V2(2f, 4f); s.Player.Posture = low;
            Simulation.Step(s, .1f, new V2(1f, 0f));                                    // full push while low: stands, but only jogs
            Equal(s.Player.Posture, Posture.Stand); True(!s.Player.Running); Near(s.Player.Position.X, 2f + 1.45f * .1f); True(s.Player.RunBlocked);
            Simulation.Step(s, .1f, new V2(1f, 0f)); True(!s.Player.Running);            // holding the push keeps jogging
            Simulation.Step(s, .1f, new V2(.7f, 0f)); True(!s.Player.Running); True(!s.Player.RunBlocked);   // easing off clears the latch
            Simulation.Step(s, .1f, new V2(1f, 0f)); True(s.Player.Running);             // a new push runs
        }
        // The keyboard's run key does the same from a crouch.
        GameState k = Playing(5); k.Enemies.Clear(); k.Player.Posture = Posture.Crouch;
        Simulation.Step(k, .1f, new V2(.7f, 0f), true); Equal(k.Player.Posture, Posture.Stand); True(!k.Player.Running);
        Simulation.Step(k, .1f, new V2(1f, 0f), true); True(!k.Player.Running);
        Simulation.Step(k, .1f); Simulation.Step(k, .1f, new V2(1f, 0f), true); True(k.Player.Running);
        // Out of stamina, a run push falls back to a jog.
        GameState tired = Playing(5); tired.Enemies.Clear(); tired.Player.Stamina = 0f; Simulation.Step(tired, .1f, new V2(1f, 0f));
        True(!tired.Player.Running); Equal(tired.Player.Stance, Stance.Jog);
    }

    private static List<GameEventKind> KindsOf(List<GameEvent> events)
    { var kinds = new List<GameEventKind>(); for (int i = 0; i < events.Count; i++) kinds.Add(events[i].Kind); return kinds; }

    private static int IndexOf(List<GameEvent> events, GameEventKind kind, int from = 0)
    { for (int i = from; i < events.Count; i++) if (events[i].Kind == kind) return i; return -1; }

    private static void EventBusDelivery()
    {
        GameState s = Playing(2); s.Player.Position = new V2(4f, 4f); s.Player.Face = new V2(1f, 0f); s.Equipped = Weapon.Crowbar;
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.6f, 4f, 150f);
        var bus = new EventBus(); var all = new List<GameEvent>(); var hits = new List<GameEvent>();
        bus.Subscribe(all.Add); bus.Subscribe(GameEventKind.Hit, hits.Add);
        Equal(bus.Pump(s), 1); Equal(all[0].Kind, GameEventKind.Start);
        True(Simulation.Attack(s));
        // One call, three announcements: none is lost to the next, which the old single-string event could not promise.
        Equal(bus.Pump(s), 3);
        Equal(all[1].Kind, GameEventKind.Swing); Equal(all[2].Kind, GameEventKind.EnemyState); Equal(all[3].Kind, GameEventKind.Hit);
        Equal(hits.Count, 1); Equal(hits[0].Subject, e.Id); Equal(hits[0].Source, EventSource.Player); Near(hits[0].Amount, 28f);
        Near(hits[0].Position.X, e.Position.X);
        Equal(bus.Pump(s), 0); Equal(all.Count, 4); Equal(hits.Count, 1);              // nothing is delivered twice
        for (int i = 1; i < all.Count; i++) True(all[i].Id > all[i - 1].Id);          // ids only grow
        // The legacy single-string view still reports the latest event.
        Equal(s.Event, "hit"); Equal(s.EventId, all[all.Count - 1].Id);
        // Loot carries what was taken.
        GameState l = Playing(2); l.Loot.Clear(); AddLoot(l, 7, "street", Item.Ammo, 5, 4f, 4f); l.Player.Position = new V2(4f, 4f);
        var heard = new List<GameEvent>(); var lootBus = new EventBus(); lootBus.Subscribe(GameEventKind.Loot, heard.Add);
        Simulation.Interact(l); lootBus.Pump(l);
        Equal(heard.Count, 1); Equal(heard[0].Subject, 7); Equal(heard[0].Value, (int)Item.Ammo); Near(heard[0].Amount, 5f);
    }

    private static void EventBusLifecycle()
    {
        var bus = new EventBus(); var seen = new List<GameEvent>(); Action<GameEvent> handler = seen.Add;
        bus.Subscribe(handler);
        GameState a = Playing(1); bus.Pump(a); Equal(seen.Count, 1);
        GameState b = Playing(1); bus.Pump(b); Equal(seen.Count, 2);                  // a fresh game restarts the ids; they are still delivered
        bus.Unsubscribe(handler); b.Inventory[(int)Item.Crowbar] = 1; Simulation.UseItem(b, Item.Crowbar);
        Equal(bus.Pump(b), 1); Equal(seen.Count, 2);                                  // delivered to nobody
        bus.Subscribe(GameEventKind.Equip, handler); bus.Unsubscribe(GameEventKind.Equip, handler);
        Simulation.UseItem(b, Item.Crowbar); bus.Pump(b); Equal(seen.Count, 2);
        bool threw = false; try { bus.Subscribe(null); } catch (ArgumentNullException) { threw = true; } True(threw);
        Equal(bus.Pump(null), 0);
    }

    private static void EventLogBounded()
    {
        GameState s = Playing(); s.Inventory[(int)Item.Crowbar] = 1;
        for (int i = 0; i < 200; i++) Simulation.UseItem(s, Item.Crowbar);           // 1 start + 200 equips
        Equal(s.Events.Count, GameState.EventLogCapacity);
        for (int i = 1; i < s.Events.Count; i++) Equal(s.Events[i].Id, s.Events[i - 1].Id + 1);
        var bus = new EventBus(); int heard = 0; bus.Subscribe(e => heard++);
        Equal(bus.Pump(s), GameState.EventLogCapacity); Equal(heard, GameState.EventLogCapacity);
        Equal(bus.Missed, 201 - GameState.EventLogCapacity);                          // reported, not silently lost
    }

    private static void AiStateEvents()
    {
        GameState s = Playing(3); s.Player.Position = new V2(3.8f, 4f); Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.6f, 4f);
        e.Face = new V2(-1f, 0f); e.Awareness = .99f;
        var bus = new EventBus(); var states = new List<GameEvent>(); bus.Subscribe(GameEventKind.EnemyState, states.Add); bus.Pump(s);
        Simulation.Step(s, .05f); bus.Pump(s);
        Equal(states.Count, 1); Equal(states[0].Subject, e.Id); Equal(states[0].Value, (int)AiState.Chase); Equal(states[0].Source, EventSource.Bandit);
        Simulation.Step(s, .05f); bus.Pump(s); Equal(states.Count, 1);                // still chasing: no new announcement
        s.Player.Position = new V2(1f, 9f);                                          // far away and out of sight: it goes to where it last saw you,
        for (int i = 0; i < 400 && states.Count < 3; i++) { Simulation.Step(s, .05f); bus.Pump(s); }   // searches there, then gives up
        Equal(states.Count, 3); Equal(states[1].Value, (int)AiState.Search); Equal(states[2].Value, (int)AiState.Patrol);
    }

    private static void EclipseEventSequence()
    {
        // One tool: the walls hold, with a cracking warning on the way.
        GameState s = Playing(6); s.Area = "shelter"; s.WallTools = 1; s.WallIntegrity = Simulation.WallCapacity(s);
        var bus = new EventBus(); var log = new List<GameEvent>(); bus.Subscribe(log.Add);
        for (int i = 0; i < 4810; i++) { Simulation.Step(s, .05f); bus.Pump(s); if (s.Mode != RunMode.Playing) break; }
        Equal(s.Mode, RunMode.Survived);
        var expected = new List<GameEventKind> { GameEventKind.Start, GameEventKind.Warning, GameEventKind.Eclipse, GameEventKind.Siege, GameEventKind.Cracking, GameEventKind.EclipseEnded };
        var order = KindsOf(log); order.RemoveAll(k => k == GameEventKind.WallHit);   // blows on the walls fall between the others
        Equal(string.Join(",", order), string.Join(",", expected));
        True(IndexOf(log, GameEventKind.WallHit) > IndexOf(log, GameEventKind.Siege));
        Equal(log[IndexOf(log, GameEventKind.Siege)].Source, EventSource.Apostle);
        True(log[IndexOf(log, GameEventKind.Cracking)].Amount <= Simulation.WallCapacity(s) * s.Data.Safehouse.WarnFraction + .001f);
        // No tools: the breach names the Apostle, and the exposure damage that follows does too.
        GameState b = SiegeOf(0); var bus2 = new EventBus(); var log2 = new List<GameEvent>(); bus2.Subscribe(log2.Add);
        for (int i = 0; i < 1800; i++) { Simulation.Step(b, .05f); bus2.Pump(b); if (b.Mode != RunMode.Playing) break; }
        int siege = IndexOf(log2, GameEventKind.Siege), crack = IndexOf(log2, GameEventKind.Cracking), breach = IndexOf(log2, GameEventKind.Breach);
        int hurt = IndexOf(log2, GameEventKind.Hurt, breach), dead = IndexOf(log2, GameEventKind.Dead);
        True(siege >= 0 && crack > siege && breach > crack && hurt > breach && dead > hurt);
        Equal(log2[breach].Source, EventSource.Apostle); Near(log2[breach].Amount, 0f);
        Equal(log2[hurt].Source, EventSource.Apostle); Near(log2[hurt].Amount, 13f); Equal(log2[dead].Source, EventSource.Apostle);
        // A new day is announced separately from the end of the Eclipse.
        GameState d = Playing(5, true); d.Mode = RunMode.Survived; Simulation.NextCycle(d);
        Equal(d.Events[d.Events.Count - 1].Kind, GameEventKind.DayStarted);
    }

    private static void Face(Enemy e, float x, float y) { e.Face = new V2(x, y); }

    private static void SightAndAwareness()
    {
        GameState s = Playing(8); s.Player.Position = new V2(4f, 4f); s.Player.Posture = Posture.Stand;
        // Behind it, at walking range: not seen. In front: seen, but suspicion builds over time, not at once.
        Enemy behind = OneEnemy(s, EnemyKind.Bandit, 5.2f, 4f); Face(behind, 1f, 0f);
        for (int i = 0; i < 4; i++) { Simulation.Step(s, .05f, new V2(.3f, 0f)); s.Player.Position = new V2(4f, 4f); }
        Near(behind.Awareness, 0f); Equal(behind.State, AiState.Patrol);
        GameState t = Playing(8); t.Player.Position = new V2(4f, 4f);
        Enemy front = OneEnemy(t, EnemyKind.Bandit, 5.2f, 4f); Face(front, -1f, 0f); front.Target = front.Position;
        Simulation.Step(t, .05f, new V2(.3f, 0f)); True(front.Awareness > 0f && front.Awareness < 1f); Equal(front.State, AiState.Patrol);
        // A watched enemy freezes to look rather than carrying on.
        V2 held = front.Position; Simulation.Step(t, .05f, new V2(.3f, 0f)); Near(front.Position.X, held.X, .0001f);
        int steps = 0; while (front.State == AiState.Patrol && steps++ < 80) Simulation.Step(t, .05f, new V2(.3f, 0f));
        Equal(front.State, AiState.Chase); True(steps > 2 && steps < 40);
        // Close behind it, inside close sense, it notices from any direction; point-blank is at once.
        GameState u = Playing(8); u.Player.Position = new V2(4f, 4f);
        Enemy close = OneEnemy(u, EnemyKind.Bandit, 4.8f, 4f); Face(close, 1f, 0f); Simulation.Step(u, .05f); True(close.Awareness > 0f);
        GameState v = Playing(8); v.Player.Position = new V2(4f, 4f);
        Enemy blank = OneEnemy(v, EnemyKind.Bandit, 4.5f, 4f); Face(blank, 1f, 0f); Simulation.Step(v, .05f); Equal(blank.State, AiState.Chase);
        // Suspicion drains once the player is out of sight.
        GameState w = Playing(8); w.Player.Position = new V2(4f, 4f);
        Enemy wary = OneEnemy(w, EnemyKind.Bandit, 5.2f, 4f); Face(wary, 1f, 0f); wary.Awareness = .8f;
        for (int i = 0; i < 40; i++) Simulation.Step(w, .05f); Near(wary.Awareness, 0f);
        // The scavenger flees when it notices an unarmed-of-tools player; the chase decision is unchanged.
        GameState x = Playing(8); x.Player.Position = new V2(4f, 4f); x.Inventory[(int)Item.Tools] = 0;
        Enemy thief = OneEnemy(x, EnemyKind.Scavenger, 4.4f, 4f); Simulation.Step(x, .05f); Equal(thief.State, AiState.Flee);
    }

    private static void CoverAndConcealment()
    {
        // A car between the two blocks sight: the enemy never notices, then does once the player steps out.
        Prop car = Simulation.Props[4]; Equal(car.Kind, PropKind.Car);
        GameState s = Playing(9); s.Player.Position = new V2(car.Position.X, car.Position.Y + car.HalfHeight + .3f); s.Player.Posture = Posture.Crouch;
        Enemy e = OneEnemy(s, EnemyKind.Bandit, car.Position.X, car.Position.Y - car.HalfHeight - .9f); Face(e, 0f, 1f); e.Target = e.Position;
        True(!Simulation.LineClear(e.Position, s.Player.Position));
        for (int i = 0; i < 60; i++) Simulation.Step(s, .05f); Near(e.Awareness, 0f); Equal(s.Player.Position.X, car.Position.X, "stayed put");
        // Props are solid: the player cannot walk through a car.
        True(!Simulation.CanWalk(car.Position, "street"));
        // Walking at the edge of a bandit's range: seen on the road, unseen when low in the grass beside it, and the ring shrinks.
        GameState road = Playing(9); road.Player.Position = new V2(5.5f, 4f); road.Player.Stance = Stance.Walk;
        GameState grass = Playing(9); grass.Player.Position = new V2(4.2f, 1.4f); grass.Player.Posture = Posture.Crouch; grass.Player.Stance = Stance.Crouch; grass.Player.Moving = true;
        road.Player.Moving = true;
        float onRoad = Simulation.DetectionRadius(road); float inGrass = Simulation.DetectionRadius(grass);
        Near(onRoad, 1.4f); Near(inGrass, .95f * .65f); True(Simulation.InCover(grass) && !Simulation.InCover(road));
        // Standing still helps, and noise hurts.
        road.Player.Moving = false; Near(Simulation.DetectionRadius(road), 1.4f * .8f);
        road.Player.Noise = 1f; Near(Simulation.DetectionRadius(road), 1.4f * .8f + 2f);
        // The Apostle's range follows the same rules, scaled to its larger base.
        GameState a = Playing(9); a.Player.Position = new V2(5.5f, 4f); a.Player.Moving = true; a.Player.Stance = Stance.Walk;
        Near(Simulation.DetectionRadius(a, EnemyKind.Apostle), 4.8f);
        a.Player.Stance = Stance.Crouch; Near(Simulation.DetectionRadius(a, EnemyKind.Apostle), 4.8f * .95f / 1.4f);
    }

    private static void LosingAPursuer()
    {
        GameState s = Playing(10); s.Player.Position = new V2(4f, 4f);
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 5f, 4f); Face(e, -1f, 0f); e.Awareness = .99f;
        Simulation.Step(s, .05f); Equal(e.State, AiState.Chase);
        // The player vanishes behind a building; the bandit goes to the last place it saw them, not to where they are.
        V2 lastSeen = e.LastKnown; s.Player.Position = new V2(1.65f, 1.5f);   // inside the safehouse footprint: not a place to stand, but out of reach and sight
        s.Player.Position = new V2(9f, 9f); float closest = float.MaxValue; bool searched = false, gaveUp = false;
        for (int i = 0; i < 600; i++)
        {
            Simulation.Step(s, .05f);
            closest = Math.Min(closest, V2.Distance(e.Position, s.Player.Position));
            if (e.State == AiState.Search) searched = true;
            if (searched && e.State == AiState.Patrol) { gaveUp = true; break; }
        }
        True(searched && gaveUp, "it searched and then gave up"); True(closest > 3f, "it never homed in on the hidden player: " + closest);
        True(!e.HasLastKnown); Near(e.Awareness, 0f);
        True(lastSeen.X > 3f && lastSeen.X < 5.2f);
        // Search lasts the data's time: the Apostle looks longer than a bandit.
        True(s.Data.EnemyOf(EnemyKind.Apostle).SearchSeconds > s.Data.EnemyOf(EnemyKind.Bandit).SearchSeconds);
    }

    private static void HearingNoise()
    {
        GameState s = Playing(11); s.Player.Position = new V2(4f, 1.2f); s.Equipped = Weapon.Pistol; s.Inventory[(int)Item.Pistol] = 1; s.Inventory[(int)Item.Ammo] = 5;
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 4f, 6f); Face(e, 0f, 1f);                // far, facing away, with the safehouse row between
        Simulation.Step(s, .05f); Equal(e.State, AiState.Patrol);
        s.Player.Face = new V2(0f, 1f); True(Simulation.Attack(s));                      // a shot carries 8 tiles without any line of sight
        Simulation.Step(s, .05f); Equal(e.State, AiState.Search); True(e.HasLastKnown); True(V2.Distance(e.LastKnown, s.Player.Position) < 1f);
        // Quiet movement is not heard from the same distance.
        GameState q = Playing(11); q.Player.Position = new V2(4f, 1.2f);
        Enemy f = OneEnemy(q, EnemyKind.Bandit, 4f, 6f); Face(f, 0f, 1f); q.Player.Posture = Posture.Crouch;
        for (int i = 0; i < 40; i++) Simulation.Step(q, .05f, new V2(.3f, 0f)); Equal(f.State, AiState.Patrol);
    }

    private static void WalkTo(GameState s, V2 goal, float tilt)
    {
        for (int i = 0; i < 600 && V2.Distance(s.Player.Position, goal) > .12f; i++)
        {
            V2 way = (goal - s.Player.Position).Normalized; Simulation.Step(s, .05f, way * tilt);
        }
    }

    private static void SneakingPastTheApostle()
    {
        GameState s = SiegeOf(1); Run(s, 8f); True(s.SiegeStarted);
        Enemy apostle = s.Enemies[0]; Equal(apostle.Kind, EnemyKind.Apostle);
        True(Simulation.Watch(s).UnderAttack); True(Simulation.Watch(s).AtDoor);
        // Out the back window: you land low, on the north side, with the whole safehouse between you and it.
        s.Player.Position = Simulation.RearWindow; s.InteractCooldown = 0f; Simulation.Interact(s);
        Equal(s.Area, "street"); Equal(s.Player.Posture, Posture.Crouch); True(V2.Distance(s.Player.Position, Simulation.RearExit) < .01f);
        float before = s.WallIntegrity; Run(s, 4f);
        Equal(apostle.State, AiState.Patrol); Near(apostle.Awareness, 0f); True(s.WallIntegrity < before, "the walls keep falling while the player is away");
        // Creep out through the east alley and away along the road, crouched: it never notices.
        float worst = 0f; bool chased = false;
        foreach (V2 goal in new[] { new V2(3f, .36f), new V2(3f, 3.4f), new V2(6f, 3.4f) })
        {
            for (int i = 0; i < 600 && V2.Distance(s.Player.Position, goal) > .12f; i++)
            {
                Simulation.Step(s, .05f, (goal - s.Player.Position).Normalized * .3f);
                worst = Math.Max(worst, apostle.Awareness); chased |= apostle.State == AiState.Chase || apostle.State == AiState.Search;
            }
        }
        True(!chased, "it did not react"); True(worst < .5f, "awareness stayed low: " + worst);
        // Make a noise from there and it comes to look, leaving the walls alone.
        s.Equipped = Weapon.Pistol; s.Inventory[(int)Item.Pistol] = 1; s.Inventory[(int)Item.Ammo] = 4; s.Player.Face = new V2(1f, 0f); s.Player.Posture = Posture.Stand;
        Simulation.Attack(s); Simulation.Step(s, .05f); Equal(apostle.State, AiState.Search);
        float held = s.WallIntegrity; Run(s, 2f); Near(s.WallIntegrity, held, .0001f);
        // The front door is another matter: it is at your shoulder and sees you at once.
        GameState f = SiegeOf(1); Run(f, 8f); Enemy guard = f.Enemies[0];
        f.Player.Position = new V2(3f, 5.3f); f.InteractCooldown = 0f; Simulation.Interact(f);   // leave the building by the front
        Equal(f.Area, "street"); Simulation.Step(f, .05f); True(guard.State == AiState.Chase || guard.State == AiState.Attack);
    }

    private static void InjuriesAndTreatment()
    {
        GameState s = Playing(12); s.Enemies.Clear(); Equal(s.Injuries.Count, 0);
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.1f, 4f); s.Player.Position = new V2(4f, 4f); Face(e, -1f, 0f); e.Awareness = 1f; e.State = AiState.Chase; e.LastKnown = s.Player.Position; e.HasLastKnown = true;
        var bus = new EventBus(); var heard = new List<GameEvent>(); bus.Subscribe(GameEventKind.Injured, heard.Add);
        for (int i = 0; i < 80 && s.Injuries.Count == 0; i++) Simulation.Step(s, .05f);
        Equal(s.Injuries.Count, 1); bus.Pump(s); Equal(heard.Count, 1);
        Equal(s.Injuries[0].Source, EventSource.Bandit); Equal(s.Injuries[0].Kind, InjuryKind.Cut); Equal(heard[0].Value, (int)s.Injuries[0].Part);
        True(Simulation.PartName(s.Injuries[0].Part).Length > 3);
        // Medicine heals and treats the worst wound; it works at full health only if there is a wound.
        s.Injuries.Add(new Injury { Part = BodyPart.LeftLeg, Kind = InjuryKind.Deep, Source = EventSource.Apostle });
        s.Player.Health = 50f; s.Inventory[(int)Item.Medicine] = 2; Simulation.UseItem(s, Item.Medicine);
        Equal(s.Injuries.Count, 1); Equal(s.Injuries[0].Kind, InjuryKind.Cut); Near(s.Player.Health, 90f); Equal(s.Inventory[(int)Item.Medicine], 1);
        True(s.Message.Contains("left leg"));
        s.Player.Health = 100f; Simulation.UseItem(s, Item.Medicine); Equal(s.Injuries.Count, 0); Equal(s.Inventory[(int)Item.Medicine], 0);
        s.Inventory[(int)Item.Medicine] = 1; Simulation.UseItem(s, Item.Medicine); Equal(s.Inventory[(int)Item.Medicine], 1);      // nothing to treat: nothing spent
        // Bruises fade by dawn; cuts stay. Wounds age.
        s.Injuries.Add(new Injury { Part = BodyPart.Torso, Kind = InjuryKind.Bruise }); s.Injuries.Add(new Injury { Part = BodyPart.Head, Kind = InjuryKind.Cut });
        Simulation.Step(s, .1f); True(s.Injuries[0].Age > 0f);
        s.Mode = RunMode.Survived; Simulation.NextCycle(s); Equal(s.Injuries.Count, 1); Equal(s.Injuries[0].Kind, InjuryKind.Cut);
        // The safehouse protects: no wound is recorded while safe.
        GameState safe = SiegeOf(3); safe.Player.Health = 100f; Run(safe, 20f); Equal(safe.Injuries.Count, 0);
    }

    private static void BaseWatching()
    {
        GameState s = SiegeOf(3); Equal(s.Enemies.Count, 1);
        BaseWatch far = Simulation.Watch(s); True(far.Active); True(far.Distance > 6f); True(!far.AtDoor); True(!far.UnderAttack);
        var bus = new EventBus(); var hits = new List<GameEvent>(); bus.Subscribe(GameEventKind.WallHit, hits.Add);
        float lastDistance = far.Distance; bool nearer = true;
        for (int i = 0; i < 300; i++)
        {
            Simulation.Step(s, .05f); bus.Pump(s);
            BaseWatch w = Simulation.Watch(s); if (w.Distance > lastDistance + .05f) nearer = false; lastDistance = w.Distance;
        }
        True(nearer, "the sound only gets closer"); BaseWatch at = Simulation.Watch(s); True(at.AtDoor && at.UnderAttack);
        True(hits.Count >= 4); Equal(hits[0].Source, EventSource.Apostle);
        for (int i = 1; i < hits.Count; i++) True(hits[i].Id > hits[i - 1].Id);
        True(at.WallFraction > 0f && at.WallFraction < 1f); True(at.Direction.Magnitude > .99f);
        // Away from the safehouse the watch is silent, but the attack is still reported.
        s.Area = "clinic"; BaseWatch away = Simulation.Watch(s); True(!away.Active); True(away.UnderAttack);
    }

    private static void ItemsAndEquipment()
    {
        GameState s = Playing(13);
        True(Simulation.Describe(s, Item.Crowbar).Contains("damage 28")); True(Simulation.Describe(s, Item.Food).Contains("+35 stamina"));
        True(Simulation.Describe(s, Item.Medicine).Contains("wound")); True(Simulation.Describe(s, Item.Tools).Contains("workbench"));
        Equal(s.Equipped, Weapon.Fists);
        s.Inventory[(int)Item.Crowbar] = 1; Simulation.UseItem(s, Item.Crowbar); Equal(s.Equipped, Weapon.Crowbar);
        Simulation.UseItem(s, Item.Crowbar); Equal(s.Equipped, Weapon.Fists);           // the same action unequips
        Simulation.UseItem(s, Item.Pistol); Equal(s.Equipped, Weapon.Fists);            // not owned: cannot be equipped
        Simulation.UseItem(s, Item.Crowbar); Simulation.UseItem(s, Item.Food); Equal(s.Equipped, Weapon.Crowbar);
    }

    private static void StealthStatus()
    {
        GameState s = Playing(14); s.Player.Position = new V2(4f, 4f);
        Equal(Simulation.StealthOf(s), Stealth.Hidden);
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 5f, 4f); Face(e, -1f, 0f);
        Equal(Simulation.StealthOf(s), Stealth.Exposed);                                // it could see you, but has not started to
        e.Awareness = .3f; Equal(Simulation.StealthOf(s), Stealth.Noticed);
        e.State = AiState.Search; Equal(Simulation.StealthOf(s), Stealth.Searching);
        e.State = AiState.Chase; Equal(Simulation.StealthOf(s), Stealth.Hunted);
        e.State = AiState.Patrol; e.Awareness = 0f; Face(e, 1f, 0f); Equal(Simulation.StealthOf(s), Stealth.Hidden);   // facing away
        s.Area = "clinic"; e.State = AiState.Chase; Equal(Simulation.StealthOf(s), Stealth.Hidden);                   // indoors, nothing follows
    }

    private static void AimRanges()
    {
        GameState s = Playing(1); s.Player.Position = new V2(4f, 4f);
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.9f, 4f); True(Simulation.AimTarget(s) == e);
        e.Position = new V2(5.4f, 4f); True(Simulation.AimTarget(s) == e);   // melee acquires out to reach plus lunge (1.55)
        e.Position = new V2(5.6f, 4f); True(Simulation.AimTarget(s) == null);
        s.Equipped = Weapon.Pistol; e.Position = new V2(9f, 4f); True(Simulation.AimTarget(s) == e);
        e.Position = new V2(9.1f, 4f); True(Simulation.AimTarget(s) == null);
        e.Position = new V2(4.5f, 4f); s.Area = "clinic"; True(Simulation.AimTarget(s) == null);
    }

    private static void AutoEquipment()
    {
        GameState s = Playing(7); s.Area = "clinic"; s.Player.Position = new V2(3f, 3f); s.AutoLoot = true; s.Equipped = Weapon.Crowbar; s.Loot.Clear();
        AddLoot(s, 1, "clinic", Item.Pistol, 1, 3f, 3f); AddLoot(s, 2, "clinic", Item.Crowbar, 1, 3.1f, 3f);
        True(Simulation.AutoLoot(s) != null); Equal(s.Equipped, Weapon.Crowbar); True(Simulation.AutoLoot(s) == null);
        Simulation.Step(s, .1f); Simulation.Step(s, .1f); Simulation.Step(s, .1f); Equal(s.Inventory[(int)Item.Crowbar], 0);
        Simulation.Step(s, .1f); Equal(s.Inventory[(int)Item.Crowbar], 1); Equal(s.Equipped, Weapon.Crowbar);
    }

    private static void PausedActions()
    {
        GameState s = Playing(4); s.Area = "workshop"; s.Player.Position = s.Loot[0].Position; s.Mode = RunMode.Paused;
        string before = Snapshot(s); True(!Simulation.Attack(s, true)); Simulation.Dodge(s); Simulation.UseItem(s, Item.Food);
        Simulation.Interact(s); True(!Simulation.TapLoot(s, s.Loot[0].Position)); Equal(Snapshot(s), before);
    }

    private static void AllInteriors()
    {
        Equal(Simulation.Buildings.Count, 5);
        for (int i = 0; i < Simulation.Buildings.Count; i++)
        {
            GameState s = Playing(1); Building building = Simulation.Buildings[i]; s.Player.Position = building.Door;
            True(Simulation.Context(s).StartsWith("Enter ")); Simulation.Interact(s); Equal(s.Area, building.Id);
            True(Simulation.CanWalk(s.Player.Position, s.Area));
            s.Player.Position = new V2(3f, 5.3f); s.InteractCooldown = 0; Equal(Simulation.Context(s), "Leave building");
            Simulation.Interact(s); Equal(s.Area, "street"); Near(s.Player.Position.X, building.Door.X); Near(s.Player.Position.Y, building.Door.Y + .15f);
            True(Simulation.CanWalk(s.Player.Position, "street"));
        }
    }

    private static void DirectionalDodge()
    {
        GameState s = Playing(2); s.Enemies.Clear(); s.Player.Position = new V2(4f, 4f);
        Simulation.Dodge(s, new V2(2f, -2f)); Near(s.Player.Face.Magnitude, 1f); Near(s.Player.Stamina, 78f);
        Near(s.Player.Face.X, .7071068f); Near(s.Player.Face.Y, -.7071068f);
        V2 before = s.Player.Position; Simulation.Step(s, .05f); True(s.Player.Position.X > before.X && s.Player.Position.Y < before.Y);
        float stamina = s.Player.Stamina; Simulation.Dodge(s); Near(s.Player.Stamina, stamina);
    }

    private static void DepthOrder()
    {
        Building shelter = Simulation.FindBuilding("shelter");   // x .65-2.65, y .65-2.35; front corner sum 5.0
        // Just east of the building's northern end: the old sum rule put the actor behind the wall.
        V2 east = new V2(shelter.Position.X + shelter.Width + .2f, shelter.Position.Y + .1f);
        True(Depth.Of(east) <= Depth.BuildingOrder(shelter), "this is the case the old rule got wrong");
        True(InFrontOrder(east), "east of the building must draw over it");
        // Just west of the building's southern end: the old rule could put the actor over the wall.
        V2 west = new V2(shelter.Position.X - .2f, shelter.Position.Y + shelter.Height - .1f);
        True(!InFrontOrder(west), "west of the building must draw behind it");
        True(Depth.ActorOrder(new V2(1.6f, 2.6f), true) > Depth.BuildingOrder(shelter), "south, at the door");
        True(Depth.ActorOrder(new V2(1.6f, .4f), true) < Depth.BuildingOrder(shelter), "north, behind");
        Equal(Depth.ActorOrder(east, false), Depth.Of(east));                                            // interiors use plain depth
        // Every walkable point on the street must satisfy the box rule against every building, with no conflict.
        int checkedPoints = 0;
        for (float x = .2f; x <= 9.8f; x += .1f) for (float y = .2f; y <= 9.8f; y += .1f)
        {
            var p = new V2(x, y); if (!Simulation.CanWalk(p, "street")) continue;
            int order = Depth.ActorOrder(p, true); checkedPoints++;
            for (int i = 0; i < Simulation.Buildings.Count; i++)
            {
                Building b = Simulation.Buildings[i]; int sort = Depth.BuildingOrder(b);
                Depth.Relation relation = Depth.RelationTo(b, p);
                if (relation == Depth.Relation.InFront) True(order > sort, "in front of " + b.Id + " at " + p);
                else if (relation == Depth.Relation.Behind) True(order < sort, "behind " + b.Id + " at " + p);
            }
        }
        True(checkedPoints > 5000, "the sweep must cover the street");
    }

    private static bool InFrontOrder(V2 p) { return Depth.ActorOrder(p, true) > Depth.BuildingOrder(Simulation.FindBuilding("shelter")); }

    private static void WindedSwing()
    {
        GameState s = Playing(); s.Player.Position = new V2(4f, 4f); s.Player.Face = new V2(1f, 0f); s.Equipped = Weapon.Crowbar;
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.6f, 4f, 100f);
        s.Player.Stamina = 4f;
        True(Simulation.Attack(s, true) == false); Near(s.Player.Stamina, 4f); Near(e.Health, 100f);        // heavy is still refused, and costs nothing
        True(Simulation.Attack(s)); Near(e.Health, 86f); Near(s.Player.Stamina, 0f); True(s.Player.Winded > 0f);   // 28 x 0.5
        int winded = KindsOf(s.Events).FindAll(k => k == GameEventKind.Winded).Count; Equal(winded, 1);
        Run(s, 1f); Near(s.Player.Winded, 0f);
        s.Player.Stamina = 50f; Run(s, .6f); s.Player.Stamina = 50f; True(Simulation.Attack(s)); Near(e.Health, 58f);       // rested: full damage, no cue
        Equal(KindsOf(s.Events).FindAll(k => k == GameEventKind.Winded).Count, 1);
        GameData d = GameData.CreateDefault(); d.Weapons[1].WindedDamageScale = 0f; True(string.Join("|", d.Validate()).Contains("winded"));
    }

    private static void DataDefaultsValid()
    {
        GameData d = GameData.CreateDefault(); Equal(d.Validate().Count, 0, string.Join("; ", d.Validate()));
        Equal(d.ItemOf(Item.Medicine).Name, "Medicine"); True(d.WeaponOf(Weapon.Pistol).Ranged); Equal(d.EnemyOf(EnemyKind.Apostle).Health, 260f);
        Near(d.WeaponOf(Weapon.Fists).AimCosine, 0.2588190451f, .00001f); Near(d.WeaponOf(Weapon.Pistol).AimCosine, 0.7660444431f, .00001f);
        Near(d.WeaponOf(Weapon.Crowbar).AcquireRange, 1.55f); Near(d.WeaponOf(Weapon.Pistol).AcquireRange, 5f);
        GameState s = Simulation.Create(1); True(s.Data != null); Near(s.Player.Health, 100f); Near(s.DayDuration, 150f); Near(s.NightDuration, 90f);
        Near(Simulation.Create(1, true).DayDuration, 35f); Equal(Simulation.ItemName(Item.Ammo), "Ammo");
        // Each run owns its data, so editing one run's tuning cannot leak into another's.
        True(!ReferenceEquals(Simulation.Create(1).Data, s.Data));
        // A state that arrives without data (for example one built by hand) still plays on the shipped defaults.
        var bare = new GameState(); Near(Simulation.WallCapacity(bare), 40f); True(bare.Data != null);
    }

    private static void DataValidation()
    {
        Func<Action<GameData>, string> problems = edit => { GameData d = GameData.CreateDefault(); edit(d); return string.Join("|", d.Validate()); };
        True(problems(d => d.Items.RemoveAt(0)).Contains("Crowbar"), "missing item");
        True(problems(d => d.Weapons.Add(new WeaponDef { Id = Weapon.Pistol })).Contains("exactly once"), "duplicate weapon");
        True(problems(d => d.Enemies[0].Health = 0f).Contains("positive health"), "enemy health");
        True(problems(d => d.Weapons[0].Damage = 0f).Contains("deal damage"), "weapon damage");
        True(problems(d => d.Weapons[2].AimHalfAngle = 0f).Contains("aim angle"), "aim angle");
        True(problems(d => d.Weapons[0].AmmoCost = 1).Contains("not ranged"), "melee ammo");
        True(problems(d => d.Safehouse.BaseIntegrity = 0f).Contains("base integrity"), "base integrity");
        True(problems(d => d.Safehouse.WarnFraction = 2f).Contains("warning fraction"), "warn fraction");
        True(problems(d => d.Clock.DaySeconds = 0f).Contains("durations"), "clock");
        True(problems(d => d.Player.RunBandMin = d.Player.WalkBandMax).Contains("speed bands"), "speed bands");
        True(problems(d => d.Player.ProneHoldSeconds = 0f).Contains("prone hold"), "prone hold");
        True(problems(d => d.Eclipses.Clear()).Contains("cycle 1"), "no first eclipse");
        True(problems(d => d.Eclipses.Add(new EclipseProfile { Name = "dup", FromCycle = 1 })).Contains("Two Eclipse profiles"), "duplicate eclipse start");
        True(problems(d => d.Items[2].StaminaRestore = d.Items[2].HealthRestore = 0f).Contains("restores nothing"), "empty consumable");
        True(problems(d => d.Player = null).Contains("must all be present"), "missing player");
        GameData broken = GameData.CreateDefault(); broken.Enemies.Clear();
        bool threw = false; try { Simulation.Create(1, false, broken); } catch (ArgumentException) { threw = true; }
        True(threw, "Create must refuse invalid data");
    }

    private static void EclipseProfiles()
    {
        GameData d = GameData.CreateDefault();
        var later = new EclipseProfile { Name = "The long Eclipse", FromCycle = 3, DurationScale = 2f, ExposureDamage = 30f, ExposureInterval = 1f, WallPressure = 1f, WallPressureGrowth = 0f, WarningSeconds = 10f };
        later.Spawns.Add(new EclipseSpawn(10, EnemyKind.Apostle, new V2(9.2f, 1.9f))); later.Spawns.Add(new EclipseSpawn(11, EnemyKind.Scavenger, new V2(9f, 9f)));
        d.Eclipses.Add(later); Equal(d.Validate().Count, 0);
        Equal(d.EclipseFor(1).Name, "The first Eclipse"); Equal(d.EclipseFor(2).Name, "The first Eclipse");
        Equal(d.EclipseFor(3).Name, "The long Eclipse"); Equal(d.EclipseFor(9).Name, "The long Eclipse"); Equal(d.EclipseFor(0).Name, "The first Eclipse");
        // Profile order in the list must not matter.
        d.Eclipses.Reverse(); d.Prepare(); Equal(d.EclipseFor(2).Name, "The first Eclipse"); Equal(d.EclipseFor(4).Name, "The long Eclipse");

        GameState s = Simulation.Create(1, false, d); Simulation.Start(s);
        s.Enemies.Clear(); Run(s, 150f - 20f + .1f); Equal(s.Phase, DayPhase.Warning);               // cycle 1: warning 20 s out
        Run(s, 21f); Equal(s.Phase, DayPhase.Eclipse); Equal(s.Enemies.Count, 1); Near(s.Duration, 90f);
        Near(Simulation.WallPressure(s), .6f);

        GameState t = Simulation.Create(1, false, d); Simulation.Start(t); t.Cycle = 3; t.Enemies.Clear();
        Near(Simulation.WallPressure(t), 1f);
        Run(t, 150f - 10f - .1f); Equal(t.Phase, DayPhase.Day);                                      // cycle 3: warning only 10 s out
        Run(t, .2f); Equal(t.Phase, DayPhase.Warning);
        Run(t, 11f); Equal(t.Phase, DayPhase.Eclipse); Near(t.Duration, 180f);
        Equal(t.Enemies.Count, 2); True(t.Enemies.Exists(e => e.Id == 11 && e.Kind == EnemyKind.Scavenger));
        // Exposure: indoors without a safehouse, the later profile hits harder and faster.
        t.Area = "clinic"; t.Player.Position = new V2(3f, 3f); float before = t.Player.Health;
        Run(t, .5f); Near(before - t.Player.Health, 30f); Run(t, .6f); Near(before - t.Player.Health, 60f);
    }

    private static void DataDrivesBehavior()
    {
        GameData d = GameData.CreateDefault();
        d.Weapons[0].Damage = 100f;                                       // fists
        d.Enemies[0].Drops.Add(new ItemStack(Item.Medicine, 2));           // bandits also drop medicine
        d.Enemies[0].DefeatText = "Custom text.";
        d.Items[2].StaminaRestore = 10f; d.Items[2].HealthRestore = 0f;    // food
        d.Safehouse.BaseIntegrity = 100f; d.Safehouse.IntegrityPerTool = 5f; d.Safehouse.MaxTools = 1;
        d.Clock.DaySeconds = 60f; d.Clock.EclipseSeconds = 30f; d.Player.MaxHealth = 150f; d.Player.DawnHealing = 5f;
        GameState s = Simulation.Create(1, false, d); Simulation.Start(s);
        Near(s.DayDuration, 60f); Near(s.NightDuration, 30f); Near(s.Player.Health, 150f); Near(s.WallIntegrity, 100f);
        Enemy e = OneEnemy(s, EnemyKind.Bandit, 4.4f, 4f); s.Player.Position = new V2(4f, 4f); s.Player.Face = new V2(1f, 0f);
        int medicine = s.Inventory[(int)Item.Medicine];
        True(Simulation.Attack(s)); True(e.Health <= 0f, "100 damage kills a 65 health bandit in one blow");
        Equal(s.Inventory[(int)Item.Medicine], medicine + 2); Equal(s.Message, "Custom text.");
        s.Player.Stamina = 50f; Simulation.UseItem(s, Item.Food); Near(s.Player.Stamina, 60f); Equal(s.Message, "A quick meal. +10 stamina");
        s.WallTools = 1; Near(Simulation.WallCapacity(s), 105f); Equal(Simulation.Context(s) == null ? "" : "x", "");
        s.Area = "shelter"; s.Player.Position = new V2(3f, 1.3f); Equal(Simulation.Context(s), "Walls fully reinforced");
        // Stronger enemy health follows the data too, and health caps at the data's maximum.
        d.Enemies[1].Health = 500f; Near(Simulation.CreateEnemy(9, EnemyKind.Scavenger, new V2(), d).Health, 500f);
        s.Player.Health = 140f; Simulation.NextCycle(s); Near(s.Player.Health, 145f);
    }

    private static void BrowserFixture()
    {
        // Filled from the unchanged browser engine's seed=1 fixture, not from this port.
        GameState state = Simulation.Create(1);
        Equal(state.Loot.Count, 13); Equal(state.Enemies.Count, 3);
        Near(state.Loot[0].Position.X, 1.2655188686f, .000002f);
        Near(state.Loot[0].Position.Y, 1.4084894719f, .000002f);
        Equal(state.Seed, 3037600243u);
    }
}
