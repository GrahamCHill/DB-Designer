# DB Designer

DB Designer is a desktop-first visual workspace for designing database schemas, modeling APIs, building SQL queries visually, and generating starter code from an ERD. The project combines a Vue 3 + TypeScript frontend with a Rust + Tauri desktop shell so it can support both canvas-heavy interaction and native desktop workflows.

It is designed for people who want more than a basic ERD editor. Instead of stopping at table design, DB Designer also helps you move into API planning, query composition, and model generation from the same source structure.

## What You Can Do

With DB Designer, you can:

- design relational schemas visually
- organize tables into groups and nested groups
- create relationships between columns
- save and load schema files
- export SQL from a visual model
- use tables as input for REST, GraphQL, and Federation design
- build SQL queries visually from schema tables
- generate model code in multiple programming languages
- export visual canvases as images

## Main Workspaces

### DB Schema Workspace

This is the core ERD workspace. It manages tables, columns, relations, groups, and schema tabs.

Features currently present in the codebase:

- multi-tab schema editing
- schema naming per tab
- table creation with default starter columns
- column editing for type, nullability, PK, uniqueness, defaults, and comments
- table width resizing
- relation creation and removal
- draggable table layout
- nested table groups
- group locking to prevent automatic reassignment
- drag-and-drop group assignment from the sidebar
- minimap support
- schema save/load using `.dbm.json`
- SQL export
- PNG/JPG canvas export
- local persistence through browser storage

### API Designer Workspace

The API workspace lets the schema drive interface design. It supports three design modes:

- REST
- GraphQL
- GraphQL Federation

Current capabilities include:

- switching between API design modes
- REST endpoint node creation
- REST type node creation
- endpoint metadata such as method, path, params, request body, and responses
- GraphQL type creation across several kinds, including roots, enums, interfaces, unions, and inputs
- federation service creation
- federation type modeling with entity and key-field support
- visual relations between API nodes
- grouping of API nodes
- API project persistence in local storage
- bootstrapping API nodes directly from database tables
- keeping the ERD visible in the background while modeling APIs

### Query Builder Workspace

The query builder turns the schema into a visual SQL composition tool.

Current capabilities include:

- adding schema tables onto a query canvas
- preventing duplicate additions of the same source table
- per-table aliases
- drag-based table positioning
- visual join creation between columns
- join type selection: `INNER`, `LEFT`, `RIGHT`, `FULL`
- select column toggles
- aggregate functions such as `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`
- column aliases
- where clause building
- group by configuration
- order by configuration
- `DISTINCT`, `LIMIT`, and `OFFSET`
- generated SQL preview
- manual SQL override and reset
- SQL file export
- PNG/JPG export for the query canvas
- automatic cleanup of joins/filters/orders/groups when tables are removed

### ERD to Code Workspace

The codegen workspace generates starter data models from a schema.

Supported output targets currently include:

- TypeScript
- Go
- Rust
- Python
- Java
- Kotlin
- C#
- C++

Current options include:

- TypeScript interfaces
- TypeScript classes
- TypeScript optional nullable mapping
- TypeScript Zod schema generation
- Go package naming
- Go `json` and `db` tags
- Go pointer mapping for nullable fields
- Python dataclass output
- Python Pydantic output
- Python SQLAlchemy-style output
- Rust struct generation with Serde-friendly output
- per-table preview tabs
- selective table inclusion
- copy-all output
- downloadable generated files
- loading an external schema file or using the current in-app schema

## Export Support

### Schema Workspace Exports

- `.dbm.json`
- SQL
- PNG
- JPG

### API Workspace Exports

- OpenAPI 3.0 JSON
- TypeScript fetch client
- JavaScript fetch client
- Python FastAPI stubs
- GraphQL SDL
- GraphQL resolver stubs for TypeScript
- GraphQL resolver stubs for JavaScript
- Federation SDL
- Apollo subgraph starter code for TypeScript
- Apollo subgraph starter code for JavaScript

### Query Workspace Exports

- `.sql`
- PNG
- JPG

### Codegen Workspace Exports

- generated model code by selected language
- clipboard copy
- downloadable single-file output

## Database Import Support

The project already contains live database import plumbing in both the UI and Tauri backend.

What exists now:

- connection modal for PostgreSQL, MySQL, SQLite, and SQL Server
- connection testing UI flow
- SQLite file browse flow through the Tauri dialog plugin
- Tauri command registration for `db_test_connection` and `db_import_schema`
- Rust-side connection test support for PostgreSQL, SQLite, MySQL, and SQL Server
- Rust-side schema import support for PostgreSQL, SQLite, MySQL, and SQL Server
- type normalization into the internal schema model
- automatic visual placement of imported tables
- foreign-key extraction for imported PostgreSQL, SQLite, MySQL, and SQL Server schemas

Current note:

- the Rust backend database integrations are implemented and the backend currently builds successfully
- the remaining validation work is functional testing against real sample databases for each supported dialect

## Example Workflow

A realistic workflow in the app looks like this:

1. Create or import a schema in the DB Schema workspace.
2. Organize tables into groups and connect relationships.
3. Switch to the API workspace and generate starter REST or GraphQL structures from tables.
4. Move to the Query Builder workspace to prototype SQL queries using the same schema.
5. Open ERD to Code and generate model code for your application layer.

This is the main strength of the project: the schema is not treated as an isolated artifact.

## Tech Stack

- Frontend: Vue 3, TypeScript, Vite
- State management: Pinia
- Canvas/graph interaction: Vue Flow
- Desktop shell: Tauri 2
- Native backend: Rust
- Database layer: SQLx
- Styling: custom CSS, with Tailwind tooling present in the project

## Getting Started

### Prerequisites

You will need:

- Node.js 18 or newer recommended
- npm
- Rust toolchain
- Tauri prerequisites for your operating system

For Windows development, make sure the standard Tauri desktop requirements are available, including WebView2 and the relevant Microsoft C++ build tooling if they are not already installed.

### Install Dependencies

```bash
npm install
```

### Run The Frontend In The Browser

```bash
npm run dev
```

### Run The Desktop App In Development

```bash
npm run tauri dev
```

### Build The Frontend

```bash
npm run build
```

### Build The Desktop App

```bash
npm run tauri build
```

## Project Structure

```text
src/
  components/
    api-modals/        API editing dialogs
    api-panels/        API overview and export panels
    api-sidebar/       API workspace controls
    canvas/            ERD and API visual canvases
    codegen/           ERD-to-code workspace
    modals/            DB schema dialogs
    query-canvas/      query builder canvas
    query-sidebar/     query builder controls
    sidebar/           schema workspace sidebar
  composables/         shared export and containment logic
  stores/              Pinia stores for schema, API, query, tabs, and workspace state
  types/               shared TypeScript domain models

src-tauri/
  src/
    db.rs              database import and test logic
    lib.rs             Tauri application bootstrap
    main.rs            native entrypoint
  tauri.conf.json      Tauri configuration
```

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` type-checks and builds the frontend
- `npm run preview` previews the production frontend build
- `npm run tauri dev` runs the desktop app in development
- `npm run tauri build` packages the desktop app

## Current Status

This project is already broad and feature-rich on the frontend side. The ERD, API, query, and codegen workflows are all present and connected through shared state. Export generation is also already substantial.

The native database integration is now wired through Tauri and implemented across PostgreSQL, SQLite, MySQL, and SQL Server in the Rust backend. The main remaining work in this area is end-to-end validation against real sample databases and any follow-up polishing that comes out of that testing.

## Contributing

If you are extending the project, these are good places to start:

- `src/stores/schema.ts` for ERD behavior
- `src/stores/api.ts` for API modeling and exports
- `src/stores/query.ts` for query builder logic
- `src/components/codegen/CodegenPanel.vue` for code generation behavior
- `src-tauri/src/db.rs` for native database integration

A good contribution rule for this repository is: keep the README and the UI honest. If a workflow is visible but not fully wired through yet, document that clearly.

## License

No license file is currently present in this repository. If you want to distribute or open-source the project, add an explicit license so usage terms are clear.


