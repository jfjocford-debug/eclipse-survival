using System.Text;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;
using EclipseSurvival.Core;
namespace EclipseSurvival
{
    /// <summary>
    /// The Survivor screen, opened with Tab or I. The left side is the body: where you are hurt, how badly, and your
    /// health and stamina. The right side is everything you carry, with what each item does, which weapon is in your
    /// hands, and a button to use it, so nobody has to guess which number key is the medicine.
    /// Time is stopped while it is open: reading a menu should never be what kills you.
    /// </summary>
    public sealed class SurvivorPanel : MonoBehaviour
    {
        GameController game;
        Font font;
        GameObject root;
        RectTransform rowsRoot;
        Text header, conditionText, woundText, healthText, staminaText, noteText;
        RectTransform healthFill, staminaFill;
        readonly Image[] parts = new Image[6];
        string signature = "";
        float clock;
        const float BarWidth = 300f;
        static readonly Color Panel = new Color(.055f, .12f, .09f, .97f), Ink = new Color(.93f, .91f, .75f), Accent = new Color(.85f, .74f, .46f);
        static readonly Color Dim = new Color(.62f, .66f, .56f), Row = new Color(.09f, .17f, .12f, 1f), RowOn = new Color(.27f, .23f, .1f, 1f);
        static readonly Color ButtonFill = new Color(.2f, .32f, .22f, 1f), Healthy = new Color(.22f, .33f, .25f, 1f);
        static readonly Color Bruise = new Color(.6f, .5f, .26f, 1f), Cut = new Color(.82f, .42f, .25f, 1f), Deep = new Color(.9f, .2f, .18f, 1f);

        public bool Visible { get { return root != null && root.activeSelf; } }

        public void Initialize(GameController controller, Font uiFont)
        {
            game = controller; font = uiFont;
            gameObject.layer = 5;
            var self = (RectTransform)transform;   // stretch over the whole canvas so the screen below can fill it
            self.anchorMin = Vector2.zero; self.anchorMax = Vector2.one; self.offsetMin = self.offsetMax = Vector2.zero;
            var rootRect = (RectTransform)new GameObject("Survivor screen", typeof(RectTransform)).transform;
            root = rootRect.gameObject; root.layer = 5; rootRect.SetParent(transform, false);
            rootRect.anchorMin = Vector2.zero; rootRect.anchorMax = Vector2.one; rootRect.offsetMin = rootRect.offsetMax = Vector2.zero;
            var dim = root.AddComponent<Image>(); dim.color = new Color(0f, 0f, 0f, .66f); dim.raycastTarget = true;   // also blocks clicks on the game behind
            var box = Rt("Box", rootRect, new Vector2(.5f, .5f), new Vector2(.5f, .5f), new Vector2(1180f, 640f), Vector2.zero);
            var boxImage = box.gameObject.AddComponent<Image>(); boxImage.color = Panel; boxImage.raycastTarget = false;

            header = Txt("SURVIVOR", box, 30, new Vector2(30f, -16f), new Vector2(700f, 40f), TextAnchor.MiddleLeft, Ink);
            Txt("CONDITION", box, 20, new Vector2(30f, -66f), new Vector2(300f, 28f), TextAnchor.MiddleLeft, Accent);
            Txt("BACKPACK", box, 20, new Vector2(600f, -66f), new Vector2(300f, 28f), TextAnchor.MiddleLeft, Accent);

            // The body, seen from the front: your right hand is on the left of the figure.
            var body = Rt("Body", box, TopLeft, TopLeft, new Vector2(220f, 360f), new Vector2(40f, -104f));
            parts[(int)BodyPart.Head] = Block("Head", body, new Vector2(110f, -30f), new Vector2(44f, 44f));
            parts[(int)BodyPart.Torso] = Block("Torso", body, new Vector2(110f, -125f), new Vector2(76f, 120f));
            parts[(int)BodyPart.RightArm] = Block("Right arm", body, new Vector2(56f, -125f), new Vector2(28f, 110f));
            parts[(int)BodyPart.LeftArm] = Block("Left arm", body, new Vector2(164f, -125f), new Vector2(28f, 110f));
            parts[(int)BodyPart.RightLeg] = Block("Right leg", body, new Vector2(92f, -255f), new Vector2(32f, 140f));
            parts[(int)BodyPart.LeftLeg] = Block("Left leg", body, new Vector2(128f, -255f), new Vector2(32f, 140f));

            woundText = Txt("", box, 17, new Vector2(280f, -104f), new Vector2(290f, 330f), TextAnchor.UpperLeft, Ink);
            conditionText = Txt("", box, 20, new Vector2(40f, -470f), new Vector2(520f, 28f), TextAnchor.MiddleLeft, Ink);
            Txt("Health", box, 17, new Vector2(40f, -508f), new Vector2(80f, 24f), TextAnchor.MiddleLeft, Dim);
            healthFill = Bar(box, new Vector2(130f, -512f), new Color(.85f, .43f, .3f));
            healthText = Txt("", box, 17, new Vector2(440f, -508f), new Vector2(110f, 24f), TextAnchor.MiddleLeft, Ink);
            Txt("Stamina", box, 17, new Vector2(40f, -540f), new Vector2(80f, 24f), TextAnchor.MiddleLeft, Dim);
            staminaFill = Bar(box, new Vector2(130f, -544f), new Color(.64f, .74f, .42f));
            staminaText = Txt("", box, 17, new Vector2(440f, -540f), new Vector2(110f, 24f), TextAnchor.MiddleLeft, Ink);
            noteText = Txt("Hunger, thirst and sleep are not in this build yet. Wounds are recorded and treatable; their lasting effects come with the injury fuse.", box, 15, new Vector2(40f, -574f), new Vector2(520f, 52f), TextAnchor.UpperLeft, Dim);

            var rowsRect = Rt("Items", box, TopLeft, TopLeft, new Vector2(550f, 480f), new Vector2(600f, -100f)); rowsRoot = rowsRect;
            Txt("Tab or Esc: close     1 to 6: quick-use     Time is stopped while this screen is open.", box, 16, new Vector2(600f, -598f), new Vector2(430f, 30f), TextAnchor.MiddleLeft, Dim);
            Btn("Close", box, new Vector2(1040f, -594f), new Vector2(110f, 34f), game.ClosePanel);
            root.SetActive(false);
        }

        static readonly Vector2 TopLeft = new Vector2(0f, 1f);

        RectTransform Rt(string name, Transform parent, Vector2 anchor, Vector2 pivot, Vector2 size, Vector2 position)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.layer = 5;
            var r = (RectTransform)go.transform; r.SetParent(parent, false);
            r.anchorMin = r.anchorMax = anchor; r.pivot = pivot; r.sizeDelta = size; r.anchoredPosition = position;
            return r;
        }

        Image Block(string name, Transform parent, Vector2 center, Vector2 size)
        {
            var r = Rt(name, parent, TopLeft, new Vector2(.5f, .5f), size, center);
            var image = r.gameObject.AddComponent<Image>(); image.color = Healthy; image.raycastTarget = false;
            return image;
        }

        RectTransform Bar(Transform parent, Vector2 position, Color color)
        {
            var back = Rt("Meter", parent, TopLeft, TopLeft, new Vector2(BarWidth, 16f), position);
            var backImage = back.gameObject.AddComponent<Image>(); backImage.color = new Color(.1f, .16f, .11f, 1f); backImage.raycastTarget = false;
            var fill = Rt("Fill", back, TopLeft, TopLeft, new Vector2(BarWidth, 16f), Vector2.zero);
            var fillImage = fill.gameObject.AddComponent<Image>(); fillImage.color = color; fillImage.raycastTarget = false;
            return fill;
        }

        Text Txt(string value, Transform parent, int size, Vector2 position, Vector2 dimensions, TextAnchor align, Color color)
        {
            var r = Rt(value.Length > 24 ? "Text" : value, parent, TopLeft, TopLeft, dimensions, position);
            var t = r.gameObject.AddComponent<Text>();
            t.font = font; t.fontSize = size; t.color = color; t.text = value; t.alignment = align; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Truncate;
            return t;
        }

        UnityEngine.UI.Button Btn(string label, Transform parent, Vector2 position, Vector2 size, UnityAction action)
        {
            var r = Rt(label, parent, TopLeft, TopLeft, size, position);
            var image = r.gameObject.AddComponent<Image>(); image.color = ButtonFill;
            var button = r.gameObject.AddComponent<UnityEngine.UI.Button>(); button.targetGraphic = image; button.onClick.AddListener(action);
            var colors = button.colors; colors.normalColor = Color.white; colors.highlightedColor = new Color(1f, .95f, .77f); button.colors = colors;
            Txt(label, r, 18, Vector2.zero, size, TextAnchor.MiddleCenter, Ink);
            return button;
        }

        public void SetOpen(bool open)
        {
            if (root == null) return;
            root.SetActive(open);
            if (open) { signature = ""; Refresh(true); }
        }

        void Update()
        {
            if (root == null || !root.activeSelf || game == null || game.State == null) return;
            clock += Time.unscaledDeltaTime; if (clock < .1f) return; clock = 0f;
            Refresh(false);
        }

        static Item ItemOfWeapon(Weapon weapon) { return weapon == Weapon.Pistol ? Item.Pistol : Item.Crowbar; }

        static string Ago(float seconds)
        {
            if (seconds < 10f) return "just now";
            if (seconds < 90f) return Mathf.RoundToInt(seconds) + " seconds ago";
            return Mathf.RoundToInt(seconds / 60f) + " minutes ago";
        }

        static string Hex(Color c) { return ColorUtility.ToHtmlStringRGB(c); }

        void Refresh(bool force)
        {
            var s = game.State; var data = s.Data; var p = s.Player;
            header.text = "SURVIVOR · " + (s.Phase == DayPhase.Eclipse ? "Eclipse" : "Day") + " " + s.Cycle;
            // Body: every part takes the colour of its worst wound.
            for (int i = 0; i < parts.Length; i++) parts[i].color = Healthy;
            var wounds = new StringBuilder();
            for (int i = 0; i < s.Injuries.Count; i++)
            {
                var w = s.Injuries[i];
                Color tone = w.Kind == InjuryKind.Deep ? Deep : w.Kind == InjuryKind.Cut ? Cut : Bruise;
                var image = parts[(int)w.Part];
                Color current = image.color;
                bool worse = current == Healthy || (w.Kind == InjuryKind.Deep) || (w.Kind == InjuryKind.Cut && current == Bruise);
                if (worse) image.color = tone;
                wounds.Append("<b>").Append(Simulation.PartName(w.Part)).Append("</b>\n<color=#").Append(Hex(tone)).Append('>').Append(Simulation.KindName(w.Kind))
                    .Append("</color> · ").Append(Simulation.SourceName(w.Source)).Append(" · ").Append(Ago(w.Age)).Append("\n\n");
            }
            woundText.text = s.Injuries.Count == 0 ? "No wounds.\n\nWounds appear here the moment you are hurt, with where, how bad, and who did it. Medicine treats the worst one." : wounds.ToString();
            float healthFraction = Mathf.Clamp01(p.Health / data.Player.MaxHealth), staminaFraction = Mathf.Clamp01(p.Stamina / data.Player.MaxStamina);
            healthFill.sizeDelta = new Vector2(BarWidth * healthFraction, 16f); staminaFill.sizeDelta = new Vector2(BarWidth * staminaFraction, 16f);
            healthText.text = Mathf.CeilToInt(p.Health) + " / " + Mathf.CeilToInt(data.Player.MaxHealth);
            staminaText.text = Mathf.CeilToInt(p.Stamina) + " / " + Mathf.CeilToInt(data.Player.MaxStamina);
            string state = healthFraction > .75f ? "Steady" : healthFraction > .4f ? "Hurt" : healthFraction > .2f ? "Badly hurt" : "Critical";
            conditionText.text = "Condition: " + state + (s.Injuries.Count > 0 ? " · " + s.Injuries.Count + (s.Injuries.Count == 1 ? " wound" : " wounds") : "") + (p.Winded > 0f ? " · Winded" : "");

            var key = new StringBuilder();
            key.Append((int)s.Equipped).Append('|');
            for (int i = 0; i < s.Inventory.Length; i++) key.Append(s.Inventory[i]).Append(',');
            key.Append(s.Injuries.Count).Append(p.Health >= data.Player.MaxHealth ? "f" : "n");
            string next = key.ToString();
            if (!force && next == signature) return;
            signature = next; BuildRows();
        }

        void BuildRows()
        {
            foreach (Transform child in rowsRoot) Destroy(child.gameObject);
            var s = game.State; var data = s.Data;
            AddRow(0, "Fists", "Bare hands · damage " + (int)data.WeaponOf(Weapon.Fists).Damage, "", s.Equipped == Weapon.Fists, true,
                s.Equipped == Weapon.Fists ? null : "Equip", () => game.Use(ItemOfWeapon(game.State.Equipped)));
            for (int i = 0; i < 6; i++)
            {
                Item item = (Item)i; ItemDef def = data.ItemOf(item); int count = s.Inventory[i]; bool owned = count > 0;
                bool weapon = def.Use == ItemUse.Weapon; bool equipped = weapon && s.Equipped == def.Weapon;
                string description = Simulation.Describe(s, item);
                if (item == Item.Pistol && owned) description += " · " + s.Inventory[(int)Item.Ammo] + " rounds loaded";
                string action = !owned ? null : weapon ? (equipped ? "Unequip" : "Equip") : def.Use == ItemUse.Consumable ? (item == Item.Medicine ? "Treat" : "Eat") : null;
                if (item == Item.Medicine && owned && s.Injuries.Count == 0 && s.Player.Health >= data.Player.MaxHealth) action = null;
                int slot = i; Item captured = item;
                AddRow(i + 1, def.Name, description, weapon ? (owned ? "carried" : "") : "x" + count, equipped, owned, action, () => game.Use(captured), "[" + (slot + 1) + "]");
            }
        }

        void AddRow(int index, string name, string description, string quantity, bool equipped, bool owned, string action, UnityAction onClick, string hotkey = "")
        {
            float y = -index * 66f;
            var row = Rt("Row " + name, rowsRoot, TopLeft, TopLeft, new Vector2(550f, 60f), new Vector2(0f, y));
            var back = row.gameObject.AddComponent<Image>(); back.color = equipped ? RowOn : Row; back.raycastTarget = false;
            Color text = owned ? Ink : Dim;
            Txt(hotkey, row, 16, new Vector2(10f, -8f), new Vector2(40f, 24f), TextAnchor.MiddleLeft, Dim);
            Txt(name, row, 22, new Vector2(50f, -5f), new Vector2(200f, 28f), TextAnchor.MiddleLeft, text);
            Txt(quantity, row, 20, new Vector2(250f, -5f), new Vector2(90f, 28f), TextAnchor.MiddleLeft, equipped ? Accent : text);
            Txt(description, row, 15, new Vector2(50f, -33f), new Vector2(380f, 24f), TextAnchor.MiddleLeft, Dim);
            if (equipped) Txt("EQUIPPED", row, 16, new Vector2(340f, -8f), new Vector2(110f, 24f), TextAnchor.MiddleLeft, Accent);
            if (action != null) Btn(action, row, new Vector2(440f, -12f), new Vector2(100f, 36f), onClick);
        }
    }
}
