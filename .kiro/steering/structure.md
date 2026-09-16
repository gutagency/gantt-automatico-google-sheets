# Project Structure

```
/
├── Code_v2.15.gs          # GanttLib — central library, all business logic lives here
├── Wrapper_Gantt_v2.gs    # Wrapper — menu + thin delegation layer for each spreadsheet copy
├── Tests_Gantt.gs         # Property-based + unit tests (GAS nativo, sin dependencias)
└── .kiro/
    ├── steering/
    │   ├── product.md
    │   ├── tech.md
    │   └── structure.md
    └── specs/
        └── cascadas-por-etapa/   # Active feature spec
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

## File responsibilities

### `Code_v2.15.gs` (GanttLib)
The only place where business logic is written. Contains:
- `CONFIG` — global constants (sheet names, colors)
- `TRADUCCIONES_PT` / `TRADUCCIONES_ES` — ES↔PT translation dictionaries
- Date utility functions: `sumarDiasHabiles`, `restarDiasHabiles`, `siguienteDiaHabil`, `diaHabilAnterior`, `esDiaHabil`, `calcularDiasHabiles`
- Holiday helpers: `obtenerFeriados`
- Cascade functions: `cascadaInversa`, `cascadaNormal`, `cascadaDesdeCursor`
- Per-stage cascades (v2.15+): `obtenerLimitesSubgrupos`, `cascadaInversaSubgrupos`, `cascadaNormalSubgrupos`
- Gantt generation: `generarGantt`, `copiarGanttACliente`
- UI helpers: `verificarHeadersCreativo`, `marcarSuperposicionEntrada`, `formatearFechasCreativo`
- Trigger handlers: `onEdit(e)`, `onChange(e)`

### `Wrapper_Gantt_v2.gs`
One function per menu item, each delegating to `GanttLib.<fn>()`. Also contains:
- `onOpen()` — builds the "🤖 Agente" menu (no library calls here)
- `instalarTriggerAutomatico()` — installs `onChange` + `alEditar` installable triggers

## Conventions

- **Never add logic to the wrapper.** Any new feature goes into `Code_v2.15.gs`.
- **Every new public function in GanttLib needs a wrapper stub** and a menu entry in `onOpen()` (if user-facing).
- **Version is tracked in the filename** (`Code_v2.15.gs`) and in the top-level JSDoc comment block. Bump the version on each significant change.
- **Sheet names are always referenced via `CONFIG.*`**, never hardcoded as strings inline.
- **Colors are always referenced via `CONFIG.*`**, never hardcoded as hex values inline.
- **Subgroup headers** (rows whose column A is `PROCESO CREATIVO` or `PRODUCTION PLANNING`) are structural markers — no cascade function should ever write to them.
