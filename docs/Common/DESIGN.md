# Design System Reference

This document captures the full UI and design language used. It is intended to be reused for new applications that should feel visually consistent with these products. Everything here is system-level — use it to build your own layout, not to copy any specific app.

---

## The Design Philosophy

The palette is **earthy and professional** — grounded in forest greens, dusty roses, warm browns, and soft neutrals. It avoids bright primaries. The UI feels calm and trustworthy, not flashy. Interactions are clean and minimal. Whitespace does a lot of the work.

---

## Color Palette

### Brand Greens
The primary action and success color family. Used for CTAs, active states, success indicators, and key data.

| Name | Hex | Use Case |
|------|-----|---------|
| Forest Green | `#2F5D46` | Primary action, success, active |
| Forest Green Hover | `#254A38` | Hover state of primary |
| Forest Green Light | `#3A7056` | Lighter action variant |
| Sage | `#6F8077` | Muted green surfaces, one sidebar option |
| Sage Hover | `#78917E` | Hover on sage elements |
| Sage Dark | `#5a6b62` | Borders on sage surfaces |
| Mint Surface | `#e4f0eb` | Green tinted card backgrounds |
| Pale Mint | `#f0fdf4` | Very light green background |
| Soft Mint | `#F0F7F2` | Page section backgrounds |
| Green Border | `#A8D0D9` | Borders on green surfaces |
| Green Card Light | `#C8E0D4` | Light card fill in green family |

### Dusty Roses
The secondary/accent color family. Used for alerts, partner branding, open/critical states.

| Name | Hex | Use Case |
|------|-----|---------|
| Dusty Rose | `#B55A6B` | Secondary accent, alerts, critical |
| Dusty Rose Dark | `#9E4D5E` | Hover state |
| Rose Dark | `#8B4A58` | Dark variant (e.g. elevated sidebar) |
| Rose Deep | `#7A3E4A` | Deeper dark on rose surfaces |
| Rose Surface | `#F0CDD9` | Light rose tinted backgrounds |
| Rose Pale | `#FAEAED` | Very light rose fills |
| Rose Border | `#C1A5BB` | Borders on rose surfaces |

### Warm Browns / Amber
Tertiary. Used for warnings, in-progress, and neutral-warm states.

| Name | Hex | Use Case |
|------|-----|---------|
| Warm Brown | `#8B664A` | Tertiary accent, warning |
| Warm Brown Hover | `#7A5840` | Hover on warm brown elements |
| Amber | `#8B664A` | Same family, warm state indicator |
| Amber Surface | `#f5eadc` | Amber tinted background fills |
| Amber Border | `#D2A974` | Borders on amber surfaces |
| Golden | `#8B6914` | Deep yellow-brown for progress |
| Golden Surface | `#FAECC8` | Light gold fills |

### Slate / Neutral Browns
For neutral states, cold indicators, closed/dormant, and disabled elements.

| Name | Hex | Use Case |
|------|-----|---------|
| Slate | `#83766D` | Neutral text, cold/closed state |
| Slate Dark | `#6B635D` | Secondary body text |
| Slate Warm | `#B0a09a` | Muted warm surface |
| Stone | `#C0B8B4` | Borders on slate surfaces |
| Neutral Surface | `#EEECEA` | Light neutral fills |
| Warm Off-White | `#F7F5F3` | Gentle surface background |

### Blues (Info / Task)
Used sparingly for informational states and task-type indicators.

| Name | Hex | Use Case |
|------|-----|---------|
| Info Blue | `#3A6FA8` | Info, task, neutral action |
| Info Blue Dark | `#3A6A8A` | Hover / darker variant |
| Info Surface | `#EAF0F8` | Info tinted backgrounds |
| Info Border | `#B8CDE8` | Borders on info surfaces |
| Info Fill | `#D6E4F5` | Filled info headers |

### Danger / Error
For destructive actions and critical errors.

| Name | Hex | Use Case |
|------|-----|---------|
| Danger | `#C0392B` | Destructive action |
| Danger Hover | `#A93226` | Hover on danger |
| Danger Surface | `#FDECEA` | Error message backgrounds |
| Danger Light | `#FEF2F2` | Very pale error tint |

### Backgrounds & Surfaces

| Name | Hex | Use Case |
|------|-----|---------|
| App Background | `#F4F4F2` | Page / app shell background |
| Surface White | `#ffffff` | Cards, modals, inputs |
| Row Alternate | `#fafafa` | Alternate table row |
| Row Hover | `#e6f2f5` | Table/list row hover |
| Table Header | `#F4F4F2` | Table head fill |

### Text

| Name | Hex | Use Case |
|------|-----|---------|
| Text Primary | `#0f172a` | Headings, key content |
| Text Primary Alt | `#1A1A1A` | Body copy |
| Text Mid | `#475569` | Secondary labels, subtext |
| Text Secondary | `#6B635D` | Softer body text |
| Text Light | `#94a3b8` | Placeholders, hints, disabled |
| Text Dim | `#6b7280` | Muted labels |

### Borders

| Name | Hex | Use Case |
|------|-----|---------|
| Border Light | `#e2e8f0` | Default element borders |
| Border Mid | `#cbd5e1` | Medium emphasis borders |
| Border Warm | `#E2DDD8` | Warm-toned borders |
| Border Strong | `#BFBFBF` | High contrast borders |

---

## Semantic Color Mapping

When building status systems, use these pairings (background + foreground):

| Semantic Role | Background | Text/Icon |
|--------------|-----------|----------|
| Active / Success / Done | `#e4f0eb` | `#2F5D46` |
| Warning / In Progress | `#f5eadc` | `#8B664A` |
| Danger / Critical / Hot | `#FAEAED` | `#B55A6B` |
| Info / Task | `#EAF0F8` | `#3A6FA8` |
| Neutral / Closed / Cold | `#EEECEA` | `#83766D` |
| Error | `#FDECEA` | `#C0392B` |
| Purple / Review | `#F3EEF8` | `#6B3FA0` |

---

## Typography

**Font Family:** `Inter` (Google Fonts), fallback: `'Segoe UI', system-ui, sans-serif`

Load it as:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
```

### Type Scale

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Hero / Large Title | 32–40px | 800 | Landing, empty states |
| Page Title | 24px | 700–800 | Module headings |
| Section Header | 17–18px | 700 | Card titles, section labels |
| Body Default | 14px | 400–500 | Table cells, form values |
| Body Small | 13px | 400–500 | Labels, secondary content |
| Caption / Badge | 11–12px | 600–700 | Badges, tags, metadata |
| Micro | 9–10px | 600–700 | Stat labels, uppercase headers |
| Stat Number | 22–26px | 800 | Dashboard counts |

### Text Conventions
- Uppercase labels: `font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase`
- Section card titles: same as above, `color: textMid`
- Tabular numbers (counts, values): `font-variant-numeric: tabular-nums`

---

## Spacing System

All spacing is on an **even-number base**. Common values:

**Micro:** 2, 4, 6, 8px  
**Small:** 10, 12, 14px  
**Medium:** 16, 20, 24px  
**Large:** 28, 32, 36, 40px  
**XL:** 48, 56px

### Common Padding Combos
| Context | Value |
|---------|-------|
| Tight badge / tag | `2px 8px` or `3px 7px` |
| Button (small) | `4px 10px` to `6px 12px` |
| Button (default) | `8px 16px` to `9px 18px` |
| Input field | `8px 12px` |
| Card (compact) | `16px` |
| Card (default) | `20px 24px` |
| Card (large) | `24px 28px` |
| Modal | `28px` |
| Page content | `40px 48px` |

---

## Border Radius

| Use | Value |
|-----|-------|
| Inline badge / tag | `20px` (pill) |
| Micro label | `3px` |
| Input / small component | `4px` |
| Button | `6px` |
| Card / panel | `8–10px` |
| Modal | `10–12px` |
| Sidebar button | `5px` |

---

## Elevation & Shadows

| Level | Value | Use |
|-------|-------|-----|
| Flat / subtle | `0 1px 4px rgba(0,0,0,0.08)` | Default cards |
| Low | `0 2px 16px rgba(0,0,0,0.07)` | Elevated cards |
| Mid | `0 4px 16px rgba(0,0,0,0.12)` | Dropdowns, menus |
| High | `0 8px 32px rgba(0,0,0,0.15)` | Modals, panels |
| Strong | `0 12px 40px rgba(0,0,0,0.18)` | Full-screen modals |
| Tooltip | `0 2px 8px rgba(0,0,0,0.2)` | Tooltips |
| Slide panel | `-8px 0 32px rgba(0,0,0,0.15)` | Right-side detail panel |

---

## Components

### Buttons

**Primary**
```
background: #2F5D46
color: #fff
padding: 8px 16px – 9px 18px
border-radius: 6px
font-size: 13–14px
font-weight: 600
border: none
```

**Secondary / Ghost**
```
background: transparent
color: #475569
border: 1px solid #e2e8f0 (or #E2DDD8)
padding: 6px 12px – 8px 16px
border-radius: 6px
font-size: 13px
```

**Danger**
```
background: #C0392B
color: #fff
padding: 6px 12px
border-radius: 6px
font-size: 13px
```

**Small (inline)**
```
padding: 3px 8px – 4px 10px
border-radius: 4px
font-size: 12px
font-weight: 600
```

---

### Status / Tag Badges
```
display: inline-flex
align-items: center
padding: 2px 8px – 3px 10px
border-radius: 20px (pill)
font-size: 11–12px
font-weight: 600–700
```
Color pairings: see **Semantic Color Mapping** above.

---

### Cards
```
background: #ffffff
border-radius: 8–10px
box-shadow: 0 1px 4px rgba(0,0,0,0.08)
padding: 16px – 24px
border: 1px solid #e2e8f0 (optional)
```

**Accented card** (left border stripe):
```
border-left: 3px solid <semantic color>
```

---

### Form Inputs
```
padding: 8px 12px
border: 1px solid #e2e8f0 (or #E2DDD8)
border-radius: 6px
font-size: 14px
font-family: Inter, system-ui
color: #0f172a
background: #ffffff
```

Focus state:
```
outline: 2px solid #2F5D46
outline-offset: 0
border-color: #2F5D46
```

Labels:
```
font-size: 13px
font-weight: 500
color: #475569
margin-bottom: 5px
```

---

### Tables

**Header row:**
```
background: #F4F4F2
padding: 10px 16px
font-size: 11px
font-weight: 700
text-transform: uppercase
letter-spacing: 0.06em
color: #475569
border-bottom: 2px solid #e2e8f0
```

**Data row:**
```
padding: 12px 16px
font-size: 13–14px
border-bottom: 1px solid #e2e8f0
```

**Row hover:** `background: #e6f2f5`  
**Alternate row:** `background: #fafafa`

---

### Sidebar / Navigation

The sidebar background is a **free choice from any mid-tone in the palette**. The rule is: pick a muted, medium-saturation color — not too light (the content area is already light), not too dark (it becomes heavy). Text is always near-white on top of it.

**How to pick a sidebar color:**
Take any color family from the palette and use its mid-tone — the darkened surface version, not the pale fill. Any of these work:

| Color Family | Sidebar BG | Border | Hover BG |
|-------------|-----------|--------|---------|
| Sage Green | `#6F8077` | `#5a6b62` | `#78917E` |
| Warm Taupe | `#98887E` | `#877870` | `#A8978D` |
| Dusty Rose | `#B55A6B` | `#9E4D5E` | `#C06070` |
| Rose Muted | `#8B4A58` | `#7A3E4A` | `#9E5566` |
| Warm Brown | `#8B664A` | `#7A5840` | `#9A7358` |
| Slate | `#83766D` | `#726860` | `#918278` |
| Info Blue | `#3A6FA8` | `#2F5E96` | `#4A7DB8` |

Regardless of which color you choose, text and icons always use:
```
text (active/default): rgba(255,255,255,0.9)  or  #f0f5f1
text (dim/inactive):   rgba(255,255,255,0.55)
active item bg:        rgba(255,255,255,0.15)
hover item bg:         rgba(255,255,255,0.08)  (or a slightly lighter tint of the sidebar color)
```

**Nav item:**
```
padding: 9px 10px
border-radius: 5px
font-size: 13px
font-weight: 500
gap: 10px (icon + label)
```

**Width:** 216–240px expanded, 56px collapsed  
**Transition:** `width 0.2s ease`

---

### Modals

```
background: #ffffff
border-radius: 10–12px
padding: 28px
max-width: 520px (standard), 680px (wide)
box-shadow: 0 12px 40px rgba(0,0,0,0.18)
```

**Overlay:**
```
background: rgba(0,0,0,0.45)
position: fixed
inset: 0
display: flex
align-items: center
justify-content: center
z-index: 1000
```

---

### Kanban Columns

Each stage gets its own background + header accent:

| Stage feeling | Column BG | Header color | Header fill |
|--------------|----------|-------------|------------|
| Open / Start | `#EEF2F7` | `#3A6FA8` | `#D6E4F5` |
| In Progress / Warm | `#FDF8EC` | `#8B6914` | `#FAECC8` |
| Review / Pending | `#F3EEF8` | `#6B3FA0` | `#E4D5F5` |
| Done / Closed Won | `#EBF5EE` | `#2F5D46` | `#C5E0CE` |
| Closed Lost / Dead | `#f9fafb` | `#6b7280` | `#e2e8f0` |

---

### Dropdowns / Context Menus
```
background: #ffffff
border: 1px solid #E2DDD8
border-radius: 8px
box-shadow: 0 4px 16px rgba(0,0,0,0.12)
min-width: 130px
```

Item:
```
padding: 8px 14px
font-size: 13–14px
color: #0f172a
hover background: #F4F4F2
```

---

### Tooltips
```
background: #1e293b
color: #ffffff
padding: 4px 8px – 6px 10px
border-radius: 4–6px
font-size: 12px
box-shadow: 0 2px 8px rgba(0,0,0,0.2)
pointer-events: none
z-index: 9999
```

---

## Layout Patterns

### App Shell
```
display: flex
min-height: 100vh
background: #F4F4F2
```
- Left: fixed sidebar (216–240px)
- Right: `flex: 1`, `overflow-y: auto`

### Page Content Area
```
padding: 40px 48px
max-width: 1280px
```

### Dashboard Grid
- Stats row: `grid-template-columns: repeat(4, 1fr)`, `gap: 16–20px`
- Two-column cards: `grid-template-columns: 1fr 1fr`, `gap: 14px`, `align-items: stretch`
- Side-by-side equal height: `grid-template-columns: 1fr 1fr 28px 1fr 1fr` (with spacer column)

### Detail Panel (slide-in)
```
width: 320–400px
position: fixed (or flex child)
border-left: 1px solid #e2e8f0
box-shadow: -8px 0 32px rgba(0,0,0,0.15)
background: #ffffff
padding: 24–28px
```

---

## Sign-in / Auth Pages

```
background: #F4F4F2 (or white)
card: centered, max-width 400px, padding 32–40px, border-radius 10px, shadow mid
logo: brand mark centered at top
input fields: full width, stacked
primary button: full width, Forest Green
```

Logo treatment: monogram in a rounded square, fill with your chosen sidebar color or primary brand color, white text — e.g. "DF" in sage `#6F8077`, "M" in forest green `#2F5D46`, or match whatever sidebar color you chose.

---

## Icon Conventions

- Size: 14–18px inline, 20–22px in sidebar nav
- Style: outline/stroke preferred (Lucide, Heroicons, or emoji as fallback)
- Color: inherits text color or uses semantic color
- Sidebar icons: `rgba(255,255,255,0.7)` inactive, `rgba(255,255,255,1)` active

---

## Animation & Transitions

| Type | Value |
|------|-------|
| Sidebar collapse | `width 0.2s ease` |
| Hover state | `background 0.15s ease` |
| Modal appear | fade in + slight scale up |
| Toast notification | slide in from top or bottom |
| General interactive | `transition: 0.15s` |

---

## Quick Reference — Starter Token Set

If you are starting a new app and want this design language, copy these:

```js
const C = {
  // Backgrounds
  bg:           "#F4F4F2",
  surface:      "#ffffff",
  tableHead:    "#F4F4F2",
  rowHover:     "#e6f2f5",
  rowAlt:       "#fafafa",

  // Brand
  primary:      "#2F5D46",
  primaryHover: "#254A38",
  secondary:    "#B55A6B",
  tertiary:     "#8B664A",

  // Sidebar — pick any mid-tone from the palette (see Sidebar section)
  // Examples: "#6F8077" (sage), "#98887E" (taupe), "#8B4A58" (rose), "#8B664A" (brown), "#83766D" (slate)
  sidebar:      "<your choice>",
  sidebarBorder:"<slightly darker than sidebar>",
  sidebarText:  "#f0f5f1",            // always near-white
  sidebarActive:"rgba(255,255,255,0.15)",
  sidebarHover: "rgba(255,255,255,0.08)",

  // Semantic
  green:        "#2F5D46",
  greenBg:      "#e4f0eb",
  amber:        "#8B664A",
  amberBg:      "#f5eadc",
  red:          "#B55A6B",
  redBg:        "#F0CDD9",
  slate:        "#83766D",
  slateBg:      "#EEECEA",
  danger:       "#C0392B",
  dangerBg:     "#FDECEA",
  info:         "#3A6FA8",
  infoBg:       "#EAF0F8",

  // Text
  text:         "#0f172a",
  textMid:      "#475569",
  textLight:    "#94a3b8",

  // Borders
  border:       "#e2e8f0",
  borderMid:    "#cbd5e1",
  borderWarm:   "#E2DDD8",
};
```
