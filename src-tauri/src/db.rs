use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Shared types matching the frontend Schema shape ──────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchemaColumn {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub col_type: String,
    pub nullable: bool,
    #[serde(rename = "primaryKey")]
    pub primary_key: bool,
    pub unique: bool,
    #[serde(rename = "defaultValue")]
    pub default_value: String,
    pub comment: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchemaTable {
    pub id: String,
    pub name: String,
    pub comment: String,
    pub columns: Vec<SchemaColumn>,
    pub color: String,
    pub position: Position,
    #[serde(rename = "groupId")]
    pub group_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchemaRelation {
    pub id: String,
    #[serde(rename = "sourceTableId")]
    pub source_table_id: String,
    #[serde(rename = "sourceColumnId")]
    pub source_column_id: String,
    #[serde(rename = "targetTableId")]
    pub target_table_id: String,
    #[serde(rename = "targetColumnId")]
    pub target_column_id: String,
    #[serde(rename = "type")]
    pub rel_type: String,
    pub label: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportedSchema {
    pub id: String,
    pub name: String,
    pub tables: Vec<SchemaTable>,
    pub relations: Vec<SchemaRelation>,
    pub groups: Vec<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct TestResult {
    pub ok: bool,
    pub message: String,
}

// ── Connection args from frontend ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ConnectArgs {
    pub dialect: String,
    // Network DBs
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub ssl: Option<bool>,
    pub instance: Option<String>,
    // SQLite
    pub path: Option<String>,
}

impl ConnectArgs {
    fn pg_url(&self) -> String {
        let host = self.host.as_deref().unwrap_or("localhost");
        let port = self.port.unwrap_or(5432);
        let db = self.database.as_deref().unwrap_or("postgres");
        let user = self.username.as_deref().unwrap_or("postgres");
        let pass = self.password.as_deref().unwrap_or("");
        let ssl = if self.ssl.unwrap_or(false) { "?sslmode=require" } else { "" };
        format!("postgresql://{}:{}@{}:{}/{}{}", user, pass, host, port, db, ssl)
    }

    fn mysql_url(&self) -> String {
        let host = self.host.as_deref().unwrap_or("localhost");
        let port = self.port.unwrap_or(3306);
        let db = self.database.as_deref().unwrap_or("");
        let user = self.username.as_deref().unwrap_or("root");
        let pass = self.password.as_deref().unwrap_or("");
        format!("mysql://{}:{}@{}:{}/{}", user, pass, host, port, db)
    }

    fn mssql_url(&self) -> String {
        let host = self.host.as_deref().unwrap_or("localhost");
        let port = self.port.unwrap_or(1433);
        let db = self.database.as_deref().unwrap_or("master");
        let user = self.username.as_deref().unwrap_or("sa");
        let pass = self.password.as_deref().unwrap_or("");
        let instance = self.instance.as_deref().unwrap_or("");
        let server = if instance.is_empty() {
            format!("{}:{}", host, port)
        } else {
            format!("{}\\{}", host, instance)
        };
        format!(
            "Server={};Database={};User Id={};Password={};TrustServerCertificate=True",
            server, db, user, pass
        )
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn map_pg_type(pg: &str) -> String {
    match pg.to_lowercase().as_str() {
        "int4" | "int" | "integer" => "INTEGER",
        "int8" | "bigint" => "BIGINT",
        "int2" | "smallint" => "SMALLINT",
        "serial" => "SERIAL",
        "bigserial" => "BIGSERIAL",
        "varchar" | "character varying" => "VARCHAR",
        "text" => "TEXT",
        "char" | "character" => "CHAR",
        "bool" | "boolean" => "BOOLEAN",
        "float4" | "real" => "FLOAT",
        "float8" | "double precision" => "DOUBLE",
        "numeric" | "decimal" => "DECIMAL",
        "date" => "DATE",
        "time" | "time without time zone" => "TIME",
        "timestamp" | "timestamp without time zone" => "TIMESTAMP",
        "timestamptz" | "timestamp with time zone" => "TIMESTAMPTZ",
        "uuid" => "UUID",
        "json" => "JSON",
        "jsonb" => "JSONB",
        "bytea" => "BYTEA",
        _ if pg.ends_with("[]") => "ARRAY",
        _ => "TEXT",
    }
    .to_string()
}

fn map_mysql_type(t: &str) -> String {
    let lower = t.to_lowercase();
    if lower.contains("bigint") { return "BIGINT".into(); }
    if lower.contains("smallint") { return "SMALLINT".into(); }
    if lower.contains("tinyint") || lower.contains("bit") { return "BOOLEAN".into(); }
    if lower.contains("int") { return "INTEGER".into(); }
    if lower.contains("decimal") || lower.contains("numeric") { return "DECIMAL".into(); }
    if lower.contains("double") { return "DOUBLE".into(); }
    if lower.contains("float") { return "FLOAT".into(); }
    if lower.contains("datetime") || lower.contains("timestamp") { return "TIMESTAMP".into(); }
    if lower.contains("date") { return "DATE".into(); }
    if lower.contains("time") { return "TIME".into(); }
    if lower.contains("text") { return "TEXT".into(); }
    if lower.contains("char") || lower.contains("varchar") { return "VARCHAR".into(); }
    if lower.contains("blob") || lower.contains("binary") { return "BYTEA".into(); }
    if lower.contains("json") { return "JSON".into(); }
    "TEXT".into()
}

fn table_colors() -> Vec<&'static str> {
    vec![
        "#3ECF8E", "#3B82F6", "#8B5CF6", "#F59E0B",
        "#EF4444", "#06B6D4", "#EC4899", "#10B981",
    ]
}

// ── PostgreSQL ───────────────────────────────────────────────────────────────

#[cfg(feature = "postgres")]
mod pg_impl {
    use super::*;
    use sqlx::PgPool;

    pub async fn test(args: &ConnectArgs) -> Result<TestResult, String> {
        match PgPool::connect(&args.pg_url()).await {
            Ok(_) => Ok(TestResult { ok: true, message: "Connected successfully".into() }),
            Err(e) => Ok(TestResult { ok: false, message: e.to_string() }),
        }
    }

    pub async fn import(args: &ConnectArgs, db_name: &str) -> Result<ImportedSchema, String> {
        let pool = PgPool::connect(&args.pg_url()).await.map_err(|e| e.to_string())?;

        // Fetch tables
        use sqlx::Row;
        let rows = sqlx::query(
            r#"
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            "#
        )
        .fetch_all(&pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

        let colors = table_colors();
        let mut tables: Vec<SchemaTable> = Vec::new();
        let mut table_id_map: std::collections::HashMap<String, String> = Default::default();

        for (i, row) in rows.iter().enumerate() {
            let table_name: String = row.try_get("table_name").map_err(|e| e.to_string())?;
            let table_id = Uuid::new_v4().to_string();
            table_id_map.insert(table_name.clone(), table_id.clone());

            // Fetch columns
            let col_rows = sqlx::query(
                r#"
                SELECT
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    COALESCE(
                        (SELECT TRUE FROM information_schema.table_constraints tc
                         JOIN information_schema.key_column_usage kcu
                           ON tc.constraint_name = kcu.constraint_name
                          AND tc.table_schema = kcu.table_schema
                          AND tc.table_name = kcu.table_name
                         WHERE tc.constraint_type = 'PRIMARY KEY'
                           AND kcu.column_name = c.column_name
                           AND tc.table_name = $1
                         LIMIT 1),
                        FALSE
                    ) AS is_pk,
                    COALESCE(
                        (SELECT TRUE FROM information_schema.table_constraints tc
                         JOIN information_schema.key_column_usage kcu
                           ON tc.constraint_name = kcu.constraint_name
                         WHERE tc.constraint_type = 'UNIQUE'
                           AND kcu.column_name = c.column_name
                           AND tc.table_name = $1
                         LIMIT 1),
                        FALSE
                    ) AS is_unique
                FROM information_schema.columns c
                WHERE c.table_schema = 'public' AND c.table_name = $1
                ORDER BY c.ordinal_position
                "#,
            )
            .bind(&table_name)
            .fetch_all(&pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

            let mut columns: Vec<SchemaColumn> = Vec::new();
            for c in col_rows {
                columns.push(SchemaColumn {
                    id: Uuid::new_v4().to_string(),
                    name: c.try_get("column_name").map_err(|e| e.to_string())?,
                    col_type: map_pg_type(&c.try_get::<String, _>("data_type").map_err(|e| e.to_string())?),
                    nullable: c.try_get::<String, _>("is_nullable").map_err(|e| e.to_string())? == "YES",
                    primary_key: c.try_get::<bool, _>("is_pk").unwrap_or(false),
                    unique: c.try_get::<bool, _>("is_unique").unwrap_or(false),
                    default_value: c.try_get::<Option<String>, _>("column_default").unwrap_or_default().unwrap_or_default(),
                    comment: String::new(),
                });
            }

            let cols_per_row = 3usize;
            let x = (i % cols_per_row) as f64 * 380.0 + 60.0;
            let y = (i / cols_per_row) as f64 * 320.0 + 60.0;

            tables.push(SchemaTable {
                id: table_id,
                name: table_name.clone(),
                comment: String::new(),
                columns,
                color: colors[i % colors.len()].to_string(),
                position: Position { x, y },
                group_id: None,
            });
        }

        // Fetch FK relations
        let fk_rows = sqlx::query(
            r#"
            SELECT
                tc.table_name AS source_table,
                kcu.column_name AS source_col,
                ccu.table_name AS target_table,
                ccu.column_name AS target_col
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            "#
        )
        .fetch_all(&pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

        let mut relations: Vec<SchemaRelation> = Vec::new();
        for fk in &fk_rows {
            let s_table: String = fk.try_get("source_table").map_err(|e| e.to_string())?;
            let s_col: String = fk.try_get("source_col").map_err(|e| e.to_string())?;
            let t_table: String = fk.try_get("target_table").map_err(|e| e.to_string())?;
            let t_col: String = fk.try_get("target_col").map_err(|e| e.to_string())?;

            let src_tid = match table_id_map.get(&s_table) { Some(v) => v.clone(), None => continue };
            let tgt_tid = match table_id_map.get(&t_table) { Some(v) => v.clone(), None => continue };
            let src_table = match tables.iter().find(|t| t.id == src_tid) { Some(v) => v, None => continue };
            let tgt_table = match tables.iter().find(|t| t.id == tgt_tid) { Some(v) => v, None => continue };
            let src_cid = match src_table.columns.iter().find(|c| c.name == s_col) { Some(v) => v.id.clone(), None => continue };
            let tgt_cid = match tgt_table.columns.iter().find(|c| c.name == t_col) { Some(v) => v.id.clone(), None => continue };
            relations.push(SchemaRelation {
                id: Uuid::new_v4().to_string(),
                source_table_id: src_tid,
                source_column_id: src_cid,
                target_table_id: tgt_tid,
                target_column_id: tgt_cid,
                rel_type: "one-to-many".into(),
                label: String::new(),
            });
        }

        Ok(ImportedSchema {
            id: Uuid::new_v4().to_string(),
            name: db_name.to_string(),
            tables,
            relations,
            groups: vec![],
            created_at: now_iso(),
            updated_at: now_iso(),
        })
    }
}

// ── SQLite ───────────────────────────────────────────────────────────────────

#[cfg(feature = "sqlite")]
mod sqlite_impl {
    use super::*;
    use sqlx::SqlitePool;

    pub async fn test(path: &str) -> Result<TestResult, String> {
        let url = format!("sqlite://{}", path);
        match SqlitePool::connect(&url).await {
            Ok(_) => Ok(TestResult { ok: true, message: "Connected".into() }),
            Err(e) => Ok(TestResult { ok: false, message: e.to_string() }),
        }
    }

    pub async fn import(path: &str) -> Result<ImportedSchema, String> {
        let url = format!("sqlite://{}", path);
        let pool = SqlitePool::connect(&url).await.map_err(|e| e.to_string())?;

        use sqlx::Row;
        let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .fetch_all(&pool).await.map_err(|e: sqlx::Error| e.to_string())?;

        let colors = table_colors();
        let mut tables: Vec<SchemaTable> = Vec::new();

        for (i, row) in rows.iter().enumerate() {
            let table_name: String = row.try_get("name").map_err(|e| e.to_string())?;
            let pragma = sqlx::query(&format!("PRAGMA table_info(\"{}\")", table_name))
                .fetch_all(&pool).await.map_err(|e| e.to_string())?;

            let mut columns: Vec<SchemaColumn> = Vec::new();
            for col_row in &pragma {
                use sqlx::Row;
                let name: String = col_row.try_get("name").unwrap_or_default();
                let col_type: String = col_row.try_get("type").unwrap_or_default();
                let not_null: i64 = col_row.try_get("notnull").unwrap_or(0);
                let pk: i64 = col_row.try_get("pk").unwrap_or(0);
                let dflt: Option<String> = col_row.try_get("dflt_value").ok().flatten();

                columns.push(SchemaColumn {
                    id: Uuid::new_v4().to_string(),
                    name,
                    col_type: map_mysql_type(&col_type), // SQLite types are loose, reuse mapping
                    nullable: not_null == 0,
                    primary_key: pk > 0,
                    unique: pk > 0,
                    default_value: dflt.unwrap_or_default(),
                    comment: String::new(),
                });
            }

            let x = (i % 3) as f64 * 380.0 + 60.0;
            let y = (i / 3) as f64 * 320.0 + 60.0;
            tables.push(SchemaTable {
                id: Uuid::new_v4().to_string(),
                name: table_name.clone(),
                comment: String::new(),
                columns,
                color: colors[i % colors.len()].to_string(),
                position: Position { x, y },
                group_id: None,
            });
        }

        Ok(ImportedSchema {
            id: Uuid::new_v4().to_string(),
            name: std::path::Path::new(path)
                .file_stem().and_then(|s| s.to_str()).unwrap_or("database").to_string(),
            tables,
            relations: vec![],
            groups: vec![],
            created_at: now_iso(),
            updated_at: now_iso(),
        })
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn db_test_connection(args: ConnectArgs) -> Result<TestResult, String> {
    match args.dialect.as_str() {
        #[cfg(feature = "postgres")]
        "postgresql" => pg_impl::test(&args).await,

        #[cfg(feature = "sqlite")]
        "sqlite" => {
            let path = args.path.as_deref().unwrap_or("");
            sqlite_impl::test(path).await
        }

        _ => Ok(TestResult {
            ok: false,
            message: format!("Dialect '{}' not yet enabled in this build. Add the feature flag.", args.dialect),
        }),
    }
}

#[tauri::command]
pub async fn db_import_schema(args: ConnectArgs) -> Result<ImportedSchema, String> {
    match args.dialect.as_str() {
        #[cfg(feature = "postgres")]
        "postgresql" => {
            let db = args.database.clone().unwrap_or_else(|| "postgres".into());
            pg_impl::import(&args, &db).await
        }

        #[cfg(feature = "sqlite")]
        "sqlite" => {
            let path = args.path.clone().unwrap_or_default();
            sqlite_impl::import(&path).await
        }

        _ => Err(format!("Dialect '{}' not supported in this build.", args.dialect)),
    }
}
