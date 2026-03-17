<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal" @click.stop>
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="modal-icon" :style="{ color: localTable.color }">⬡</span>
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

        <!-- Column editor -->
        <div class="modal-body">
          <div class="type-filter-row">
            <span class="type-filter-label">Database</span>
            <div class="type-filter-tabs">
              <button
                v-for="dialect in TYPE_DIALECTS"
                :key="dialect.value"
                type="button"
                class="type-filter-tab"
                :class="{ active: selectedTypeDialect === dialect.value }"
                :title="dialect.description"
                @click="selectedTypeDialect = dialect.value"
              >{{ dialect.label }}</button>
            </div>
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
            <span class="col-head" style="flex:1">Default</span>
            <span class="col-head" style="width:32px"></span>
          </div>

          <draggable-list :columns="localTable.columns" @update="localTable.columns = $event">
            <template #default="{ col, index }">
              <div class="column-editor-row" :key="col.id">
                <span class="drag-handle">⠿</span>

                <input
                  class="col-input"
                  style="flex:1.5"
                  v-model="col.name"
                  placeholder="column_name"
                />

                <div class="type-picker" style="flex:1">
                  <button
                    class="col-input col-type-select type-picker-trigger"
                    type="button"
                    :ref="el => setTypePickerTrigger(col.id, el)"
                    :title="getTypeDescription(col.type)"
                    @click="toggleTypePicker(col.id)"
                  >
                    <span class="type-picker-value">{{ getDisplayType(col.type) }}</span>
                    <span class="type-picker-caret">{{ openTypePickerFor === col.id ? '▲' : '▼' }}</span>
                  </button>
                </div>

                <button
                  class="type-help-btn"
                  type="button"
                  :title="getTypeDescription(col.type)"
                >?</button>

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

                <input
                  type="checkbox"
                  class="col-check"
                  v-model="col.primaryKey"
                  @change="if(col.primaryKey)
                  { col.nullable = false; col.unique = true }"
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
                  class="col-input"
                  style="flex:1"
                  v-model="col.defaultValue"
                  placeholder="default…"
                />

                <button class="del-col-btn" @click="removeColumn(index)" title="Delete column">✕</button>
              </div>
            </template>
          </draggable-list>

          <button class="add-col-btn" @click="addColumn">+ Add Column</button>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <div class="footer-left">
            <button class="btn-danger" @click="deleteTable">Delete Table</button>
          </div>
          <div class="footer-right">
            <button class="btn-cancel" @click="$emit('close')">Cancel</button>
            <button class="btn-save" @click="save">Save Table</button>
          </div>
        </div>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="activeTypePickerColumn && typePickerMenuStyle"
        class="type-picker-menu type-picker-menu-portal"
        :style="typePickerMenuStyle"
      >
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
            <span>{{ isTypeGroupCollapsed(group.label) ? '+' : '−' }}</span>
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
    </Teleport>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, onUnmounted, type ComponentPublicInstance } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useSchemaStore } from '../../stores/schema'
import type { Table, Column } from '../../types'
import { SQL_TYPE_OPTIONS, getSqlTypeDescription, getSqlTypeGroups, type SqlTypeDialectFilter } from '../../types/sqlTypes'

// Simple draggable list using native HTML5 drag
const DraggableList = {
  props: ['columns'],
  emits: ['update'],
  setup(props: any, {slots }: any) {
    return () => {
      const cols = props.columns
      return cols.map((col: Column, i: number) =>
        slots.default({ col, index: i })
      )
    }
  }
}

const TABLE_COLORS = [
  '#3ECF8E', '#3B82F6', '#8B5CF6', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#10B981',
  '#F97316', '#84CC16',
]

const TYPE_DIALECTS: { value: Exclude<SqlTypeDialectFilter, 'all'>; label: string; description: string }[] = [
  { value: 'postgresql', label: 'Postgres', description: 'Show PostgreSQL-specific types, including arrays and JSONB.' },
  { value: 'mysql', label: 'MySQL', description: 'Show MySQL-specific integer, text, and enum types.' },
  { value: 'sqlite', label: 'SQLite', description: 'Show SQLite-friendly storage types.' },
  { value: 'sqlserver', label: 'SQL Server', description: 'Show SQL Server-specific Unicode and binary types.' },
]

const props = defineProps<{ table: Table }>()
const emit = defineEmits<{ close: []; deleted: [] }>()
const store = useSchemaStore()

const localTable = reactive<Table>(JSON.parse(JSON.stringify(props.table)))
const selectedTypeDialect = ref<Exclude<SqlTypeDialectFilter, 'all'>>('postgresql')
const openTypePickerFor = ref<string | null>(null)
const collapsedTypeGroups = ref<Record<string, boolean>>({})
const typePickerTriggerById = ref<Record<string, HTMLElement | null>>({})
const typePickerMenuStyle = ref<Record<string, string> | null>(null)
const filteredTypeGroups = computed(() => getSqlTypeGroups(selectedTypeDialect.value))
const visibleTypeValues = computed(() => new Set(
  filteredTypeGroups.value.flatMap(group => group.types.map(type => type.value))
))
const activeTypePickerColumn = computed(() =>
  localTable.columns.find(column => column.id === openTypePickerFor.value) ?? null
)
const arrayElementOptions = computed(() =>
  SQL_TYPE_OPTIONS.filter(type =>
    !type.value.endsWith('[]') &&
    type.value !== 'ARRAY' &&
    type.dialects.includes('postgresql')
  )
)

function onWindowPointerDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('.type-picker')) return
  if (target?.closest('.type-picker-menu-portal')) return
  openTypePickerFor.value = null
  typePickerMenuStyle.value = null
}

function setTypePickerTrigger(columnId: string, el: Element | ComponentPublicInstance | null) {
  typePickerTriggerById.value = {
    ...typePickerTriggerById.value,
    [columnId]: el instanceof HTMLElement ? el : null,
  }
}

function updateTypePickerPosition(columnId: string) {
  const trigger = typePickerTriggerById.value[columnId]
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const width = 380
  const height = 380
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const left = Math.max(16, Math.min(rect.left, viewportWidth - width - 16))
  const preferredTop = rect.bottom + 6
  const top = preferredTop + height > viewportHeight - 16
    ? Math.max(16, rect.top - height - 6)
    : preferredTop

  typePickerMenuStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${height}px`,
    zIndex: '1600',
  }
}

onMounted(() => {
  window.addEventListener('mousedown', onWindowPointerDown)
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('scroll', onWindowScroll, true)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', onWindowPointerDown)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('scroll', onWindowScroll, true)
})

function getTypeDescription(type: string) {
  return getSqlTypeDescription(type)
}

function getDisplayType(type: string) {
  return showArrayTypeSelector(type) ? 'ARRAY' : type
}

function isTypeVisible(type: string) {
  return visibleTypeValues.value.has(type)
}

function toggleTypePicker(columnId: string) {
  if (openTypePickerFor.value === columnId) {
    openTypePickerFor.value = null
    typePickerMenuStyle.value = null
    return
  }
  openTypePickerFor.value = columnId
  updateTypePickerPosition(columnId)
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
  if (value === 'ARRAY') {
    col.type = `${getArrayElementType(col.type)}[]`
    return
  }
  col.type = value
}

function selectType(col: Column, value: string) {
  onTypeChange(col, value)
  openTypePickerFor.value = null
  typePickerMenuStyle.value = null
}

function onArrayElementTypeChange(col: Column, value: string) {
  col.type = `${value}[]`
}

function onWindowResize() {
  if (openTypePickerFor.value) updateTypePickerPosition(openTypePickerFor.value)
}

function onWindowScroll() {
  if (openTypePickerFor.value) updateTypePickerPosition(openTypePickerFor.value)
}

function addColumn() {
  localTable.columns.push({
    id: uuidv4(),
    name: `column_${localTable.columns.length + 1}`,
    type: 'VARCHAR',
    nullable: true,
    primaryKey: false,
    unique: false,
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
  width: 820px;
  max-width: 95vw;
  max-height: 85vh;
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
  transition: border-color 0.15s;
}

.table-name-input:focus {
  border-bottom-color: #3ECF8E;
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
  transition: transform 0.15s, border-color 0.15s;
}

.color-dot:hover, .color-dot.active {
  transform: scale(1.3);
  border-color: #ffffff80;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.type-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.type-filter-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #555;
}

.type-filter-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.type-filter-tab {
  border: 1px solid #2a2a35;
  background: #121218;
  color: #777;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.type-filter-tab:hover {
  color: #d0d0d8;
  border-color: #3a3a50;
}

.type-filter-tab.active {
  color: #3ECF8E;
  border-color: #3ECF8E50;
  background: #3ECF8E14;
}

.modal-body::-webkit-scrollbar { width: 4px; }
.modal-body::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }

.columns-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 8px 0;
  border-bottom: 1px solid #1e1e28;
  margin-bottom: 4px;
}

.col-head {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #444;
}

.col-head.center {
  text-align: center;
}

.column-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  font-size: 14px;
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
  transition: border-color 0.15s;
  min-width: 0;
}

.col-input:focus {
  border-color: #3ECF8E40;
}

.col-type-select {
  background: #1a1a22;
  cursor: pointer;
}

.type-picker {
  position: relative;
  min-width: 0;
}

.type-picker-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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

.type-picker-menu {
  width: 380px;
  max-height: 380px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #2a2a35;
  border-radius: 10px;
  background: #121218;
  box-shadow: 0 18px 40px #00000070;
  z-index: 30;
}

.type-picker-menu::-webkit-scrollbar { width: 4px; }
.type-picker-menu::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 2px; }

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
  transition: background 0.15s, color 0.15s;
}

.type-group-toggle:hover {
  color: #f0f0f0;
  background: #1c1c24;
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
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.type-option:hover {
  border-color: #3ECF8E40;
  background: #1c1f26;
}

.type-option.active {
  border-color: #3ECF8E55;
  background: #3ECF8E14;
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

.type-help-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #2a2a35;
  background: #121218;
  color: #777;
  cursor: help;
  flex-shrink: 0;
  transition: all 0.15s;
}

.type-help-btn:hover {
  color: #3ECF8E;
  border-color: #3ECF8E40;
}

.array-type-select {
  width: 140px;
  min-width: 140px;
}

.array-type-placeholder {
  width: 140px;
  min-width: 140px;
  flex-shrink: 0;
}

.col-check {
  width: 36px;
  height: 16px;
  cursor: pointer;
  accent-color: #3ECF8E;
  flex-shrink: 0;
}

.del-col-btn {
  background: none;
  border: none;
  color: #333;
  cursor: pointer;
  font-size: 12px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
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
  transition: color 0.15s, border-color 0.15s;
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

.btn-cancel {
  background: none;
  border: 1px solid #2a2a35;
  color: #888;
  border-radius: 7px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  color: #e0e0e0;
  background: #1e1e28;
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
  transition: background 0.15s;
}

.btn-save:hover {
  background: #45e09a;
}

.btn-danger {
  background: none;
  border: 1px solid #EF444440;
  color: #EF4444;
  border-radius: 7px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-danger:hover {
  background: #EF444415;
}
</style>
