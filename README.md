# DB Designer

DB Designer is a desktop-first visual design tool for database schemas, API contracts, SQL query composition, and model code generation. It is built with Vue 3, TypeScript, Vite, Pinia, Vue Flow, and Tauri so the same project can feel like a rich web canvas while still supporting native desktop workflows.

Instead of treating schema work as an isolated task, this project connects four related workflows in one app:

- Design and organize relational schemas visually
- Turn tables into REST or GraphQL starting points
- Compose SQL queries on a canvas
- Generate application models from the ERD

## Why This Project Exists

Most database tools are strong in one area and weak in the others. DB Designer aims to give you one place to:

- sketch an ERD quickly
- group and reorganize tables visually
- derive API shapes from the schema
- experiment with joins before writing SQL manually
- export code stubs for downstream application work

## Core Workspaces

### 1. DB Schema

The schema workspace is the heart of the app. It lets you create and edit tables, columns, relations, and nested table groups on a canvas.

Current capabilities include:

- multi-tab schema editing
- table creation with default ID columns
- column metadata such as type, nullability, PK, uniqueness, default value, and comments
- relation modeling between columns
- draggable groups with containment behavior
- group locking to keep table membership stable
- minimap support
- JSON save/load using `.dbm.json`
- SQL export
- canvas export to PNG or JPG

### 2. API Designer

The API workspace layers API modeling on top of the schema thinking. It supports three modes:

- REST
- GraphQL
- GraphQL Federation

Highlights:

- create REST endpoints and data types visually
- create GraphQL types, roots, enums, unions, interfaces, and inputs
- create federation services and service-owned types
- bootstrap API nodes from database tables
- export OpenAPI, SDL, resolver stubs, and subgraph boilerplate

### 3. Query Builder

The query workspace provides a visual SQL builder driven by selected schema tables.

It currently supports:

- adding tables to a query canvas
- join creation between columns
- select column toggles
- aggregates
- aliases
- where clauses
- group by
- order by
- distinct
- limit and offset
- generated SQL preview
- manual SQL override/reset
- SQL file export
- PNG/JPG canvas export

### 4. ERD to Code

The codegen workspace converts a schema into starter models and DTO-like structures.

Current target languages:

- TypeScript
- Go
- Rust
- Python
- Java
- Kotlin
- C#
- C++

Several language-specific options are already supported, such as:

- TypeScript interfaces, classes, and optional Zod schemas
- Go package name, tag generation, and nullable pointers
- Python dataclass, Pydantic, and SQLAlchemy-style output

## Tech Stack

- Frontend: Vue 3 + TypeScript + Vite
- State: Pinia
- Canvas/diagramming: Vue Flow
- Desktop shell: Tauri 2
- Native backend: Rust
- Database access: SQLx
- Styling: custom CSS with Tailwind tooling available in the project

## Getting Started

### Prerequisites

You will need:

- Node.js 18+ recommended
- npm
- Rust toolchain
- Tauri system prerequisites for your OS

For Windows development, make sure the standard Tauri build dependencies are installed, including WebView2 and the Microsoft C++ build tools if your environment does not already have them.

### Install

```bash
npm install
```

### Run In The Browser

```bash
npm run dev
```

### Run As A Tauri Desktop App

```bash
npm run tauri dev
```

### Build Frontend Assets

```bash
npm run build
```

### Build Desktop App

```bash
npm run tauri build
```

## Project Structure

```text
src/
  components/
    api-modals/        API editing dialogs
    api-panels/        API overview + export panels
    api-sidebar/       API workspace controls
    canvas/            ERD and API visual canvases
    codegen/           ERD-to-code workspace
    modals/            DB schema dialogs
    query-canvas/      query builder canvas
    query-sidebar/     query builder controls
    sidebar/           schema workspace sidebar
  composables/         shared export and containment logic
  stores/              Pinia stores for schema, API, query, tabs, workspace
  types/               shared TypeScript models

src-tauri/
  src/
    db.rs              database import/test logic
    lib.rs             Tauri app bootstrap
    main.rs            native entrypoint
  tauri.conf.json      Tauri configuration
```

## Development Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` type-checks and builds the frontend
- `npm run preview` previews the frontend build
- `npm run tauri dev` runs the desktop app in development
- `npm run tauri build` creates a packaged desktop build

## Current Status

This project is already substantial and usable for local design workflows, but it is still in active development. A few important implementation notes are worth calling out:

- The schema, API, query, and codegen workspaces are present and wired in the frontend.
- Local persistence is used heavily through `localStorage` for tabs, schemas, and API projects.
- The database connection UI exposes PostgreSQL, MySQL, SQLite, and SQL Server options.
- The Rust import implementation currently contains PostgreSQL and SQLite paths.
- The current Tauri bootstrap in `src-tauri/src/lib.rs` only registers a sample `greet` command, so database import commands still need to be connected before the DB import workflow can fully function in-app.

In short: the product vision is clearly implemented in the UI, and several exports/generators already work, but the native database integration is not fully finished yet.

## Export Formats

### Schema Workspace

- `.dbm.json`
- SQL
- PNG
- JPG

### API Workspace

- OpenAPI 3.0 JSON
- TypeScript fetch client
- JavaScript fetch client
- Python FastAPI stubs
- GraphQL SDL
- GraphQL resolver stubs
- Federation SDL
- Apollo subgraph starter code

### Query Workspace

- SQL file export
- PNG
- JPG

### Codegen Workspace

- generated model code by language
- clipboard copy
- downloadable single-file output

## Roadmap Ideas

Some natural next steps for the project are:

- register and finish Tauri DB commands end-to-end
- complete MySQL and SQL Server native import support
- add automated tests for stores and export generators
- add project-level import/export across all workspaces
- support richer SQL generation and validation
- add migrations and diff tooling
- package generated code into multi-file language templates

## Contributing

If you are extending the app, the best starting points are:

- `src/stores/schema.ts` for ERD behavior
- `src/stores/api.ts` for API modeling and exports
- `src/stores/query.ts` for SQL builder behavior
- `src/components/codegen/CodegenPanel.vue` for model generation
- `src-tauri/src/db.rs` for native database integration

When contributing, try to keep the app honest: if a workflow is visible in the UI but incomplete natively, document that clearly instead of hiding it.

## License

No license file is currently present in this repository. If you plan to share or distribute the project, add an explicit license so usage terms are clear.
