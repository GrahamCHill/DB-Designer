<template>
  <div class="minimap" ref="minimapEl" @mousedown="onMinimapClick">
    <svg class="minimap-svg" :viewBox="`0 0 ${CANVAS_W} ${CANVAS_H}`">
      <!-- Groups -->
      <rect
        v-for="group in schema.groups"
        :key="'g' + group.id"
        :x="group.position.x"
        :y="group.position.y"
        :width="group.size.w"
        :height="group.size.h"
        :fill="group.color + '15'"
        :stroke="group.color + '60'"
        stroke-width="4"
        rx="12"
      />

      <!-- Relations -->
      <path
        v-for="rel in schema.relations"
        :key="'r' + rel.id"
        :d="getRelPath(rel)"
        fill="none"
        stroke="#3ECF8E"
        stroke-width="3"
        opacity="0.3"
      />

      <!-- Tables -->
      <rect
        v-for="table in schema.tables"
        :key="'t' + table.id"
        :x="table.position.x"
        :y="table.position.y"
        :width="TABLE_WIDTH"
        :height="tableHeight(table)"
        :fill="table.color + '22'"
        :stroke="table.color"
        stroke-width="3"
        rx="8"
      />

      <!-- Viewport indicator -->
      <rect
        class="viewport-rect"
        :x="viewportRect.x"
        :y="viewportRect.y"
        :width="viewportRect.w"
        :height="viewportRect.h"
        fill="none"
        stroke="#ffffff"
        stroke-width="4"
        opacity="0.3"
        rx="4"
      />
    </svg>
    <div class="minimap-label">MAP</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import type { Relation, Table } from '../../types'
import { TABLE_WIDTH, TABLE_HEADER_H, TABLE_COL_PAD_TOP, TABLE_ROW_H } from '../../types'

const props = defineProps<{
  pan: { x: number; y: number }
  zoom: number
  viewportW: number
  viewportH: number
}>()

const emit = defineEmits<{
  'navigate': [x: number, y: number]
}>()

const store = useSchemaStore()
const schema = computed(() => store.schema)
const minimapEl = ref<HTMLElement>()

const CANVAS_W = 6000
const CANVAS_H = 6000

function tableHeight(table: Table) {
  return TABLE_HEADER_H + TABLE_COL_PAD_TOP + table.columns.length * TABLE_ROW_H + 29
}

function getConnector(tableId: string, colId: string, side: 'left' | 'right') {
  const t = schema.value.tables.find(t => t.id === tableId)
  if (!t) return { x: 0, y: 0 }
  const idx = t.columns.findIndex(c => c.id === colId)
  return {
    x: t.position.x + (side === 'right' ? TABLE_WIDTH : 0),
    y: t.position.y + TABLE_HEADER_H + TABLE_COL_PAD_TOP + (idx >= 0 ? idx : 0) * TABLE_ROW_H + TABLE_ROW_H / 2,
  }
}

function getRelPath(rel: Relation) {
  const src = getConnector(rel.sourceTableId, rel.sourceColumnId, 'right')
  const tgt = getConnector(rel.targetTableId, rel.targetColumnId, 'left')
  const cx = Math.abs(tgt.x - src.x) * 0.5
  return `M ${src.x} ${src.y} C ${src.x + cx} ${src.y}, ${tgt.x - cx} ${tgt.y}, ${tgt.x} ${tgt.y}`
}

// The viewport rect in canvas-space
const viewportRect = computed(() => {
  const x = -props.pan.x / props.zoom
  const y = -props.pan.y / props.zoom
  const w = props.viewportW / props.zoom
  const h = props.viewportH / props.zoom
  return { x, y, w, h }
})

function onMinimapClick(e: MouseEvent) {
  const rect = minimapEl.value!.getBoundingClientRect()
  const mx = (e.clientX - rect.left) / rect.width
  const my = (e.clientY - rect.top) / rect.height

  // Canvas coords at click
  const cx = mx * CANVAS_W
  const cy = my * CANVAS_H

  // Convert to pan — centre viewport on that point
  const newPanX = -(cx * props.zoom) + props.viewportW / 2
  const newPanY = -(cy * props.zoom) + props.viewportH / 2

  emit('navigate', newPanX, newPanY)
}
</script>

<style scoped>
.minimap {
  position: absolute;
  bottom: 64px;
  right: 20px;
  width: 180px;
  height: 120px;
  background: #0f0f12ee;
  border: 1px solid #2a2a35;
  border-radius: 8px;
  overflow: hidden;
  z-index: 150;
  cursor: crosshair;
  box-shadow: 0 4px 20px #00000060;
}

.minimap-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.viewport-rect {
  pointer-events: none;
}

.minimap-label {
  position: absolute;
  top: 5px;
  right: 7px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #333;
}
</style>
