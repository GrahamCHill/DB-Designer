<template>
  <div
    class="canvas-root"
    ref="canvasEl"
    @mousedown="onCanvasMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @wheel.prevent="onWheel"
    @contextmenu.prevent
  >
    <svg class="relations-svg" :width="canvasSize.w" :height="canvasSize.h">
      <defs>
        <marker id="arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#3ECF8E" opacity="0.8" />
        </marker>
        <marker id="arrow-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
          <circle cx="3.5" cy="3.5" r="3" fill="#3ECF8E" opacity="0.8" />
        </marker>
      </defs>

      <!-- Existing relations -->
      <g v-for="rel in store.schema.relations" :key="rel.id">
        <path
          :d="getRelationPath(rel)"
          fill="none"
          :stroke="store.selectedRelationId === rel.id ? '#3ECF8E' : '#3ECF8E55'"
          stroke-width="2"
          stroke-dasharray="6,3"
          marker-end="url(#arrow-end)"
          class="relation-line"
          @click="selectRelation(rel.id)"
        />
      </g>

      <!-- In-progress relation drawing -->
      <path
        v-if="drawingRel"
        :d="drawingRelPath"
        fill="none"
        stroke="#3ECF8E"
        stroke-width="2"
        stroke-dasharray="6,3"
        opacity="0.6"
      />
    </svg>

    <div
      class="canvas-content"
      :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }"
    >
      <TableNode
        v-for="table in store.schema.tables"
        :key="table.id"
        :table="table"
        :selected="store.selectedTableId === table.id"
        :drawing-rel="!!drawingRel"
        @mousedown.stop="startDrag(table.id, $event)"
        @select="store.selectedTableId = table.id; store.selectedRelationId = null"
        @start-relation="startRelation(table.id, $event)"
        @end-relation="endRelation(table.id, $event)"
        @edit="store.editingTableId = table.id"
      />
    </div>

    <!-- Empty state -->
    <div v-if="store.schema.tables.length === 0" class="empty-state">
      <div class="empty-icon">⬡</div>
      <p>Your canvas is empty</p>
      <span>Click <strong>+ New Table</strong> in the sidebar to get started</span>
    </div>

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button @click="zoom = Math.min(2, zoom + 0.1)">+</button>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <button @click="zoom = Math.max(0.2, zoom - 0.1)">−</button>
      <button @click="resetView" title="Reset view">⊙</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import TableNode from './TableNode.vue'
import type { Relation } from '../../types'

const store = useSchemaStore()
const canvasEl = ref<HTMLElement>()
const canvasSize = reactive({ w: 4000, h: 4000 })

const zoom = ref(1)
const pan = reactive({ x: 40, y: 40 })

// Dragging tables
const dragging = ref<{ tableId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

// Panning canvas
const panning = ref<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null)

// Drawing relations
const drawingRel = ref<{ fromTableId: string; fromColumnId: string; mouseX: number; mouseY: number } | null>(null)

function startDrag(tableId: string, e: MouseEvent) {
  const table = store.schema.tables.find(t => t.id === tableId)!
  store.selectedTableId = tableId
  store.selectedRelationId = null
  dragging.value = {
    tableId,
    startX: e.clientX,
    startY: e.clientY,
    origX: table.position.x,
    origY: table.position.y,
  }
}

function onCanvasMouseDown(e: MouseEvent) {
  if (e.target === canvasEl.value || (e.target as HTMLElement).classList.contains('canvas-content')) {
    store.selectedTableId = null
    store.selectedRelationId = null
    panning.value = { startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y }
  }
}

function onMouseMove(e: MouseEvent) {
  if (dragging.value) {
    const dx = (e.clientX - dragging.value.startX) / zoom.value
    const dy = (e.clientY - dragging.value.startY) / zoom.value
    store.updateTablePosition(dragging.value.tableId, {
      x: dragging.value.origX + dx,
      y: dragging.value.origY + dy,
    })
  }
  if (panning.value) {
    pan.x = panning.value.origPanX + (e.clientX - panning.value.startX)
    pan.y = panning.value.origPanY + (e.clientY - panning.value.startY)
  }
  if (drawingRel.value) {
    const rect = canvasEl.value!.getBoundingClientRect()
    drawingRel.value.mouseX = (e.clientX - rect.left - pan.x) / zoom.value
    drawingRel.value.mouseY = (e.clientY - rect.top - pan.y) / zoom.value
  }
}

function onMouseUp() {
  dragging.value = null
  panning.value = null
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.08 : 0.08
  zoom.value = Math.min(2, Math.max(0.2, zoom.value + delta))
}

function resetView() {
  zoom.value = 1
  pan.x = 40
  pan.y = 40
}

function selectRelation(id: string) {
  store.selectedRelationId = id
  store.selectedTableId = null
}

function startRelation(tableId: string, columnId: string) {
  const rect = canvasEl.value!.getBoundingClientRect()
  drawingRel.value = { fromTableId: tableId, fromColumnId: columnId, mouseX: 0, mouseY: 0 }
}

function endRelation(tableId: string, columnId: string) {
  if (drawingRel.value && drawingRel.value.fromTableId !== tableId) {
    store.addRelation({
      sourceTableId: drawingRel.value.fromTableId,
      sourceColumnId: drawingRel.value.fromColumnId,
      targetTableId: tableId,
      targetColumnId: columnId,
      type: 'one-to-many',
      label: '',
    })
  }
  drawingRel.value = null
}

function getTableCenter(tableId: string, columnId?: string) {
  const table = store.schema.tables.find(t => t.id === tableId)
  if (!table) return { x: 0, y: 0 }
  const colIndex = columnId ? table.columns.findIndex(c => c.id === columnId) : 0
  return {
    x: table.position.x + 160,
    y: table.position.y + 44 + (colIndex >= 0 ? colIndex * 34 + 17 : 0),
  }
}

function getRelationPath(rel: Relation) {
  const src = getTableCenter(rel.sourceTableId, rel.sourceColumnId)
  const tgt = getTableCenter(rel.targetTableId, rel.targetColumnId)
  const dx = tgt.x - src.x
  const cx = src.x + dx * 0.5
  return `M ${src.x} ${src.y} C ${cx} ${src.y}, ${cx} ${tgt.y}, ${tgt.x} ${tgt.y}`
}

const drawingRelPath = computed(() => {
  if (!drawingRel.value) return ''
  const src = getTableCenter(drawingRel.value.fromTableId, drawingRel.value.fromColumnId)
  const tgt = { x: drawingRel.value.mouseX, y: drawingRel.value.mouseY }
  const dx = tgt.x - src.x
  const cx = src.x + dx * 0.5
  return `M ${src.x} ${src.y} C ${cx} ${src.y}, ${cx} ${tgt.y}, ${tgt.x} ${tgt.y}`
})
</script>

<style scoped>
.canvas-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0f0f10;
  background-image:
    radial-gradient(circle, #2a2a2e 1px, transparent 1px);
  background-size: 28px 28px;
  cursor: default;
  user-select: none;
}

.relations-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.relation-line {
  pointer-events: stroke;
  cursor: pointer;
}

.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 4000px;
  height: 4000px;
  z-index: 2;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  gap: 8px;
  z-index: 0;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.12;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff30;
  margin: 0;
}

.empty-state span {
  font-size: 13px;
  color: #ffffff18;
}

.empty-state strong {
  color: #3ECF8E50;
}

.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #1a1a1f;
  border: 1px solid #2a2a35;
  border-radius: 8px;
  padding: 4px 8px;
  z-index: 100;
}

.zoom-controls button {
  background: none;
  border: none;
  color: #888;
  font-size: 16px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.zoom-controls button:hover {
  color: #fff;
  background: #2a2a35;
}

.zoom-controls span {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
