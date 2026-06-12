<template>
  <div
    class="table-node"
    :class="{
      selected,
      highlighted,
      'drawing-mode': drawingRel,
      'read-only': readOnly,
    }"
    :style="{
      left:  table.position.x + 'px',
      top:   table.position.y + 'px',
      width: table.width + 'px',
      '--table-color': table.color,
      '--table-color-rgb': hexToRgb(table.color),
      '--dot-color-rgb': hexToRgb(table.color),
    }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('select', $event)"
  >
    <div class="table-header" :style="{ borderColor: table.color }">
      <div class="header-left">
        <span class="table-icon" :style="{ color: table.color }">DB</span>
        <span class="table-name">{{ table.name }}</span>
      </div>
      <div class="header-actions">
        <button v-if="!readOnly" class="icon-btn" @click.stop="$emit('edit')" title="Edit table">Edit</button>
        <button v-if="readOnly" class="icon-btn primary" @click.stop="$emit('generate-api', table)" title="Generate API for this table">API</button>
      </div>
    </div>

    <div class="columns-list">
      <div
        v-for="col in table.columns"
        :key="col.id"
        class="column-row"
        :class="{
          'is-pk': col.primaryKey,
          'has-type-mismatch': mismatchedColumns.has(col.id),
          'has-connection-error': invalidColumns.has(col.id),
        }"
        :title="columnIssues[col.id]?.join(' | ') ?? ''"
      >
        <div
          v-if="!readOnly"
          class="connector connector-left"
          :class="{ connected: connectedAsTarget.has(col.id) }"
          :style="connectedAsTarget.has(col.id) ? { '--dot-color': table.color } : {}"
          title="Input - drop a relation here"
          @mousedown.stop="$emit('start-relation', { columnId: col.id, side: 'left', event: $event })"
          @mouseup.stop="$emit('end-relation', { columnId: col.id, side: 'left' })"
        />

        <div class="col-badges">
          <span v-if="col.primaryKey" class="badge pk" title="Primary Key">PK</span>
          <span v-else-if="col.unique" class="badge uq" title="Unique">UQ</span>
          <span v-else-if="!col.nullable" class="badge nn" title="Not Null">NN</span>
          <span v-else class="badge empty" />
        </div>

        <span class="col-name">{{ col.name }}</span>
        <span class="col-type">{{ col.type }}</span>

        <div
          v-if="!readOnly"
          class="connector connector-right"
          :class="{ connected: connectedAsSource.has(col.id) }"
          :style="connectedAsSource.has(col.id) ? { '--dot-color': table.color } : {}"
          title="Output - drag to connect"
          @mousedown.stop="$emit('start-relation', { columnId: col.id, side: 'right', event: $event })"
          @mouseup.stop="$emit('end-relation', { columnId: col.id, side: 'right' })"
        />
      </div>

      <div v-if="table.columns.length === 0" class="no-columns">No columns yet</div>
    </div>

    <div class="table-footer">
      <span class="col-count">{{ table.columns.length }} col{{ table.columns.length !== 1 ? 's' : '' }}</span>
      <span v-if="connectedAsSource.size + connectedAsTarget.size > 0" class="conn-count">
        {{ connectedAsSource.size + connectedAsTarget.size }} rel{{ (connectedAsSource.size + connectedAsTarget.size) !== 1 ? 's' : '' }}
      </span>
    </div>

    <div
      v-if="!readOnly"
      class="resize-handle"
      title="Drag to resize"
      @mousedown.stop="$emit('resize-start', $event)"
    >::</div>
  </div>
</template>

<script setup lang="ts">
import type { Table } from '../../types'

defineProps<{
  table: Table
  selected: boolean
  highlighted: boolean
  drawingRel: boolean
  connectedAsSource: Set<string>
  connectedAsTarget: Set<string>
  mismatchedColumns: Set<string>
  invalidColumns: Set<string>
  columnIssues: Record<string, string[]>
  readOnly?: boolean
}>()

defineEmits<{
  mousedown: [e: MouseEvent]
  select: [e: MouseEvent]
  edit: []
  'start-relation': [data: { columnId: string, side: 'left' | 'right', event: MouseEvent }]
  'end-relation': [data: { columnId: string, side: 'left' | 'right' }]
  'resize-start': [e: MouseEvent]
  'generate-api': [table: Table]
}>()

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
</script>

<style scoped>
.table-node {
  position: absolute;
  min-width: 240px;
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 10px;
  box-shadow: 0 4px 24px #00000060;
  overflow: visible;
  cursor: grab;
  transition: box-shadow 0.2s, border-color 0.2s;
  box-sizing: border-box;
}
.table-node:active { cursor: grabbing; }

.table-node.selected {
  border-color: var(--table-color);
  box-shadow: 0 0 0 2px rgba(var(--table-color-rgb, 62, 207, 142), 0.4),
              0 8px 32px #00000080;
}
.table-node.highlighted {
  border-color: var(--table-color);
  box-shadow:
    0 0 0 2px rgba(var(--table-color-rgb, 62, 207, 142), 0.55),
    0 0 28px rgba(var(--table-color-rgb, 62, 207, 142), 0.25),
    0 8px 32px #00000080;
}
.table-node.drawing-mode { cursor: crosshair; }

.table-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a35;
  border-left: 3px solid;
  border-radius: 9px 9px 0 0;
}
.header-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.table-icon  { font-size: 10px; line-height: 1; flex-shrink: 0; font-weight: 700; letter-spacing: 0.08em; }
.table-name  {
  font-size: 13px; font-weight: 700; color: #f0f0f0;
  letter-spacing: 0.02em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.header-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.table-node:hover .header-actions,
.table-node.selected .header-actions { opacity: 1; }

.icon-btn {
  background: none; border: none; color: #666; cursor: pointer;
  font-size: 9px; min-width: 32px; height: 22px; padding: 0 6px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.icon-btn:hover        { color: #fff;    background: #2a2a35; }
.icon-btn.danger:hover { color: #EF4444; background: #EF444420; }

.columns-list { padding: 4px 0; }
.column-row {
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px; height: 34px; position: relative;
  transition: background 0.1s;
}
.column-row:hover       { background: #1e1e25; }
.column-row.is-pk       { background: #1a1f1a; }
.column-row.is-pk:hover { background: #1e2620; }
.column-row.has-type-mismatch {
  background: rgba(245, 158, 11, 0.12);
  box-shadow: inset 2px 0 0 #F59E0B;
}
.column-row.has-connection-error {
  background: rgba(239, 68, 68, 0.12);
  box-shadow: inset 2px 0 0 #EF4444;
}
.column-row.has-type-mismatch .col-type,
.column-row.has-connection-error .col-type {
  color: #f3b36b;
}
.column-row.has-connection-error .col-name {
  color: #f2b1b1;
}

.connector {
  position: absolute;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid #3a3a45;
  background: #16161a;
  cursor: crosshair; z-index: 10;
  transition: border-color 0.12s, background 0.12s, transform 0.12s, box-shadow 0.12s;
}
.connector-left  { left: -6px; }
.connector-right { right: -6px; }

.connector.connected {
  border-color: var(--dot-color, #3ECF8E);
  background:   var(--dot-color, #3ECF8E);
  box-shadow: 0 0 6px rgba(var(--dot-color-rgb, 62, 207, 142), 0.6);
}
.connector:hover {
  border-color: #3ECF8E !important;
  background:   #3ECF8E !important;
  transform: scale(1.35);
  box-shadow: 0 0 8px #3ECF8E80 !important;
}

.connector-left::after {
  content: 'L'; position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  font-size: 8px; font-weight: 700; color: #3a3a55; letter-spacing: 0.08em;
  font-family: 'JetBrains Mono', monospace; pointer-events: none; opacity: 0; transition: opacity 0.12s;
}
.connector-right::after {
  content: 'R'; position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  font-size: 8px; font-weight: 700; color: #3a3a55; letter-spacing: 0.08em;
  font-family: 'JetBrains Mono', monospace; pointer-events: none; opacity: 0; transition: opacity 0.12s;
}
.column-row:hover .connector-left::after,
.column-row:hover .connector-right::after { opacity: 1; }

.col-badges { width: 24px; flex-shrink: 0; }
.badge { font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; letter-spacing: 0.05em; }
.badge.pk { background: #3ECF8E20; color: #3ECF8E; border: 1px solid #3ECF8E40; }
.badge.uq { background: #3B82F620; color: #3B82F6; border: 1px solid #3B82F640; }
.badge.nn { background: #F59E0B20; color: #F59E0B; border: 1px solid #F59E0B40; }
.badge.empty { display: inline-block; width: 24px; }

.col-name {
  flex: 1;
  min-width: 0;
  color: #f0f0f0;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.col-type {
  color: #8b95a7;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
}
.no-columns {
  padding: 18px 14px;
  text-align: center;
  color: #71717a;
  font-size: 12px;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px 10px;
  border-top: 1px solid #22232d;
  color: #71717a;
  font-size: 11px;
}
.conn-count { color: #8b95a7; }

.resize-handle {
  position: absolute;
  right: 6px;
  bottom: 4px;
  color: #5b6170;
  cursor: nwse-resize;
  font-size: 11px;
  letter-spacing: 0.08em;
}
.table-node.read-only {
  cursor: pointer;
}
.table-node.read-only:hover {
  border-color: #3B82F680;
  box-shadow: 0 0 15px #3B82F630;
}
.icon-btn.primary {
  color: #3B82F6;
}
.icon-btn.primary:hover {
  background: #3B82F620;
}
</style>
