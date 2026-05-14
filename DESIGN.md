---
name: CETIEM — Plataforma de Certificación ESG
description: Mexico's national AI-powered ESG certification platform for PyMEs, built on NVIDIA NIM and the V.L.A.P. protocol.
colors:
  institutional-jade: "#1d9e75"
  compliance-lime: "#ADFF4F"
  assessment-cyan: "#00C8E0"
  status-approved: "#9fc031"
  status-progress: "#ffbf00"
  status-review: "#1e7d93"
  status-hardstop: "#aa3939"
  base: "#0A0A0A"
  surface-raised: "#0D0D0D"
  surface-elevated: "#111111"
  surface-floating: "#161616"
  text-primary: "#F2F2F2"
  text-secondary: "#999999"
  text-muted: "#4D4D4D"
  border-subtle: "#0F0F0F"
  neutral-mid: "#8b8d98"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.2em"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.institutional-jade}"
    textColor: "{colors.base}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.institutional-jade}"
    textColor: "{colors.base}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-destructive:
    backgroundColor: "{colors.status-hardstop}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  input-default:
    backgroundColor: "#0F1410"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  card-default:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: CETIEM — Plataforma de Certificación ESG

## 1. Overview

**Creative North Star: "The Certification Vault"**

CETIEM is not a SaaS dashboard. It is the place where Mexico's ESG compliance record is created, validated, and sealed. Every visual decision answers one question: would this document hold up in court? The aesthetic is that of a notarial chamber running on AI: absolute black surfaces like polished carbon, a deep institutional jade that reads as a compliance seal, and UI density calibrated strictly to role. The company entering for the first time sees calm and guidance. The assessor reviewing their twelfth document this week sees precision and speed.

The system explicitly rejects three failure modes. It is not the generic SaaS green (HubSpot, Intercom, Notion) — warm, rounded, and disposable. It is not the SAT portal or IMSS interface — bureaucratic gray, formless, no hierarchy. And it is not the crypto dark-mode aesthetic — neon excess and speculative energy have no place near a certificate that carries legal standing. When the certification is issued, it must feel final, verifiable, and serious.

The landing page and the product dashboard carry equal design investment. They are not separate aesthetics joined by a shared logo: they are one system, two surfaces of the same vault.

**Key Characteristics:**
- Always-dark surfaces: authority is not negotiated per-screen
- Institutional Jade (#1d9e75) as the single canonical primary: rare, earned by proximity to certification events
- Tonal layering (#0A → #0D → #11 → #16) creates depth without shadows or decoration
- The V.L.A.P. status quad is the system's primary communication mechanism — not decoration
- Typographic hierarchy through weight + scale contrast; no gradient text, no ornament
- All UI copy in Spanish (Mexico); administrative metadata in uppercase Inter Black

## 2. Colors: The Vault Palette

A minimal palette dominated by dark tonal neutrals, punctuated by a single brand accent and a mandatory four-state semantic quad. Every color has a role; none are decorative.

### Primary
- **Institutional Jade** (#1d9e75): The compliance seal color. Active navigation, primary action buttons, focus rings, certification event badges, brand mark. Reserved: never used as a background fill on large surfaces. Rarity is the point. Note: the codebase currently uses #00D47A — this is the canonical moodboard value and the direction going forward.

### Secondary
- **Compliance Lime** (#ADFF4F): Admin-role marker. Admin nav badge, approved-certification confirmation states, advanced workflow progress indicators. Bright and deliberate — it signals administrative authority, not success states (those are `status-approved`).
- **Assessment Cyan** (#00C8E0): Assessor-role marker. Assessor nav badge, Q&A interface accents, information-level callouts in the assessor console. Never on Empresa-facing screens.

### Tertiary: The V.L.A.P. Status Quad
The four-state semantic system is the product's primary language. Every document in the system has exactly one state at any time, and that state must be expressed through this quad. These colors never appear outside their semantic roles.

- **Status Approved** (#9fc031): Verified, certified, complete. Olive-lime — serious, not celebratory.
- **Status In Progress** (#ffbf00): Active AI processing, pipeline running, human review pending. Amber — attention without alarm.
- **Status Review** (#1e7d93): Awaiting human validation by an assessor. Deep teal — measured, deliberate.
- **Status Hard Stop** (#aa3939): Non-compliance detected. Hard stop threshold breached. Triggers CAPA workflow. Crimson — the system's most consequential color.

**The One Pair Rule.** Every status color always travels with its label or icon. Color alone is never sufficient for state communication. Assessors process many documents; color-blind users are not an edge case — they are a compliance concern.

### Neutral: The Tonal Stack
Depth in CETIEM comes from surface temperature, not from shadows.

- **Base Black** (#0A0A0A): Page background. The vault floor. Never used on elevated surfaces.
- **Sidebar Surface** (#0D0D0D): Persistent sidebar navigation, sticky headers. Slightly warmer than base.
- **Card Surface** (#111111): Panels, cards, data tables, content wells. The primary work surface.
- **Floating Surface** (#161616): Dropdowns, tooltips, notification panels, popovers. Farthest from the base.
- **Text Primary** (#F2F2F2): Headings, active labels, confirmed states.
- **Text Secondary** (#999999): Body text, descriptions, secondary labels. The reading voice.
- **Text Muted** (#4D4D4D): Placeholders, disabled labels, tertiary metadata. Barely visible.
- **Border Subtle** (rgba(255,255,255,0.06) / ~#0F0F0F): Default dividers, card edges. A whisper.
- **Border Visible** (rgba(255,255,255,0.10) / ~#1A1A1A): Inputs, focused panels, visible separation.
- **Neutral Mid** (#8b8d98): Timestamps, file metadata, neutral status indicators from the moodboard palette.

**The Glow Exception Rule.** The only decorative light effect permitted is the green glow on activated interactive elements: `box-shadow: 0 0 20px rgba(29,158,117,0.25), 0 0 60px rgba(29,158,117,0.08)`. Every other bloom, glow, or radial gradient on a UI element is prohibited.

## 3. Typography

**Display Font:** Bricolage Grotesque (ExtraBold 800, Bold 700), with Inter as fallback
**Body Font:** Inter (400, 500, 600, 700, 900), system-ui fallback
**Monospace:** JetBrains Mono (Regular 400, Medium 500)

**Character:** Bricolage Grotesque's irregular thick-thin strokes read as crafted, not system-generated — it brings editorial gravitas to compliance headings without requiring illustration. Inter's neutral precision handles everything below headline. JetBrains Mono surfaces wherever the system's technical artifacts live: certificate hashes, document IDs, audit log entries. It makes clear that every record is a unique, machine-verified artifact.

### Hierarchy
- **Display** (ExtraBold 800, clamp(2.5rem → 4rem), line-height 1.05, tracking -0.02em): Landing page hero headings and major section anchors. Bricolage Grotesque only. Never used inside the product dashboard.
- **Headline** (Bold 700, clamp(1.5rem → 2.25rem), line-height 1.1, tracking -0.02em): Section titles within the product. Bricolage Grotesque or Inter Black. First heading the assessor sees on any screen.
- **Title** (Bold 700, 1.125rem/18px, line-height 1.3, tracking -0.01em): Panel headings, card titles, sidebar section labels. Inter Bold. The most common heading size in the product.
- **Body** (Regular 400 / Medium 500, 0.875rem/14px, line-height 1.6): All reading content — dictamen text, document descriptions, notification body. Inter. Hard cap at 65ch line length.
- **Label** (Black 900, 0.625rem/10px, line-height 1, tracking 0.2em, UPPERCASE): Badges, nav labels, breadcrumbs, status tags, role identifiers, column headers in tables. The system's metadata voice. Always Inter Black + wide tracking + uppercase — this combination is reserved for it.
- **Mono** (Regular 400, 0.8125rem/13px, line-height 1.6): Certificate hashes (SHA-256), document UUIDs, audit log entries, technical IDs. JetBrains Mono.

**The No-Decoration Rule.** No text-shadow on any label or body copy. No `background-clip: text` gradient text — prohibited. Emphasis is achieved through weight (400→700→900) and scale contrast, never through color on multi-line text.

**The Label Reserve Rule.** The Inter Black + uppercase + wide-tracking combination belongs exclusively to the Label role. Do not use this combination on body text, card descriptions, or headings. When it appears, it signals system metadata. Diluting it with decorative usage destroys the signal.

## 4. Elevation

CETIEM uses tonal layering as its sole depth system. Cards are flat at rest. There are no resting card box-shadows. Depth is communicated through surface color temperature: darker = further from the user, lighter = brought forward. The only exception is the Green Glow, which signals interactive activation, not structural elevation.

### Surface Stack
- **Base** (#0A0A0A): Body background. Always the deepest layer in any composition.
- **Raised** (#0D0D0D): Sidebar, sticky navigation, persistent header chrome.
- **Elevated** (#111111): Cards, content panels, data tables, form containers.
- **Floating** (#161616): Dropdowns, notification drawers, tooltips, context menus.

The difference between adjacent steps is ~4-6 luminance points — enough to perceive, never enough to shout.

### Shadow Vocabulary
- **Green Glow** (`box-shadow: 0 0 20px rgba(29,158,117,0.25), 0 0 60px rgba(29,158,117,0.08)`): Primary action buttons on hover, hero CTAs on activation. The system's one moment of theatrics.
- **Green Glow Small** (`box-shadow: 0 0 10px rgba(29,158,117,0.20)`): Input focus ring supplement, active nav item subtle glow.
- **Focus Ring** (`box-shadow: 0 0 0 3px rgba(29,158,117,0.12)`): Input focus state only. Structural, not decorative.
- **Ambient Dark** (`box-shadow: 0 4px 24px rgba(0,0,0,0.4)`): Floating panels (notification drawer) to reinforce they're above the surface stack.

**The Flat-By-Default Rule.** Panels and cards are flat at rest. No resting card box-shadow. The surface color difference is the elevation system. Shadows appear only as: (1) interactive state response (glow on button hover), or (2) float reinforcement (dropdown above the page).

## 5. Components

### Buttons
Tactile and confident. The primary button is a certification action — it must feel final and deliberate.

- **Shape:** Gently rounded (12px / rounded-lg). Not pill-shaped — the Vault is not playful.
- **Primary:** Institutional Jade (#1d9e75) background, Base Black (#0A0A0A) text, Inter Black, uppercase, tracking-widest. Padding: 12px 24px standard; 16px 48px for hero CTAs.
- **Hover:** Lifts 1px (`translateY(-1px)`), green glow amplifies to `0 0 28px rgba(29,158,117,0.45)`. No fill change — the vertical movement is the feedback signal.
- **Focus-Visible:** 2px jade outline, 2px offset.
- **Active:** `scale(0.97)`, glow removed.
- **Ghost:** Transparent background, white/50% text. Hover: white/80% text, no background fill. Arrow icon translates +1px on hover. Used for secondary navigation CTAs.
- **Destructive:** Status Hard Stop red (#aa3939) background. Reserved for irreversible actions: revoke certificate, reject assessment. Requires confirmation step before execution.
- **Disabled:** 50% opacity, `pointer-events: none`. No hover state. No glow.

### Badges and Status Tags
The signature component of the system. Every document state, every role, every system event is expressed through a badge.

- **Anatomy:** Pill shape (4px radius), 10px Inter Black, tracking 0.2em, uppercase. Always three layers simultaneously: background tint + solid text + ~25-30% opacity border.
- **Status Approved:** `bg: rgba(159,192,49,0.12)`, `color: #9fc031`, `border: rgba(159,192,49,0.30)`
- **Status In Progress:** `bg: rgba(255,191,0,0.10)`, `color: #ffbf00`, `border: rgba(255,191,0,0.25)`
- **Status Review:** `bg: rgba(30,125,147,0.12)`, `color: #1e7d93`, `border: rgba(30,125,147,0.30)`
- **Status Hard Stop:** `bg: rgba(170,57,57,0.12)`, `color: #aa3939`, `border: rgba(170,57,57,0.30)`
- **Role Jade (Empresa):** `bg: rgba(29,158,117,0.12)`, `color: #1d9e75`, `border: rgba(29,158,117,0.25)`
- **Role Cyan (Assessor):** `bg: rgba(0,200,224,0.12)`, `color: #00C8E0`, `border: rgba(0,200,224,0.25)`
- **Role Lime (Admin):** `bg: rgba(173,255,79,0.10)`, `color: #ADFF4F`, `border: rgba(173,255,79,0.25)`
- **State:** Badges are indicators, not interactive controls. No hover state.

**The Triple-Layer Rule.** Every badge carries all three: background tint + solid text color + opacity border. A badge with only one or two of these layers is incomplete and must be corrected.

### Cards and Panels
- **Corner Style:** 12px radius (rounded-lg). Inner nested content uses 8px (rounded-md). Never 0px — the Vault has corners, not edges.
- **Background:** Card Surface (#111111). Never Base Black — cards must be perceptibly elevated from the page.
- **Border:** 1px `rgba(255,255,255,0.08)`. Structural, not decorative. Every card has a border.
- **Shadow:** None at rest. The surface color carries the elevation.
- **Internal Padding:** 24px default (p-6). Dense assessor panels: 16px (p-4). Landing page hero cards: 40px+ (p-10). Vary padding for rhythm.
- **Glass Variant:** `bg: rgba(255,255,255,0.04)`, `backdrop-filter: blur(12px)`, same 1px rgba border. Reserved for: hero section overlays, full-bleed landing backgrounds. Not for data tables, assessor panels, or any content the user reads closely.

**The No-Nested-Card Rule.** Cards inside cards are always wrong. Use padding variation, dividers, or section-level background tints instead.

### Inputs and Form Controls
- **Style:** Full-width, 8px radius (rounded-md), `bg: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.10)`. Height: 40px. Text: Inter Regular 14px, #F2F2F2.
- **Placeholder:** rgba(255,255,255,0.30).
- **Focus:** `border-color: #1d9e75`, `box-shadow: 0 0 0 3px rgba(29,158,117,0.12)`. No background fill change.
- **Error:** `border-color: #aa3939`, `box-shadow: 0 0 0 3px rgba(170,57,57,0.10)`.
- **Disabled:** 50% opacity, `cursor: not-allowed`.
- **Label:** Always above the field, not inside it (except search inputs). Inter Medium 12px, white/60%.

### Navigation (Sidebar)
- **Shell:** 256px fixed-width, `bg: #0D0D0D`, `border-right: 1px solid rgba(255,255,255,0.06)`, full viewport height.
- **Logo zone:** Top 20px/20px padding. Institutional logo + role badge below.
- **Nav item default:** Inter Medium 14px, white/45%, 12px radius, 10px vertical + 12px horizontal padding, `border-left: 2px solid transparent`.
- **Nav item active:** `bg: rgba(29,158,117,0.08)`, `color: #1d9e75`, `border-left: 2px solid #1d9e75`. The 2px left border is structural state signaling — the only permissible use of a side border in the system.
- **Nav item hover:** white/80% text, `bg: rgba(255,255,255,0.03)`.
- **Nav item disabled:** white/20%, no hover, `cursor: not-allowed`.
- **Badge on nav item:** Small jade/cyan/lime pill badge for "NUEVO" states, top-right of label.

### AI Hint Panel (Signature Component)
A persistent tile at the bottom of the sidebar, below the navigation scroll zone. Grounds the user in the AI context of their role.

- **Background:** `rgba(29,158,117,0.04)`, `border: 1px solid rgba(29,158,117,0.12)`, 12px radius.
- **Header:** Sparkles icon + role AI label in jade Label style (0.5625rem, Black, uppercase, tracking 0.3em).
- **Body:** 10px Inter Light, rgba(255,255,255,0.35), line-height 1.6.
- **Never interactive.** This is a contextual indicator, not a button or link.

## 6. Do's and Don'ts

### Do:
- **Do** use Institutional Jade (#1d9e75) as the canonical primary, not #00D47A. The codebase uses #00D47A — this should be migrated to align with the moodboard.
- **Do** pair every V.L.A.P. status color with its text label or icon. Color alone is never sufficient for state communication.
- **Do** use the tonal surface stack for elevation: #0A0A0A base → #0D0D0D sidebar → #111111 cards → #161616 floating. Surface color is the only depth system.
- **Do** write all UI labels, error messages, placeholders, and notifications in Spanish (Mexico). Proper nouns (V.L.A.P., Hard Stop, Assessor) may stay in English.
- **Do** use uppercase Inter Black + tracking 0.2em exclusively for Badge/Label content: status tags, breadcrumbs, nav labels, column headers. Reserve this combination for metadata only.
- **Do** use Bricolage Grotesque exclusively for Display and Headline roles. Inter handles everything at Title and below.
- **Do** use JetBrains Mono for all technical artifacts: certificate hashes, document UUIDs, audit log entries, SHA-256 values.
- **Do** cap body text at 65ch maximum line length. Assessors read dense compliance documents; line length is an accessibility and fatigue concern.
- **Do** keep the green glow (`0 0 20px rgba(29,158,117,0.25)`) strictly reserved for primary button activation. It is not a decorative treatment.
- **Do** vary padding across sections for rhythm. Same padding everywhere is monotony.

### Don't:
- **Don't** use #00D47A as the brand primary. It reads as generic SaaS green — CETIEM's primary anti-reference. #1d9e75 is canonical.
- **Don't** use generic SaaS green UI patterns: HubSpot/Intercom/Notion-style warm rounded cards, friendly illustration-led empty states, soft pastel backgrounds. CETIEM is not a startup tool.
- **Don't** reference Mexican government portal aesthetics (SAT, IMSS, Gob.mx): gray form surfaces, table-heavy layouts with no hierarchy, no visual rhythm. CETIEM replaces what they represent — it must not resemble it.
- **Don't** use crypto or Web3 neon-dark patterns: multiple simultaneous neon colors, neon-on-neon layering, aggressive bloom on static surfaces. CETIEM's dark theme is institutional command, not speculation.
- **Don't** use `background-clip: text` gradient text. Prohibited absolutely.
- **Don't** add resting box-shadow card shadows. Elevation is tonal, not shadow-based.
- **Don't** use glassmorphism (backdrop-blur) on content panels, data tables, or any surface the user reads closely. Glass is reserved for hero overlays and floating surface contexts.
- **Don't** use `border-left` greater than 1px as a decorative color stripe on cards, callouts, or list items. The sidebar active item's 2px left border is the only permitted use, and it is structural state signaling, not decoration.
- **Don't** use V.L.A.P. status colors (approved lime, progress amber, review teal, hardstop red) for any purpose other than their defined semantic roles. They are not accent colors.
- **Don't** add consumer-facing warmth: illustrations, mascots, rounded avatars with bright fills, or celebratory animations. The Certification Vault has no characters.
- **Don't** nest cards. A card inside a card is always wrong. Use padding steps, dividers, or tonal sections instead.
- **Don't** use border-left or border-right as accent stripes on cards or callouts. Rewrite with background tints, full borders, or leading numbers instead.
