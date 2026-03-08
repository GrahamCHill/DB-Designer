<template>
  <div
    class="table-node"
    :class="{ selected, 'drawing-mode': drawingRel }"
    :style="{
      left: table.position.x + 'px',
      top: table.position.y + 'px',
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
        <!-- Left connector (target) -->
        <div
          class="connector connector-left"
          :title="`Connect to ${col.name}`"
          @mouseup.stop="$emit('end-relation', col.id)"
        />

        <div class="col-badges">
          <span v-if="col.primaryKey" class="badge pk" title="Primary Key">PK</span>
          <span v-else-if="col.unique" class="badge uq" title="Unique">UQ</span>
          <span v-else-if="!col.nullable" class="badge nn" title="Not Null">NN</span>
          <span v-else class="badge empty" />
        </div>

        <span class="col-name">{{ col.name }}</span>
        <span class="col-type">{{ col.type }}</span>

        <!-- Right connector (source) -->
        <div
          class="connector connector-right"
          :title="`Drag to create relation from ${col.name}`"
          @mousedown.stop="$emit('start-relation', col.id)"
        />
      </div>

      <div v-if="table.columns.length === 0" class="no-columns">
        No columns yet
      </div>
    </div>

    <!-- Footer -->
    <div class="table-footer">
      <span class="col-count">{{ table.columns.length }} column{{ table.columns.length !== 1 ? 's' : '' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Table } from '../../types'

defineProps<{
  table: Table
  selected: boolean
  drawingRel: boolean
}>()

defineEmits<{
  mousedown: [e: MouseEvent]
  select: []
  edit: []
  'start-relation': [columnId: string]
  'end-relation': [columnId: string]
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

.table-node:active {
  cursor: grabbing;
}

.table-node.selected {
  border-color: var(--table-color);
  box-shadow: 0 0 0 2px var(--table-color)40, 0 8px 32px #00000080;
}

.table-node.drawing-mode {
  cursor: crosshair;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a35;
  border-left: 3px solid;
  border-radius: 9px 9px 0 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-icon {
  font-size: 14px;
  line-height: 1;
}

.table-name {
  font-size: 13px;
  font-weight: 700;
  color: #f0f0f0;
  letter-spacing: 0.02em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.header-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.table-node:hover .header-actions {
  opacity: 1;
}

.icon-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}

.icon-btn:hover {
  color: #fff;
  background: #2a2a35;
}

.columns-list {
  padding: 4px 0;
}

.column-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 34px;
  position: relative;
  transition: background 0.1s;
}

.column-row:hover {
  background: #1e1e25;
}

.column-row.is-pk {
  background: #1a1f1a;
}

.column-row.is-pk:hover {
  background: #1e2620;
}

.connector {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #3a3a45;
  background: #16161a;
  cursor: crosshair;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
  z-index: 10;
}

.connector-left {
  left: -6px;
}

.connector-right {
  right: -6px;
}

.connector:hover {
  border-color: #3ECF8E;
  background: #3ECF8E;
  transform: scale(1.3);
}

.col-badges {
  width: 24px;
  flex-shrink: 0;
}

.badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  letter-spacing: 0.05em;
}

.badge.pk {
  background: #3ECF8E20;
  color: #3ECF8E;
  border: 1px solid #3ECF8E40;
}

.badge.uq {
  background: #3B82F620;
  color: #3B82F6;
  border: 1px solid #3B82F640;
}

.badge.nn {
  background: #F59E0B20;
  color: #F59E0B;
  border: 1px solid #F59E0B40;
}

.badge.empty {
  display: inline-block;
  width: 24px;
}

.col-name {
  flex: 1;
  font-size: 12.5px;
  color: #d0d0d8;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-type {
  font-size: 11px;
  color: #3ECF8E90;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  flex-shrink: 0;
}

.no-columns {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #444;
  font-style: italic;
}

.table-footer {
  padding: 6px 12px;
  border-top: 1px solid #1e1e25;
}

.col-count {
  font-size: 11px;
  color: #444;
}
</style>
