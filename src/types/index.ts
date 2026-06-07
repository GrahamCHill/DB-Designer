export type ColumnType = string
export type TableKind = 'table' | 'resource'
export type ResourceNodeType =
  | 'blob-storage'
  | 'nosql-database'
  | 'cache'
  | 'message-queue'
  | 'data-export'
  | 'external-service'

export interface Column {
  id: string
  name: string
  type: ColumnType
  dialectTypes?: Partial<Record<SQLDialect, ColumnType>>
  nullable: boolean
  primaryKey: boolean
  unique: boolean
  immutable: boolean
  defaultValue: string
  comment: string
}

export interface Table {
  id: string
  kind?: TableKind
  resourceType?: ResourceNodeType | null
  name: string
  comment: string
  columns: Column[]
  color: string
  position: { x: number; y: number }
  groupId: string | null
  groupLocked: boolean
  immutable: boolean
  width: number            // px, defaults to TABLE_WIDTH   // when true, groupId cannot be changed by geometry or drag
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
  waypoints?: { x: number; y: number }[]
}

export interface TableGroup {
  id: string
  name: string
  color: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  parentGroupId: string | null  // for nested groups
}

export interface CommentBox {
  id: string
  text: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  color: string
}

export type BridgeTableUseCase =
  | 'generic'
  | 'membership'
  | 'line-items'
  | 'enrollment'
  | 'assignment'
  | 'vector-rag'
  | 'audit-trail'

export interface BridgeTableOptions {
  useCase: BridgeTableUseCase
  tableName?: string
  notes?: string
}

export interface Schema {
  id: string
  name: string
  dialect: SQLDialect
  tables: Table[]
  relations: Relation[]
  groups: TableGroup[]
  comments: CommentBox[]
  createdAt: string
  updatedAt: string
}

export type SQLDialect = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver'

// Layout constants — single source of truth used by canvas SVG math
export const TABLE_WIDTH = 320
export const TABLE_HEADER_H = 44      // header block height
export const TABLE_COL_PAD_TOP = 4    // padding-top on .columns-list
export const TABLE_ROW_H = 34         // height of each .column-row
