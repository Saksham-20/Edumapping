---
name: EduMapping
description: From classroom to career. A placement season kept as one attested record.
colors:
  ink-950: "#0C1426"
  ink-900: "#111B31"
  ink-800: "#1E2A45"
  ink-700: "#2D3954"
  ink-600: "#46516B"
  ink-500: "#56617A"
  bone-50: "#FBF9F4"
  bone-100: "#F5F1E6"
  bone-200: "#EAE3D2"
  bone-300: "#DAD0B8"
  record-paper: "#FFFDF8"
  saffron-500: "#FF9933"
  saffron-600: "#E57E14"
  saffron-700: "#B35F0C"
  saffron-800: "#87470B"
  india-600: "#138808"
  india-700: "#0F6C06"
  stamp-600: "#4D3895"
  stamp-700: "#3D2C78"
  vermilion-600: "#AE3A21"
  vermilion-700: "#8E2F1B"
typography:
  display:
    fontFamily: "Archivo, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(2.9rem, 1.5rem + 4.6vw, 5.6rem)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 116"
  headline:
    fontFamily: "Archivo, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 1.3rem + 2.8vw, 3.6rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.025em"
    fontVariation: "\"wdth\" 116"
  title:
    fontFamily: "Archivo, Public Sans, system-ui, sans-serif"
    fontSize: "2.15rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 116"
  title-sm:
    fontFamily: "Archivo, Public Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 116"
  figure:
    fontFamily: "Archivo, Public Sans, system-ui, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
    fontVariation: "\"wdth\" 116"
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.07em"
  stamp:
    fontFamily: "Archivo, Public Sans, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: "0.08em"
    fontVariation: "\"wdth\" 116"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  xs: "4px"
  sm: "6px"
  tab: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "80px"
  section-lg: "128px"
components:
  button-primary:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.bone-50}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.bone-50}"
  button-saffron:
    backgroundColor: "{colors.saffron-500}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.record-paper}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "42px"
  button-secondary-hover:
    backgroundColor: "{colors.bone-100}"
  input:
    backgroundColor: "{colors.record-paper}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.record-paper}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.lg}"
    padding: "24px"
  status-stamp-verified:
    textColor: "{colors.stamp-700}"
    typography: "{typography.stamp}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
  status-stamp-cleared:
    textColor: "{colors.india-700}"
    typography: "{typography.stamp}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
  status-stamp-sent-back:
    textColor: "{colors.vermilion-700}"
    typography: "{typography.stamp}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
  nav-item:
    textColor: "{colors.bone-200}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.record-paper}"
    textColor: "{colors.ink-950}"
  tab-active:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.bone-50}"
    rounded: "{rounded.tab}"
    padding: "8px 16px"
---

# Design System: EduMapping

## Overview

**Creative North Star: "The Attested Record"**

Every screen is a document the placement cell has checked, sealed and signed. Content is printed on security paper; the navy degree folder is the ground the documents rest in; the Indian tricolour appears as engraved guilloche linework, the way it appears on a marksheet or a banknote; and status is a rubber stamp pressed in office ink. The world is built from the materials of an Indian certificate, which is why it reads as trustworthy to a placement officer preparing for a NAAC inspection rather than as another SaaS dashboard.

The system runs in two registers. **Persuade** (landing page, auth) gives the navy folder a full field, draws the rosette once on load and presses the "Verified · Locked" stamp as its signature moment. **Operate** (every signed-in screen) is dense and still: a navy sidebar folder, paper content, hairline-bordered cards, static stamps for status and no decorative motion. Both registers share one palette, one type pairing and the same brand pieces (`components/brand`).

The world refuses the category default: no gradient hero, no tilted dashboard screenshot, no logo strip, no glass, no grain or grid textures. Depth is paper resting on a desk, not light through frosted panels. Sample records are always labelled as samples.

**Key Characteristics:**
- Navy folder grounds (hero bands, auth aside, app sidebar) holding paper documents.
- Guilloche rosettes, bands and certificate borders generated from spirograph curves in saffron, India green and ink.
- Status set as rubber stamps in meaningful inks: violet attests, green clears, vermilion sends back.
- Archivo set expanded (width 116) for headlines and figures, Public Sans for reading, JetBrains Mono for roll numbers and serials.
- Hairline borders and a soft paper lift; no hard offset shadows, no blur.
- Two motions that belong to the world: ink drawing itself, and a stamp landing.

## Colors

A document palette: navy ink on warm security paper, the tricolour as linework, and three office inks that each mean exactly one thing.

### Primary
- **Degree-Folder Navy** (ink-950): the ink of every heading and body figure, the primary button, the active tab, and the full-bleed folder grounds (landing hero, inspection band, auth aside, app sidebar). Navy rather than black because Indian certificates are printed and signed in it.
- **Folder Navy, lifted** (ink-800): primary-button hover and the second tone inside navy surfaces.
- **Ink Greys** (ink-700, ink-600, ink-500): secondary text, field labels, captions and serials. ink-500 is the lightest ink allowed for text on paper (5.4:1 on bone-100).

### Secondary
- **Tricolour Saffron** (saffron-500): the one hot accent. The landing "Bring your college on board" CTA, the inset underline on primary-button hover, unread counts, tab counts and the loading arc. As text on paper it steps down to saffron-700 or saffron-800 for contrast.
- **Focus Saffron** (saffron-600): the focus ring everywhere (`:focus-visible` outline and `ring-saffron-600`), and the button border of the saffron variant.

### Tertiary
- **Attestation Violet** (stamp-600 / stamp-700): the colour of an Indian office stamp pad. "Verified", "Locked", information and signed-off states, and the officer's drawn signature (stamp-800).
- **India Green** (india-600 / india-700): cleared, accepted, eligible, letter verified. Also the green ring of the guilloche linework.
- **Correction Vermilion** (vermilion-600 / vermilion-700): sent back, rejected, revoked, field errors, the margin rule of the ruled register.

### Neutral
- **Security Paper** (bone-50): the page ground for every signed-in screen and every light landing band.
- **Ledger Sand** (bone-100): table heads, hover rows, alternate bands, secondary-button hover.
- **Paper Fold** (bone-200 / bone-300): skeletons, scrollbar thumbs, inactive tab counts.
- **Record Paper** (record-paper): the surface of every document: cards, inputs, tables, modals, the certificate interior. Slightly brighter than the ground so a record sits *on* the page. Lives as the arbitrary value `#FFFDF8` in the code.
- **Hairlines** are ink-950 at alpha, never a separate grey: 13% for card and table edges, 15% for document and modal edges, 20% for field borders, 10% for dividers inside a surface.

### Named Rules
**The Folder and Paper Rule.** Navy is a ground, not a fill. It holds documents (hero, report band, auth aside, sidebar); content you read sits on paper. A navy card on a paper page is wrong; a paper slip on the navy sidebar is the active state.

**The One Hot Ink Rule.** Saffron is the only hot accent and appears in small doses: one primary CTA per landing viewport, focus rings, counts. Saffron text on paper uses saffron-700 or darker.

**The Stamp Pad Rule.** Violet, green and vermilion are inks with meaning (attested, cleared, sent back) and are never used decoratively. Pending and in-progress states use saffron.

## Typography

**Display Font:** Archivo (variable, `font-stretch: 116%` via `.font-display`), with Public Sans and system-ui fallback
**Body Font:** Public Sans, with system-ui, -apple-system, Segoe UI fallback
**Label/Mono Font:** JetBrains Mono, with ui-monospace fallback

**Character:** Archivo set expanded reads like the denomination on a banknote or the title on a degree certificate: wide, heavy, official. Public Sans is a civic document face, plain and legible for first-generation students on mid-range phones. Mono marks data that must be read character by character.

### Hierarchy
- **Display** (800, clamp 2.9rem to 5.6rem, 0.94): the landing hero headline only. Auth aside uses the same voice at clamp 2.6rem to 4.2rem.
- **Headline** (800, clamp 2.1rem to 3.6rem, 1.02, -0.025em): landing section headings; `text-balance`.
- **Title** (700, 1.75rem mobile to 2.15rem, 1.1, -0.02em): the one h1 on every signed-in page (PageHeader).
- **Title small** (700, 1.125rem): section blocks, card titles (1rem), modal titles.
- **Figure** (700 to 800, 2.1rem in stat tiles, 1.65rem in records, line-height 1, tabular): numbers that matter (CGPA, counts, LPA), always in Archivo.
- **Body** (400, 1rem, 1.6): reading text; landing leads run at 1.125rem with a 38 to 58ch measure; prose max 64ch.
- **Body small** (400, 0.875rem): app copy, table cells, field text, descriptions.
- **Label** (600, 11px, 0.07em, uppercase): table headers, record field names, definition-row terms, sidebar group names (10.5px, 0.1em).
- **Stamp** (700 to 800, expanded, uppercase, 0.08em to 0.12em): status stamps and document-type headers on records.
- **Mono** (400 to 600, 10px to 13px, 0.04em): roll numbers, document serials, report figures, keyboard hints.

### Named Rules
**The Denomination Rule.** Archivo, expanded, is for headlines and figures. Paragraphs, labels and controls are Public Sans.

**The Data-Only Mono Rule.** JetBrains Mono is for roll numbers, serials, record figures and `kbd`, never a costume for headings or buttons.

**The Furniture Caps Rule.** Tracked uppercase belongs to document furniture: field names, table heads, a record's type line, stamps, nav group names. It never appears as a kicker above a headline.

## Layout

**App (Operate).** A fixed navy sidebar folder 256px wide from `lg` (1024px); below that a slide-in drawer (min of 20rem or 85vw). A sticky 64px top bar on paper (bone-50 at 95%, no blur) holds the command-palette trigger, notifications and account. Every page renders through PageShell: max width 1240px (`max-w-content`; `wide` 1440px, `narrow` 56rem), gutters 16 / 24 / 32px, top padding 32 to 40px. Pages open with PageHeader (title, lead, actions that wrap below on mobile) closed by an 8px guilloche band. Content groups in SectionBlocks 40px apart; stat tiles in a four-up grid; cards padded 20px mobile, 24px desktop.

**Landing (Persuade).** A 12-column grid inside a 1320px wrap with 20 / 32 / 48px gutters. The first viewport is the navy field split 5 / 7: headline, one sentence and two actions on the left; a large certificate on the right. Sections alternate paper (bone-50), sand (bone-100) and navy bands, with 80 / 96 / 128px vertical padding. Headings sit left-aligned on a shared edge, with the lead in the opposite columns or below.

**Auth.** Full viewport. From `lg` a 5 / 7 split: the navy folder aside with the drawn rosette, the line "From classroom to career." and a light stamp; the form on paper at max-w-md. Below `lg`, paper only, and the form is the first thing seen.

**Rhythm.** 8 / 12 / 16 / 24 / 40px inside surfaces; 80 to 128px between landing bands. Tables scroll horizontally inside a focusable region rather than squeezing.

## Elevation & Depth

Paper on a desk. Surfaces are flat at rest and defined by hairlines; depth appears as a soft contact shadow when a document is lifted (hover on interactive cards), floats (modal, command palette, drawer), or sits in the folder (the hero certificate). Overlays dim the page with navy (ink-950 at 55 to 65%), never with blur.

### Shadow Vocabulary
- **Lift** (`0 1px 2px rgba(12,20,38,.05), 0 10px 26px -16px rgba(12,20,38,.28)`): hover on interactive cards and stat tiles.
- **Lift large** (`0 2px 4px rgba(12,20,38,.06), 0 30px 60px -30px rgba(12,20,38,.42)`): modals, command palette, mobile drawer.
- **Paper rest** (`0 1px 1px rgba(12,20,38,.05), 0 8px 18px -12px rgba(12,20,38,.32)`, token `block-sm`): landing record documents and the landing primary button at rest.
- **Saffron rest** (`0 1px 1px rgba(12,20,38,.06), 0 12px 28px -16px rgba(179,95,12,.45)`, token `block-saffron`): the landing saffron CTA.
- **Folder** (`0 1px 0 rgba(255,255,255,.04) inset, 0 30px 70px -30px rgba(0,0,0,.6)`): a certificate resting on the navy field.
- **Paper slip** (`0 8px 18px -12px rgba(0,0,0,.7)`): the active sidebar item pulled out of the folder.

### Named Rules
**The Paper on a Desk Rule.** Shadows are soft, low and navy-tinted. No zero-blur offset blocks, no glass, no backdrop blur. The `block*` token names are historical; they resolve to paper lift.

**The Still Grid Rule.** Hover changes border, colour and shadow, never position. Cards, buttons and rows do not translate or scale, so a hovered card never moves its neighbours; a trailing arrow may nudge 4px inside its own button.

## Shapes

Gently rounded documents with hairline edges. Corners step by role: 4px for in-app status stamps, 6px for badges, tags and the rubber stamp, 8px for tabs and pagination, 10px for every control (button, input, icon button, nav item, avatar), 14px for cards, tables, toolbars and empty states, 16px for modals (18px top corners as a bottom sheet on mobile). Landing large buttons go to 12px. Circles are reserved for spinners and dots.

The recurring silhouettes are the world's own: the guilloche rosette (stacked hypotrochoids), the interleaved-wave guilloche band used as a rule under page titles and headlines, the interlaced-ring certificate border, dotted leader lines inside records, and the double-ruled rubber stamp set a few degrees off true.

### Named Rules
**The Hairline Document Rule.** Every surface is edged by a 1px ink hairline (13 to 20% alpha). Dashed borders mean "empty" (EmptyState) or a link in the chain, nothing else.

## Components

### Buttons
Tactile and plain: ink on paper, like a signed form.
- **Shape:** gently curved (10px); heights 36 / 42 / 50px in the app, 40 / 46 / 54px on the landing.
- **Primary:** navy fill and border, paper text, semibold. Hover lifts to ink-800 and draws a 2px saffron inset underline (`inset 0 -2px 0 0 #FF9933`).
- **Saffron:** saffron-500 fill, saffron-600 border, navy text. The single high-emphasis action on a navy band.
- **Secondary / Outline:** record-paper (app) or transparent (landing), ink hairline at 20 to 25%, darkening to 60% or full ink on hover with a bone-100 wash.
- **Ghost:** transparent, ink-700 text, 6% ink wash on hover.
- **Light / Ghost-dark:** the paper-filled and paper-outlined pair for navy grounds; light hovers to saffron.
- **Danger / Success:** vermilion-600 and india-700 fills with white text.
- **Focus:** 2px ring in saffron-600 with a 2px offset on the ground colour. Loading swaps the icon for a current-colour arc spinner and disables the control.

### Status stamps
- **In-app (StatusBadge):** transparent ground, 1.5px border in the state ink at about 70%, 4px corners, expanded 10.5px bold caps. One table maps every domain status: violet for applied, offered, scheduled; saffron for screening, shortlisted, pending; green for selected, accepted, approved; vermilion for rejected, revoked, cancelled; ink grey for withdrawn, closed, draft.
- **Badge (tinted pill):** for counts and non-status metadata: a 50-tint ground, 30% border and an 800-weight text from the same hue, 6px corners.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** record-paper on the bone-50 page.
- **Shadow Strategy:** none at rest; Lift on hover when interactive (see Elevation).
- **Border:** 1px ink at 13%; interactive cards darken to 35% on hover.
- **Internal Padding:** 20px mobile, 24px desktop. Tables, toolbars and tab bars share the same paper, hairline and 14px (tabs 12px) shell.

### Inputs / Fields
- **Style:** record-paper ground, 1px ink border at 20% (40% on hover), 10px corners, 10 x 14px padding, 14px text, ink-500 placeholder.
- **Focus:** border goes full navy with a 2px saffron-500 ring at 30%.
- **Error / Disabled:** vermilion-600 border and 25% vermilion ring, with a vermilion-700 message announced as an alert; disabled turns bone-100 with ink-500 text. Labels sit above in 14px medium ink-800; a required mark is a vermilion asterisk plus a screen-reader "(required)".

### Navigation
- **Sidebar folder:** ink-950 with a 7%-opacity rosette watermark, brand lockup and microtext rule at the top, 10.5px tracked group names in bone-300 at 60%. Items are 14px medium bone-200 with 18px Heroicons; hover washes white at 6%. **Active** is a record-paper slip with navy text, a saffron-700 icon and the paper-slip shadow.
- **Top bar:** sticky, paper at 95%, hairline bottom; on mobile it shows the current page title in Archivo and a menu button.
- **Tabs:** a paper strip with 4px inset; the active tab is a navy fill with paper text and a saffron count chip.

### Rubber Stamp (signature)
Double rule (2.5px border plus a 1.5px outline offset 3px), expanded extra-bold caps at 0.12em, optional mono sub-line, rotated -7deg by default (each placement picks its own small angle), multiplied into the paper. Tones: stamp (violet), india, vermilion, saffron, and light for navy grounds. `press` plays the landing: scale 1.9 and blurred to scale 1, over 0.6s on `cubic-bezier(.16,1,.3,1)`. It is reserved for signature moments (the hero record at about 1.8s, the live rule check), and rests static everywhere else.

### Certificate Frame (signature)
A record surface: record-paper (or ink-900 on navy) inside a 9px interlaced-ring guilloche border in saffron and India green, 14px outer and 6px inner corners, an inner hairline and an optional mono serial top-right. Inside, records use a letterhead, a microtext rule, label-over-figure fields in a hairline grid, dotted leader lines, a drawn signature and a stamp. Used for the documents a student or the cell would recognise as "the record".

### Guilloche (signature)
A rosette generated from layered hypotrochoids (saffron outer lace, green ring, ink core) with three tone sets: light, dark and paper. Below 150px it drops to two heavier layers. `draw` traces each layer once on mount (2.6s, staggered 0.22s), only on the landing hero and auth aside; on app screens it is a static watermark at 7% opacity. The guilloche band (interleaved saffron and green sine waves) underlines page titles and the hero's last word.

## Do's and Don'ts

### Do:
- **Do** set every signed-in page in PageShell on bone-50, with a PageHeader closed by the 8px guilloche band.
- **Do** put documents on record-paper (#FFFDF8) with a 1px ink hairline and 14px corners; let depth come only from Lift on hover or overlay.
- **Do** carry the tricolour as engraved linework (rosette, band, certificate border), not as surface fills.
- **Do** express status as a stamp in its meaning ink: violet attests, green clears, vermilion sends back, saffron waits. Map statuses through the single `STATUS_TONES` table.
- **Do** set headlines and figures in expanded Archivo and give figures `tabular-nums`; set roll numbers and serials in JetBrains Mono.
- **Do** use the 2px saffron-600 focus ring with a 2px offset on every interactive element.
- **Do** caption every sample record, report or student as sample data ("Sample record. Names and marks are illustrative.").
- **Do** switch off ink-draw, stamp-press, reveals and counters under `prefers-reduced-motion`, rendering the final state.

### Don't:
- **Don't** use hard zero-blur offset shadows, glassmorphism, backdrop blur, film grain or grid-texture overlays.
- **Don't** put a navy card on a paper page or set paragraphs on saffron; navy is a ground, saffron is an accent.
- **Don't** use violet, green or vermilion decoratively; each one is a state.
- **Don't** set a kicker or eyebrow above a headline; the heading carries its own weight.
- **Don't** animate decoration on app screens or press a stamp on a dense list; motion in Operate is state feedback only.
- **Don't** move, scale or translate cards, buttons or rows on hover; the only hover motion is the 4px nudge of a trailing arrow inside its button.
- **Don't** use Tailwind's default gray, blue, indigo or purple scales, or the legacy `azure`, `primary` and `secondary` scales, in new work; use ink, bone, saffron, india, stamp and vermilion.
- **Don't** use emoji as icons; icons are Heroicons outline at 1.8 to 2 stroke.
