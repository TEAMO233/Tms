# 协议管理页 Design QA（线路总览表格版）

## Comparison target

- Source visual truth: `/var/folders/42/qjjlsl6156b_0744mv5sxbcm0000gn/T/codex-clipboard-1a8ddc44-1ccf-473d-9ea5-f8d73f69dcb7.png`
- Desktop evidence: `/Users/teamo/Desktop/Tms/design-qa-protocol-board-desktop.png`
- Mobile evidence: `/Users/teamo/Desktop/Tms/design-qa-protocol-board-mobile.png`
- Viewports: desktop `2048 × 977`; mobile `390 × 844`
- State: dark TunnelBox admin shell, protocol management route, six preview machine rows.

## Full-view comparison evidence

The implementation now follows the supplied Operations Table reference: the same dark shell, 255px sidebar, 56px top bar, page title, two right-aligned actions, three-metric summary strip, filter toolbar, dense table, six machine rows, and pagination footer are visible in the desktop viewport.

The table grid uses fixed desktop columns for machine, node status, IP, protocol health, protocol list, assigned users, and actions. The desktop evidence places the table at approximately `y=343`, ends it at approximately `y=894`, and renders six `82px` rows plus the pagination footer in one viewport.

## Interaction evidence

- Search `vmss` narrows the table to `vmss日本`; reset restores all six rows.
- Protocol health `有异常` narrows the table to `加坡01` and its `AnyTLS（异常）` chip.
- Column settings opens and closes from the toolbar.
- `一键搭建整机协议` opens the existing setup dialog.
- Row-level `分配用户` opens the existing assignment dialog.
- Mobile keeps the summary and controls readable and exposes the dense table through an intentional horizontal scroll region (`1720px` table content inside a `345px` viewport).

## Findings

- No P0/P1/P2 visual mismatch remains against the supplied screenshot.
- [P3] Production API responses do not consistently provide the preview-only uptime, node type, assignment count, or per-protocol health fields. The preview fixture matches the reference; production fallback values remain conservative instead of fabricating health data.
- [P3] The table is intentionally horizontally scrollable on narrow screens because the reference is a fleet comparison table with seven information-dense columns. The mobile shell, summary, controls, and first table region remain usable without clipping the page itself.

## Required fidelity surfaces

- Fonts and typography: dark admin typography, compact table labels, Chinese/English title pairing, and monospace IP/ratio values match the reference hierarchy.
- Spacing and layout rhythm: 255px sidebar, 56px header, 18px summary/toolbar rhythm, fixed column widths, 82px rows, and visible pagination preserve the reference composition.
- Colors and visual tokens: blue actions, purple protocol chips, green healthy state, amber warning state, red offline/error state, and dark navy surfaces are represented consistently.
- Image quality and asset fidelity: no decorative raster imagery is required; the existing TunnelBox logo and icon system are used.
- Copy and content: title, subtitle, summary labels, filter labels, table headers, six sample nodes, actions, and pagination follow the supplied design.
- Icons and states: copy-IP, column settings, refresh, user assignment, protocol-health, node-online, partial-error, and offline states are all represented.
- Responsiveness and accessibility: search and filters have labels, action buttons retain names, dialogs remain available, and mobile preserves a deliberate table scroll affordance.

## Patches made since the previous QA pass

- Replaced the visible Command Board composition with the Operations Table composition from the latest user-provided screenshot.
- Added six reference-aligned preview nodes, 36 protocol fixtures, three summary metrics, four filters/reset, refresh, column settings, and pagination.
- Added compact row actions while preserving the existing setup, create, assignment, self-use, and clear-machine handlers.
- Tuned the admin shell, column grid, row density, offline colors, and desktop/mobile responsive behavior.

final result: passed
