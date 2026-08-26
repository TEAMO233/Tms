# Design QA — TunnelBox 清晰运营台

## Visual source and implementation

- Selected direction: 1 / 清晰运营台
- Source visual truth: `/Users/teamo/.codex/generated_images/01a03b56-d67e-7e63-957d-05a68878f3b2/exec-8910a634-4e6a-4f77-8009-d346ade56f18.png`
- Preview URL: `http://127.0.0.1:3001/dashboard?preview=protocol-board`
- Dashboard screenshot: `/Users/teamo/Desktop/Tms/design-qa-dashboard-light.png`
- Protocol desktop screenshot: `/Users/teamo/Desktop/Tms/design-qa-protocol-light-desktop.png`
- Dashboard mobile screenshot: `/Users/teamo/Desktop/Tms/design-qa-dashboard-light-mobile.png`
- Mobile drawer screenshot: `/Users/teamo/Desktop/Tms/design-qa-mobile-drawer.png`
- Protocol mobile screenshots: `/Users/teamo/Desktop/Tms/design-qa-protocol-light-mobile-top.png` and `/Users/teamo/Desktop/Tms/design-qa-protocol-light-mobile-rows.png`
- Same-input comparison: `/Users/teamo/Desktop/Tms/design-qa-dashboard-comparison.png`

## Compared states

- Desktop reference and implementation were compared together at the same captured size, `1487 × 1058`; the browser CSS viewport was `1502 × 1069`.
- Mobile was verified at a `390 × 844` CSS viewport with the navigation drawer closed and open.
- The dashboard fixture was loaded with four metrics, hourly traffic data, forwarding groups, an expanded sidebar, and no focused control.
- Protocol management was checked at desktop and mobile widths with six machine rows, wrapped protocol chips, status variants, assigned-user actions, filters, column settings, and the create modal.

## Fidelity review

- Layout: fixed `224px` sidebar, `72px` collapsed rail, content gutters, top account controls, four-card metric row, compact chart, and forwarding table follow the selected source composition.
- Typography: compact system sans-serif hierarchy, restrained `24–28px` page headings, muted metadata, and monospace operational values are consistent across routes.
- Surfaces: Zinc background, white bordered cards, subtle shadows, blue active states, semantic green/amber/red statuses, and modest radii are consistent across the app.
- Assets: all visible UI icons use maintained icon libraries; no inline or handcrafted SVG, emoji placeholder, gradient, skin picker, or glass-style modal backdrop remains.
- Responsive behavior: desktop sidebar collapse and mobile off-canvas drawer work without content overlap; protocol rows become readable cards and no audited route produces body-level horizontal overflow.

## Interaction checks

- Sidebar: expanded `224px`, collapsed `72px`, restored `224px`.
- Mobile drawer: closed left position `-224px`, open left position `0px`; overlay and close affordance present.
- Dashboard: date shortcut and account menu were exercised.
- Protocol management: search filtering reduced the fixture from six rows to one and clearing restored six; create and column-settings dialogs opened and closed correctly.
- Preview navigation preserves `?preview=protocol-board` so all protected redesign routes remain reviewable without a backend session.

## Route audit

All 16 routes were loaded at `1280 × 800`. Every route used `rgb(250, 250, 250)` as the page background, had no active dark class, exposed a semantic page heading, and had `0px` body-level horizontal overflow:

`/`, `/dashboard`, `/forward`, `/inbound`, `/relay`, `/transparent-relay`, `/guide`, `/my-sub`, `/tunnel`, `/node`, `/user`, `/profile`, `/limit`, `/config`, `/settings`, `/change-password`.

## Findings and fixes

- P0/P1/P2: none remaining.
- Fixed during QA: stale dark/skin infrastructure, mobile navigation query loss, missing semantic headings, protocol table action clipping, mobile card overflow, blur modal backdrops, handcrafted SVG icons, and unescaped confirmation-copy quotes.
- P3 accepted difference: the selected source is conceptual, so the implementation keeps the product's real route set and business grouping. The source logo motif is represented by the closest maintained Heroicon because no matching source asset file exists.

## Verification

- `npm run build` — passed.
- `node --test src/utils/*.test.mjs scripts/test-*.mjs` — 5/5 passed.
- ESLint across changed TypeScript/TSX files — 0 errors; legacy style warnings remain.
- Browser route and responsive audit — passed.

Final result: passed
