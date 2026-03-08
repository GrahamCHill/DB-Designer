<template>
  <div
    class="table-node"
    :class="{
      selected,
      highlighted,
      'drawing-mode': drawingRel,
    }"
    :style="{
      left: table.position.x + 'px',
      top:  table.position.y + 'px',
      '--table-color': table.color,
    }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('select')"
  >
    <!-- Header -->
    <div class="table-header" :style="{ borderColor: table.color }">
      <div class="header-left">
        <span class="table-icon" :style="{ color: table.color }">⬡</span>
        <span class="table-name">{{ table.name }}</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" @click.stop="$emit('edit')" title="Edit table">✎</button>
      </div>
    </div>

    <!-- Columns -->
    <div class="columns-list">
      <div
        v-for="col in table.columns"
        :key="col.id"
        class="column-row"
        :class="{ 'is-pk': col.primaryKey }"
      >
        <!--
          LEFT connector = INPUT only.
          - Always shown, accepts dropped relations (end-relation).
          - Filled if this column is a target of any relation.
          - Cannot start a relation from here.
        -->
        <div
          class="connector connector-left"
          :class="{ connected: connectedAsTarget.has(col.id) }"
          :style="connectedAsTarget.has(col.id) ? { '--dot-color': table.color } : {}"
          title="Input — drop a relation here"
          @mouseup.stop="$emit('end-relation', col.id)"
        />

        <div class="col-badges">
          <span v-if="col.primaryKey"   class="badge pk" title="Primary Key">PK</span>
          <span v-else-if="col.unique"  class="badge uq" title="Unique">UQ</span>
          <span v-else-if="!col.nullable" class="badge nn" title="Not Null">NN</span>
          <span v-else class="badge empty" />
        </div>

        <span class="col-name">{{ col.name }}</span>
        <span class="col-type">{{ col.type }}</span>

        <!--
          RIGHT connector = OUTPUT only.
          - Drag to start a relation from this column.
          - Filled if this column is a source of any relation.
          - Cannot accept dropped relations.
        -->
        <div
          class="connector connector-right"
          :class="{ connected: connectedAsSource.has(col.id) }"
          :style="connectedAsSource.has(col.id) ? { '--dot-color': table.color } : {}"
          title="Output — drag to connect"
          @mousedown.stop="$emit('start-relation', col.id)"
        />
      </div>

      <div v-if="table.columns.length === 0" class="no-columns">
        No columns yet
      </div>
    </div>

    <!-- Footer -->
    <div class="table-footer">
      <div class="footer-left">
        <span class="col-count">
          {{ table.columns.length }} col{{ table.columns.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <div class="footer-right">
        <span v-if="connectedAsSource.size > 0 || connectedAsTarget.size > 0" class="conn-count">
          {{ connectedAsSource.size + connectedAsTarget.size }}
          relation{{ (connectedAsSource.size + connectedAsTarget.size) !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Table } from '../../types'

const props = defineProps<{
  table: Table
  selected: boolean
  highlighted: boolean        // true when a connected relation is selected
  drawingRel: boolean
  connectedAsSource: Set<string>   // column IDs that are sources of relations
  connectedAsTarget: Set<string>   // column IDs that are targets of relations
}>()

defineEmits<{
  mousedown: [e: MouseEvent]
  select: []
  edit: []
  'start-relation': [columnId: string]
  'end-relation':   [columnId: string]
}>()
</script>

<style scoped>
.table-node {
  position: absolute;
  width: 320px;
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 10px;
  box-shadow: 0 4px 24px #00000060;
  overflow: visible;
  cursor: grab;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.table-node:active { cursor: grabbing; }

.table-node.selected {
  border-color: var(--table-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--table-color) 40%, transparent),
              0 8px 32px #00000080;
}

/* Highlighted = a relation touching this table is selected */
.table-node.highlighted {
  border-color: var(--table-color);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--table-color) 55%, transparent),
    0 0 28px color-mix(in srgb, var(--table-color) 25%, transparent),
    0 8px 32px #00000080;
}

.table-node.drawing-mode { cursor: crosshair; }

/* Header */
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a35;
  border-left: 3px solid;
  border-radius: 9px 9px 0 0;
}

.header-left { display: flex; align-items: center; gap: 8px; }
.table-icon  { font-size: 14px; line-height: 1; }
.table-name  {
  font-size: 13px; font-weight: 700; color: #f0f0f0;
  letter-spacing: 0.02em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.header-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.table-node:hover .header-actions { opacity: 1; }

.icon-btn {
  background: none; border: none; color: #666; cursor: pointer;
  font-size: 14px; width: 24px; height: 24px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.icon-btn:hover { color: #fff; background: #2a2a35; }

/* Column rows */
.columns-list { padding: 4px 0; }

.column-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 34px;
  position: relative;
  transition: background 0.1s;
}
.column-row:hover   { background: #1e1e25; }
.column-row.is-pk   { background: #1a1f1a; }
.column-row.is-pk:hover { background: #1e2620; }

/* ── Connectors ────────────────────────────────────────────── */

.connector {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  /* default: empty ring */
  border: 2px solid #3a3a45;
  background: #16161a;
  cursor: crosshair;
  z-index: 10;
  transition: border-color 0.12s, background 0.12s, transform 0.12s, box-shadow 0.12s;
}

/* LEFT = input */
.connector-left  { left: -6px; }
/* RIGHT = output */
.connector-right { right: -6px; }

/* Connected state — filled with the table's colour */
.connector.connected {
  border-color: var(--dot-color, #3ECF8E);
  background:   var(--dot-color, #3ECF8E);
  box-shadow: 0 0 6px color-mix(in srgb, var(--dot-color, #3ECF8E) 60%, transparent);
}

/* Hover — always turn green-ish regardless of state */
.connector:hover {
  border-color: #3ECF8E !important;
  background:   #3ECF8E !important;
  transform: scale(1.35);
  box-shadow: 0 0 8px #3ECF8E80 !important;
}

/* Left connector label hint — "IN" */
.connector-left::after {
  content: 'IN';
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  font-weight: 700;
  color: #3a3a55;
  letter-spacing: 0.08em;
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s;
}

/* Right connector label hint — "OUT" */
.connector-right::after {
  content: 'OUT';
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  font-weight: 700;
  color: #3a3a55;
  letter-spacing: 0.08em;
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s;
}

.column-row:hover .connector-left::after,
.column-row:hover .connector-right::after {
  opacity: 1;
}

/* Badges */
.col-badges { width: 24px; flex-shrink: 0; }

.badge {
  font-size: 9px; font-weight: 700;
  padding: 1px 4px; border-radius: 3px; letter-spacing: 0.05em;
}
.badge.pk { background: #3ECF8E20; color: #3ECF8E; border: 1px solid #3ECF8E40; }
.badge.uq { background: #3B82F620; color: #3B82F6; border: 1px solid #3B82F640; }
.badge.nn { background: #F59E0B20; color: #F59E0B; border: 1px solid #F59E0B40; }
.badge.empty { display: inline-block; width: 24px; }

.col-name {
  flex: 1; font-size: 12.5px; color: #d0d0d8;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.col-type {
  font-size: 11px; color: #3ECF8E90;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  flex-shrink: 0;
}

.no-columns {
  padding: 12px; text-align: center;
  font-size: 12px; color: #444; font-style: italic;
}

/* Footer */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-top: 1px solid #1e1e25;
}

.col-count  { font-size: 11px; color: #444; }
.conn-count { font-size: 11px; color: #3ECF8E80; }
</style>
