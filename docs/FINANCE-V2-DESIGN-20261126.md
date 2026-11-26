# Market Compass — finance v2 design system and shell geometry

Updated 26 November 2026. Scope: the shared front-end of **both** PWA editions. This document
describes the visual layer only. No route, control, data contract, consent notice or safety
boundary changed when v2 landed; if a future change needs to move one of those, it is not a
design change and does not belong here.

Everything below is about the public PWA source. Nothing here is a secret, but note the standing
rule from the repository README: private architecture, financial plans and security procedures
stay in the private repository. Keep it that way when extending this file.

---

## 1. What v2 is, and where it lives

| Piece | File | Role |
| --- | --- | --- |
| Semantic tokens | `src/index.css` (`:root`, `.dark`) | Tailwind's `--background`, `--card`, `--primary`, `--border`… — every existing component styles through these |
| Palette swap | `src/ionic-shell.css` | The hard-coded hexes the shell had accumulated (surfaces, hairlines, muted text, shadows) |
| v2 skin | `src/finance-v2.css` (**new**) | `--fin-*` primitives + shell, hero, dock, cards, `button` geometry, chat surface |
| Import order | `src/main.tsx` | `index.css` → `ionic-shell.css` → `finance-v2.css`, last |

The two layers are deliberate. `--fin-*` names the shell's own vocabulary (canvas, ink, brand,
tints); the Tailwind tokens keep every pre-existing component working without touching its markup.
**When you change one, check the other** — a card drawn with `bg-card` and a card drawn with
`--fin-card` must remain the same white.

---

## 2. Token palette

### 2.1 Primitives (`finance-v2.css`)

Light:

| Token | Value | Use |
| --- | --- | --- |
| `--fin-canvas` | `#f2f5fa` | page background |
| `--fin-canvas-2` | `#eaeef7` | deeper canvas / scrims |
| `--fin-card` | `#ffffff` | cards, sheets, dock, composer |
| `--fin-ink` | `#0c1626` | primary text |
| `--fin-ink-soft` | `#5a6b85` | secondary text |
| `--fin-ink-faint` | `#5d6b81` | meta text, labels — **contrast-critical, see 2.3** |
| `--fin-line` | `#e6eaf2` | card borders |
| `--fin-line-soft` | `#eff2f8` | inset panels, hairlines between rows |
| `--fin-brand` | `#0e7a5f` | primary actions, links |
| `--fin-brand-deep` | `#0b6a52` | pressed / active tab |
| `--fin-brand-tint` | `#e3f3ec` | active pill, icon chips |
| `--fin-mint` | `#7fe3b0` | accent on dark surfaces only |
| `--fin-gold` | `#f4c86a` | secondary accent (drafts, warnings) |
| `--fin-rose` | `#e0453f` | destructive, badges |
| `--fin-blue` | `#2f6fed` | informational third tone |
| `--fin-ink-card` | `#0b1620` | app bar, assistant band, status backing |
| `--fin-ink-card-2` | `#12302a` | hero gradient anchor |
| `--fin-r-card` / `-r-lg` / `-r-pill` | `22px` / `26px` / `999px` | radius scale |
| `--fin-shadow-card` | `0 1px 2px rgba(12,22,38,.04), 0 12px 28px -22px rgba(12,22,38,.42)` | resting cards |
| `--fin-shadow-float` | `0 18px 44px -26px rgba(12,22,38,.45)` | sheets |
| `--fin-shadow-ink` | `0 16px 36px -22px rgba(6,18,26,.72)` | the hero card |
| `--fin-tabbar-h` | `68px` | dock minimum height (see 4.1) |

Dark (the `.dark` class; not currently reachable from the UI, kept correct so it does not rot):
canvas `#0a0f14`, card `#111820`, ink `#e8eef5`, soft `#8fa0b3`, faint `#93a3b8`, line `#1e2933`,
brand `#31d9a0`, brand-deep `#24b686`, brand-tint `#12302a`, ink-card `#0d1a20`.

### 2.2 Semantic tokens (`index.css`) — the ones components already use

Light: `--background: 217 44% 96%`, `--foreground: 217 52% 10%`, `--card: 0 0% 100%`,
`--border: 220 32% 93%`, `--muted: 216 32% 95%`, `--muted-foreground: 216 19% 44%`,
`--primary: 165 79% 27%`, `--primary-foreground: 0 0% 100%`, `--accent: 154 40% 92%`,
`--destructive: 2 72% 50%`, `--ring: 165 70% 33%`, `--radius: 0.875rem`.
Charts: `165 79% 32%`, `199 76% 45%`, `41 86% 56%`, `2 72% 58%`, `262 56% 60%`.
Shadows were replaced from transparent placeholders to real elevation
(`--shadow-sm|md|lg|xl|2xl`).

The retired v1 palette was warm cream (`42 30% 96%`) with forest green (`165 24% 19%`) and gold
(`43 65% 69%`). If you find those hues anywhere except the two exceptions below, it is a miss.

### 2.3 The contrast rule (this is a real regression we shipped and fixed)

The first v2 pass used `--fin-ink-faint: #8695ab`. Measured with the WCAG formula it failed AA on
every surface it sits on:

| surface | `#8695ab` (v2.0) | `#5d6b81` (v2.1) |
| --- | --- | --- |
| `#ffffff` card | 3.04 ✗ | 5.40 ✓ |
| `#f0f4f9` muted panel | 2.76 ✗ | 4.89 ✓ |
| `#eff2f8` line-soft | 2.71 ✗ | 4.82 ✓ |
| `#f2f5fa` canvas | 2.78 ✗ | 4.95 ✓ |
| `#eaf1f8` tinted tile | — | 4.74 ✓ |

Meta text in this app is 10–11px, so it is *normal* text for AA purposes (4.5:1, not 3:1). Any new
tint that meta text will sit on must be re-checked. `axe-core` on six screens is the guard —
see §6.

Also removed in v2.1: `.mc-spend-tab-meta` had `opacity: .78`, which dropped it to 3.18:1. It is
now full opacity on `--fin-ink-faint`.

### 2.4 Two literal colours that must stay

`index.css` still contains `background-color: hsl(165 24% 19%)` (mobile header) and
`background-color: hsl(44 33% 99%)` (tab bar) inside media queries. They are **dead at runtime**
(every real rule sets those surfaces with `!important`), but `tests/iphone-mobile-shell.test.mjs`
asserts them. If you delete them "as cleanup" the gate fails. Change them only together with the
assertion.

---

## 3. Gotcha 1 — Ionic's unlayered `button` rule

### Symptom

Every Tailwind-rounded or bordered `<button>` in the app rendered as a **flat square with a dark
outline**: `rounded-xl` ignored, `border border-border` ignored (colour fell back to `currentColor`,
i.e. ink), so outlined buttons looked like 1px black boxes and the disabled primary looked like a
pale mint slab. It had been that way for a long time and read as "unfinished design".

### Mechanism

`@ionic/react/css/structure.css` ships:

```css
button { padding:0; border:0; border-radius:0; font-family:inherit; … }
```

That rule is **unlayered**. Tailwind v4 puts every utility in `@layer utilities`. In the cascade,
unlayered author styles beat *all* layered styles regardless of specificity — so `.rounded-xl`
(specificity 0,1,0, in a layer) loses to `button` (0,0,1, unlayered). The shorthand `border:0` also
takes `border-color` with it, which is why only the colour looked "wrong" on bordered buttons.

### Fix (do not "simplify" it)

`finance-v2.css` re-declares the geometry **outside any layer**, with `button.class` specificity
(0,1,1) so it also out-specifies Ionic:

```css
button.rounded-xl { border-radius: calc(var(--radius) + 4px); }
/* … md, lg, 2xl, 3xl, full and the arbitrary [14px]–[22px] steps in use … */
button.border { border-width: 1px; border-style: solid; }
button.border:not([class*='border-primary']):not([class*='border-destructive'])
             :not([class*='border-white']):not([class*='border-amber'])
             :not([class*='border-transparent']) { border-color: hsl(var(--border)); }
button.border-primary { border-color: hsl(var(--primary) / .45); }
button.border-destructive { border-color: hsl(var(--destructive) / .35); }
```

**Extending it:** if a component starts using a radius or border utility that is not in the lists,
add it. `rounded-none` and inline `style={{borderRadius}}` need no entry. The `:not()` chain exists
because a plain `button.border` colour would flatten the meaningful tints; add a class there rather
than removing it.

**Cost of the fix:** because *every* button changed shape at once, the v2 release reviewed button
shape on every screen. Do the same if you extend the list.

---

## 4. Gotcha 2 — `finance-v2.css` can be emitted *before* the tail of `index.css`

### Symptom

A rule in `finance-v2.css` that duplicated a selector from `index.css` was silently ignored even
though `finance-v2.css` is imported *last* in `main.tsx`. First casualty: the mobile page titles
kept the editorial serif after the redesign was supposed to make them sans.

### Mechanism

`index.css` begins with `@import "tailwindcss"` and `@import url(fonts…)`. Tailwind's generated
output (theme, preflight, **all utilities**) is emitted at that import position, while the author's
own rules — `.mc-app-*`, `.serif`, `.mc-wallet-*` — follow further down the file. Vite's CSS
bundling then interleaves the three entry stylesheets, so a measurable tail of `index.css` lands
**after** `finance-v2.css` in the built bundle. Source order in `main.tsx` is therefore not a
guarantee.

Measured in a v2 build: `.mc-app-overview` at byte ~180 300, `.mc-quick-action` ~182 500,
`.serif{font-family:var(--app-font-serif)}` at ~226 900 — while the whole of `finance-v2.css`
sits between ~211 200 and ~226 900.

### Fix and rules

1. **Never rely on source order for an identical selector.** Raise specificity instead:
   ```css
   @media (max-width: 1023px) { html .serif { font-family: var(--app-font-sans); … } }
   ```
   `html .serif` (0,1,1) wins wherever it lands. The same trick is available as
   `.mc-mobile-content.mc-assistant-page` for the two-class wrappers.
2. **Distinct selectors are safe.** `.mc-stat-card` in `finance-v2.css` vs `.mc-stat-card` in
   `index.css` is *not* safe; `ion-card.mc-wallet-hero` vs `.mc-wallet-hero` is.
3. **`!important` only buys you order, not layering.** Ionic's unlayered `!important` rules
   (`ionic-shell.css`) still beat a later layered or unlayered rule of equal specificity — fight
   those with specificity, as §3 does.
4. **Verify after any refactor of the three stylesheets:**
   ```sh
   grep -ob "\.serif{" dist/public/assets/main-*.css | head
   grep -ob "fin-canvas" dist/public/assets/main-*.css | head
   ```
   If a v2 marker sits before the rule it means to override, that override is dead.

---

## 5. Assistant safe-area geometry

The AI route is the only full-bleed screen: no `IonHeader`, no page scroll, its own dark bar, and a
composer pinned above the dock. Its geometry is **load-bearing for the iOS keyboard** and is
asserted by tests — read this before touching it.

### 5.1 Resting layout (`max-width: 1023px`)

```css
.mc-mobile-content.mc-assistant-page {
  box-sizing: border-box;
  height: calc(100dvh - 66px - max(10px, env(safe-area-inset-bottom, 0px)));
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 0 0 !important;  /* the dark header's nudge */
  margin: 0 !important;
  overflow: hidden;
}
```

- `66px` is the dock's occupied height (58px tab button + 8px top padding) so the composer sits
  flush on the dock with no dead strip. The dock's actual `min-height` is
  `calc(var(--fin-tabbar-h) + max(10px, env(…)))` = 102px on a 34px-inset phone, against the
  `66 + 34 = 100` assumed here: the surface therefore overlaps the dock by ~2px, which is invisible
  because the dock is opaque and painted later. If you change `--fin-tabbar-h`, reconcile these two
  numbers in the same commit.
- The `+ 10px` top padding belongs to the **dark header**, not the page.

### 5.2 The status band must meet the header exactly

```css
.mc-mobile-content.mc-assistant-page {
  background: linear-gradient(to bottom,
    #0b1620 0,
    #10302a calc(env(safe-area-inset-top, 0px) + 10px),
    #f2f5fa calc(env(safe-area-inset-top, 0px) + 10px));
}
```

Three constraints, each one a bug we already shipped:

1. The stop must be `safe-area + 10px` — the exact top edge of the assistant bar. It was
   `+ 11px`, which left a 1px light hairline between the status area and the header.
2. The colour must be the ink ramp (`#0b1620 → #10302a`), not a leftover hue. v1's forest green
   (`hsl(165 24% 20%)`) survived the palette sweep here and produced a visibly lighter band above
   the bar.
3. Below the band the fill must be `#f2f5fa` (conversation canvas), **not** white and not
   `transparent`. White flashes as a strip under the composer if any geometry ever leaves a
   sliver; `--fin-canvas` merges with the chat log.

The three values are asserted in `tests/chat-first-parity.test.mjs`.

### 5.3 Keyboard-open layout

When the composer is focused and the visual viewport has shrunk by ≥140px
(`isChatKeyboardVisible`), `installAssistantKeyboardViewport()` sets custom properties on
`<html>` and adds `.mc-chat-keyboard-open`:

| property | source | meaning |
| --- | --- | --- |
| `--mc-chat-visible-height` | `visualViewport.height` | the band the surface must fill |
| `--mc-chat-visible-page-top` | `chatSurfaceVisibleTop(offsetTop, pageTop)` | where that band starts, in document coordinates |
| `--mc-chat-visible-top` | `visualViewport.offsetTop` | kept for diagnostics |
| `--mc-chat-resting-visible-bottom`, `--mc-chat-resting-bottom-inset`, `--mc-chat-tabbar-height` | `assistantRestingViewportGeometry()` | written only while the keyboard is **closed** |

With the keyboard open the dock is hidden (`display: none`), the document is frozen
(`body{position:fixed; inset:0}`), and the surface switches to absolute positioning:

```css
html.mc-chat-keyboard-open .mc-mobile-content.mc-assistant-page {
  position: absolute !important;
  top: var(--mc-chat-visible-page-top, 0px) !important;
  left: 0 !important; right: 0 !important;
  height: var(--mc-chat-visible-height, 100dvh) !important;
  max-height: var(--mc-chat-visible-height, 100dvh) !important;
  z-index: 45;
}
```

**Why `max(offsetTop, pageTop)` and not `pageTop`.** Installed iOS WebKit keeps the document frozen
while it pans the *visual* viewport down to hold the focused composer above the keyboard. `scrollY`
stays 0, so `visualViewport.pageTop` reports **0** while `offsetTop` reports the pan. Positioning
from `pageTop` alone drew the surface too high by exactly the pan, and the page showed through
between the composer and the keyboard — a 140px void on the first report. `chatSurfaceVisibleTop()`
returns the larger of the two, which is correct whether the document scrolled, the viewport panned,
or both. Covered by `tests/assistant-keyboard-viewport.test.mjs`.

**Do not** replace the absolute positioning with `position: fixed`: iOS 26 pans fixed descendants
while the keyboard animates, which is the same class of drift in reverse.

### 5.4 No backdrop blur, anywhere in the shell

The app bar and the dock are opaque. An earlier iteration learned that `backdrop-filter` on a
sticky iOS surface softens the text underneath mid-scroll, and `ionic-shell.css` encodes that lesson
with `-webkit-backdrop-filter: none !important`. v2 kept it. If you want a "glass" dock, test it on
a physical iPhone first — the simulator does not repro it.

---

## 6. How to verify a design change

```sh
# always
pnpm run typecheck:libs
pnpm --filter @workspace/market-compass run typecheck
pnpm --filter @workspace/market-compass run build          # BASE_PATH must match the origin
node --experimental-strip-types --test tests/*.test.mjs    # 424 assertions
```

Then look at it the way the bugs were found — geometry measured, not eyeballed. Headless Chromium
can emulate an iPhone **including safe-area insets**, which plain viewport emulation cannot:

```js
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, left: 0, bottom: 34, right: 0 } });
```

That single call is what exposed the assistant band and the tap-target defects. Pair it with
`axe-core` (`resultTypes:['violations']`, tags `wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa`) on the
vault login, home, menu sheet, markets, assistant and spend screens — the target is **zero
violations**, which is where v2.1 landed. The keyboard geometry can be exercised by overriding the
`visualViewport` getters and dispatching `resize`; the six cases in
`chatSurfaceVisibleTop` are the ones that matter.

**CI is not acceptance.** Per the standing release rules, a green suite does not mean an iPhone
downloaded the new service-worker shell, and a headless Chromium run does not mean Safari rendered
it. Check the physical device after every deployment.

---

## 7. House rules that came out of this work

- **Targets:** ~44px minimum on phones. Measured, not assumed — `summary` rows were 20px and
  crypto quick-pick chips 27px before this pass (below even WCAG 2.5.8's 24px floor).
- **Inputs:** 16px minimum on mobile or iOS zooms the viewport on focus (`index.css` enforces it).
- **Money:** tabular numerals (`.fin-num`, `.mc-wallet-number`, `.mc-stat-number`,
  `.mc-account-right strong`, `.mc-market-value strong`).
- **Disclosure rows:** `summary` markers are hidden globally; plain-text rows get a chevron from
  `summary:not(:has(svg))::after`. A row that already ships its own arrow icon is excluded — never
  add a second chevron to markup.
- **Status is never colour-only:** chips carry a dot *and* a word.
- **Release-gate hooks are frozen:** `aria-label="Mobile app tabs"`, the four `.mc-tab-link` tabs,
  `mobile-nav-*` test ids, `menuOpen && createPortal(`, the quick-menu label set, `mc-wallet-hero`,
  the Bootstrap `col-4`/`col-6` grids and the "No bank connection" line. A redesign may restyle
  them; it may not remove them.

---

## 8. Known open items

1. **Third-party fonts.** `index.css` still opens with `@import url(fonts.googleapis.com…)` and
   `index.html` links Google's Inter for an app that never uses it. For a privacy-first,
   offline-first PWA that is an external request on every cold start. Removing both drops desktop
   to system fonts (serif falls back to Georgia); self-hosting needs WOFF2 binaries committed.
   Undecided — see the owner.
2. **`docs/` on the public repo.** This file is the first document here; the README says internal
   documentation belongs in the private repository. If the public repo should stay doc-free, move
   this file rather than deleting the content.
3. **Dark mode** is token-correct but unreachable from the UI. Either wire a switch or accept that
   it will drift.
