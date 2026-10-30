# CRM Design Reference — Dashboard & Records List

A domain-agnostic reference for replicating the visual structure of the Dashboard and Prospects/Leads pages. All pixel values, colors, and layout patterns are extracted directly from the source app.

---

## 1. Design Tokens

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `bg` | `#F4F4F2` | Page background |
| `surface` | `#ffffff` | Cards, inputs, dropdowns |
| `primary` | `#1d4ed8` | Buttons, links, active states |
| `primaryDark` | `#1e3a8a` | Avatar backgrounds |
| `primaryLight` | `#e8f4f8` | Info banners, selected row highlights |
| `text` | `#0f172a` | Body text |
| `textMid` | `#475569` | Secondary text, labels |
| `textLight` | `#94a3b8` | Muted text, placeholders, empty states |
| `border` | `#e2e8f0` | All dividers and card outlines |
| `borderMid` | `#cbd5e1` | Input borders, secondary button borders |
| `tableHead` | `#F4F4F2` | Table header rows, card section headers |
| `rowHover` | `#e6f2f5` | Table row hover |
| `rowAlt` | `#fafafa` | Alternating table rows |
| `sidebar` | `#6F8077` | Sidebar background |
| `sidebarText` | `#f0f5f1` | Sidebar nav text |
| `sidebarActive` | `#d4d4d4` | Active nav item text |
| `sidebarHoverBg` | `#78917E` | Nav item hover |

### Status / Category Colors

For any ordinal category with a color (e.g. rating, stage, priority), use this 3-token system: `text color`, `background tint`, and an optional `border`.

```
Status badge pattern:
  text color  → saturated/dark version of the hue
  bg color    → very light tint (~10% opacity)
  border      → midpoint between bg and text
```

Examples from the app:

| Category | Text | Background | Border |
|---|---|---|---|
| Hot / Urgent | `#991b1b` | `#fff1f2` | — |
| Warm / Active | `#92400e` | `#fffbeb` | — |
| Cold / Inactive | `#475569` | `#f8fafc` | — |
| Success / Converted | `#15803d` | `#f0fdf4` | `#A8D0D9` |
| Neutral / Closed | `#83766D` | `#F4F4F2` | `#BFBFBF` |
| Warning / Dormant | `#8B664A` | `#f5eadc` | `#D2A974` |

### Typography

| Element | Size | Weight | Transform |
|---|---|---|---|
| Page title | 16–17px | 700 | uppercase, letter-spacing 0.1–0.2 |
| Card big number | 22–26px | 800 | tabular-nums |
| Section header chip | 11–12px | 700 | uppercase, letter-spacing 0.4–0.5 |
| Table column header | 11px | 700 | uppercase, letter-spacing 0.4 |
| Body / table cell | 13px | 400–600 | — |
| Badge / tag | 11px | 600–700 | uppercase, letter-spacing 0.2–0.3 |
| Sub-label under number | 11px | 400 | — |

---

## 2. Layout Shell

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (200–220px fixed)   │  Main content area   │
│  bg: #6F8077                 │  bg: #F4F4F2         │
│                              │  padding: 24–28px    │
│  [Logo / App Name]           │                      │
│                              │  <Page content>      │
│  [Nav Item]  ←── active      │                      │
│  [Nav Item]                  │                      │
│  [Nav Item]                  │                      │
└─────────────────────────────────────────────────────┘
```

### Sidebar Nav Item

```
padding: 10px 18px
font-size: 13px, font-weight: 600
display: flex, align-items: center, gap: 10px
[icon 15×15] [label]

default:  color #f0f5f1, background transparent
hover:    background #78917E
active:   background rgba(255,255,255,.12), color #d4d4d4
          border-left: 2px solid #d4d4d4
```

---

## 3. Primitive Components

### `Card`

```
background: #ffffff
border-radius: 6px
border: 1px solid #e2e8f0
box-shadow: 0 1px 3px rgba(0,0,0,.04)
```

### `StatusBadge`

```
display: inline-flex
align-items: center
gap: 5px
padding: 2px 9px
border-radius: 4px
font-size: 11px, font-weight: 700
text-transform: uppercase, letter-spacing: 0.3

Dot: width 5px, height 5px, border-radius 50%, same color as text
```

Usage: `<StatusBadge label="Active" color="#2F5D46" bg="#e4f0eb" border="#A8D0D9"/>`

### `Tag` (inline label, no dot)

```
padding: 2px 8px
border-radius: 3px
font-size: 11px, font-weight: 600
background: primaryLight (#e8f4f8)
color: primary (#1d4ed8)
border: 1px solid rgba(primary, .13)
```

### `Btn`

```
Primary:
  background: #1d4ed8, color: #fff
  border: none, border-radius: 4px
  padding: 7px 16px, font-size: 13px, font-weight: 600

Secondary:
  background: #ffffff, color: #475569
  border: 1px solid #cbd5e1, border-radius: 4px
  padding: 7px 16px, font-size: 13px, font-weight: 600

Small (both variants):
  padding: 4px 12px, font-size: 11px
```

### `Table Header Cell (Th)`

```
padding: 9px 14px
text-align: left
font-size: 11px, font-weight: 700
color: #94a3b8
background: #F4F4F2
border-bottom: 1px solid #e2e8f0
white-space: nowrap
text-transform: uppercase, letter-spacing: 0.4
```

### `Table Data Cell (Td)`

```
padding: 11px 14px
font-size: 13px
color: #0f172a
border-bottom: 1px solid #e2e8f0
vertical-align: middle
```

### `EmptyState`

```
text-align: center
padding: 80px 24px

  [Large icon/emoji, font-size 52px, opacity 0.6]
  [Title, font-size 17px, font-weight 700, color textMid]
  [Subtitle, font-size 13px, color textLight, max-width 360px, centered]
  [Primary action button — optional]
```

### `SectionHeader`

```
display: flex, align-items: center, justify-content: space-between
margin-bottom: 20px
padding-bottom: 14px
border-bottom: 1px solid #e2e8f0

  Left:
    <h2> font-size 16px, font-weight 700, text-transform uppercase, letter-spacing 0.1
    <p>  font-size 12px, color textLight, margin-top 4px

  Right:
    [Optional action button or controls]
```

---

## 4. Dashboard Page

### 4a. Stats Row (KPI Cards)

A 4-column grid of clickable metric cards at the top of the dashboard.

```
display: grid
grid-template-columns: repeat(4, 1fr)
gap: 12px
margin-bottom: 24px
```

Each card:
```
Card + padding: 20px
cursor: pointer
border-left: 3px solid [accent color]

  [Big number]    font-size 26px, font-weight 800, color = accent color
  [Label]         font-size 13px, font-weight 600, color text
  [Sub-label]     font-size 11px, color textLight, margin-top 2px
```

Click navigates to the corresponding module/page.

Example cards (swap labels and colors for your domain):

| Label | Accent Color |
|---|---|
| Item Type A count | `#749486` |
| Item Type B count | `#6F8077` |
| Open Pipeline count | `#2F5D46` |
| Pipeline value ($ or units) | `#78917E` |

---

### 4b. Two-Column Chart Cards Row

```
display: grid
grid-template-columns: 1fr 1fr
gap: 14px
margin-bottom: 14px
align-items: stretch
```

Each chart card is a `Card` with `padding: 20px`.

**Card section header:**
```
font-size: 12px, font-weight: 700
color: textMid (#475569)
text-transform: uppercase, letter-spacing: 0.5
margin-bottom: 14px
```

**Category breakdown row (used inside both cards):**
```
display: flex, align-items: center, gap: 10px, margin-bottom: 10px

  [Color bar]   width 3px, height 28px, border-radius 2px, flex-shrink 0
  [Label]       flex 1, font-size 13px, color text, font-weight 500
  [Count]       font-size 13px, font-weight 700, color = bar color
  [Value]       font-size 13px, font-weight 700, text-align right (optional secondary)
```

**Footer totals strip (inside each card):**
```
margin-top: 14px
padding-top: 14px
border-top: 1px solid #e2e8f0
display: flex, gap: 20px

  Each metric:
    Label: font-size 11px, font-weight 700, color textLight, uppercase, letter-spacing 0.5
    Value: font-size 22px, font-weight 800, color accent, font-variant-numeric tabular-nums
```

---

### 4c. Owner Summary Grid

A grid that shows per-owner breakdowns split into two groups (e.g. leads summary on the left, opportunities on the right), with a visual spacer column between them.

```
display: grid
grid-template-columns: 1fr 1fr 28px 1fr 1fr
gap: 12px
```

**Group header labels (span first 2 and last 2 columns):**
```
font-size: 12px, font-weight: 700
color: textMid, text-transform: uppercase, letter-spacing: 0.5
padding-bottom: 2px
```

**Owner card (rendered for each owner, up to 2 per row):**
```
Card + padding: 16px
border-left: 3px solid [accent]
display: flex, flex-direction: column

  [Owner name]      font-size 13px, font-weight 700, color text, margin-bottom 6px
  [Big number]      font-size 22–26px, font-weight 800, color accent, margin-bottom 2–6px
  [Sub-label]       font-size 11px, color textLight, margin-bottom 4–8px
  [Category rows]   flex 1 (same pattern as 4b breakdown rows, smaller numbers)
  [Footer strip]    border-top, show key metric (e.g. Converted, Closed Won value)
```

Cards are arranged 2-per-row inside columns 1–2 (group A) and 4–5 (group B). Empty slots render `<div/>` to preserve grid alignment.

---

## 5. Records List Page (Prospects / Leads pattern)

### 5a. Module Bar

The top bar of every records page.

```
display: flex, align-items: center, gap: 12px, margin-bottom: 16px, flex-wrap: wrap

  [Title block]
    h2: font-size 17px, font-weight 700, color text
    span: font-size 12px, color textLight  ← record count

  [flex: 1]  ← spacer

  [Search input]
    background: surface, border: 1px solid border, border-radius: 4px, padding: 5px 10px
    [search icon 13×13 + <input>]
    min-width: 200px

  [View toggle]  (List / Kanban / Table)
    display: flex, border: 1px solid border, border-radius: 4px, overflow: hidden
    Active tab: background primary, color #fff
    Inactive tab: background surface, color textMid
    padding: 6px 14px, font-size: 12px, font-weight: 600

  [Import button]  secondary style with ↑ icon

  [+ New button]   primary style
```

---

### 5b. Quick Filter Tabs

A horizontal tab row that filters the list by a preset.

```
display: flex, gap: 0
border-bottom: 1px solid border
margin-bottom: 14px

Each tab:
  padding: 7px 16px
  border: none, background: transparent, cursor: pointer
  font-size: 12px, font-weight: 600, letter-spacing: 0.2
  text-transform: uppercase, white-space: nowrap
  margin-bottom: -1px  ← overlaps the border-bottom

  active:   color primary, border-bottom: 2px solid primary
  inactive: color textMid, border-bottom: 2px solid transparent
```

---

### 5c. Bulk Action Bar (conditional)

Appears when one or more rows are checked.

```
display: flex, align-items: center, gap: 8px
padding: 8px 14px
background: primaryLight (#e8f4f8)
border: 1px solid primary
border-radius: 4px
margin-bottom: 12px

  ["{N} Selected" label]  font-size 12px, font-weight 700, color primary, uppercase
  [flex: 1]
  [Action buttons: secondary small]
```

---

### 5d. List Table

Wrapped in a `Card` with no padding (table fills edge-to-edge).

```
<table style="width: 100%; border-collapse: collapse">
  <thead>
    <tr>
      [Th checkboxAll]
      [Th with ColDropdown for sortable/filterable columns]
      [Th for plain columns]
    </tr>
  </thead>
  <tbody>
    {rows}
    [Empty row: colSpan=all, padding 48px, text-align center, color textLight, font-size 13px]
  </tbody>
</table>

[Pagination footer]
  display: flex, align-items: center, justify-content: space-between
  padding: 10px 16px
  border-top: 1px solid border
  font-size: 12px, color textMid
  ["{N} records found" · Prev / Page# / Next buttons]
```

**Row styling:**
```
base: alternating #ffffff / #fafafa
hover: #e6f2f5
cursor: pointer

Conditional row coloring based on recency/state:
  > 30 days stale:   background #fff5f5  (red tint)
  20–30 days:        background #fffde7  (yellow tint)
  recent / ok:       background #f0fdf4  (green tint)
  inactive/cold:     background #f8f8f8 / #f3f3f3
```

**Hover-reveal action buttons:**
Show `[View] [Edit] [Delete]` small secondary buttons in the last `Td` only on row hover. The `Td` uses `onClick={e => e.stopPropagation()}` so clicks don't trigger row navigation.

---

### 5e. Column Dropdown (sort + filter)

Each sortable `Th` replaces its plain label with a `ColDropdown` component rendered inline.

```
Trigger: small ▾ button (no border, no background)
  active color: primary
  inactive color: textLight
  Active sort indicator: ↑ or ↓ next to the label
  Active filter indicator: 5px dot (primary color) next to the label

Dropdown panel (portaled to body via createPortal):
  position: fixed (coordinates calculated from button.getBoundingClientRect())
  min-width: 170px
  background: surface, border: 1px solid border
  border-radius: 4px, box-shadow: 0 6px 18px rgba(0,0,0,.15)
  z-index: 9999, padding: 4px 0

  [Sort section header]  10px, uppercase, color textLight
  [Asc button]
  [Desc button]
  [divider]
  [Filter section header]
  [All option]
  [Option per unique value]

  Selected option: background primaryLight, color primary
  Other options:   background none, color text
  Each option: padding 6–7px 12px, width 100%, text-align left, font-size 13px
```

---

### 5f. Kanban View

```
display: grid
grid-template-columns: repeat([N status columns], 1fr)
gap: 10px

Column:
  [Column header]
    padding: 8px 12px
    background: [status accent color]
    border-radius: 4px 4px 0 0
    margin-bottom: 2px
    font-weight: 700, font-size: 12px, color: #fff, uppercase, letter-spacing: 0.5
    sub-line: count, font-size 11px, color rgba(255,255,255,.75)

  [Card stack]
    display: grid, gap: 6px

    Each card (Card component, padding 12px, cursor pointer):
      [Primary name]     font-size 13px, font-weight 700, color text
      [Secondary name]   font-size 12px, color textMid
      [Sub-label]        font-size 11px, color textLight, margin-bottom 6px
      [Row: badge + ...]
      [Footer: source info, font-size 11px, color textLight, border-top]

    Empty column:
      padding: 20px, text-align: center
      font-size: 12px, color: textLight
      border: 1px dashed border, border-radius: 4px
```

---

## 6. Common Modal Pattern

```
Overlay:
  position: fixed, inset: 0
  background: rgba(15,23,42,.5)
  display: flex, align-items: center, justify-content: center
  z-index: 1000

Panel:
  background: surface
  border-radius: 6px
  width: [560px default], max-width: 95vw
  box-shadow: 0 20px 60px rgba(0,0,0,.2)
  overflow: hidden

  Header:
    display: flex, align-items: center, justify-content: space-between
    padding: 14px 22px
    border-bottom: 1px solid border
    background: tableHead (#F4F4F2)
    [Title: font-size 14px, font-weight 700]
    [× close button: font-size 18px, color textLight, no border]

  Body:
    padding: 22px
    max-height: 72vh
    overflow-y: auto
```

---

## 7. Info Banner Pattern

Used at the top of module pages to explain what the section is for.

```
margin-bottom: 10–14px
padding: 8–10px 12–14px
background: primaryLight (#e8f4f8)
border: 1px solid rgba(primary, .13)
border-radius: 5–6px
font-size: 12px
color: textMid

  <strong style="color: primary">[Module Name]</strong> — [One-line description]
```

---

## 8. Applying to a New Domain

To adapt this system to a different application:

1. **Keep the token names** (`bg`, `surface`, `primary`, `text`, `textMid`, `textLight`, `border`) — just swap the hex values to match your brand.
2. **Replace domain nouns** — "Leads", "Opportunities", "Accounts" → whatever your entities are called.
3. **Choose status/category colors** — pick 3–5 colors using the same 3-token pattern (text, background tint, border). Assign them to your own states.
4. **Dashboard KPI cards** — plug in your 4 most important metrics. The left-border accent color ties each card to its category color.
5. **Category breakdown rows** — the color-bar + label + count pattern works for any ordinal grouping (priority, stage, region, type).
6. **Owner/team summary cards** — works for any grouping key (team, region, rep, department). Just change what the "big number" and footer metric mean.
7. **Records list** — `ModuleBar` + `QuickFilters` + `Table` is the reusable pattern. The `ColDropdown` component handles sort/filter per column independently of the data schema.
8. **Row color coding** — the recency-tint pattern (red/yellow/green based on staleness) can be applied to any "last updated" or "last action" date field.
