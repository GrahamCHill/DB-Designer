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
          <div class="columns-header">
            <span class="col-head" style="width:24px"></span>
            <span class="col-head" style="flex:1.5">Column Name</span>
            <span class="col-head" style="flex:1">Type</span>
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

                <select class="col-input col-type-select" style="flex:1" v-model="col.type">
                  <optgroup v-for="group in TYPE_GROUPS" :label="group.label" :key="group.label">
                    <option v-for="t in group.types" :key="t" :value="t">{{ t }}</option>
                  </optgroup>
                </select>

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
  </Teleport>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useSchemaStore } from '../../stores/schema'
import type { Table, Column } from '../../types'

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

const TYPE_GROUPS = [
  { label: 'Integer', types: ['INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL'] },
  { label: 'String', types: ['VARCHAR', 'TEXT', 'CHAR'] },
  { label: 'Boolean', types: ['BOOLEAN'] },
  { label: 'Float', types: ['FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC'] },
  { label: 'Date/Time', types: ['DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ'] },
  { label: 'Special', types: ['UUID', 'JSON', 'JSONB', 'BYTEA', 'ARRAY'] },
]

const props = defineProps<{ table: Table }>()
const emit = defineEmits<{ close: []; deleted: [] }>()
const store = useSchemaStore()

const localTable = reactive<Table>(JSON.parse(JSON.stringify(props.table)))

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
