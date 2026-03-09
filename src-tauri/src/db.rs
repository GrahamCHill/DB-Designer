use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

#[derive(Debug, Deserialize)]
pub struct ConnectArgs {
    pub dialect: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub ssl: Option<bool>,
    pub instance: Option<String>,
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
}

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

fn map_sqlite_type(t: &str) -> String {
    let lower = t.to_lowercase();
    if lower.contains("bigint") { return "BIGINT".into(); }
    if lower.contains("smallint") { return "SMALLINT".into(); }
    if lower.contains("int") { return "INTEGER".into(); }
    if lower.contains("decimal") || lower.contains("numeric") { return "DECIMAL".into(); }
    if lower.contains("double") { return "DOUBLE".into(); }
    if lower.contains("float") || lower.contains("real") { return "FLOAT".into(); }
    if lower.contains("datetime") || lower.contains("timestamp") { return "TIMESTAMP".into(); }
    if lower == "date" { return "DATE".into(); }
    if lower == "time" { return "TIME".into(); }
    if lower.contains("blob") || lower.contains("binary") { return "BYTEA".into(); }
    if lower.contains("json") { return "JSON".into(); }
    if lower.contains("char") || lower.contains("clob") || lower.contains("text") || lower.contains("varchar") {
        return "VARCHAR".into();
    }
    "TEXT".into()
}

fn map_sqlserver_type(t: &str) -> String {
    match t.to_lowercase().as_str() {
        "bigint" => "BIGINT",
        "int" => "INTEGER",
        "smallint" => "SMALLINT",
        "tinyint" | "bit" => "BOOLEAN",
        "decimal" | "numeric" | "money" | "smallmoney" => "DECIMAL",
        "float" => "DOUBLE",
        "real" => "FLOAT",
        "date" => "DATE",
        "time" => "TIME",
        "datetime" | "datetime2" | "smalldatetime" | "datetimeoffset" => "TIMESTAMP",
        "char" | "nchar" => "CHAR",
        "varchar" | "nvarchar" => "VARCHAR",
        "text" | "ntext" => "TEXT",
        "uniqueidentifier" => "UUID",
        "json" => "JSON",
        "binary" | "varbinary" | "image" | "rowversion" | "timestamp" => "BYTEA",
        _ => "TEXT",
    }
    .to_string()
}
fn table_colors() -> Vec<&'static str> {
    vec![
        "#3ECF8E", "#3B82F6", "#8B5CF6", "#F59E0B",
        "#EF4444", "#06B6D4", "#EC4899", "#10B981",
    ]
}

#[cfg(feature = "postgres")]
mod pg_impl {
    use super::*;
    use sqlx::{PgPool, Row};

    pub async fn test(args: &ConnectArgs) -> Result<TestResult, String> {
        match PgPool::connect(&args.pg_url()).await {
            Ok(_) => Ok(TestResult { ok: true, message: "Connected successfully".into() }),
            Err(e) => Ok(TestResult { ok: false, message: e.to_string() }),
        }
    }

    pub async fn import(args: &ConnectArgs, db_name: &str) -> Result<ImportedSchema, String> {
        let pool = PgPool::connect(&args.pg_url()).await.map_err(|e| e.to_string())?;
        let rows = sqlx::query(
            r#"
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            "#,
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

            let x = (i % 3) as f64 * 380.0 + 60.0;
            let y = (i / 3) as f64 * 320.0 + 60.0;
            tables.push(SchemaTable {
                id: table_id,
                name: table_name,
                comment: String::new(),
                columns,
                color: colors[i % colors.len()].to_string(),
                position: Position { x, y },
                group_id: None,
            });
        }

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
            "#,
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

#[cfg(feature = "sqlite")]
mod sqlite_impl {
    use super::*;
    use sqlx::{Row, SqlitePool};

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

        let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .fetch_all(&pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

        let colors = table_colors();
        let mut tables: Vec<SchemaTable> = Vec::new();
        let mut table_id_map: std::collections::HashMap<String, String> = Default::default();

        for (i, row) in rows.iter().enumerate() {
            let table_name: String = row.try_get("name").map_err(|e| e.to_string())?;
            let table_id = Uuid::new_v4().to_string();
            table_id_map.insert(table_name.clone(), table_id.clone());

            let pragma = sqlx::query(&format!("PRAGMA table_info(\"{}\")", table_name))
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?;

            let index_rows = sqlx::query(&format!("PRAGMA index_list(\"{}\")", table_name))
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?;
            let mut unique_columns: std::collections::HashSet<String> = Default::default();
            for index_row in index_rows {
                let is_unique: i64 = index_row.try_get("unique").unwrap_or(0);
                if is_unique == 0 {
                    continue;
                }
                let index_name: String = index_row.try_get("name").unwrap_or_default();
                let index_info = sqlx::query(&format!("PRAGMA index_info(\"{}\")", index_name))
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| e.to_string())?;
                if index_info.len() != 1 {
                    continue;
                }
                if let Some(column_name) = index_info[0].try_get::<Option<String>, _>("name").ok().flatten() {
                    unique_columns.insert(column_name);
                }
            }

            let mut columns: Vec<SchemaColumn> = Vec::new();
            for col_row in &pragma {
                let name: String = col_row.try_get("name").unwrap_or_default();
                let col_type: String = col_row.try_get("type").unwrap_or_default();
                let not_null: i64 = col_row.try_get("notnull").unwrap_or(0);
                let pk: i64 = col_row.try_get("pk").unwrap_or(0);
                let dflt: Option<String> = col_row.try_get("dflt_value").ok().flatten();

                columns.push(SchemaColumn {
                    id: Uuid::new_v4().to_string(),
                    name: name.clone(),
                    col_type: map_sqlite_type(&col_type),
                    nullable: not_null == 0,
                    primary_key: pk > 0,
                    unique: pk > 0 || unique_columns.contains(&name),
                    default_value: dflt.unwrap_or_default(),
                    comment: String::new(),
                });
            }

            let x = (i % 3) as f64 * 380.0 + 60.0;
            let y = (i / 3) as f64 * 320.0 + 60.0;
            tables.push(SchemaTable {
                id: table_id,
                name: table_name,
                comment: String::new(),
                columns,
                color: colors[i % colors.len()].to_string(),
                position: Position { x, y },
                group_id: None,
            });
        }

        let mut relations: Vec<SchemaRelation> = Vec::new();
        for table in &tables {
            let fk_rows = sqlx::query(&format!("PRAGMA foreign_key_list(\"{}\")", table.name))
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?;

            for fk_row in fk_rows {
                let source_column: String = fk_row.try_get("from").unwrap_or_default();
                let target_table: String = fk_row.try_get("table").unwrap_or_default();
                let target_column: String = fk_row.try_get("to").unwrap_or_default();

                let Some(target_table_id) = table_id_map.get(&target_table).cloned() else {
                    continue;
                };
                let Some(source_column_id) = table.columns.iter().find(|column| column.name == source_column).map(|column| column.id.clone()) else {
                    continue;
                };
                let Some(target_column_id) = tables
                    .iter()
                    .find(|candidate| candidate.id == target_table_id)
                    .and_then(|candidate| candidate.columns.iter().find(|column| column.name == target_column))
                    .map(|column| column.id.clone()) else {
                    continue;
                };

                relations.push(SchemaRelation {
                    id: Uuid::new_v4().to_string(),
                    source_table_id: table.id.clone(),
                    source_column_id,
                    target_table_id,
                    target_column_id,
                    rel_type: "one-to-many".into(),
                    label: String::new(),
                });
            }
        }

        Ok(ImportedSchema {
            id: Uuid::new_v4().to_string(),
            name: std::path::Path::new(path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("database")
                .to_string(),
            tables,
            relations,
            groups: vec![],
            created_at: now_iso(),
            updated_at: now_iso(),
        })
    }
}

#[cfg(feature = "mysql")]
mod mysql_impl {
    use super::*;
    use sqlx::{MySqlPool, Row};

    pub async fn test(args: &ConnectArgs) -> Result<TestResult, String> {
        match MySqlPool::connect(&args.mysql_url()).await {
            Ok(_) => Ok(TestResult { ok: true, message: "Connected successfully".into() }),
            Err(e) => Ok(TestResult { ok: false, message: e.to_string() }),
        }
    }

    pub async fn import(args: &ConnectArgs, db_name: &str) -> Result<ImportedSchema, String> {
        let pool = MySqlPool::connect(&args.mysql_url()).await.map_err(|e| e.to_string())?;
        let rows = sqlx::query(
            r#"
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ? AND table_type = 'BASE TABLE'
            ORDER BY table_name
            "#,
        )
        .bind(db_name)
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

            let column_rows = sqlx::query(
                r#"
                SELECT
                    c.column_name,
                    c.column_type,
                    c.is_nullable,
                    c.column_default,
                    c.column_key,
                    c.extra
                FROM information_schema.columns c
                WHERE c.table_schema = ? AND c.table_name = ?
                ORDER BY c.ordinal_position
                "#,
            )
            .bind(db_name)
            .bind(&table_name)
            .fetch_all(&pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

            let columns = column_rows
                .into_iter()
                .map(|column| {
                    let column_type: String = column.try_get("column_type").map_err(|e| e.to_string())?;
                    let column_key: String = column.try_get("column_key").unwrap_or_default();
                    let extra: String = column.try_get("extra").unwrap_or_default();
                    Ok(SchemaColumn {
                        id: Uuid::new_v4().to_string(),
                        name: column.try_get("column_name").map_err(|e| e.to_string())?,
                        col_type: map_mysql_type(&column_type),
                        nullable: column.try_get::<String, _>("is_nullable").map_err(|e| e.to_string())? == "YES",
                        primary_key: column_key == "PRI",
                        unique: column_key == "PRI" || column_key == "UNI",
                        default_value: column.try_get::<Option<String>, _>("column_default").unwrap_or_default().unwrap_or_else(|| {
                            if extra.contains("auto_increment") { "AUTO_INCREMENT".into() } else { String::new() }
                        }),
                        comment: String::new(),
                    })
                })
                .collect::<Result<Vec<_>, String>>()?;

            let x = (i % 3) as f64 * 380.0 + 60.0;
            let y = (i / 3) as f64 * 320.0 + 60.0;
            tables.push(SchemaTable {
                id: table_id,
                name: table_name,
                comment: String::new(),
                columns,
                color: colors[i % colors.len()].to_string(),
                position: Position { x, y },
                group_id: None,
            });
        }

        let fk_rows = sqlx::query(
            r#"
            SELECT
                kcu.table_name AS source_table,
                kcu.column_name AS source_column,
                kcu.referenced_table_name AS target_table,
                kcu.referenced_column_name AS target_column
            FROM information_schema.key_column_usage kcu
            WHERE kcu.table_schema = ?
              AND kcu.referenced_table_name IS NOT NULL
            ORDER BY kcu.table_name, kcu.ordinal_position
            "#,
        )
        .bind(db_name)
        .fetch_all(&pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

        let mut relations: Vec<SchemaRelation> = Vec::new();
        for fk in fk_rows {
            let source_table: String = fk.try_get("source_table").map_err(|e| e.to_string())?;
            let source_column: String = fk.try_get("source_column").map_err(|e| e.to_string())?;
            let target_table: String = fk.try_get("target_table").map_err(|e| e.to_string())?;
            let target_column: String = fk.try_get("target_column").map_err(|e| e.to_string())?;

            let Some(source_table_id) = table_id_map.get(&source_table).cloned() else {
                continue;
            };
            let Some(target_table_id) = table_id_map.get(&target_table).cloned() else {
                continue;
            };
            let Some(source_column_id) = tables
                .iter()
                .find(|table| table.id == source_table_id)
                .and_then(|table| table.columns.iter().find(|column| column.name == source_column))
                .map(|column| column.id.clone()) else {
                continue;
            };
            let Some(target_column_id) = tables
                .iter()
                .find(|table| table.id == target_table_id)
                .and_then(|table| table.columns.iter().find(|column| column.name == target_column))
                .map(|column| column.id.clone()) else {
                continue;
            };

            relations.push(SchemaRelation {
                id: Uuid::new_v4().to_string(),
                source_table_id,
                source_column_id,
                target_table_id,
                target_column_id,
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

#[cfg(feature = "sqlserver")]
mod sqlserver_impl {
    use super::*;
    use tiberius::{AuthMethod, Client, Config, EncryptionLevel, Row, SqlBrowser};
    use tokio::net::TcpStream;
    use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

    type SqlServerClient = Client<Compat<TcpStream>>;

    struct TableMeta {
        key: String,
        display_name: String,
        schema_name: String,
        table_name: String,
    }

    fn row_str(row: &Row, name: &str) -> String {
        row.get::<&str, _>(name).unwrap_or("").to_string()
    }

    fn row_i32(row: &Row, name: &str) -> i32 {
        row.get::<i32, _>(name).unwrap_or(0)
    }

    async fn connect(args: &ConnectArgs) -> Result<SqlServerClient, String> {
        let mut config = Config::new();
        config.host(args.host.as_deref().unwrap_or("localhost"));
        config.port(args.port.unwrap_or(1433));
        config.database(args.database.as_deref().unwrap_or("master"));
        config.authentication(AuthMethod::sql_server(
            args.username.as_deref().unwrap_or("sa").to_string(),
            args.password.as_deref().unwrap_or("").to_string(),
        ));
        config.trust_cert();
        config.encryption(if args.ssl.unwrap_or(false) {
            EncryptionLevel::Required
        } else {
            EncryptionLevel::Off
        });
        if let Some(instance) = args.instance.as_deref().filter(|value| !value.is_empty()) {
            config.instance_name(instance);
        }

        let tcp = TcpStream::connect_named(&config)
            .await
            .map_err(|e| e.to_string())?;
        tcp.set_nodelay(true).map_err(|e| e.to_string())?;
        Client::connect(config, tcp.compat_write())
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn test(args: &ConnectArgs) -> Result<TestResult, String> {
        let mut client = connect(args).await?;
        client
            .simple_query("SELECT 1")
            .await
            .map_err(|e| e.to_string())?
            .into_first_result()
            .await
            .map_err(|e| e.to_string())?;
        Ok(TestResult { ok: true, message: "Connected successfully".into() })
    }

    pub async fn import(args: &ConnectArgs, db_name: &str) -> Result<ImportedSchema, String> {
        let mut client = connect(args).await?;
        let table_rows = client
            .simple_query(
                r#"
                SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                  AND TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'sys')
                ORDER BY TABLE_SCHEMA, TABLE_NAME
                "#,
            )
            .await
            .map_err(|e| e.to_string())?
            .into_first_result()
            .await
            .map_err(|e| e.to_string())?;

        let metas = table_rows
            .iter()
            .map(|row| {
                let schema_name = row_str(row, "table_schema");
                let table_name = row_str(row, "table_name");
                let display_name = if schema_name == "dbo" {
                    table_name.clone()
                } else {
                    format!("{}.{}", schema_name, table_name)
                };
                TableMeta {
                    key: format!("{}.{}", schema_name, table_name),
                    display_name,
                    schema_name,
                    table_name,
                }
            })
            .collect::<Vec<_>>();

        let colors = table_colors();
        let mut tables: Vec<SchemaTable> = Vec::new();
        let mut table_id_map: std::collections::HashMap<String, String> = Default::default();

        for (i, meta) in metas.iter().enumerate() {
            let column_rows = client
                .query(
                    r#"
                    SELECT
                        c.COLUMN_NAME AS column_name,
                        c.DATA_TYPE AS data_type,
                        c.IS_NULLABLE AS is_nullable,
                        COALESCE(c.COLUMN_DEFAULT, '') AS column_default,
                        CAST(CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS int) AS is_pk,
                        CAST(CASE WHEN uq.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS int) AS is_unique
                    FROM INFORMATION_SCHEMA.COLUMNS c
                    LEFT JOIN (
                        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                         AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                    ) pk
                      ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
                     AND pk.TABLE_NAME = c.TABLE_NAME
                     AND pk.COLUMN_NAME = c.COLUMN_NAME
                    LEFT JOIN (
                        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                         AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                        WHERE tc.CONSTRAINT_TYPE = 'UNIQUE'
                    ) uq
                      ON uq.TABLE_SCHEMA = c.TABLE_SCHEMA
                     AND uq.TABLE_NAME = c.TABLE_NAME
                     AND uq.COLUMN_NAME = c.COLUMN_NAME
                    WHERE c.TABLE_SCHEMA = @P1 AND c.TABLE_NAME = @P2
                    ORDER BY c.ORDINAL_POSITION
                    "#,
                    &[&meta.schema_name.as_str(), &meta.table_name.as_str()],
                )
                .await
                .map_err(|e| e.to_string())?
                .into_first_result()
                .await
                .map_err(|e| e.to_string())?;

            let columns = column_rows
                .iter()
                .map(|column| SchemaColumn {
                    id: Uuid::new_v4().to_string(),
                    name: row_str(column, "column_name"),
                    col_type: map_sqlserver_type(&row_str(column, "data_type")),
                    nullable: row_str(column, "is_nullable") == "YES",
                    primary_key: row_i32(column, "is_pk") > 0,
                    unique: row_i32(column, "is_unique") > 0 || row_i32(column, "is_pk") > 0,
                    default_value: row_str(column, "column_default"),
                    comment: String::new(),
                })
                .collect::<Vec<_>>();

            let table_id = Uuid::new_v4().to_string();
            table_id_map.insert(meta.key.clone(), table_id.clone());
            let x = (i % 3) as f64 * 380.0 + 60.0;
            let y = (i / 3) as f64 * 320.0 + 60.0;
            tables.push(SchemaTable {
                id: table_id,
                name: meta.display_name.clone(),
                comment: String::new(),
                columns,
                color: colors[i % colors.len()].to_string(),
                position: Position { x, y },
                group_id: None,
            });
        }

        let fk_rows = client
            .simple_query(
                r#"
                SELECT
                    fk.TABLE_SCHEMA AS source_schema,
                    fk.TABLE_NAME AS source_table,
                    fkc.COLUMN_NAME AS source_col,
                    pk.TABLE_SCHEMA AS target_schema,
                    pk.TABLE_NAME AS target_table,
                    pkc.COLUMN_NAME AS target_col
                FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS fk
                  ON rc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME
                 AND rc.CONSTRAINT_SCHEMA = fk.TABLE_SCHEMA
                JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk
                  ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
                 AND rc.UNIQUE_CONSTRAINT_SCHEMA = pk.TABLE_SCHEMA
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE fkc
                  ON rc.CONSTRAINT_NAME = fkc.CONSTRAINT_NAME
                 AND rc.CONSTRAINT_SCHEMA = fkc.TABLE_SCHEMA
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pkc
                  ON rc.UNIQUE_CONSTRAINT_NAME = pkc.CONSTRAINT_NAME
                 AND rc.UNIQUE_CONSTRAINT_SCHEMA = pkc.TABLE_SCHEMA
                 AND fkc.ORDINAL_POSITION = pkc.ORDINAL_POSITION
                WHERE fk.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'sys')
                  AND pk.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'sys')
                ORDER BY fk.TABLE_SCHEMA, fk.TABLE_NAME, fkc.ORDINAL_POSITION
                "#,
            )
            .await
            .map_err(|e| e.to_string())?
            .into_first_result()
            .await
            .map_err(|e| e.to_string())?;

        let mut relations: Vec<SchemaRelation> = Vec::new();
        for fk in fk_rows {
            let source_key = format!("{}.{}", row_str(&fk, "source_schema"), row_str(&fk, "source_table"));
            let target_key = format!("{}.{}", row_str(&fk, "target_schema"), row_str(&fk, "target_table"));
            let source_column = row_str(&fk, "source_col");
            let target_column = row_str(&fk, "target_col");

            let Some(source_table_id) = table_id_map.get(&source_key).cloned() else {
                continue;
            };
            let Some(target_table_id) = table_id_map.get(&target_key).cloned() else {
                continue;
            };
            let Some(source_column_id) = tables
                .iter()
                .find(|table| table.id == source_table_id)
                .and_then(|table| table.columns.iter().find(|column| column.name == source_column))
                .map(|column| column.id.clone()) else {
                continue;
            };
            let Some(target_column_id) = tables
                .iter()
                .find(|table| table.id == target_table_id)
                .and_then(|table| table.columns.iter().find(|column| column.name == target_column))
                .map(|column| column.id.clone()) else {
                continue;
            };

            relations.push(SchemaRelation {
                id: Uuid::new_v4().to_string(),
                source_table_id,
                source_column_id,
                target_table_id,
                target_column_id,
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
#[tauri::command]
pub async fn db_test_connection(args: ConnectArgs) -> Result<TestResult, String> {
    match args.dialect.as_str() {
        #[cfg(feature = "postgres")]
        "postgresql" => pg_impl::test(&args).await,

        #[cfg(feature = "mysql")]
        "mysql" => mysql_impl::test(&args).await,

        #[cfg(feature = "sqlite")]
        "sqlite" => {
            let path = args.path.as_deref().unwrap_or("");
            sqlite_impl::test(path).await
        }

        #[cfg(feature = "sqlserver")]
        "sqlserver" => sqlserver_impl::test(&args).await,

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

        #[cfg(feature = "mysql")]
        "mysql" => {
            let db = args.database.clone().unwrap_or_default();
            if db.is_empty() {
                Err("Database name is required for MySQL schema import.".into())
            } else {
                mysql_impl::import(&args, &db).await
            }
        }

        #[cfg(feature = "sqlite")]
        "sqlite" => {
            let path = args.path.clone().unwrap_or_default();
            sqlite_impl::import(&path).await
        }

        #[cfg(feature = "sqlserver")]
        "sqlserver" => {
            let db = args.database.clone().unwrap_or_else(|| "master".into());
            sqlserver_impl::import(&args, &db).await
        },

        _ => Err(format!("Dialect '{}' not supported in this build.", args.dialect)),
    }
}


