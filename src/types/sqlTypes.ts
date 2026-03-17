import type { SQLDialect } from './index'

export type SqlTypeDialectFilter = SQLDialect | 'all'

export interface SqlTypeOption {
  value: string
  label: string
  group: string
  description: string
  dialects: SQLDialect[]
}

export const SQL_TYPE_OPTIONS: SqlTypeOption[] = [
  { value: 'SMALLINT', label: 'SMALLINT', group: 'Integer', description: 'Small whole numbers and compact lookup values.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'INTEGER', label: 'INTEGER', group: 'Integer', description: 'General-purpose whole numbers for IDs, counts, and status codes.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'BIGINT', label: 'BIGINT', group: 'Integer', description: 'Large whole numbers for event streams, ledgers, or high-volume IDs.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'SERIAL', label: 'SERIAL', group: 'Integer', description: 'PostgreSQL auto-incrementing integer columns.', dialects: ['postgresql'] },
  { value: 'BIGSERIAL', label: 'BIGSERIAL', group: 'Integer', description: 'PostgreSQL auto-incrementing big integer columns.', dialects: ['postgresql'] },
  { value: 'TINYINT', label: 'TINYINT', group: 'Integer', description: 'Very small integers often used for flags and compact status values.', dialects: ['mysql', 'sqlserver'] },
  { value: 'MEDIUMINT', label: 'MEDIUMINT', group: 'Integer', description: 'MySQL medium-range integer values.', dialects: ['mysql'] },
  { value: 'DECIMAL', label: 'DECIMAL', group: 'Numeric', description: 'Exact fixed-point values for money and precise calculations.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'NUMERIC', label: 'NUMERIC', group: 'Numeric', description: 'Exact precision numbers for financial or scientific data.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'REAL', label: 'REAL', group: 'Numeric', description: 'Floating-point values when approximate precision is acceptable.', dialects: ['postgresql', 'sqlite'] },
  { value: 'FLOAT', label: 'FLOAT', group: 'Numeric', description: 'Approximate floating-point numbers for measurements and telemetry.', dialects: ['postgresql', 'mysql', 'sqlserver'] },
  { value: 'DOUBLE', label: 'DOUBLE', group: 'Numeric', description: 'Higher-precision floating-point values for analytics and scientific data.', dialects: ['postgresql', 'mysql'] },
  { value: 'MONEY', label: 'MONEY', group: 'Numeric', description: 'PostgreSQL money values with locale-aware currency formatting.', dialects: ['postgresql'] },
  { value: 'BIT', label: 'BIT', group: 'Boolean / Bit', description: 'Single-bit flags or fixed-size bit fields.', dialects: ['mysql', 'sqlserver'] },
  { value: 'BOOLEAN', label: 'BOOLEAN', group: 'Boolean / Bit', description: 'True/false values for toggles, enabled flags, and states.', dialects: ['postgresql', 'mysql', 'sqlite'] },
  { value: 'CHAR', label: 'CHAR', group: 'Text', description: 'Fixed-length text such as ISO codes or padded legacy identifiers.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'VARCHAR', label: 'VARCHAR', group: 'Text', description: 'Variable-length text for names, emails, and short labels.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'TEXT', label: 'TEXT', group: 'Text', description: 'Long-form text for descriptions, content, and free-form notes.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'TINYTEXT', label: 'TINYTEXT', group: 'Text', description: 'MySQL short text blobs for compact free-form content.', dialects: ['mysql'] },
  { value: 'MEDIUMTEXT', label: 'MEDIUMTEXT', group: 'Text', description: 'MySQL medium-sized text content.', dialects: ['mysql'] },
  { value: 'LONGTEXT', label: 'LONGTEXT', group: 'Text', description: 'MySQL very large text content such as documents or logs.', dialects: ['mysql'] },
  { value: 'NCHAR', label: 'NCHAR', group: 'Text', description: 'SQL Server fixed-length Unicode text.', dialects: ['sqlserver'] },
  { value: 'NVARCHAR', label: 'NVARCHAR', group: 'Text', description: 'SQL Server variable-length Unicode text.', dialects: ['sqlserver'] },
  { value: 'DATE', label: 'DATE', group: 'Date / Time', description: 'Calendar dates without a time component.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'TIME', label: 'TIME', group: 'Date / Time', description: 'Clock time without a date component.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'TIMESTAMP', label: 'TIMESTAMP', group: 'Date / Time', description: 'Date and time values for events and audit fields.', dialects: ['postgresql', 'mysql', 'sqlite'] },
  { value: 'TIMESTAMPTZ', label: 'TIMESTAMPTZ', group: 'Date / Time', description: 'PostgreSQL timestamp with timezone awareness.', dialects: ['postgresql'] },
  { value: 'DATETIME', label: 'DATETIME', group: 'Date / Time', description: 'Date and time values in MySQL, SQLite, and SQL Server.', dialects: ['mysql', 'sqlite', 'sqlserver'] },
  { value: 'DATETIME2', label: 'DATETIME2', group: 'Date / Time', description: 'SQL Server high-precision date and time values.', dialects: ['sqlserver'] },
  { value: 'DATETIMEOFFSET', label: 'DATETIMEOFFSET', group: 'Date / Time', description: 'SQL Server date/time values with timezone offset.', dialects: ['sqlserver'] },
  { value: 'YEAR', label: 'YEAR', group: 'Date / Time', description: 'MySQL year-only values.', dialects: ['mysql'] },
  { value: 'UUID', label: 'UUID', group: 'Document / Binary', description: 'Universally unique identifiers for distributed IDs and records.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'UNIQUEIDENTIFIER', label: 'UNIQUEIDENTIFIER', group: 'Document / Binary', description: 'SQL Server GUID storage type.', dialects: ['sqlserver'] },
  { value: 'JSON', label: 'JSON', group: 'Document / Binary', description: 'Structured JSON documents and nested application payloads.', dialects: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] },
  { value: 'JSONB', label: 'JSONB', group: 'Document / Binary', description: 'PostgreSQL binary JSON optimized for indexing and querying.', dialects: ['postgresql'] },
  { value: 'XML', label: 'XML', group: 'Document / Binary', description: 'XML payloads or legacy integration documents.', dialects: ['postgresql', 'sqlserver'] },
  { value: 'BYTEA', label: 'BYTEA', group: 'Document / Binary', description: 'PostgreSQL binary data such as files or encrypted blobs.', dialects: ['postgresql'] },
  { value: 'BLOB', label: 'BLOB', group: 'Document / Binary', description: 'Binary large objects such as files, images, or archives.', dialects: ['mysql', 'sqlite'] },
  { value: 'VARBINARY(MAX)', label: 'VARBINARY(MAX)', group: 'Document / Binary', description: 'SQL Server binary large objects.', dialects: ['sqlserver'] },
  { value: 'ARRAY', label: 'ARRAY', group: 'Collection', description: 'Legacy generic array type. Prefer a concrete array type such as TEXT[] or UUID[].', dialects: ['postgresql'] },
  { value: 'INTEGER[]', label: 'INTEGER[]', group: 'Collection', description: 'PostgreSQL arrays of integers for small ordered numeric lists.', dialects: ['postgresql'] },
  { value: 'TEXT[]', label: 'TEXT[]', group: 'Collection', description: 'PostgreSQL arrays of text for tags, labels, and short string lists.', dialects: ['postgresql'] },
  { value: 'UUID[]', label: 'UUID[]', group: 'Collection', description: 'PostgreSQL arrays of UUIDs for related-ID lists.', dialects: ['postgresql'] },
  { value: 'BOOLEAN[]', label: 'BOOLEAN[]', group: 'Collection', description: 'PostgreSQL arrays of booleans for compact flag sets.', dialects: ['postgresql'] },
  { value: 'ENUM', label: 'ENUM', group: 'Collection', description: 'Controlled string values chosen from a fixed list.', dialects: ['mysql', 'postgresql'] },
  { value: 'SET', label: 'SET', group: 'Collection', description: 'MySQL multi-select enumerated values.', dialects: ['mysql'] },
  { value: 'INET', label: 'INET', group: 'Specialized', description: 'PostgreSQL IP address values.', dialects: ['postgresql'] },
  { value: 'CIDR', label: 'CIDR', group: 'Specialized', description: 'PostgreSQL network ranges and CIDR blocks.', dialects: ['postgresql'] },
  { value: 'TSVECTOR', label: 'TSVECTOR', group: 'Specialized', description: 'PostgreSQL full-text search documents.', dialects: ['postgresql'] },
  { value: 'TSQUERY', label: 'TSQUERY', group: 'Specialized', description: 'PostgreSQL full-text search queries.', dialects: ['postgresql'] },
]

export function getSqlTypeDescription(type: string): string {
  return SQL_TYPE_OPTIONS.find(option => option.value === type)?.description
    ?? 'Custom SQL type. It will be emitted as entered during export.'
}

export function getSqlTypeGroups(filter: SqlTypeDialectFilter): { label: string; types: SqlTypeOption[] }[] {
  const filtered = filter === 'all'
    ? SQL_TYPE_OPTIONS
    : SQL_TYPE_OPTIONS.filter(option => option.dialects.includes(filter))

  const grouped = new Map<string, SqlTypeOption[]>()
  for (const option of filtered) {
    if (!grouped.has(option.group)) grouped.set(option.group, [])
    grouped.get(option.group)!.push(option)
  }

  return [...grouped.entries()].map(([label, types]) => ({ label, types }))
}

export function normalizeSqlType(type: string, dialect: SQLDialect): string {
  const raw = type.trim()
  if (!raw) return 'TEXT'

  if (raw === 'ARRAY') {
    if (dialect === 'postgresql') return 'TEXT[]'
    if (dialect === 'sqlserver') return 'NVARCHAR(MAX)'
    if (dialect === 'mysql') return 'JSON'
    return 'TEXT'
  }

  if (raw.endsWith('[]')) {
    if (dialect === 'postgresql') return raw
    if (dialect === 'sqlserver') return 'NVARCHAR(MAX)'
    if (dialect === 'mysql') return 'JSON'
    return 'TEXT'
  }

  const normalized = raw.toUpperCase()
  const option = SQL_TYPE_OPTIONS.find(candidate => candidate.value === normalized)
  const genericByDialect: Record<string, Partial<Record<SQLDialect, string>>> = {
    BOOLEAN: { sqlite: 'INTEGER', sqlserver: 'BIT' },
    DOUBLE: { postgresql: 'DOUBLE PRECISION', sqlite: 'REAL', sqlserver: 'FLOAT' },
    FLOAT: { sqlite: 'REAL' },
    UUID: { mysql: 'CHAR(36)', sqlite: 'TEXT', sqlserver: 'UNIQUEIDENTIFIER' },
    'CHAR(36)': { postgresql: 'UUID', mysql: 'CHAR(36)', sqlite: 'TEXT', sqlserver: 'UNIQUEIDENTIFIER' },
    UNIQUEIDENTIFIER: { postgresql: 'UUID', mysql: 'CHAR(36)', sqlite: 'TEXT' },
    JSONB: { mysql: 'JSON', sqlite: 'TEXT', sqlserver: 'NVARCHAR(MAX)' },
    JSON: { sqlite: 'TEXT', sqlserver: 'NVARCHAR(MAX)' },
    BYTEA: { mysql: 'BLOB', sqlite: 'BLOB', sqlserver: 'VARBINARY(MAX)' },
    BLOB: { postgresql: 'BYTEA', sqlserver: 'VARBINARY(MAX)' },
    'VARBINARY(MAX)': { postgresql: 'BYTEA', mysql: 'BLOB', sqlite: 'BLOB' },
    TIMESTAMPTZ: { mysql: 'DATETIME', sqlite: 'TEXT', sqlserver: 'DATETIMEOFFSET' },
    DATETIME: { postgresql: 'TIMESTAMP', sqlite: 'TEXT', sqlserver: 'DATETIME2' },
    TIMESTAMP: { sqlserver: 'DATETIME2' },
    DATETIMEOFFSET: { postgresql: 'TIMESTAMPTZ', mysql: 'DATETIME', sqlite: 'TEXT' },
    DATETIME2: { postgresql: 'TIMESTAMP', mysql: 'DATETIME', sqlite: 'TEXT' },
    SERIAL: { mysql: 'INT AUTO_INCREMENT', sqlite: 'INTEGER', sqlserver: 'INT IDENTITY(1,1)' },
    BIGSERIAL: { mysql: 'BIGINT AUTO_INCREMENT', sqlite: 'INTEGER', sqlserver: 'BIGINT IDENTITY(1,1)' },
    MONEY: { mysql: 'DECIMAL', sqlite: 'NUMERIC', sqlserver: 'DECIMAL' },
    ENUM: { sqlite: 'VARCHAR', sqlserver: 'VARCHAR' },
    SET: { postgresql: 'VARCHAR', sqlite: 'VARCHAR', sqlserver: 'VARCHAR' },
    XML: { mysql: 'TEXT', sqlite: 'TEXT' },
    INET: { mysql: 'VARCHAR', sqlite: 'TEXT', sqlserver: 'VARCHAR' },
    CIDR: { mysql: 'VARCHAR', sqlite: 'TEXT', sqlserver: 'VARCHAR' },
    TSVECTOR: { mysql: 'TEXT', sqlite: 'TEXT', sqlserver: 'TEXT' },
    TSQUERY: { mysql: 'TEXT', sqlite: 'TEXT', sqlserver: 'TEXT' },
    YEAR: { postgresql: 'INTEGER', sqlite: 'INTEGER', sqlserver: 'INTEGER' },
    NCHAR: { postgresql: 'CHAR', mysql: 'CHAR', sqlite: 'CHAR' },
    NVARCHAR: { postgresql: 'VARCHAR', mysql: 'VARCHAR', sqlite: 'TEXT' },
  }

  if (genericByDialect[normalized]?.[dialect]) {
    return genericByDialect[normalized]![dialect]!
  }

  if (option && !option.dialects.includes(dialect)) {
    const canonical = canonicalSqlType(normalized)
    if (genericByDialect[canonical]?.[dialect]) {
      return genericByDialect[canonical]![dialect]!
    }
    if (option.group === 'Text' || option.group === 'Specialized') return dialect === 'sqlite' ? 'TEXT' : 'VARCHAR'
    if (option.group === 'Numeric') return 'NUMERIC'
    if (option.group === 'Document / Binary') return dialect === 'sqlserver' ? 'NVARCHAR(MAX)' : 'TEXT'
    if (option.group === 'Collection') return dialect === 'mysql' ? 'JSON' : dialect === 'sqlserver' ? 'NVARCHAR(MAX)' : 'TEXT'
  }

  return raw
}

export function canonicalSqlType(type: string): string {
  const upper = type.trim().toUpperCase()
  if (!upper) return 'TEXT'

  const arraySuffix = upper.endsWith('[]') ? '[]' : ''
  const base = (arraySuffix ? upper.slice(0, -2) : upper)
    .replace(/\(.*\)/, '')
    .trim()

  const aliases: Record<string, string> = {
    INT: 'INTEGER',
    INT4: 'INTEGER',
    INT8: 'BIGINT',
    BOOL: 'BOOLEAN',
    'CHARACTER VARYING': 'VARCHAR',
    'DOUBLE PRECISION': 'DOUBLE',
    UNIQUEIDENTIFIER: 'UUID',
    DATETIME2: 'TIMESTAMP',
    DATETIMEOFFSET: 'TIMESTAMPTZ',
    NVARCHAR: 'VARCHAR',
    NCHAR: 'CHAR',
    VARBINARY: 'BYTEA',
  }

  return `${aliases[base] ?? base}${arraySuffix}`
}

export function areSqlTypesCompatible(left: string, right: string): boolean {
  const a = canonicalSqlType(left)
  const b = canonicalSqlType(right)
  if (a === b) return true

  const compatibleGroups = [
    new Set(['INTEGER', 'SMALLINT', 'BIGINT', 'SERIAL', 'BIGSERIAL', 'TINYINT', 'MEDIUMINT']),
    new Set(['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL', 'MONEY']),
    new Set(['VARCHAR', 'TEXT', 'CHAR', 'NCHAR', 'NVARCHAR']),
    new Set(['UUID']),
    new Set(['DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'DATETIME']),
    new Set(['JSON', 'JSONB']),
    new Set(['BYTEA', 'BLOB', 'VARBINARY']),
  ]

  return compatibleGroups.some(group => group.has(a) && group.has(b))
}
