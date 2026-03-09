<template>
  <div
    class="canvas-root"
    ref="canvasEl"
    @mousedown="onCanvasMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @wheel.prevent="onWheel"
    @contextmenu.prevent
  >
    <div class="canvas-content" :style="contentStyle">
      <!-- Groups rendered in depth order: deepest (largest area) first, shallowest on top -->
      <GroupNode
        v-for="group in sortedGroups"
        :key="group.id"
        :group="group"
        :depth="groupDepth(group.id)"
        :selected="store.selectedGroupId === group.id"
        @mousedown-header="startGroupDrag(group.id, $event)"
        @mousedown-resize="startGroupResize(group.id, $event)"
        @select="selectGroup(group.id)"
        @edit="store.editingGroupId = group.id"
      />

      <!-- SVG: relations + labels (inside canvas-content so coords match) -->
      <svg class="relations-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3ECF8E" opacity="0.9" />
          </marker>
        </defs>

        <g v-for="rel in store.schema.relations" :key="rel.id">
          <path
            :d="getRelationPath(rel)"
            fill="none"
            :stroke="store.selectedRelationId === rel.id ? '#3ECF8E' : '#3ECF8E55'"
            :stroke-width="store.selectedRelationId === rel.id ? 2 : 1.5"
            stroke-dasharray="5,3"
            marker-end="url(#arrow-end)"
          />
          <!-- Wide hit area -->
          <path
            :d="getRelationPath(rel)"
            fill="none" stroke="transparent" stroke-width="14"
            class="relation-hit"
            @click.stop="selectRelation(rel.id)"
          />
          <!-- Cardinality labels -->
          <g v-if="relLabelPos(rel)" class="rel-labels">
            <text :x="relLabelPos(rel)!.src.x" :y="relLabelPos(rel)!.src.y" class="rel-label"
              :fill="store.selectedRelationId === rel.id ? '#3ECF8E' : '#3ECF8E99'">{{ srcLabel(rel.type) }}</text>
            <text :x="relLabelPos(rel)!.tgt.x" :y="relLabelPos(rel)!.tgt.y" class="rel-label"
              :fill="store.selectedRelationId === rel.id ? '#3ECF8E' : '#3ECF8E99'">{{ tgtLabel(rel.type) }}</text>
          </g>
        </g>

        <!-- In-progress relation -->
        <path v-if="drawingRel" :d="drawingRelPath"
          fill="none" stroke="#3ECF8E" stroke-width="1.5" stroke-dasharray="5,3"
          opacity="0.7" pointer-events="none" />
      </svg>

      <!-- Tables -->
      <TableNode
        v-for="table in store.schema.tables"
        :key="table.id"
        :table="table"
        :selected="store.selectedTableId === table.id"
        :highlighted="highlightedTableIds.has(table.id) && store.selectedTableId !== table.id"
        :drawing-rel="!!drawingRel"
        :connected-as-source="sourceColsByTable.get(table.id) ?? emptySet"
        :connected-as-target="targetColsByTable.get(table.id) ?? emptySet"
        :read-only="readOnly && !interactive"
        @mousedown.stop="!readOnly && startTableDrag(table.id, $event)"
        @select="selectTable(table.id)"
        @start-relation="!readOnly && startRelation(table.id, $event)"
        @end-relation="!readOnly && endRelation(table.id, $event)"
        @edit="!readOnly && (store.editingTableId = table.id)"
        @delete="!readOnly && store.deleteTable(table.id)"
        @resize-start="!readOnly && startTableResize(table.id, $event)"
        @generate-api="$emit('generate-api', $event)"
      />
    </div>

    <!-- Empty state -->
    <div v-if="store.schema.tables.length === 0 && store.schema.groups.length === 0" class="empty-state">
      <div class="empty-hex">⬡</div>
      <p>Canvas is empty</p>
      <span>Use the sidebar to add tables or groups</span>
    </div>

    <!-- Relation type bar (appears when a relation is selected) -->
    <div v-if="store.selectedRelationId && selectedRelData" class="rel-type-bar">
      <span class="rel-type-label">Relation type:</span>
      <button v-for="type in REL_TYPES" :key="type.value" class="rel-type-btn"
        :class="{ active: selectedRelData.type === type.value }"
        @click="store.updateRelation(store.selectedRelationId!, { type: type.value })">
        {{ type.label }}
      </button>
      <button class="rel-type-del" @click="store.deleteRelation(store.selectedRelationId!)">✕ Delete</button>
    </div>

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button @click="adjustZoom(0.1)">+</button>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <button @click="adjustZoom(-0.1)">−</button>
      <button @click="resetView" title="Reset view">⊙</button>
    </div>

    <!-- Minimap -->
    <MinimapPanel v-if="store.showMinimap && !readOnly" :pan="pan" :zoom="zoom" :viewport-w="canvasW" :viewport-h="canvasH"
      @navigate="onMinimapNavigate" />

    <!-- Group editor modal -->
    <GroupEditorModal
      v-if="store.editingGroupId && editingGroupData"
      :group="editingGroupData"
      @close="store.editingGroupId = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import TableNode from './TableNode.vue'
import GroupNode from './GroupNode.vue'
import MinimapPanel from './MinimapPanel.vue'
import GroupEditorModal from '../modals/GroupEditorModal.vue'
import type { Relation, RelationType } from '../../types'
import { TABLE_WIDTH, TABLE_HEADER_H, TABLE_COL_PAD_TOP, TABLE_ROW_H } from '../../types'
import { getDescendants } from '../../composables/useContainment'

const props = defineProps<{
  readOnly?: boolean
  interactive?: boolean
}>()

const store = useSchemaStore()
const emptySet = new Set<string>()  // stable empty set so Vue doesn't re-render every frame
const canvasEl = ref<HTMLDivElement>()
const canvasW  = ref(800)
const canvasH  = ref(600)

const emit = defineEmits<{
  'generate-api': [table: any]
}>()

onMounted(() => {
  // Delete key removes selected table or relation
  const onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (store.selectedTableId) {
        store.deleteTable(store.selectedTableId)
        e.preventDefault()
      } else if (store.selectedRelationId) {
        store.deleteRelation(store.selectedRelationId)
        e.preventDefault()
      }
    }
  }
  window.addEventListener('keydown', onKeyDown)
  // Clean up on unmount would need onUnmounted — skipping for now as canvas lives for app lifetime

  if (canvasEl.value && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        canvasW.value = e.contentRect.width
        canvasH.value = e.contentRect.height
      }
    })
    ro.observe(canvasEl.value)
  }
})

const REL_TYPES: { value: RelationType; label: string }[] = [
  { value: 'one-to-one',   label: '1 : 1' },
  { value: 'one-to-many',  label: '1 : N' },
  { value: 'many-to-many', label: 'N : M' },
]

// ── Viewport ─────────────────────────────────────────────────────────────────
const zoom = ref(1)
const pan  = reactive({ x: 40, y: 40 })

const contentStyle = computed(() => ({
  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

// ── Group render order ────────────────────────────────────────────────────────
// Largest area first (painted behind), smallest last (painted in front / on top)
const sortedGroups = computed(() =>
  [...store.schema.groups].sort((a, b) => (b.size.w * b.size.h) - (a.size.w * a.size.h))
)

// Depth of a group in the nesting tree (root = 0)
function groupDepth(groupId: string): number {
  let depth = 0
  let current: string | null = groupId
  const safety = store.schema.groups.length + 1
  let i = 0
  while (i++ < safety) {
    const g = store.schema.groups.find(g => g.id === current)
    if (!g || g.parentGroupId === null) break
    depth++
    current = g.parentGroupId
  }
  return depth
}

// ── Drag types ────────────────────────────────────────────────────────────────
type TableDrag = {
  kind: 'table'
  id: string
  origX: number; origY: number
}

type TableResizeDrag = {
  kind: 'table-resize'
  id: string
  origW: number
}

type GroupDrag = {
  kind: 'group'
  id: string
  origX: number; origY: number
  // Snapshot taken at drag-start — used for steal-prevention
  ownedTablesBefore: Set<string>       // all table IDs in this group's subtree
  ownedGroupsBefore: Set<string>       // direct child group IDs
  // Positions snapshotted so descendant groups & tables move rigidly
  subtreeGroupOrigPos: Record<string, { x: number; y: number }>  // descendant group id → orig pos
  subtreeTableOrigPos: Record<string, { x: number; y: number }>  // table id → orig pos
}

type ResizeDrag = {
  kind: 'resize'
  id: string
  origW: number; origH: number
}

type PanDrag = { kind: 'pan' }

type AnyDrag = (TableDrag | TableResizeDrag | GroupDrag | ResizeDrag | PanDrag) & {
  startClientX: number
  startClientY: number
}

const drag = ref<AnyDrag | null>(null)

// ── Relation drawing ──────────────────────────────────────────────────────────
const drawingRel = ref<{
  fromTableId: string; fromColumnId: string
  side: 'right' | 'left'; mouseX: number; mouseY: number
} | null>(null)

// ── Geometry helpers ──────────────────────────────────────────────────────────

function toCanvas(clientX: number, clientY: number) {
  const rect = canvasEl.value!.getBoundingClientRect()
  return {
    x: (clientX - rect.left - pan.x) / zoom.value,
    y: (clientY - rect.top  - pan.y) / zoom.value,
  }
}

function connectorPos(tableId: string, colId: string, side: 'left' | 'right') {
  const table = store.schema.tables.find(t => t.id === tableId)
  if (!table) return { x: 0, y: 0 }
  const idx = Math.max(0, table.columns.findIndex(c => c.id === colId))
  return {
    x: table.position.x + (side === 'right' ? (table.width ?? TABLE_WIDTH) : 0),
    y: table.position.y + TABLE_HEADER_H + TABLE_COL_PAD_TOP + idx * TABLE_ROW_H + TABLE_ROW_H / 2,
  }
}

function makeCurve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const cx = Math.max(Math.abs(b.x - a.x) * 0.5, 80)
  return `M ${a.x} ${a.y} C ${a.x + cx} ${a.y}, ${b.x - cx} ${b.y}, ${b.x} ${b.y}`
}

function getRelationPath(rel: Relation) {
  return makeCurve(
    connectorPos(rel.sourceTableId, rel.sourceColumnId, 'right'),
    connectorPos(rel.targetTableId, rel.targetColumnId, 'left'),
  )
}

function relLabelPos(rel: Relation) {
  const src = connectorPos(rel.sourceTableId, rel.sourceColumnId, 'right')
  const tgt = connectorPos(rel.targetTableId, rel.targetColumnId, 'left')
  return {
    src: { x: src.x + 14, y: src.y - 6 },
    tgt: { x: tgt.x - 22, y: tgt.y - 6 },
  }
}

function srcLabel(type: RelationType) { return type === 'many-to-many' ? 'N' : '1' }
function tgtLabel(type: RelationType) {
  if (type === 'one-to-one') return '1'
  if (type === 'one-to-many') return 'N'
  return 'M'
}

const drawingRelPath = computed(() => {
  if (!drawingRel.value) return ''
  return makeCurve(
    connectorPos(drawingRel.value.fromTableId, drawingRel.value.fromColumnId, drawingRel.value.side),
    { x: drawingRel.value.mouseX, y: drawingRel.value.mouseY },
  )
})

const selectedRelData = computed(() =>
  store.schema.relations.find(r => r.id === store.selectedRelationId) ?? null
)

// For each table: which column IDs appear as sources (right/output) of any relation
const sourceColsByTable = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const rel of store.schema.relations) {
    if (!map.has(rel.sourceTableId)) map.set(rel.sourceTableId, new Set())
    map.get(rel.sourceTableId)!.add(rel.sourceColumnId)
  }
  return map
})

// For each table: which column IDs appear as targets (left/input) of any relation
const targetColsByTable = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const rel of store.schema.relations) {
    if (!map.has(rel.targetTableId)) map.set(rel.targetTableId, new Set())
    map.get(rel.targetTableId)!.add(rel.targetColumnId)
  }
  return map
})

// When a relation is selected, highlight both endpoint tables
const highlightedTableIds = computed(() => {
  const rel = selectedRelData.value
  if (!rel) return new Set<string>()
  return new Set([rel.sourceTableId, rel.targetTableId])
})

const editingGroupData = computed(() =>
  store.schema.groups.find(g => g.id === store.editingGroupId) ?? null
)

// ── Canvas mouse down ─────────────────────────────────────────────────────────

function onCanvasMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  const isBackground =
    target === canvasEl.value ||
    target.classList.contains('canvas-content') ||
    target.classList.contains('relations-svg')
  if (isBackground) {
    store.selectedTableId    = null
    store.selectedRelationId = null
    store.selectedGroupId    = null
    drag.value = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY }
  }
}

// ── Mouse move ────────────────────────────────────────────────────────────────

function onMouseMove(e: MouseEvent) {
  if (drawingRel.value) {
    const pos = toCanvas(e.clientX, e.clientY)
    drawingRel.value.mouseX = pos.x
    drawingRel.value.mouseY = pos.y
  }

  if (!drag.value) return

  const dx = (e.clientX - drag.value.startClientX) / zoom.value
  const dy = (e.clientY - drag.value.startClientY) / zoom.value
  const d  = drag.value

  if (d.kind === 'pan') {
    pan.x += e.clientX - d.startClientX
    pan.y += e.clientY - d.startClientY
    d.startClientX = e.clientX
    d.startClientY = e.clientY

  } else if (d.kind === 'table') {
    store.updateTablePosition(d.id, { x: d.origX + dx, y: d.origY + dy })

  } else if (d.kind === 'table-resize') {
    store.updateTableWidth(d.id, Math.max(240, d.origW + dx))

  } else if (d.kind === 'group') {
    // Move this group
    store.updateGroupPosition(d.id, { x: d.origX + dx, y: d.origY + dy })
    // Move all descendant groups rigidly (they were snapshotted at drag-start)
    for (const [gid, orig] of Object.entries(d.subtreeGroupOrigPos)) {
      store.updateGroupPosition(gid, { x: orig.x + dx, y: orig.y + dy })
    }
    // Move all tables that were inside the subtree at drag-start
    for (const [tid, orig] of Object.entries(d.subtreeTableOrigPos)) {
      store.updateTablePosition(tid, { x: orig.x + dx, y: orig.y + dy })
    }

  } else if (d.kind === 'resize') {
    store.updateGroupSize(d.id, {
      w: Math.max(200, d.origW + dx),
      h: Math.max(120, d.origH + dy),
    })
  }
}

// ── Mouse up — commit containment ─────────────────────────────────────────────

function onMouseUp() {
  if (!drag.value) return
  const d = drag.value
  drag.value = null   // clear first so re-entrant events don't double-fire

  if (d.kind === 'table') {
    // T1: assign to smallest group containing table centre
    const table = store.schema.tables.find(t => t.id === d.id)
    if (table) store.updateTablePosition(d.id, table.position, true)

  } else if (d.kind === 'table-resize') {
    store.commitTableWidth()

  } else if (d.kind === 'group') {
    // S1: apply group drop — only reassigns owned items, never steals
    store.commitGroupDrop(d.id, d.ownedTablesBefore, d.ownedGroupsBefore)

  } else if (d.kind === 'resize') {
    // S2: already live during resize; just persist
    store.commitGroupSize(d.id)
  }
}

// ── Wheel ─────────────────────────────────────────────────────────────────────

function onWheel(e: WheelEvent) {
  const delta  = e.deltaY > 0 ? -0.08 : 0.08
  const newZoom = Math.min(2.5, Math.max(0.15, zoom.value + delta))
  const rect   = canvasEl.value!.getBoundingClientRect()
  const mx     = e.clientX - rect.left
  const my     = e.clientY - rect.top
  pan.x = mx - (mx - pan.x) * (newZoom / zoom.value)
  pan.y = my - (my - pan.y) * (newZoom / zoom.value)
  zoom.value = newZoom
}

function adjustZoom(delta: number) {
  zoom.value = Math.min(2.5, Math.max(0.15, zoom.value + delta))
}

function resetView() { zoom.value = 1; pan.x = 40; pan.y = 40 }

function onMinimapNavigate(x: number, y: number) { pan.x = x; pan.y = y }

// ── Table drag ────────────────────────────────────────────────────────────────

function startTableDrag(tableId: string, e: MouseEvent) {
  const table = store.schema.tables.find(t => t.id === tableId)!
  selectTable(tableId)
  drag.value = {
    kind: 'table', id: tableId,
    origX: table.position.x, origY: table.position.y,
    startClientX: e.clientX, startClientY: e.clientY,
  }
}

function startTableResize(tableId: string, e: MouseEvent) {
  const table = store.schema.tables.find(t => t.id === tableId)!
  selectTable(tableId)
  drag.value = {
    kind: 'table-resize', id: tableId,
    origW: table.width ?? TABLE_WIDTH,
    startClientX: e.clientX, startClientY: e.clientY,
  }
}

function selectTable(id: string) {
  store.selectedTableId    = id
  store.selectedRelationId = null
  store.selectedGroupId    = null
}

// ── Group drag ────────────────────────────────────────────────────────────────

function startGroupDrag(groupId: string, e: MouseEvent) {
  const group = store.schema.groups.find(g => g.id === groupId)!
  selectGroup(groupId)

  // Collect the full subtree of descendant group IDs (not including self)
  const descGroupIds = getDescendants(groupId, store.schema.groups)

  // Snapshot descendant group positions
  const subtreeGroupOrigPos: Record<string, { x: number; y: number }> = {}
  for (const g of store.schema.groups) {
    if (descGroupIds.has(g.id)) {
      subtreeGroupOrigPos[g.id] = { x: g.position.x, y: g.position.y }
    }
  }

  // All group IDs in this subtree (including self) — used to find owned tables
  const subtreeIds = new Set([groupId, ...descGroupIds])

  // Snapshot table positions for every table in the subtree
  const subtreeTableOrigPos: Record<string, { x: number; y: number }> = {}
  for (const t of store.schema.tables) {
    if (t.groupId && subtreeIds.has(t.groupId)) {
      subtreeTableOrigPos[t.id] = { x: t.position.x, y: t.position.y }
    }
  }

  // For steal-prevention: record which tables/groups were ours BEFORE the move
  const ownedTablesBefore = new Set(Object.keys(subtreeTableOrigPos))
  const ownedGroupsBefore = new Set(
    store.schema.groups
      .filter(g => g.parentGroupId === groupId)
      .map(g => g.id)
  )

  drag.value = {
    kind: 'group', id: groupId,
    origX: group.position.x, origY: group.position.y,
    ownedTablesBefore, ownedGroupsBefore,
    subtreeGroupOrigPos, subtreeTableOrigPos,
    startClientX: e.clientX, startClientY: e.clientY,
  }
}

function selectGroup(id: string) {
  store.selectedGroupId    = id
  store.selectedTableId    = null
  store.selectedRelationId = null
}

// ── Group resize ──────────────────────────────────────────────────────────────

function startGroupResize(groupId: string, e: MouseEvent) {
  const group = store.schema.groups.find(g => g.id === groupId)!
  drag.value = {
    kind: 'resize', id: groupId,
    origW: group.size.w, origH: group.size.h,
    startClientX: e.clientX, startClientY: e.clientY,
  }
}

// ── Relation drawing ──────────────────────────────────────────────────────────

function startRelation(tableId: string, columnId: string) {
  const pos = connectorPos(tableId, columnId, 'right')
  drawingRel.value = {
    fromTableId: tableId, fromColumnId: columnId,
    side: 'right', mouseX: pos.x, mouseY: pos.y,
  }
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

function selectRelation(id: string) {
  store.selectedRelationId = id
  store.selectedTableId    = null
  store.selectedGroupId    = null
}
</script>

<style scoped>
.canvas-root {
  position: relative;
  width: 100%; height: 100%;
  overflow: hidden;
  background-color: #0d0d0f;
  background-image: radial-gradient(circle, #252528 1px, transparent 1px);
  background-size: 26px 26px;
  cursor: default;
  user-select: none;
}

.canvas-content {
  position: absolute;
  top: 0; left: 0;
  width: 6000px; height: 6000px;
}

.relations-svg {
  position: absolute;
  top: 0; left: 0;
  width: 6000px; height: 6000px;
  pointer-events: none;
  overflow: visible;
}

.relation-hit { pointer-events: stroke; cursor: pointer; }

.rel-label {
  font-size: 11px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none; dominant-baseline: auto; text-anchor: middle;
}
.rel-labels { pointer-events: none; }

.empty-state {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; gap: 10px;
}
.empty-hex { font-size: 56px; opacity: 0.07; margin-bottom: 4px; }
.empty-state p  { font-size: 17px; font-weight: 600; color: #ffffff22; margin: 0; }
.empty-state span { font-size: 13px; color: #ffffff12; }

.rel-type-bar {
  position: absolute; bottom: 72px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
  background: #16161a; border: 1px solid #2a2a35; border-radius: 8px;
  padding: 6px 12px; z-index: 200; box-shadow: 0 4px 20px #00000060;
}
.rel-type-label { font-size: 10px; color: #555; letter-spacing: 0.08em; text-transform: uppercase; margin-right: 4px; }
.rel-type-btn {
  background: #1e1e28; border: 1px solid #2a2a35; color: #666;
  border-radius: 5px; padding: 4px 10px; font-size: 11px; font-weight: 600;
  font-family: 'JetBrains Mono', monospace; cursor: pointer; transition: all 0.15s;
}
.rel-type-btn:hover { color: #e0e0e0; border-color: #3a3a50; }
.rel-type-btn.active { background: #3ECF8E20; color: #3ECF8E; border-color: #3ECF8E50; }
.rel-type-del {
  background: none; border: 1px solid #EF444430; color: #EF4444;
  border-radius: 5px; padding: 4px 10px; font-size: 11px; cursor: pointer;
  margin-left: 6px; transition: background 0.15s;
}
.rel-type-del:hover { background: #EF444415; }

.zoom-controls {
  position: absolute; bottom: 20px; right: 20px;
  display: flex; align-items: center; gap: 2px;
  background: #18181d; border: 1px solid #28283380;
  border-radius: 8px; padding: 4px 8px; z-index: 200;
}
.zoom-controls button {
  background: none; border: none; color: #666; font-size: 16px;
  cursor: pointer; width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 5px; transition: color 0.15s, background 0.15s;
}
.zoom-controls button:hover { color: #e0e0e0; background: #28283380; }
.zoom-controls span {
  font-size: 11px; color: #555; min-width: 40px;
  text-align: center; font-variant-numeric: tabular-nums;
}
</style>
