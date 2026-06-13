# Theming (Light / Dark Mode)

All background and font colors must stay in sync so we never have dark text on a dark background (or light on light). The app uses **one system** (CSS custom properties); the only duplication is *where the variable values are written down*.

## One system: CSS variables

Everything that renders uses **CSS variables** (e.g. `var(--page-background)`, `var(--color-primary)`). The browser resolves those from the cascade; it does not read TypeScript. So there is only one mechanism: CSS variables. We are not using two different systems.

## Why are hex values in two places?

| Place | Who uses it | Purpose |
|-------|-------------|--------|
| **`src/constants/colors.ts`** (`THEME_COLORS`) | **Humans + check-colors script.** The app **never** reads these hex/rgba strings at runtime. TypeScript is used to (1) enforce that every color has both `light` and `dark`, (2) export **variable names** via `COLOR_VARS` (e.g. `primary` → `--color-primary`). `shared.ts` uses those names to build strings like `var(--color-primary)`; it does not use the hex values from `THEME_COLORS`. |
| **`src/index.css`** | **The browser.** This is the only place the browser gets values. `:root` sets each variable (dark theme), and `@media (prefers-color-scheme: light)` overrides with light values. So the actual pixels on screen come from here. |

So: **one system** (CSS variables), but **two write-downs** of the same values—one in TS (for structure and tooling), one in CSS (for the browser).

### How the two files stay in sync

- **Today:** They are kept in sync **manually**. When you add or change a color, you must edit both:
  1. `constants/colors.ts`: update `THEME_COLORS` (and `COLOR_VARS` if adding a new key).
  2. `index.css`: update the variable in **both** `:root` (dark value) and `@media (prefers-color-scheme: light) { :root { ... } }` (light value).
- **Verification:** The script `scripts/check-colors.cjs` (run via `npm run lint:colors` or `bash scripts/review-checks.sh`) includes a **sync check**: it compares every `THEME_COLORS` value to the corresponding variable in `index.css`. If `:root` (dark) or the light `@media` block disagree with `colors.ts`, the check fails so you fix the mismatch.
- **Optional:** You could add a build step that generates the theme section of `index.css` from `colors.ts` so only one file holds the hex values; until then, the sync check catches drift.

## Where each is used at runtime

- **`var(--something)`** – Used everywhere: inline styles, `shared.ts` (e.g. `colors.primary` → `var(--color-primary)`). The **value** of `--something` is taken from **`index.css`** only.
- **`colors.ts`** – At runtime the app only uses **`COLOR_VARS`** (the mapping from key to variable name). The **hex/rgba in `THEME_COLORS`** are not read by the app; they exist for the check script and for documentation.

## Adding a new color

1. Add an entry to `THEME_COLORS` in `constants/colors.ts` with `light` and `dark` strings.
2. Add the same key to `COLOR_VARS` with the CSS variable name (e.g. `--my-color`).
3. In `index.css`, add the variable in both `:root` (dark value) and the `@media (prefers-color-scheme: light)` block (light value). Keep these in sync with `THEME_COLORS`.

## Enforcement

`npm run lint:colors` (or `bash scripts/review-checks.sh`) runs `scripts/check-colors.cjs`, which:

- Ensures every key in `THEME_COLORS` has both `light` and `dark`.
- Fails if any `.ts`/`.tsx` file other than `constants/colors.ts` contains raw hex or `rgb`/`rgba`.
- Fails if any `.css` file other than `index.css` contains raw hex or `rgb`/`rgba`.

To fix a violation: replace the raw color with the appropriate `var(--...)` from `constants/colors.ts` (see `COLOR_VARS` for names). If no variable fits, add a new one following “Adding a new color” above.
