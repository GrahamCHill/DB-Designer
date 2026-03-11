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
            <label v-for="t in activeTables" :key="t.name" class="tbl-row">
              <input type="checkbox" :checked="selectedTables.has(t.name)" @change="toggleTable(t.name)" />
              <span class="tbl-dot" :style="{ background: t.color }"/>
              <span class="tbl-name">{{ t.name }}</span>
              <span class="tbl-cnt">{{ t.columns.length }}c</span>
            </label>
            <div v-if="!activeTables.length" class="tbl-empty">Load a schema first</div>
          </div>
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
import { useSchemaStore }    from '../../stores/schema'

const dbStore = useSchemaStore()
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
interface SchemaColumn { name: string; type: string; nullable: boolean; primaryKey: boolean; unique: boolean }
interface SchemaTable  { name: string; color: string; columns: SchemaColumn[] }

const externalSchema = ref<SchemaTable[] | null>(null)
const schemaName     = ref('')

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
      externalSchema.value = (schema.tables ?? []).map((t: any) => ({
        name: t.name, color: t.color ?? '#3ECF8E',
        columns: (t.columns ?? []).map((c: any) => ({
          name: c.name, type: c.type ?? 'text',
          nullable: c.nullable ?? true, primaryKey: c.primaryKey ?? false, unique: c.unique ?? false,
        })),
      }))
      schemaName.value = schema.name ?? file.name
    } catch { alert('Could not parse schema file') }
  }
  reader.readAsText(file)
}

const activeTables = computed<SchemaTable[]>(() => {
  if (externalSchema.value) return externalSchema.value
  return dbStore.schema.tables.map(t => ({
    name: t.name, color: t.color,
    columns: t.columns.map(c => ({
      name: c.name, type: c.type, nullable: c.nullable, primaryKey: c.primaryKey, unique: c.unique,
    })),
  }))
})
const selectedTables = ref<Set<string>>(new Set())

watch(activeTables, (tables) => {
  selectedTables.value = new Set(tables.map(t => t.name))
}, { immediate: true })

function toggleTable(name: string) {
  const s = new Set(selectedTables.value)
  s.has(name) ? s.delete(name) : s.add(name)
  selectedTables.value = s
}
function selectAll()  { selectedTables.value = new Set(activeTables.value.map(t => t.name)) }
function selectNone() { selectedTables.value = new Set() }

const filteredTables = computed(() =>
  activeTables.value.filter(t => selectedTables.value.has(t.name))
)
const previewTabs = computed(() => filteredTables.value.map(t => t.name))
const previewTab  = ref('')

watch(previewTabs, (tabs) => {
  if (!tabs.includes(previewTab.value)) previewTab.value = tabs[0] ?? ''
}, { immediate: true })
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
function toPascal(s: string) { return s.replace(/(^|_|-)(\w)/g, (_, __, c) => c.toUpperCase()) }
function toCamel(s: string)  { const p = toPascal(s); return p[0].toLowerCase() + p.slice(1) }
function getCode(tableName: string): string {
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
}
const copied = ref(false)
async function copyAll() {
  await navigator.clipboard.writeText(getAllCode())
  copied.value = true
  setTimeout(() => { copied.value = false }, 1800)
}

function downloadAll() {
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
  const blob = new Blob([getAllCode()], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `models.${ext}`
  a.click()
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


