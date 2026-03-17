<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="closeAll">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="modal-icon" :style="{ color: localTable.color }">&#11041;</span>
            <input
              class="table-name-input"
              v-model="localTable.name"
              placeholder="table_name"
              @keydown.enter="save"
            />
          </div>
          <div class="color-picker">
            <button
              v-for="color in TABLE_COLORS"
              :key="color"
              class="color-dot"
              :class="{ active: localTable.color === color }"
              :style="{ background: color }"
              @click="localTable.color = color"
            />
          </div>
        </div>

        <div class="modal-body">
          <div class="table-settings-row">
            <label class="table-setting">
              <input type="checkbox" v-model="localTable.immutable" />
              <span>Immutable table</span>
            </label>
          </div>

          <div class="type-filter-row">
            <span class="type-filter-label">Database</span>
            <span class="type-filter-value">{{ activeDialectLabel }}</span>
          </div>

          <div class="columns-header">
            <span class="col-head" style="width:24px"></span>
            <span class="col-head" style="flex:1.5">Column Name</span>
            <span class="col-head" style="flex:1">Type</span>
            <span class="col-head" style="width:140px">Array Element</span>
            <span class="col-head center" style="width:28px" title="Type help">?</span>
            <span class="col-head center" style="width:36px" title="Primary Key">PK</span>
            <span class="col-head center" style="width:36px" title="Nullable">NULL</span>
            <span class="col-head center" style="width:36px" title="Unique">UQ</span>
            <span class="col-head center" style="width:42px" title="Immutable">IMM</span>
            <span class="col-head" style="flex:1">Default</span>
            <span class="col-head center" style="width:88px" title="Suggested defaults">Preset</span>
            <span class="col-head" style="width:32px"></span>
          </div>

          <draggable-list :columns="localTable.columns" @update="localTable.columns = $event">
            <template #default="{ col, index }">
              <div class="column-editor-row" :key="col.id">
                <span class="drag-handle">::</span>

                <input
                  class="col-input"
                  style="flex:1.5"
                  v-model="col.name"
                  placeholder="column_name"
                />

                <button
                  type="button"
                  class="col-input col-type-select type-picker-trigger"
                  style="flex:1"
                  :title="getTypeDescription(col.type)"
                  @click="openTypePicker(col.id)"
                >
                  <span class="type-picker-value">{{ getDisplayType(col.type) }}</span>
                  <span class="type-picker-caret">v</span>
                </button>

                <select
                  v-if="showArrayTypeSelector(col.type)"
                  class="col-input col-type-select array-type-select"
                  :value="getArrayElementType(col.type)"
                  title="Select the element type stored in this array"
                  @change="onArrayElementTypeChange(col, ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="type in arrayElementOptions"
                    :key="type.value"
                    :value="type.value"
                    :title="type.description"
                  >{{ type.label }}</option>
                </select>
                <span v-else class="array-type-placeholder"></span>

                <button
                  class="type-help-btn"
                  type="button"
                  :title="getTypeDescription(col.type)"
                >?</button>

                <input
                  type="checkbox"
                  class="col-check"
                  v-model="col.primaryKey"
                  @change="if (col.primaryKey) { col.nullable = false; col.unique = true }"
                />
                <input
                  type="checkbox"
                  class="col-check"
                  v-model="col.nullable"
                  :disabled="col.primaryKey"
                />
                <input
                  type="checkbox"
                  class="col-check"
                  v-model="col.unique"
                  :disabled="col.primaryKey"
                />
                <input
                  type="checkbox"
                  class="col-check"
                  v-model="col.immutable"
                />

                <input
                  class="col-input"
                  style="flex:1"
                  v-model="col.defaultValue"
                  placeholder="default..."
                />

                <select
                  class="col-input default-preset-select"
                  :value="defaultPresetByColumn[col.id] ?? ''"
                  :disabled="defaultPresetsForColumn(col).length === 0"
                  @change="onDefaultPresetSelected(col, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Preset</option>
                  <option
                    v-for="preset in defaultPresetsForColumn(col)"
                    :key="preset.value"
                    :value="preset.value"
                  >{{ preset.label }}</option>
                </select>

                <button class="del-col-btn" @click="removeColumn(index)" title="Delete column">X</button>
              </div>
            </template>
          </draggable-list>

          <button class="add-col-btn" @click="addColumn">+ Add Column</button>
        </div>

        <div class="modal-footer">
          <div class="footer-left">
            <button class="btn-danger" @click="deleteTable">Delete Table</button>
          </div>
          <div class="footer-right">
            <button class="btn-cancel" @click="closeAll">Cancel</button>
            <button class="btn-save" @click="save">Save Table</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTypePickerColumn" class="type-browser-backdrop" @click.self="closeTypePicker">
      <div class="type-browser">
        <div class="type-browser-header">
          <div>
            <div class="type-browser-title">Pick SQL Type</div>
            <div class="type-browser-subtitle">
              {{ activeTypePickerColumn.name || 'Column' }} · {{ activeDialectLabel }}
            </div>
          </div>
          <button class="type-browser-close" type="button" @click="closeTypePicker">Close</button>
        </div>

        <button
          v-if="!isTypeVisible(getDisplayType(activeTypePickerColumn.type))"
          type="button"
          class="type-option current"
          :title="getTypeDescription(activeTypePickerColumn.type)"
          @click="selectType(activeTypePickerColumn, getDisplayType(activeTypePickerColumn.type))"
        >
          <span class="type-option-label">{{ getDisplayType(activeTypePickerColumn.type) }}</span>
          <span class="type-option-meta">Current</span>
        </button>

        <div
          v-for="group in filteredTypeGroups"
          :key="group.label"
          class="type-group"
        >
          <button
            type="button"
            class="type-group-toggle"
            @click="toggleTypeGroup(group.label)"
          >
            <span>{{ group.label }}</span>
            <span>{{ isTypeGroupCollapsed(group.label) ? '+' : '-' }}</span>
          </button>

          <div v-if="!isTypeGroupCollapsed(group.label)" class="type-group-options">
            <button
              v-for="type in group.types"
              :key="type.value"
              type="button"
              class="type-option"
              :class="{ active: getDisplayType(activeTypePickerColumn.type) === type.value }"
              :title="type.description"
              @click="selectType(activeTypePickerColumn, type.value)"
            >
              <span class="type-option-label">{{ type.label }}</span>
              <span class="type-option-meta">{{ type.description }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useSchemaStore } from '../../stores/schema'
import type { Table, Column, SQLDialect } from '../../types'
import { SQL_TYPE_OPTIONS, getSqlTypeDescription, getSqlTypeGroups } from '../../types/sqlTypes'

const DraggableList = {
  props: ['columns'],
  emits: ['update'],
  setup(props: any, { slots }: any) {
    return () => props.columns.map((col: Column, index: number) => slots.default({ col, index }))
  }
}

const TABLE_COLORS = [
  '#3ECF8E', '#3B82F6', '#8B5CF6', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#10B981',
  '#F97316', '#84CC16',
]

const TYPE_DIALECTS: { value: SQLDialect; label: string; description: string }[] = [
  { value: 'postgresql', label: 'Postgres', description: 'Show PostgreSQL-specific types, including arrays and JSONB.' },
  { value: 'mysql', label: 'MySQL', description: 'Show MySQL-specific integer, text, and enum types.' },
  { value: 'sqlite', label: 'SQLite', description: 'Show SQLite-friendly storage types.' },
  { value: 'sqlserver', label: 'SQL Server', description: 'Show SQL Server-specific Unicode and binary types.' },
]

type DefaultPreset = { label: string; value: string }

const props = defineProps<{ table: Table }>()
const emit = defineEmits<{ close: []; deleted: [] }>()
const store = useSchemaStore()

const localTable = reactive<Table>(JSON.parse(JSON.stringify(props.table)))
localTable.immutable ??= false
localTable.columns.forEach(column => { column.immutable ??= false })

const openTypePickerFor = ref<string | null>(null)
const collapsedTypeGroups = ref<Record<string, boolean>>({})
const defaultPresetByColumn = ref<Record<string, string>>({})

const schemaDialect = computed(() => store.schema.dialect ?? 'postgresql')
const filteredTypeGroups = computed(() => getSqlTypeGroups(schemaDialect.value))
const visibleTypeValues = computed(() => new Set(
  filteredTypeGroups.value.flatMap(group => group.types.map(type => type.value))
))
const activeTypePickerColumn = computed(() =>
  localTable.columns.find(column => column.id === openTypePickerFor.value) ?? null
)
const activeDialectLabel = computed(() =>
  TYPE_DIALECTS.find(dialect => dialect.value === schemaDialect.value)?.label ?? 'Database'
)
const arrayElementOptions = computed(() =>
  SQL_TYPE_OPTIONS.filter(type =>
    !type.value.endsWith('[]') &&
    type.value !== 'ARRAY' &&
    type.dialects.includes('postgresql')
  )
)

function closeAll() {
  closeTypePicker()
  emit('close')
}

function closeTypePicker() {
  openTypePickerFor.value = null
}

function openTypePicker(columnId: string) {
  openTypePickerFor.value = columnId
}

function getTypeDescription(type: string) {
  return getSqlTypeDescription(type)
}

function getDisplayType(type: string) {
  return showArrayTypeSelector(type) ? 'ARRAY' : type
}

function isTypeVisible(type: string) {
  return visibleTypeValues.value.has(type)
}

function toggleTypeGroup(groupLabel: string) {
  collapsedTypeGroups.value = {
    ...collapsedTypeGroups.value,
    [groupLabel]: !collapsedTypeGroups.value[groupLabel],
  }
}

function isTypeGroupCollapsed(groupLabel: string) {
  return !!collapsedTypeGroups.value[groupLabel]
}

function showArrayTypeSelector(type: string) {
  return type === 'ARRAY' || type.endsWith('[]')
}

function getArrayElementType(type: string) {
  if (type.endsWith('[]')) return type.slice(0, -2)
  return 'TEXT'
}

function onTypeChange(col: Column, value: string) {
  col.type = value === 'ARRAY' ? `${getArrayElementType(col.type)}[]` : value
}

function selectType(col: Column, value: string) {
  onTypeChange(col, value)
  closeTypePicker()
}

function onArrayElementTypeChange(col: Column, value: string) {
  col.type = `${value}[]`
}

function defaultPresetsForColumn(col: Column): DefaultPreset[] {
  const type = col.type.toUpperCase()
  const dialect = schemaDialect.value

  if (type === 'UUID' || type === 'UNIQUEIDENTIFIER') {
    if (dialect === 'postgresql') return [{ label: 'Random UUID', value: 'gen_random_uuid()' }]
    if (dialect === 'mysql') return [{ label: 'Random UUID', value: 'UUID()' }]
    if (dialect === 'sqlserver') return [{ label: 'Random UUID', value: 'NEWID()' }]
    return []
  }

  if (type === 'BOOLEAN' || type === 'BIT' || type === 'BOOLEAN[]') {
    return [
      { label: 'True', value: 'TRUE' },
      { label: 'False', value: 'FALSE' },
    ]
  }

  if (type.includes('JSON')) {
    return [
      { label: 'Empty Object', value: "'{}'" },
      { label: 'Empty Array', value: "'[]'" },
    ]
  }

  if (type.endsWith('[]') || type === 'ARRAY') {
    if (dialect === 'postgresql') return [{ label: 'Empty Array', value: "'{}'" }]
    return []
  }

  if (type.includes('INT') || type === 'DECIMAL' || type === 'NUMERIC' || type === 'FLOAT' || type === 'DOUBLE' || type === 'REAL' || type === 'MONEY') {
    return [{ label: 'Zero', value: '0' }]
  }

  if (type === 'CHAR' || type === 'VARCHAR' || type === 'TEXT' || type === 'NCHAR' || type === 'NVARCHAR') {
    return [{ label: 'Empty String', value: "''" }]
  }

  if (type.includes('DATE') && !type.includes('TIME')) {
    return [{ label: 'Today', value: dialect === 'sqlserver' ? 'CONVERT(date, GETDATE())' : 'CURRENT_DATE' }]
  }
  if (type === 'TIME') {
    return [{ label: 'Current Time', value: dialect === 'sqlserver' ? 'CONVERT(time, GETDATE())' : 'CURRENT_TIME' }]
  }
  if (type.includes('DATETIMEOFFSET')) {
    return [{ label: 'Now', value: 'SYSDATETIMEOFFSET()' }]
  }
  if (type.includes('TIMESTAMPTZ')) {
    return [{ label: 'Now', value: dialect === 'postgresql' ? 'NOW()' : 'CURRENT_TIMESTAMP' }]
  }
  if (type.includes('TIMESTAMP') || type.includes('DATETIME') || type.includes('DATETIME2')) {
    return [{ label: 'Now', value: dialect === 'sqlserver' ? 'SYSDATETIME()' : 'CURRENT_TIMESTAMP' }]
  }
  return []
}

function onDefaultPresetSelected(col: Column, value: string) {
  defaultPresetByColumn.value = { ...defaultPresetByColumn.value, [col.id]: '' }
  if (!value) return

  const presetValues = defaultPresetsForColumn(col).map(preset => preset.value)
  if (!col.defaultValue || presetValues.includes(col.defaultValue)) {
    col.defaultValue = value
    return
  }

  alert('Custom default text was left unchanged. Clear it first if you want to apply a preset.')
}

function addColumn() {
  localTable.columns.push({
    id: uuidv4(),
    name: `column_${localTable.columns.length + 1}`,
    type: 'VARCHAR',
    nullable: true,
    primaryKey: false,
    unique: false,
    immutable: false,
    defaultValue: '',
    comment: '',
  })
}

function removeColumn(index: number) {
  localTable.columns.splice(index, 1)
}

function save() {
  store.updateTable(localTable.id, {
    name: localTable.name,
    color: localTable.color,
    comment: localTable.comment,
    immutable: localTable.immutable,
    columns: localTable.columns,
  })
  emit('close')
}

function deleteTable() {
  if (confirm(`Delete table "${localTable.name}"?`)) {
    store.deleteTable(localTable.id)
    emit('close')
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: #00000088;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 12px;
  width: 980px;
  max-width: 96vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px #00000090;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #1e1e28;
  display: flex;
  align-items: center;
  gap: 16px;
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.modal-icon {
  font-size: 18px;
}

.table-name-input {
  background: none;
  border: none;
  border-bottom: 2px solid #2a2a35;
  color: #f0f0f0;
  font-size: 16px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 4px;
  outline: none;
  width: 220px;
}

.color-picker {
  display: flex;
  gap: 6px;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-dot:hover,
.color-dot.active {
  transform: scale(1.2);
  border-color: #ffffff80;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.modal-body::-webkit-scrollbar,
.type-browser::-webkit-scrollbar {
  width: 4px;
}

.modal-body::-webkit-scrollbar-thumb,
.type-browser::-webkit-scrollbar-thumb {
  background: #2a2a35;
  border-radius: 2px;
}

.table-settings-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.table-setting {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
}

.table-setting input,
.col-check {
  accent-color: #3ECF8E;
}

.type-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.type-filter-label,
.col-head {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #555;
}
.type-filter-value {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.columns-header,
.column-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.columns-header {
  padding: 0 0 8px;
  border-bottom: 1px solid #1e1e28;
  margin-bottom: 4px;
}

.col-head.center {
  text-align: center;
}

.column-editor-row {
  padding: 5px 0;
  border-bottom: 1px solid #1a1a22;
}

.column-editor-row:hover {
  background: #1a1a22;
  border-radius: 4px;
  padding-left: 4px;
  padding-right: 4px;
}

.drag-handle {
  color: #333;
  cursor: grab;
  font-size: 12px;
  width: 16px;
}

.col-input {
  background: #1a1a22;
  border: 1px solid transparent;
  border-radius: 5px;
  color: #d0d0d8;
  padding: 5px 8px;
  font-size: 12.5px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  min-width: 0;
}

.col-input:focus {
  border-color: #3ECF8E40;
}

.col-type-select,
.type-picker-trigger {
  cursor: pointer;
}

.type-picker-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}

.type-picker-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-picker-caret {
  color: #666;
  font-size: 10px;
  flex-shrink: 0;
}

.array-type-select,
.array-type-placeholder {
  width: 140px;
  min-width: 140px;
  flex-shrink: 0;
}

.type-help-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #2a2a35;
  background: #121218;
  color: #777;
  cursor: help;
  flex-shrink: 0;
}

.type-help-btn:hover {
  color: #3ECF8E;
  border-color: #3ECF8E40;
}

.col-check {
  width: 36px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.default-preset-select {
  width: 88px;
  min-width: 88px;
  flex-shrink: 0;
}

.del-col-btn {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.del-col-btn:hover {
  color: #EF4444;
  background: #EF444415;
}

.add-col-btn {
  margin-top: 10px;
  background: none;
  border: 1px dashed #2a2a35;
  color: #555;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
  width: 100%;
}

.add-col-btn:hover {
  color: #3ECF8E;
  border-color: #3ECF8E50;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #1e1e28;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-right {
  display: flex;
  gap: 8px;
}

.btn-cancel,
.btn-danger {
  background: none;
  border: 1px solid #2a2a35;
  color: #888;
  border-radius: 7px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}

.btn-save {
  background: #3ECF8E;
  color: #0a1a12;
  border: none;
  border-radius: 7px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-danger {
  border-color: #EF444440;
  color: #EF4444;
}

.btn-danger:hover {
  background: #EF444415;
}

.type-browser-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1400;
  background: rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 56px 24px 24px;
}

.type-browser {
  width: min(560px, 100%);
  max-height: min(72vh, 620px);
  overflow-y: auto;
  padding: 12px;
  border: 1px solid #2a2a35;
  border-radius: 14px;
  background: #121218;
  box-shadow: 0 24px 56px #0000007a;
}

.type-browser-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.type-browser-title {
  color: #f0f0f0;
  font-size: 14px;
  font-weight: 700;
}

.type-browser-subtitle {
  color: #777;
  font-size: 11px;
  margin-top: 4px;
}

.type-browser-close {
  border: 1px solid #2a2a35;
  background: #17171d;
  color: #9ca3af;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  cursor: pointer;
}

.type-group + .type-group {
  margin-top: 8px;
}

.type-group-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: 7px;
  background: #17171d;
  color: #9ca3af;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
}

.type-group-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.type-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #18181f;
  color: #d0d0d8;
  text-align: left;
  cursor: pointer;
}

.type-option:hover,
.type-option.active {
  border-color: #3ECF8E40;
  background: #1c1f26;
}

.type-option.current {
  margin-bottom: 8px;
  border-color: #3a3a50;
}

.type-option-label {
  font-size: 12px;
  font-weight: 700;
}

.type-option-meta {
  color: #808095;
  font-size: 10px;
  line-height: 1.35;
}
</style>
