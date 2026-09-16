# Product

**Gantt Automático** is a Google Sheets automation tool for creative and production teams to plan project activities with dates calculated automatically, respecting business days (excluding weekends and public holidays).

## Core capabilities

- **Date cascades**: two modes — inverse (anchor on last activity's end date, calculates upwards) and normal (anchor on first activity's start date, calculates downwards).
- **Per-stage cascades**: independent cascades for each sub-group/stage within a single sheet (e.g. "PROCESO CREATIVO" and "PRODUCTION PLANNING" can have different date anchors).
- **Business day awareness**: all date math skips weekends and configurable public holidays (Argentina, Brasil, México City, Chile).
- **Gantt chart generation**: unified view of creative + production activities, with color-coded bars and overlap detection.
- **Bidirectional sync**: manual cell edits to start/end dates auto-recalculate the other date and day count in-row.
- **Bilingual support**: activity names and UI text switch between Spanish and Portuguese.

## Target users

Internal creative and production teams managing advertising/media projects.

## Grouper rows (agrupadores)

Rows in `Entrada Proceso Creativo` whose column A value is `PROCESO CREATIVO` or `PRODUCTION PLANNING` (case-insensitive, ignoring leading/trailing spaces) are **grouper rows** (agrupadores). They act as visual and semantic separators between stages.

**Critical rule:** Grouper rows are NEVER tasks. No cascade function (global or per-stage) should ever assign dates to them, process them as activities, or modify their content. They must be skipped in every loop that iterates over activity rows.

## Key sheets

| Sheet name | Purpose |
|---|---|
| `Entrada Proceso Creativo` | Main input: `Actividad \| Días \| Fecha Inicio \| Fecha Fin` |
| `Entrada Producción` | Production timeline input (read from PDF via automation) |
| `Feriados` | Public holiday list by country |
| `Gantt` | Generated Gantt chart output |
| `Instrucciones` | User guide and configuration (language, country, client URL) |
