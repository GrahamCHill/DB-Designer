<template>
  <div class="cg-root">

    <!-- Left sidebar: options -->
    <aside class="cg-sidebar">
      <div class="cg-options">
        <div class="cg-brand">
          <span class="cg-brand-icon">&lt;/&gt;</span>
          <span class="cg-brand-name">ERD to Code</span>
        </div>

        <!-- Schema source -->
        <div class="cg-section">
          <div class="cg-label">Schema Source</div>
          <div class="schema-state">
            <span v-if="schemaName" class="schema-loaded">Loaded: {{ schemaName }}</span>
            <span v-else class="schema-none">No schema loaded</span>
          </div>
          <label class="btn-load">
            Load .dbm.json
            <input type="file" accept=".json" style="display:none" @change="loadSchema" />
          </label>
          <button v-if="dbStore.schema.tables.length && !externalSchema" class="btn-use-current" @click="useCurrentSchema">
            Use current DB schema
          </button>
        </div>

        <!-- Language tabs -->
        <div class="cg-section">
          <div class="cg-label">Language</div>
          <div class="lang-tabs">
            <button v-for="lang in languages" :key="lang.id"
              class="lang-tab" :class="{ active: activeLang === lang.id }"
              @click="activeLang = lang.id">
              <span class="lang-icon">{{ lang.icon }}</span>
              {{ lang.label }}
            </button>
          </div>
        </div>

        <!-- TypeScript options -->
        <div class="cg-section" v-if="activeLang === 'typescript'">
          <div class="cg-label">TS Options</div>
          <label class="opt-row"><input type="checkbox" v-model="tsOpts.interfaces" /> Interfaces</label>
          <label class="opt-row"><input type="checkbox" v-model="tsOpts.classes" /> Classes</label>
          <label class="opt-row"><input type="checkbox" v-model="tsOpts.optionalNulls" /> Nullable as optional (?)</label>
          <label class="opt-row"><input type="checkbox" v-model="tsOpts.zodSchemas" /> Zod schemas</label>
        </div>

        <!-- Rust options -->
        <div class="cg-section" v-if="activeLang === 'rust'">
          <div class="cg-label">Rust Options</div>
          <div class="opt-info">Uses Serde + Chrono</div>
        </div>

        <!-- Go options -->
        <div class="cg-section" v-if="activeLang === 'go'">
          <div class="cg-label">Go Options</div>
          <label class="opt-row"><input type="checkbox" v-model="goOpts.jsonTags" /> json tags</label>
          <label class="opt-row"><input type="checkbox" v-model="goOpts.dbTags" /> db tags</label>
          <label class="opt-row"><input type="checkbox" v-model="goOpts.pointer" /> Nullable as *Type</label>
          <div class="opt-row">
            <span>Package</span>
            <input class="pkg-input" v-model="goOpts.pkg" placeholder="models" />
          </div>
        </div>

        <!-- Python options -->
        <div class="cg-section" v-if="activeLang === 'python'">
          <div class="cg-label">Python Options</div>
          <label class="opt-row"><input type="checkbox" v-model="pyOpts.dataclass" /> dataclass</label>
          <label class="opt-row"><input type="checkbox" v-model="pyOpts.pydantic" /> Pydantic BaseModel</label>
          <label class="opt-row"><input type="checkbox" v-model="pyOpts.sqlalchemy" /> SQLAlchemy ORM</label>
          <label class="opt-row"><input type="checkbox" v-model="pyOpts.optionalNulls" /> Nullable as Optional[T]</label>
        </div>

        <!-- Table selector -->
        <div class="cg-section cg-flex">
          <div class="cg-label-row">
            <span class="cg-label">Tables</span>
            <div class="cg-label-actions">
              <button class="btn-tiny" @click="selectAll">All</button>
              <button class="btn-tiny" @click="selectNone">None</button>
            </div>
          </div>
          <div class="table-list">
            <label v-for="t in activeTables" :key="t.id" class="tbl-row">
              <input type="checkbox" :checked="selectedTables.has(t.id)" @change="toggleTable(t.id)" />
              <span class="tbl-dot" :style="{ background: t.color }"/>
              <span class="tbl-name">{{ t.name }}</span>
              <span class="tbl-cnt">{{ t.columns.length }}c</span>
            </label>
            <div v-if="!activeTables.length" class="tbl-empty">Load a schema first</div>
          </div>
        </div>

        <div v-if="exportResources.length" class="cg-section">
          <div class="cg-label">Data Export</div>
          <select v-model="selectedExportResourceId" class="export-select">
            <option value="">No export resource selected</option>
            <option v-for="resource in exportResources" :key="resource.id" :value="resource.id">
              {{ resource.name }}
            </option>
          </select>

          <div v-if="selectedExportResource" class="export-config">
            <div class="export-hint">Connected tables found by walking backward through incoming relations.</div>
            <div class="export-table-list">
              <div v-for="table in exportCandidateTables" :key="table.id" class="export-table-card">
                <label class="tbl-row export-row">
                  <input
                    type="checkbox"
                    :checked="selectedExportTableIds.has(table.id)"
                    @change="toggleExportTable(table.id)"
                  />
                  <span class="tbl-dot" :style="{ background: table.color }"/>
                  <span class="tbl-name">{{ table.name }}</span>
                  <span class="tbl-cnt">{{ selectedExportColumnCount(table.id) }}/{{ table.columns.length }}</span>
                </label>
                <div v-if="selectedExportTableIds.has(table.id)" class="export-columns">
                  <label v-for="column in table.columns" :key="column.id" class="export-col-row">
                    <input
                      type="checkbox"
                      :checked="isExportColumnSelected(table.id, column.id)"
                      @change="toggleExportColumn(table.id, column.id)"
                    />
                    <span>{{ column.name }}</span>
                    <span class="export-col-type">{{ column.type }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="cg-footer">
          <span class="cg-footer-autosave">auto-saved</span>
          <span class="cg-footer-version">{{ appVersionLabel }}</span>
        </div>
      </div>
    </aside>

    <!-- Right: code preview -->
    <div class="cg-preview">
      <div class="preview-toolbar">
        <div class="preview-tabs">
          <button v-for="t in previewTabs" :key="t"
            class="preview-tab" :class="{ active: previewTab === t }"
            @click="previewTab = t">
            {{ t }}
          </button>
        </div>
        <span class="preview-lang-badge">{{ activeLangLabel }}</span>
      </div>
      <div class="preview-body">
        <pre class="code-block"><code :class="`lang-${activeLang}`">{{ currentCode }}</code></pre>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { saveExportFile } from '../../composables/useFileExport'
import { useSchemaStore }    from '../../stores/schema'
import type { Relation, ResourceNodeType, Schema, Table } from '../../types'

const dbStore = useSchemaStore()
const appVersion = (import.meta.env.VITE_APP_VERSION || '').trim()
const appVersionLabel = appVersion ? `v${appVersion}` : 'dev'
type CodegenLanguage = 'typescript' | 'go' | 'rust' | 'python' | 'java' | 'kotlin' | 'csharp' | 'cpp'

const languages: { id: CodegenLanguage; label: string; icon: string }[] = [
  { id: 'typescript', label: 'TypeScript', icon: 'TS' },
  { id: 'go',         label: 'Go',         icon: 'Go' },
  { id: 'rust',       label: 'Rust',       icon: 'Rs' },
  { id: 'python',     label: 'Python',     icon: 'Py' },
  { id: 'java',       label: 'Java',       icon: 'Ja' },
  { id: 'kotlin',     label: 'Kotlin',     icon: 'Kt' },
  { id: 'csharp',     label: 'C#',         icon: 'C#' },
  { id: 'cpp',        label: 'C++',        icon: 'C+' },
]

const activeLang  = ref<CodegenLanguage>('typescript')
const activeLangLabel = computed(() => languages.find(l => l.id === activeLang.value)?.label ?? '')
const tsOpts = reactive({ interfaces: true, classes: false, optionalNulls: true, zodSchemas: false })
const goOpts = reactive({ jsonTags: true, dbTags: true, pointer: true, pkg: 'models' })
const pyOpts = reactive({ dataclass: false, pydantic: true, sqlalchemy: false, optionalNulls: true })
interface SchemaColumn {
  id: string
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  unique: boolean
}
interface SchemaTable  {
  id: string
  name: string
  color: string
  columns: SchemaColumn[]
}
interface SchemaResource {
  id: string
  name: string
  color: string
  resourceType: ResourceNodeType | null
}
interface SchemaModel {
  name: string
  tables: SchemaTable[]
  resources: SchemaResource[]
  relations: Relation[]
}

const externalSchema = ref<SchemaModel | null>(null)
const schemaName     = ref('')

function normalizeTable(table: Table): SchemaTable {
  return {
    id: table.id,
    name: table.name,
    color: table.color,
    columns: table.columns.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type ?? 'text',
      nullable: c.nullable ?? true,
      primaryKey: c.primaryKey ?? false,
      unique: c.unique ?? false,
    })),
  }
}

function normalizeResource(table: Table): SchemaResource {
  return {
    id: table.id,
    name: table.name,
    color: table.color ?? '#22C55E',
    resourceType: table.resourceType ?? 'external-service',
  }
}

function schemaToModel(schema: Schema): SchemaModel {
  return {
    name: schema.name ?? 'Schema',
    tables: (schema.tables ?? [])
      .filter(table => (table.kind ?? 'table') === 'table')
      .map(normalizeTable),
    resources: (schema.tables ?? [])
      .filter(table => (table.kind ?? 'table') === 'resource')
      .map(normalizeResource),
    relations: (schema.relations ?? []).map(relation => ({ ...relation })),
  }
}

function useCurrentSchema() {
  externalSchema.value = null
  schemaName.value = dbStore.schema.name || 'Current Schema'
}

function loadSchema(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const raw  = JSON.parse(ev.target?.result as string)
      const schema = raw.tables ? raw : raw.schema ?? raw
      externalSchema.value = schemaToModel(schema as Schema)
      schemaName.value = schema.name ?? file.name
    } catch { alert('Could not parse schema file') }
  }
  reader.readAsText(file)
}

const schemaModel = computed<SchemaModel>(() =>
  externalSchema.value ?? schemaToModel(dbStore.schema)
)
const activeTables = computed<SchemaTable[]>(() => schemaModel.value.tables)
const exportResources = computed(() =>
  schemaModel.value.resources.filter(resource => resource.resourceType === 'data-export')
)
const selectedExportResourceId = ref('')
const selectedTables = ref<Set<string>>(new Set())
const selectedExportTableIds = ref<Set<string>>(new Set())
const selectedExportColumnIds = ref<Record<string, Set<string>>>({})

watch(activeTables, (tables) => {
  selectedTables.value = new Set(tables.map(t => t.id))
}, { immediate: true })

watch(exportResources, (resources) => {
  if (!resources.some(resource => resource.id === selectedExportResourceId.value)) {
    selectedExportResourceId.value = resources[0]?.id ?? ''
  }
}, { immediate: true })

const selectedExportResource = computed(() =>
  exportResources.value.find(resource => resource.id === selectedExportResourceId.value) ?? null
)

const exportCandidateTables = computed(() => {
  const resource = selectedExportResource.value
  if (!resource) return []

  const tableById = new Map(activeTables.value.map(table => [table.id, table]))
  const visited = new Set<string>()
  const queue = schemaModel.value.relations
    .filter(relation => relation.targetTableId === resource.id)
    .map(relation => relation.sourceTableId)
    .filter(tableId => tableById.has(tableId))
  const ordered: SchemaTable[] = []

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)
    const table = tableById.get(currentId)
    if (!table) continue
    ordered.push(table)
    for (const relation of schemaModel.value.relations) {
      if (relation.targetTableId === currentId && tableById.has(relation.sourceTableId)) {
        queue.push(relation.sourceTableId)
      }
    }
  }

  return ordered
})

watch(exportCandidateTables, (tables) => {
  const nextTableIds = new Set(tables.map(table => table.id))
  selectedExportTableIds.value = nextTableIds
  selectedExportColumnIds.value = Object.fromEntries(
    tables.map(table => [table.id, new Set(table.columns.map(column => column.id))]),
  )
}, { immediate: true })

function toggleTable(tableId: string) {
  const s = new Set(selectedTables.value)
  s.has(tableId) ? s.delete(tableId) : s.add(tableId)
  selectedTables.value = s
}
function selectAll()  { selectedTables.value = new Set(activeTables.value.map(t => t.id)) }
function selectNone() { selectedTables.value = new Set() }

const filteredTables = computed(() =>
  activeTables.value.filter(t => selectedTables.value.has(t.id))
)
const exportPreviewTab = computed(() =>
  selectedExportResource.value ? `export:${selectedExportResource.value.name}` : ''
)
const previewTabs = computed(() => {
  const tabs = filteredTables.value.map(t => t.name)
  if (exportPreviewTab.value) tabs.push(exportPreviewTab.value)
  return tabs
})
const previewTab  = ref('')

watch(previewTabs, (tabs) => {
  if (!tabs.includes(previewTab.value)) previewTab.value = tabs[0] ?? ''
}, { immediate: true })

function toggleExportTable(tableId: string) {
  const next = new Set(selectedExportTableIds.value)
  if (next.has(tableId)) next.delete(tableId)
  else next.add(tableId)
  selectedExportTableIds.value = next
}

function isExportColumnSelected(tableId: string, columnId: string) {
  return selectedExportColumnIds.value[tableId]?.has(columnId) ?? false
}

function toggleExportColumn(tableId: string, columnId: string) {
  const next = { ...selectedExportColumnIds.value }
  const current = new Set(next[tableId] ?? [])
  if (current.has(columnId)) current.delete(columnId)
  else current.add(columnId)
  next[tableId] = current
  selectedExportColumnIds.value = next
}

function selectedExportColumnCount(tableId: string) {
  return selectedExportColumnIds.value[tableId]?.size ?? 0
}

const selectedExportTables = computed(() =>
  exportCandidateTables.value
    .filter(table => selectedExportTableIds.value.has(table.id))
    .map(table => ({
      ...table,
      columns: table.columns.filter(column => isExportColumnSelected(table.id, column.id)),
    }))
    .filter(table => table.columns.length > 0)
)
function tsType(col: SchemaColumn): string {
  const t = (col.type ?? '').toLowerCase()
  let base =
    t.includes('int') || t.includes('serial') || t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric') || t.includes('real') ? 'number'
    : t.includes('bool') ? 'boolean'
    : t.includes('json') ? 'Record<string, unknown>'
    : t.includes('date') || t.includes('time') || t.includes('timestamp') ? 'Date'
    : 'string'
  if (col.nullable && tsOpts.optionalNulls) base += ' | null'
  return base
}

function goType(col: SchemaColumn): string {
  const t = (col.type ?? '').toLowerCase()
  let base =
    t.includes('bigint') || t.includes('bigserial') ? 'int64'
    : t.includes('int') || t.includes('serial') ? 'int32'
    : t.includes('float') || t.includes('double') || t.includes('real') ? 'float64'
    : t.includes('decimal') || t.includes('numeric') ? 'float64'
    : t.includes('bool') ? 'bool'
    : t.includes('json') ? 'json.RawMessage'
    : t.includes('date') || t.includes('time') || t.includes('timestamp') ? 'time.Time'
    : 'string'
  if (col.nullable && goOpts.pointer) return `*${base}`
  return base
}

function pyType(col: SchemaColumn): string {
  const t = (col.type ?? '').toLowerCase()
  let base =
    t.includes('int') || t.includes('serial') ? 'int'
    : t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric') || t.includes('real') ? 'float'
    : t.includes('bool') ? 'bool'
    : t.includes('json') ? 'dict'
    : t.includes('date') ? 'date'
    : t.includes('time') || t.includes('timestamp') ? 'datetime'
    : 'str'
  if (col.nullable && pyOpts.optionalNulls) return `Optional[${base}]`
  return base
}

function rustType(col: SchemaColumn): string {
  const t = (col.type ?? '').toLowerCase()
  let base =
    t.includes('bigint') || t.includes('bigserial') ? 'i64'
    : t.includes('int') || t.includes('serial') ? 'i32'
    : t.includes('float') || t.includes('double') || t.includes('real') ? 'f64'
    : t.includes('decimal') || t.includes('numeric') ? 'f64'
    : t.includes('bool') ? 'bool'
    : t.includes('json') ? 'serde_json::Value'
    : t.includes('date') || t.includes('time') || t.includes('timestamp') ? 'chrono::NaiveDateTime'
    : 'String'
  if (col.nullable) return `Option<${base}>`
  return base
}

function javaType(col: SchemaColumn): string {
  const t = (col.type ?? '').toLowerCase()
  if (col.nullable) {
    return t.includes('bigint') || t.includes('bigserial') ? 'Long'
      : t.includes('int') || t.includes('serial') ? 'Integer'
      : t.includes('float') || t.includes('real') ? 'Float'
      : t.includes('double') || t.includes('decimal') || t.includes('numeric') ? 'Double'
      : t.includes('bool') ? 'Boolean'
      : t.includes('date') || t.includes('time') || t.includes('timestamp') ? 'LocalDateTime'
      : 'String'
  }
  return t.includes('bigint') || t.includes('bigserial') ? 'long'
    : t.includes('int') || t.includes('serial') ? 'int'
    : t.includes('float') || t.includes('real') ? 'float'
    : t.includes('double') || t.includes('decimal') || t.includes('numeric') ? 'double'
    : t.includes('bool') ? 'boolean'
    : t.includes('date') || t.includes('time') || t.includes('timestamp') ? 'LocalDateTime'
    : 'String'
}

function csType(col: SchemaColumn): string {
  const t = (col.type ?? '').toLowerCase()
  let base =
    t.includes('bigint') || t.includes('bigserial') ? 'long'
    : t.includes('int') || t.includes('serial') ? 'int'
    : t.includes('float') || t.includes('real') ? 'float'
    : t.includes('double') || t.includes('decimal') || t.includes('numeric') ? 'double'
    : t.includes('bool') ? 'bool'
    : t.includes('date') || t.includes('time') || t.includes('timestamp') ? 'DateTime'
    : 'string'
  if (col.nullable && base !== 'string') return `${base}?`
  return base
}

function cppType(col: SchemaColumn): string {
  const t = (col.type ?? '').toLowerCase()
  return t.includes('bigint') || t.includes('bigserial') ? 'long long'
    : t.includes('int') || t.includes('serial') ? 'int'
    : t.includes('float') || t.includes('real') ? 'float'
    : t.includes('double') || t.includes('decimal') || t.includes('numeric') ? 'double'
    : t.includes('bool') ? 'bool'
    : 'std::string'
}
function genTypeScript(tables: SchemaTable[]): string {
  const chunks: string[] = []

  if (tsOpts.zodSchemas) chunks.push(`import { z } from 'zod'\n`)

  for (const table of tables) {
    const typeName = toPascal(table.name)

    if (tsOpts.interfaces) {
      chunks.push(`export interface ${typeName} {`)
      for (const col of table.columns) {
        const optional = col.nullable && tsOpts.optionalNulls ? '?' : ''
        const type = tsType(col)
        const comment = [col.primaryKey && '@pk', col.unique && '@unique'].filter(Boolean).join(' ')
        chunks.push(`  ${col.name}${optional}: ${type}${comment ? `  // ${comment}` : ''}`)
      }
      chunks.push('}\n')
    }

    if (tsOpts.classes) {
      chunks.push(`export class ${typeName}Model {`)
      for (const col of table.columns) {
        const optional = col.nullable ? '?' : '!'
        chunks.push(`  ${col.name}${optional}: ${tsType(col)}`)
      }
      chunks.push('')
      chunks.push(`  constructor(data: Partial<${typeName}>) {`)
      for (const col of table.columns) {
        chunks.push(`    if (data.${col.name} !== undefined) this.${col.name} = data.${col.name}`)
      }
      chunks.push('  }')
      chunks.push('}\n')
    }

    if (tsOpts.zodSchemas) {
      chunks.push(`export const ${toCamel(table.name)}Schema = z.object({`)
      for (const col of table.columns) {
        const t = (col.type ?? '').toLowerCase()
        let z =
          t.includes('int') || t.includes('float') || t.includes('decimal') || t.includes('numeric') || t.includes('serial') ? 'z.number()'
          : t.includes('bool') ? 'z.boolean()'
          : t.includes('date') || t.includes('time') || t.includes('timestamp') ? 'z.date()'
          : 'z.string()'
        if (col.nullable) z += '.nullable()'
        chunks.push(`  ${col.name}: ${z},`)
      }
      chunks.push('})\n')
      chunks.push(`export type ${typeName}Schema = z.infer<typeof ${toCamel(table.name)}Schema>\n`)
    }
  }

  return chunks.join('\n')
}

function genGo(tables: SchemaTable[]): string {
  const chunks: string[] = []
  chunks.push(`package ${goOpts.pkg || 'models'}\n`)

  const needsTime = tables.some(t => t.columns.some(c => {
    const type = (c.type ?? '').toLowerCase()
    return type.includes('date') || type.includes('time') || type.includes('timestamp')
  }))
  const needsJson = tables.some(t => t.columns.some(c => (c.type ?? '').toLowerCase().includes('json')))

  const imports = ['fmt']
  if (needsTime) imports.push('time')
  if (needsJson) imports.push('encoding/json')
  chunks.push(`import (\n${imports.map(i => `\t"${i}"`).join('\n')}\n)\n`)
  chunks.push(`var _ = fmt.Sprintf // suppress unused import\n`)

  for (const table of tables) {
    const structName = toPascal(table.name)
    chunks.push(`// ${structName} maps to the "${table.name}" table.`)
    chunks.push(`type ${structName} struct {`)
    for (const col of table.columns) {
      const fieldName = toPascal(col.name)
      const goT = goType(col)
      const tags: string[] = []
      if (goOpts.jsonTags) tags.push(`json:"${col.name}${col.nullable ? ',omitempty' : ''}"`)
      if (goOpts.dbTags)   tags.push(`db:"${col.name}"`)
      const tagStr = tags.length ? ` \`${tags.join(' ')}\`` : ''
      const comments: string[] = []
      if (col.primaryKey) comments.push('PK')
      if (col.unique)     comments.push('UNIQUE')
      chunks.push(`\t${fieldName} ${goT}${tagStr}${comments.length ? ' // ' + comments.join(', ') : ''}`)
    }
    chunks.push('}\n')
  }

  return chunks.join('\n')
}

function genPython(tables: SchemaTable[]): string {
  const chunks: string[] = []
  const needsDate = tables.some(t => t.columns.some(c => (c.type ?? '').toLowerCase().includes('date') && !(c.type ?? '').toLowerCase().includes('timestamp')))
  const needsDatetime = tables.some(t => t.columns.some(c => {
    const type = (c.type ?? '').toLowerCase()
    return type.includes('timestamp') || (type.includes('time') && !type.includes('date'))
  }))
  const hasNullable = pyOpts.optionalNulls && tables.some(t => t.columns.some(c => c.nullable))

  if (pyOpts.pydantic) {
    chunks.push('from pydantic import BaseModel')
  } else if (pyOpts.dataclass) {
    chunks.push('from dataclasses import dataclass, field')
  }
  if (pyOpts.sqlalchemy) {
    chunks.push('from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Date, Text, JSON')
    chunks.push('from sqlalchemy.orm import declarative_base')
    chunks.push('\nBase = declarative_base()')
  }
  if (hasNullable) chunks.push('from typing import Optional')
  if (needsDate) chunks.push('from datetime import date')
  if (needsDatetime) chunks.push('from datetime import datetime')
  chunks.push('')

  for (const table of tables) {
    const className = toPascal(table.name)

    if (pyOpts.pydantic) {
      chunks.push(`class ${className}(BaseModel):`)
      for (const col of table.columns) {
        const pyT = pyType(col)
        const defVal = col.nullable ? ' = None' : ''
        chunks.push(`    ${col.name}: ${pyT}${defVal}`)
      }
      chunks.push('')
    }

    if (pyOpts.dataclass) {
      chunks.push('@dataclass')
      chunks.push(`class ${className}:`)
      for (const col of table.columns) {
        const pyT = pyType(col)
        const defVal = col.nullable ? ' = None' : ''
        chunks.push(`    ${col.name}: ${pyT}${defVal}`)
      }
      chunks.push('')
    }

    if (pyOpts.sqlalchemy) {
      chunks.push(`class ${className}(Base):`)
      chunks.push(`    __tablename__ = '${table.name}'`)
      chunks.push('')
      for (const col of table.columns) {
        const t = (col.type ?? '').toLowerCase()
        const sqlT =
          t.includes('bigint') ? 'Integer'
          : t.includes('int') || t.includes('serial') ? 'Integer'
          : t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric') || t.includes('real') ? 'Float'
          : t.includes('bool') ? 'Boolean'
          : t.includes('json') ? 'JSON'
          : t.includes('text') ? 'Text'
          : t.includes('timestamp') || t.includes('time') ? 'DateTime'
          : t.includes('date') ? 'Date'
          : 'String'
        const args = [sqlT, col.primaryKey && 'primary_key=True', col.nullable && 'nullable=True', col.unique && 'unique=True'].filter(Boolean).join(', ')
        chunks.push(`    ${col.name} = Column(${args})`)
      }
      chunks.push('')
    }
  }

  return chunks.join('\n')
}

function genRust(tables: SchemaTable[]): string {
  const chunks: string[] = []
  chunks.push('use serde::{Serialize, Deserialize};\n')

  const needsChrono = tables.some(t => t.columns.some(c => {
    const type = (c.type ?? '').toLowerCase()
    return type.includes('date') || type.includes('time') || type.includes('timestamp')
  }))
  if (needsChrono) chunks.push('use chrono::{NaiveDateTime};\n')

  for (const table of tables) {
    const structName = toPascal(table.name)
    chunks.push(`#[derive(Debug, Serialize, Deserialize)]`)
    chunks.push(`pub struct ${structName} {`)
    for (const col of table.columns) {
      chunks.push(`    pub ${col.name}: ${rustType(col)},`)
    }
    chunks.push('}\n')
  }
  return chunks.join('\n')
}

function genJava(tables: SchemaTable[]): string {
  const chunks: string[] = []
  chunks.push('import java.time.LocalDateTime;')
  chunks.push('import java.util.*;\n')

  for (const table of tables) {
    const className = toPascal(table.name)
    chunks.push(`public class ${className} {`)
    for (const col of table.columns) {
      chunks.push(`    private ${javaType(col)} ${col.name};`)
    }
    chunks.push('\n    public ' + className + '() {}')
    // Getters/Setters
    for (const col of table.columns) {
      const field = col.name
      const pascal = toPascal(field)
      const type = javaType(col)
      chunks.push(`\n    public ${type} get${pascal}() { return this.${field}; }`)
      chunks.push(`    public void set${pascal}(${type} ${field}) { this.${field} = ${field}; }`)
    }
    chunks.push('}\n')
  }
  return chunks.join('\n')
}

function genKotlin(tables: SchemaTable[]): string {
  const chunks: string[] = []
  chunks.push('import java.time.LocalDateTime\n')
  for (const table of tables) {
    const className = toPascal(table.name)
    chunks.push(`data class ${className}(`)
    for (const col of table.columns) {
      const type = javaType(col) // Use java types as proxy for simple mapping
      const ktType = type === 'Integer' ? 'Int' : type === 'LocalDateTime' ? 'LocalDateTime' : type === 'String' ? 'String' : type.charAt(0).toUpperCase() + type.slice(1)
      const nullable = col.nullable ? '?' : ''
      chunks.push(`    val ${col.name}: ${ktType}${nullable},`)
    }
    chunks.push(')\n')
  }
  return chunks.join('\n')
}

function genCSharp(tables: SchemaTable[]): string {
  const chunks: string[] = []
  chunks.push('using System;')
  chunks.push('using System.Collections.Generic;\n')
  chunks.push('namespace Models\n{')
  for (const table of tables) {
    const className = toPascal(table.name)
    chunks.push(`    public class ${className}`)
    chunks.push('    {')
    for (const col of table.columns) {
      const type = csType(col)
      const pascal = toPascal(col.name)
      chunks.push(`        public ${type} ${pascal} { get; set; }`)
    }
    chunks.push('    }\n')
  }
  chunks.push('}')
  return chunks.join('\n')
}

function genCpp(tables: SchemaTable[]): string {
  const chunks: string[] = []
  chunks.push('#include <string>')
  chunks.push('#include <vector>\n')
  for (const table of tables) {
    const structName = toPascal(table.name)
    chunks.push(`struct ${structName} {`)
    for (const col of table.columns) {
      chunks.push(`    ${cppType(col)} ${col.name};`)
    }
    chunks.push('};\n')
  }
  return chunks.join('\n')
}
function exportFunctionName(name: string) {
  return `build${toPascal(name)}Export`
}

function exportPayloadName(name: string) {
  return `${toPascal(name)}ExportPayload`
}

function exportTableVar(table: SchemaTable) {
  return toCamel(table.name)
}

function selectedColumnNames(table: SchemaTable) {
  return table.columns.map(column => column.name)
}

function genTypeScriptExport(resourceName: string, tables: SchemaTable[]): string {
  const fnName = exportFunctionName(resourceName)
  const payloadName = exportPayloadName(resourceName)
  const lines: string[] = []
  lines.push(`export interface ${payloadName} {`)
  for (const table of tables) {
    lines.push(`  ${exportTableVar(table)}: Array<{`)
    for (const column of table.columns) {
      lines.push(`    ${column.name}: ${tsType(column)}`)
    }
    lines.push('  }>')
  }
  lines.push('}\n')
  lines.push(`export function ${fnName}(rowsByTable: Record<string, Array<Record<string, unknown>>>): ${payloadName} {`)
  lines.push('  return {')
  for (const table of tables) {
    const fields = table.columns.map(column => `${column.name}: row.${column.name} as ${tsType(column)}`).join(', ')
    lines.push(`    ${exportTableVar(table)}: (rowsByTable['${table.name}'] ?? []).map(row => ({ ${fields} })),`)
  }
  lines.push('  }')
  lines.push('}')
  return lines.join('\n')
}

function genGoExport(resourceName: string, tables: SchemaTable[]): string {
  const payloadName = exportPayloadName(resourceName)
  const fnName = exportFunctionName(resourceName)
  const lines: string[] = []
  lines.push(`type ${payloadName} struct {`)
  for (const table of tables) {
    lines.push(`\t${toPascal(exportTableVar(table))} []map[string]any \`json:"${exportTableVar(table)}"\``)
  }
  lines.push('}\n')
  lines.push(`func ${fnName}(rowsByTable map[string][]map[string]any) ${payloadName} {`)
  lines.push(`\treturn ${payloadName}{`)
  for (const table of tables) {
    lines.push(`\t\t${toPascal(exportTableVar(table))}: pickRows(rowsByTable["${table.name}"], []string{${selectedColumnNames(table).map(name => `"${name}"`).join(', ')}}),`)
  }
  lines.push('\t}')
  lines.push('}\n')
  lines.push('func pickRows(rows []map[string]any, columns []string) []map[string]any {')
  lines.push('\tresult := make([]map[string]any, 0, len(rows))')
  lines.push('\tfor _, row := range rows {')
  lines.push('\t\tentry := map[string]any{}')
  lines.push('\t\tfor _, column := range columns {')
  lines.push('\t\t\tentry[column] = row[column]')
  lines.push('\t\t}')
  lines.push('\t\tresult = append(result, entry)')
  lines.push('\t}')
  lines.push('\treturn result')
  lines.push('}')
  return lines.join('\n')
}

function genPythonExport(resourceName: string, tables: SchemaTable[]): string {
  const fnName = exportFunctionName(resourceName)
  const lines: string[] = []
  lines.push(`def ${toSnake(fnName)}(rows_by_table: dict[str, list[dict]]) -> dict:`)
  lines.push('    return {')
  for (const table of tables) {
    lines.push(`        "${exportTableVar(table)}": [{${selectedColumnNames(table).map(name => `"${name}": row.get("${name}")`).join(', ')}} for row in rows_by_table.get("${table.name}", [])],`)
  }
  lines.push('    }')
  return lines.join('\n')
}

function genRustExport(resourceName: string, tables: SchemaTable[]): string {
  const fnName = exportFunctionName(resourceName)
  const lines: string[] = []
  lines.push('use serde_json::{Map, Value};\n')
  lines.push(`pub fn ${toSnake(fnName)}(rows_by_table: &std::collections::HashMap<String, Vec<Map<String, Value>>>) -> Map<String, Value> {`)
  lines.push('\tlet mut payload = Map::new();')
  for (const table of tables) {
    lines.push(`\tpayload.insert("${exportTableVar(table)}".into(), Value::Array(`)
    lines.push(`\t\trows_by_table.get("${table.name}").cloned().unwrap_or_default().into_iter().map(|row| {`)
    lines.push('\t\t\tlet mut picked = Map::new();')
    for (const column of table.columns) {
      lines.push(`\t\t\tif let Some(value) = row.get("${column.name}") { picked.insert("${column.name}".into(), value.clone()); }`)
    }
    lines.push('\t\t\tValue::Object(picked)')
    lines.push('\t\t}).collect()')
    lines.push('\t));')
  }
  lines.push('\tpayload')
  lines.push('}')
  return lines.join('\n')
}

function genJavaExport(resourceName: string, tables: SchemaTable[]): string {
  const fnName = exportFunctionName(resourceName)
  const lines: string[] = []
  lines.push(`public static Map<String, Object> ${fnName}(Map<String, List<Map<String, Object>>> rowsByTable) {`)
  lines.push('    Map<String, Object> payload = new LinkedHashMap<>();')
  for (const table of tables) {
    lines.push(`    payload.put("${exportTableVar(table)}", rowsByTable.getOrDefault("${table.name}", List.of()).stream().map(row -> {`)
    lines.push('        Map<String, Object> picked = new LinkedHashMap<>();')
    for (const column of table.columns) {
      lines.push(`        picked.put("${column.name}", row.get("${column.name}"));`)
    }
    lines.push('        return picked;')
    lines.push('    }).toList());')
  }
  lines.push('    return payload;')
  lines.push('}')
  return lines.join('\n')
}

function genKotlinExport(resourceName: string, tables: SchemaTable[]): string {
  const fnName = exportFunctionName(resourceName)
  const lines: string[] = []
  lines.push(`fun ${toCamel(fnName)}(rowsByTable: Map<String, List<Map<String, Any?>>>) : Map<String, Any?> {`)
  lines.push('    return linkedMapOf(')
  for (const table of tables) {
    lines.push(`        "${exportTableVar(table)}" to (rowsByTable["${table.name}"] ?: emptyList()).map { row -> linkedMapOf(`)
    lines.push(`            ${selectedColumnNames(table).map(name => `"${name}" to row["${name}"]`).join(', ')}`)
    lines.push('        ) },')
  }
  lines.push('    )')
  lines.push('}')
  return lines.join('\n')
}

function genCSharpExport(resourceName: string, tables: SchemaTable[]): string {
  const fnName = exportFunctionName(resourceName)
  const lines: string[] = []
  lines.push(`public static Dictionary<string, object> ${fnName}(Dictionary<string, List<Dictionary<string, object?>>> rowsByTable)`)
  lines.push('{')
  lines.push('    return new Dictionary<string, object>')
  lines.push('    {')
  for (const table of tables) {
    lines.push(`        ["${exportTableVar(table)}"] = rowsByTable.GetValueOrDefault("${table.name}", new List<Dictionary<string, object?>>()).Select(row => new Dictionary<string, object?>`)
    lines.push('        {')
    for (const column of table.columns) {
      lines.push(`            ["${column.name}"] = row.GetValueOrDefault("${column.name}"),`)
    }
    lines.push('        }).ToList(),')
  }
  lines.push('    };')
  lines.push('}')
  return lines.join('\n')
}

function genCppExport(resourceName: string, tables: SchemaTable[]): string {
  const fnName = exportFunctionName(resourceName)
  const lines: string[] = []
  lines.push(`std::map<std::string, std::vector<std::map<std::string, std::string>>> ${fnName}(`)
  lines.push('  const std::map<std::string, std::vector<std::map<std::string, std::string>>>& rowsByTable')
  lines.push(') {')
  lines.push('  std::map<std::string, std::vector<std::map<std::string, std::string>>> payload;')
  for (const table of tables) {
    lines.push(`  for (const auto& row : rowsByTable.count("${table.name}") ? rowsByTable.at("${table.name}") : std::vector<std::map<std::string, std::string>>{}) {`)
    lines.push('    std::map<std::string, std::string> picked;')
    for (const column of table.columns) {
      lines.push(`    if (row.count("${column.name}")) picked["${column.name}"] = row.at("${column.name}");`)
    }
    lines.push(`    payload["${exportTableVar(table)}"].push_back(picked);`)
    lines.push('  }')
  }
  lines.push('  return payload;')
  lines.push('}')
  return lines.join('\n')
}

function genExportFunction(resourceName: string, tables: SchemaTable[]): string {
  if (tables.length === 0) return '// Select at least one connected table/column for this export resource.'
  switch (activeLang.value) {
    case 'typescript': return genTypeScriptExport(resourceName, tables)
    case 'go': return genGoExport(resourceName, tables)
    case 'rust': return genRustExport(resourceName, tables)
    case 'python': return genPythonExport(resourceName, tables)
    case 'java': return genJavaExport(resourceName, tables)
    case 'kotlin': return genKotlinExport(resourceName, tables)
    case 'csharp': return genCSharpExport(resourceName, tables)
    case 'cpp': return genCppExport(resourceName, tables)
  }
}
function toPascal(s: string) { return s.replace(/(^|_|-)(\w)/g, (_, __, c) => c.toUpperCase()) }
function toCamel(s: string)  { const p = toPascal(s); return p[0].toLowerCase() + p.slice(1) }
function toSnake(s: string)  { return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase() }
function getCode(tableName: string): string {
  if (tableName.startsWith('export:')) {
    return selectedExportResource.value
      ? genExportFunction(selectedExportResource.value.name, selectedExportTables.value)
      : '// No export resource selected.'
  }
  const tables = filteredTables.value.filter(t => t.name === tableName)
  if (!tables.length) return '-- select a table'
  switch (activeLang.value) {
    case 'typescript': return genTypeScript(tables)
    case 'go':         return genGo(tables)
    case 'rust':       return genRust(tables)
    case 'python':     return genPython(tables)
    case 'java':       return genJava(tables)
    case 'kotlin':     return genKotlin(tables)
    case 'csharp':     return genCSharp(tables)
    case 'cpp':        return genCpp(tables)
  }
}

const currentCode = computed(() => getCode(previewTab.value))

function getAllCode(): string {
  const modelCode = (() => {
    switch (activeLang.value) {
    case 'typescript': return genTypeScript(filteredTables.value)
    case 'go':         return genGo(filteredTables.value)
    case 'rust':       return genRust(filteredTables.value)
    case 'python':     return genPython(filteredTables.value)
    case 'java':       return genJava(filteredTables.value)
    case 'kotlin':     return genKotlin(filteredTables.value)
    case 'csharp':     return genCSharp(filteredTables.value)
    case 'cpp':        return genCpp(filteredTables.value)
    }
  })()
  if (!selectedExportResource.value) return modelCode
  const exportCode = genExportFunction(selectedExportResource.value.name, selectedExportTables.value)
  return `${modelCode}\n\n${exportCode}`.trim()
}
const copied = ref(false)
async function copyAll() {
  await navigator.clipboard.writeText(getAllCode())
  copied.value = true
  setTimeout(() => { copied.value = false }, 1800)
}

async function downloadAll() {
  let ext = 'txt'
  switch (activeLang.value) {
    case 'typescript': ext = 'ts'; break
    case 'go':         ext = 'go'; break
    case 'rust':       ext = 'rs'; break
    case 'python':     ext = 'py'; break
    case 'java':       ext = 'java'; break
    case 'kotlin':     ext = 'kt'; break
    case 'csharp':     ext = 'cs'; break
    case 'cpp':        ext = 'cpp'; break
  }

  await saveExportFile({
    data: getAllCode(),
    defaultPath: `models.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    mimeType: 'text/plain',
  })
}

defineExpose({ copyAll, downloadAll })
</script>

<style scoped>
.cg-root {
  display: flex; flex-direction: row; height: 100%; width: 100%;
  font-family: 'JetBrains Mono', monospace; overflow: hidden;
  background: #0a0a0f;
}
.cg-sidebar {
  display: flex; flex-direction: row; height: 100%;
  border-right: 1px solid #1a1a24; flex-shrink: 0;
}

.cg-options {
  width: 240px; display: flex; flex-direction: column; height: 100%; overflow-y: auto; background: #0d0d14;
}
.cg-options::-webkit-scrollbar { width: 3px; }
.cg-options::-webkit-scrollbar-thumb { background: #252535; border-radius: 2px; }

.cg-brand { display: flex; align-items: center; gap: 8px; padding: 13px 14px 11px; border-bottom: 1px solid #1a1a24; flex-shrink: 0; }
.cg-brand-icon { font-size: 15px; color: #3ECF8E; }
.cg-brand-name { font-size: 12px; font-weight: 700; color: #e0e0e0; letter-spacing: 0.04em; }

.cg-section { padding: 10px 14px; border-bottom: 1px solid #181820; }
.cg-section.cg-flex { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 120px; }
.cg-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #444; margin-bottom: 8px; }
.cg-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.cg-label-actions { display: flex; gap: 4px; }
.btn-tiny { background: none; border: 1px solid #252535; border-radius: 3px; color: #555; font-size: 9px; padding: 2px 6px; cursor: pointer; transition: color 0.15s; font-family: 'JetBrains Mono', monospace; }
.btn-tiny:hover { color: #3ECF8E; }

/* Schema */
.schema-state { margin-bottom: 6px; }
.schema-loaded { font-size: 10px; color: #3ECF8E; }
.schema-none   { font-size: 10px; color: #444; font-style: italic; }
.btn-load {
  display: block; width: 100%; background: none; border: 1px solid #252535; color: #666;
  border-radius: 5px; padding: 5px 10px; font-size: 10px; cursor: pointer; text-align: center;
  margin-bottom: 5px; transition: color 0.15s, border-color 0.15s; font-family: 'JetBrains Mono', monospace;
}
.btn-load:hover { color: #3ECF8E; border-color: #3ECF8E40; }
.btn-use-current {
  width: 100%; background: none; border: 1px dashed #252535; color: #555;
  border-radius: 5px; padding: 4px; font-size: 10px; cursor: pointer;
  transition: color 0.15s, border-color 0.15s; font-family: 'JetBrains Mono', monospace;
}
.btn-use-current:hover { color: #3ECF8E; border-color: #3ECF8E40; }

/* Language tabs */
.lang-tabs { display: flex; flex-direction: column; gap: 4px; }
.lang-tab {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px;
  background: none; border: 1px solid #1e1e28; color: #555; cursor: pointer; font-size: 11px;
  transition: all 0.15s; font-family: 'JetBrains Mono', monospace;
}
.lang-tab:hover  { color: #aaa; background: #181820; }
.lang-tab.active { color: #f0f0f8; background: #1a1a28; border-color: #3a3a55; }
.lang-icon {
  font-size: 9px; font-weight: 900; width: 22px; height: 18px; border-radius: 3px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: #2a2a3e; color: #8080c0;
}
.lang-tab.active .lang-icon { background: #3ECF8E20; color: #3ECF8E; }

/* Options */
.opt-row { display: flex; align-items: center; gap: 7px; font-size: 11px; color: #888; margin-bottom: 5px; cursor: pointer; }
.opt-row input[type="checkbox"] { accent-color: #3ECF8E; }
.opt-row span { color: #666; }
.opt-info { font-size: 10px; color: #555; font-style: italic; }
.pkg-input { flex: 1; background: #18181f; border: 1px solid #252535; border-radius: 4px; color: #aaa; font-size: 10px; padding: 3px 6px; font-family: 'JetBrains Mono', monospace; outline: none; }

/* Table list */
.table-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.table-list::-webkit-scrollbar { width: 3px; }
.table-list::-webkit-scrollbar-thumb { background: #252535; border-radius: 2px; }
.tbl-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 5px; cursor: pointer; transition: background 0.1s; }
.tbl-row:hover { background: #181820; }
.tbl-row input { accent-color: #3ECF8E; }
.tbl-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.tbl-name { flex: 1; font-size: 11.5px; color: #b0b0c8; }
.tbl-cnt  { font-size: 9.5px; color: #38384e; }
.tbl-empty { font-size: 11px; color: #2a2a3a; font-style: italic; text-align: center; padding: 16px; }

.export-select {
  width: 100%;
  background: #18181f;
  border: 1px solid #252535;
  border-radius: 6px;
  color: #b0b0c8;
  font-size: 11px;
  padding: 7px 9px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
}

.export-config {
  margin-top: 10px;
}

.export-hint {
  font-size: 10px;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 8px;
}

.export-table-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.export-table-card {
  border: 1px solid #1f2430;
  border-radius: 8px;
  background: #11151c;
  overflow: hidden;
}

.export-row {
  margin: 0;
}

.export-columns {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 8px 8px;
}

.export-col-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: #aeb8c7;
  padding: 4px 6px;
  border-radius: 5px;
}

.export-col-row:hover {
  background: #181e28;
}

.export-col-row input {
  accent-color: #3ECF8E;
}

.export-col-type {
  margin-left: auto;
  color: #5b6575;
}

.cg-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid #181820;
  flex-shrink: 0;
}

.cg-footer-autosave {
  font-size: 10px;
  color: #3ecf8e80;
  letter-spacing: 0.02em;
}

.cg-footer-version {
  margin-left: auto;
  font-size: 10px;
  color: #7a7a8c;
  background: #1a1a22;
  padding: 2px 6px;
  border-radius: 8px;
  letter-spacing: 0.06em;
}

/* Action buttons */
.btn-copy, .btn-download {
  width: 100%; padding: 7px; border-radius: 6px; font-size: 11px; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-weight: 600; border: none; margin-bottom: 5px;
  transition: all 0.15s;
}

.btn-copy     { background: #3ECF8E20; color: #3ECF8E; border: 1px solid #3ECF8E40; }
.btn-copy:hover { background: #3ECF8E30; }
.btn-download { background: #1e1e28; color: #666; border: 1px solid #252535; }
.btn-download:hover { color: #3ECF8E; border-color: #3ECF8E40; }
.cg-preview { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.preview-toolbar {
  display: flex; align-items: center; height: 38px; min-height: 38px;
  background: #0d0d14; border-bottom: 1px solid #1a1a24; padding: 0 12px;
}
.preview-tabs { display: flex; flex: 1; height: 100%; gap: 0; overflow-x: auto; }
.preview-tabs::-webkit-scrollbar { height: 2px; }
.preview-tab {
  padding: 0 14px; background: none; border: none; border-bottom: 2px solid transparent;
  color: #444; cursor: pointer; font-size: 11px; white-space: nowrap; height: 100%;
  font-family: 'JetBrains Mono', monospace; transition: color 0.15s, border-color 0.15s;
}
.preview-tab:hover  { color: #888; }
.preview-tab.active { color: #e0e0e0; border-bottom-color: #3ECF8E; }
.preview-lang-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: #3ECF8E; background: #3ECF8E15; border: 1px solid #3ECF8E30;
  padding: 2px 8px; border-radius: 10px; flex-shrink: 0;
}

.preview-body {
  flex: 1; overflow: auto; padding: 20px 24px;
}
.preview-body::-webkit-scrollbar { width: 5px; height: 5px; }
.preview-body::-webkit-scrollbar-thumb { background: #252535; border-radius: 3px; }

.code-block {
  margin: 0; white-space: pre; tab-size: 2; font-size: 13px; line-height: 1.75;
  font-family: 'JetBrains Mono', monospace;
}
.lang-typescript { color: #8080c0; }
.lang-go         { color: #7abfff; }
.lang-python     { color: #a0c0a0; }
</style>



