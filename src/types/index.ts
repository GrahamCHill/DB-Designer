export type ColumnType =
  | 'INTEGER' | 'BIGINT' | 'SMALLINT' | 'SERIAL' | 'BIGSERIAL'
  | 'VARCHAR' | 'TEXT' | 'CHAR'
  | 'BOOLEAN'
  | 'FLOAT' | 'DOUBLE' | 'DECIMAL' | 'NUMERIC'
  | 'DATE' | 'TIME' | 'TIMESTAMP' | 'TIMESTAMPTZ'
  | 'UUID' | 'JSON' | 'JSONB'
  | 'BYTEA' | 'ARRAY'

export interface Column {
  id: string
  name: string
  type: ColumnType
  nullable: boolean
  primaryKey: boolean
  unique: boolean
  defaultValue: string
  comment: string
}

export interface Table {
  id: string
  name: string
  comment: string
  columns: Column[]
  color: string
  position: { x: number; y: number }
}

export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many'

export interface Relation {
  id: string
  sourceTableId: string
  sourceColumnId: string
  targetTableId: string
  targetColumnId: string
  type: RelationType
  label: string
}

export interface Schema {
  id: string
  name: string
  tables: Table[]
  relations: Relation[]
  createdAt: string
  updatedAt: string
}

export type SQLDialect = 'postgresql' | 'mysql' | 'sqlite'
