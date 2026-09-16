# Tech Stack

## Platform

**Google Apps Script** (V8 runtime) — server-side JavaScript that runs inside Google Workspace. All code executes in the context of a Google Spreadsheet.

## Architecture: Library + Wrapper pattern

The project uses a two-layer architecture:

- **`Code_v2.15.gs` (GanttLib)** — the central library containing all business logic. This is the "source of truth" project, published as a shared Apps Script library.
- **`Wrapper_Gantt_v2.gs`** — thin client-side script attached to each spreadsheet copy. It builds the menu locally and delegates every function call to `GanttLib.<fn>()`.

The wrapper exists because `onOpen` must run without authorization (simple trigger), so it cannot call the library directly for menu construction. All other functions are installed triggers that run with the authorization of the user who ran `instalarTriggerAutomatico()`.

## Trigger types

| Trigger | Handler | Type | Notes |
|---|---|---|---|
| `onChange` | `onChange(e)` | Installable | Structural changes, holiday normalization |
| `onEdit` | `alEditar(e)` | Installable | Cell edits → sync Días ↔ Fechas |
| `onOpen` | `onOpen()` | Simple | Menu construction only — no library calls |

`alEditar` is used instead of `onEdit` to avoid conflicts with simple trigger execution model.

## Key APIs used

- `SpreadsheetApp` — sheets, ranges, cell formatting, background colors
- `ScriptApp` — trigger installation/deletion
- `SpreadsheetApp.getUi()` — menu construction, `alert()` dialogs
- `SpreadsheetApp.toast()` — non-blocking notifications

## Language & style

- ES5-compatible JavaScript (no `let`/`const`, no arrow functions, no destructuring)
- `var` for all variable declarations
- `for` loops with explicit index variables (no `forEach`, no `map`)
- Global `CONFIG` object for all constants (colors, sheet names)
- No external npm dependencies — all logic is vanilla GAS

## No build system

There is no build step, bundler, test runner, or CI pipeline configured in this repo. Scripts are deployed directly to Google Apps Script via the GAS editor or `clasp`.

### Common commands (if using clasp)

```bash
# Push local changes to Apps Script project
clasp push

# Pull latest from Apps Script project
clasp pull

# Open project in browser
clasp open
```

> **Note:** `clasp` requires a `.clasp.json` config with the `scriptId`. If not present, changes must be applied manually via the GAS web editor.

## Important: Triggers don't fire on programmatic writes

`onEdit` triggers (installable or simple) only fire on **manual** user edits. When code writes to a cell via `setValue()` / `setValues()`, the trigger does NOT fire.

**Consequence:** Any bot action or function that writes to a cell and expects the same recalculation that `onEdit` would do, must call the recalculation logic **directly** after writing. Do not rely on the trigger.

Example: `agregarDayOffBot` writes to column E, then explicitly calls `recalcularFechaFinConExcepciones()` because `onEdit` won't fire.
