<template>
  <div
    class="canvas-root"
    ref="canvasEl"
    @mousedown="onCanvasMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @wheel.prevent="onWheel"
    @contextmenu.prevent="openContextMenu"
  >
    <div class="canvas-content" :style="contentStyle">
      <!-- Groups rendered in depth order: deepest (largest area) first, shallowest on top -->
      <GroupNode
        v-for="group in sortedGroups"
        :key="group.id"
        :group="group"
        :depth="groupDepth(group.id)"
        :selected="store.selectedGroupId === group.id || store.multiSelectedGroupIds.has(group.id)"
        @mousedown-header="startGroupDrag(group.id, $event)"
        @mousedown-resize="startGroupResize(group.id, $event)"
        @select="selectGroup(group.id, $event)"
        @edit="store.editingGroupId = group.id"
      />

      <CommentNode
        v-for="comment in store.schema.comments"
        :key="comment.id"
        :comment="comment"
        :selected="store.selectedCommentId === comment.id || store.multiSelectedCommentIds.has(comment.id)"
        @mousedown-header="startCommentDrag(comment.id, $event)"
        @mousedown-resize="startCommentResize(comment.id, $event)"
        @select="selectComment(comment.id, $event)"
        @update:text="store.updateComment(comment.id, { text: $event })"
        @delete="deleteComment(comment.id)"
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
            :stroke="relationValidationById.get(rel.id)?.hasError
              ? (store.selectedRelationId === rel.id ? '#EF4444' : '#EF444488')
              : (store.selectedRelationId === rel.id ? '#3ECF8E' : '#3ECF8E55')"
            :stroke-width="store.selectedRelationId === rel.id ? 2 : 1.5"
            stroke-dasharray="5,3"
            marker-start="url(#arrow-end)"
          />
          <!-- Wide hit area -->
          <path
            :d="getRelationPath(rel)"
            fill="none" stroke="transparent" stroke-width="14"
            class="relation-hit"
            @click.stop="selectRelation(rel.id)"
            @dblclick.stop="addRelationWaypoint(rel.id, $event)"
          >
            <title>{{ relationValidationById.get(rel.id)?.messages.join(' | ') || 'Valid relation' }}</title>
          </path>
          <!-- Cardinality labels -->
          <g v-if="relLabelPos(rel)" class="rel-labels">
            <text :x="relLabelPos(rel)!.src.x" :y="relLabelPos(rel)!.src.y" class="rel-label"
              :fill="store.selectedRelationId === rel.id ? '#3ECF8E' : '#3ECF8E99'">{{ srcLabel(rel.type) }}</text>
            <text :x="relLabelPos(rel)!.tgt.x" :y="relLabelPos(rel)!.tgt.y" class="rel-label"
              :fill="store.selectedRelationId === rel.id ? '#3ECF8E' : '#3ECF8E99'">{{ tgtLabel(rel.type) }}</text>
          </g>
          <g
            v-if="relationValidationById.get(rel.id)?.hasError"
            class="rel-error"
            @click.stop="selectRelation(rel.id)"
          >
            <circle :cx="relationPathMidpoint(rel).x" :cy="relationPathMidpoint(rel).y" r="10" />
            <text :x="relationPathMidpoint(rel).x" :y="relationPathMidpoint(rel).y + 4" class="rel-error-text">X</text>
            <title>{{ relationValidationById.get(rel.id)?.messages.join(' | ') }}</title>
          </g>
          <g
            v-for="(waypoint, index) in relationWaypointById[rel.id] ?? rel.waypoints ?? []"
            :key="`${rel.id}-${index}`"
            class="rel-waypoint"
            @mousedown.stop="startRelationWaypointDrag(rel.id, index, $event)"
            @dblclick.stop="removeRelationWaypoint(rel.id, index)"
          >
            <circle :cx="waypoint.x" :cy="waypoint.y" r="7" />
            <title>Drag to bend this relation visually. Double-click to remove this diverter.</title>
          </g>
        </g>

        <!-- In-progress relation -->
        <path v-if="drawingRel" :d="drawingRelPath"
          fill="none" stroke="#3ECF8E" stroke-width="1.5" stroke-dasharray="5,3"
          opacity="0.7" pointer-events="none" />
      </svg>

      <!-- Tables -->
      <TableNode
        v-for="table in sqlTables"
        :key="table.id"
        :table="table"
        :selected="store.selectedTableId === table.id || store.multiSelectedTableIds.has(table.id)"
        :highlighted="highlightedTableIds.has(table.id) && store.selectedTableId !== table.id && !store.multiSelectedTableIds.has(table.id)"
        :drawing-rel="!!drawingRel"
        :connected-as-source="sourceColsByTable.get(table.id) ?? emptySet"
        :connected-as-target="targetColsByTable.get(table.id) ?? emptySet"
        :mismatched-columns="mismatchedColsByTable.get(table.id) ?? emptySet"
        :invalid-columns="invalidColsByTable.get(table.id) ?? emptySet"
        :column-issues="columnIssuesByTable.get(table.id) ?? emptyIssues"
        :read-only="props.readOnly && !props.interactive"
        @mousedown.stop="!props.readOnly && startTableDrag(table.id, $event)"
        @select="selectTable(table.id, $event)"
        @start-relation="!props.readOnly && startRelation(table.id, $event.columnId, $event.side, $event.event)"
        @end-relation="!props.readOnly && endRelation(table.id, $event.columnId, $event.side)"
        @edit="!props.readOnly && (store.editingTableId = table.id)"
        @resize-start="!props.readOnly && startTableResize(table.id, $event)"
        @generate-api="$emit('generate-api', $event)"
      />

      <ResourceNode
        v-for="resource in resourceTables"
        :key="resource.id"
        :table="resource"
        :selected="store.selectedTableId === resource.id || store.multiSelectedTableIds.has(resource.id)"
        :highlighted="highlightedTableIds.has(resource.id) && store.selectedTableId !== resource.id && !store.multiSelectedTableIds.has(resource.id)"
        :connected-as-source="sourceColsByTable.get(resource.id) ?? emptySet"
        :connected-as-target="targetColsByTable.get(resource.id) ?? emptySet"
        :read-only="props.readOnly && !props.interactive"
        @mousedown.stop="!props.readOnly && startTableDrag(resource.id, $event)"
        @select="selectTable(resource.id)"
        @start-relation="!props.readOnly && startRelation(resource.id, $event.columnId, $event.side, $event.event)"
        @end-relation="!props.readOnly && endRelation(resource.id, $event.columnId, $event.side)"
        @edit="!props.readOnly && (store.editingTableId = resource.id)"
      />
    </div>

    <!-- Empty state -->
    <div v-if="store.schema.tables.length === 0 && store.schema.groups.length === 0 && store.schema.comments.length === 0" class="empty-state">
      <div class="empty-hex">[]</div>
      <p>Canvas is empty</p>
      <span>Use the sidebar or right-click to add tables, resources, or groups</span>
    </div>

    <div
      v-if="contextMenu"
      class="canvas-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @mousedown.stop
      @click.stop
      @contextmenu.prevent.stop
    >
      <button class="context-menu-item" @click="createAtContext('table')">New Table</button>
      <button class="context-menu-item" @click="createAtContext('group')">New Group</button>
      <button class="context-menu-item" @click="createAtContext('comment')">Comment Box</button>
      <button
        v-if="bridgeContextTables.length === 2"
        class="context-menu-item"
        @click="openBridgeTableFromSelection"
      >Junction Table for Selected Tables</button>
      <button class="context-menu-item" @click="createPrefabAtContext('rag')">Basic RAG System</button>
      <button class="context-menu-item" @click="createPrefabAtContext('audit')">Basic Audit System</button>
      <button class="context-menu-item" @click="createAtContext('blob-storage')">S3 / Blob</button>
      <button class="context-menu-item" @click="createAtContext('nosql-database')">NoSQL Database</button>
      <button class="context-menu-item" @click="createAtContext('cache')">Cache</button>
      <button class="context-menu-item" @click="createAtContext('message-queue')">Message Queue</button>
      <button class="context-menu-item" @click="createAtContext('data-export')">Data Export</button>
      <button class="context-menu-item" @click="createAtContext('external-service')">External Service</button>
      <button v-if="store.hasCopiedCanvasItems()" class="context-menu-item" @click="pasteAtContext">Paste</button>
    </div>

    <!-- Relation type bar (appears when a relation is selected) -->
    <div v-if="store.selectedRelationId && selectedRelData" class="rel-type-bar">
      <span class="rel-type-label">Relation type:</span>
      <button v-for="type in REL_TYPES" :key="type.value" class="rel-type-btn"
        :class="{ active: selectedRelData.type === type.value }"
        @click="store.updateRelation(store.selectedRelationId!, { type: type.value })">
        {{ type.label }}
      </button>
      <button
        v-if="selectedRelData.type === 'many-to-many'"
        class="rel-type-action"
        @click="createBridgeTable()"
      >Create Junction Table</button>
      <button class="rel-type-del" @click="requestDeleteRelation()">Delete Relation</button>
    </div>

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button @click="adjustZoom(0.1)">+</button>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <button @click="adjustZoom(-0.1)">-</button>
      <button @click="resetView" class="reset-view-btn" title="Reset view">Reset</button>
    </div>

    <!-- Minimap -->
    <MinimapPanel v-if="store.showMinimap && !props.readOnly" :pan="pan" :zoom="zoom" :viewport-w="canvasW" :viewport-h="canvasH"
      @navigate="onMinimapNavigate" />

    <!-- Group editor modal -->
    <GroupEditorModal
      v-if="store.editingGroupId && editingGroupData"
      :group="editingGroupData"
      @close="closeGroupEditor"
    />

    <ConfirmDialog
      v-if="confirmState"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-label="confirmState.confirmLabel"
      :cancel-label="confirmState.cancelLabel"
      :danger="confirmState.danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <BridgeTableModal
      v-if="bridgeModalSelection && bridgeModalSourceTable && bridgeModalTargetTable"
      :source-table="bridgeModalSourceTable"
      :target-table="bridgeModalTargetTable"
      @confirm="confirmBridgeTable"
      @cancel="bridgeModalSelection = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { useSchemaStore } from '../../stores/schema'
import TableNode from './TableNode.vue'
import ResourceNode from './ResourceNode.vue'
import GroupNode from './GroupNode.vue'
import CommentNode from './CommentNode.vue'
import MinimapPanel from './MinimapPanel.vue'
import GroupEditorModal from '../modals/GroupEditorModal.vue'
import ConfirmDialog from '../modals/ConfirmDialog.vue'
import BridgeTableModal from '../modals/BridgeTableModal.vue'
import type { BridgeTableOptions, Relation, RelationType, ResourceNodeType } from '../../types'
import { TABLE_WIDTH, TABLE_HEADER_H, TABLE_COL_PAD_TOP, TABLE_ROW_H } from '../../types'
import { getDescendants } from '../../composables/useContainment'
import { areSqlTypesCompatible } from '../../types/sqlTypes'

const props = defineProps<{
  readOnly?: boolean
  interactive?: boolean
}>()

const store = useSchemaStore()
const sqlTables = computed(() => store.sqlTables)
const resourceTables = computed(() => store.resourceTables)
const emptySet = new Set<string>()  // stable empty set so Vue doesn't re-render every frame
const emptyIssues: Record<string, string[]> = {}
const contextMenu = ref<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null)
const canvasEl = ref<HTMLDivElement>()
const canvasW  = ref(800)
const canvasH  = ref(600)
const confirmState = ref<null | {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  onConfirm: () => void
}>(null)
const bridgeModalSelection = ref<{
  relationId?: string
  sourceTableId: string
  targetTableId: string
} | null>(null)

defineEmits<{
  'generate-api': [table: any]
}>()

type CanvasShortcutWindow = Window & {
  __dbDesignerCanvasKeyHandler?: (e: KeyboardEvent) => void
}

const onKeyDown = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  if (document.querySelector('.modal-overlay, .type-picker-overlay')) return
  if (e.repeat && (e.ctrlKey || e.metaKey)) {
    const repeatedKey = e.key.toLowerCase()
    if (repeatedKey === 'a' || repeatedKey === 'c' || repeatedKey === 'v' || repeatedKey === 'y' || repeatedKey === 'z') {
      e.preventDefault()
      return
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    if (e.shiftKey) store.redo()
    else store.undo()
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    store.redo()
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    store.selectAllCanvas()
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    store.copySelectedCanvasItems()
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    store.pasteCopiedCanvasItems()
    e.preventDefault()
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    const selectedTableIds = store.multiSelectedTableIds.size > 0
      ? [...store.multiSelectedTableIds]
      : store.selectedTableId
        ? [store.selectedTableId]
        : []
    const selectedGroupIds = store.multiSelectedGroupIds.size > 0
      ? [...store.multiSelectedGroupIds]
      : store.selectedGroupId
        ? [store.selectedGroupId]
        : []
    const selectedCommentIds = store.multiSelectedCommentIds.size > 0
      ? [...store.multiSelectedCommentIds]
      : store.selectedCommentId
        ? [store.selectedCommentId]
        : []

    if (selectedTableIds.length > 0) {
      const message = selectedTableIds.length === 1
        ? `Delete "${store.schema.tables.find(table => table.id === selectedTableIds[0])?.name ?? 'selected item'}"?`
        : `Delete ${selectedTableIds.length} selected table/resource item(s)?`
      confirmState.value = {
        title: 'Delete Item',
        message,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true,
        onConfirm: () => {
          for (const tableId of selectedTableIds) store.deleteTable(tableId)
          store.clearMultiSelection()
        },
      }
    } else if (selectedGroupIds.length > 0) {
      const message = selectedGroupIds.length === 1
        ? `Delete group "${store.schema.groups.find(group => group.id === selectedGroupIds[0])?.name ?? 'selected group'}"?`
        : `Delete ${selectedGroupIds.length} selected group(s)?`
      confirmState.value = {
        title: 'Delete Group',
        message,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true,
        onConfirm: () => {
          for (const groupId of selectedGroupIds) store.deleteGroup(groupId, false)
          store.clearMultiSelection()
        },
      }
    } else if (selectedCommentIds.length > 0) {
      confirmState.value = {
        title: 'Delete Comment',
        message: selectedCommentIds.length === 1 ? 'Delete selected comment box?' : `Delete ${selectedCommentIds.length} selected comment box(es)?`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true,
        onConfirm: () => {
          for (const commentId of selectedCommentIds) store.deleteComment(commentId)
          store.clearMultiSelection()
        },
      }
    } else if (store.selectedRelationId) {
      requestDeleteRelation()
    }
  }
}

onMounted(() => {
  if (!props.readOnly) {
    const canvasWindow = window as CanvasShortcutWindow
    if (canvasWindow.__dbDesignerCanvasKeyHandler) {
      window.removeEventListener('keydown', canvasWindow.__dbDesignerCanvasKeyHandler)
    }
    canvasWindow.__dbDesignerCanvasKeyHandler = onKeyDown
    window.addEventListener('keydown', onKeyDown)
  }
  window.addEventListener('mouseup', onWindowMouseUp, true)
  window.addEventListener('blur', onWindowBlur)
  // Clean up on unmount would need onUnmounted â€” skipping for now as canvas lives for app lifetime

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

onUnmounted(() => {
  if (!props.readOnly) {
    const canvasWindow = window as CanvasShortcutWindow
    if (canvasWindow.__dbDesignerCanvasKeyHandler === onKeyDown) {
      window.removeEventListener('keydown', onKeyDown)
      delete canvasWindow.__dbDesignerCanvasKeyHandler
    }
  }
  window.removeEventListener('mouseup', onWindowMouseUp, true)
  window.removeEventListener('blur', onWindowBlur)
})

const REL_TYPES: { value: RelationType; label: string }[] = [
  { value: 'one-to-one',   label: '1 : 1' },
  { value: 'one-to-many',  label: '1 : N' },
  { value: 'many-to-many', label: 'N : M' },
]

// â”€â”€ Viewport â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const zoom = ref(1)
const pan  = reactive({ x: 40, y: 40 })

const contentStyle = computed(() => ({
  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

// â”€â”€ Group render order â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Drag types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // Snapshot taken at drag-start â€” used for steal-prevention
  ownedTablesBefore: Set<string>       // all table IDs in this group's subtree
  ownedGroupsBefore: Set<string>       // direct child group IDs
  // Positions snapshotted so descendant groups & tables move rigidly
  subtreeGroupOrigPos: Record<string, { x: number; y: number }>  // descendant group id â†’ orig pos
  subtreeTableOrigPos: Record<string, { x: number; y: number }>  // table id â†’ orig pos
}

type MultiTableDrag = {
  kind: 'multi-table'
  tableOrigPos: Record<string, { x: number; y: number }>
}

type CommentDrag = {
  kind: 'comment'
  id: string
  origX: number; origY: number
}

type CommentResizeDrag = {
  kind: 'comment-resize'
  id: string
  origW: number; origH: number
}

type MultiGroupDrag = {
  kind: 'multi-group'
  groupOrigPos: Record<string, { x: number; y: number }>
  groupOwnedTablesBefore: Record<string, string[]>
  groupOwnedGroupsBefore: Record<string, string[]>
  groupSubtreeGroupOrigPos: Record<string, Record<string, { x: number; y: number }>>
  groupSubtreeTableOrigPos: Record<string, Record<string, { x: number; y: number }>>
  standaloneTableOrigPos: Record<string, { x: number; y: number }>
}

type ResizeDrag = {
  kind: 'resize'
  id: string
  origW: number; origH: number
}

type RelationWaypointDrag = {
  kind: 'relation-waypoint'
  id: string
  waypointIndex: number
  origX: number; origY: number
}

type PanDrag = { kind: 'pan' }

type AnyDrag = (TableDrag | TableResizeDrag | CommentDrag | CommentResizeDrag | GroupDrag | MultiTableDrag | MultiGroupDrag | ResizeDrag | RelationWaypointDrag | PanDrag) & {
  startClientX: number
  startClientY: number
}

const drag = ref<AnyDrag | null>(null)
const relationWaypointById = reactive<Record<string, { x: number; y: number }[]>>({})

// â”€â”€ Relation drawing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const drawingRel = ref<{
  fromTableId: string; fromColumnId: string
  side: 'right' | 'left'; mouseX: number; mouseY: number
} | null>(null)

// â”€â”€ Geometry helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toCanvas(clientX: number, clientY: number) {
  const rect = canvasEl.value!.getBoundingClientRect()
  return {
    x: (clientX - rect.left - pan.x) / zoom.value,
    y: (clientY - rect.top  - pan.y) / zoom.value,
  }
}

function relationSourceSide(rel: Relation): 'left' | 'right' {
  return rel.sourceSide ?? 'right'
}

function relationTargetSide(rel: Relation): 'left' | 'right' {
  return rel.targetSide ?? 'left'
}

function connectorPos(tableId: string, colId: string, side: 'left' | 'right') {
  const table = store.schema.tables.find(t => t.id === tableId)
  if (!table) return { x: 0, y: 0 }
  if ((table.kind ?? 'table') === 'resource') {
    return {
      x: table.position.x + (side === 'right' ? (table.width ?? TABLE_WIDTH) : 0),
      y: table.position.y + 72,
    }
  }
  const idx = Math.max(0, table.columns.findIndex(c => c.id === colId))
  return {
    x: table.position.x + (side === 'right' ? (table.width ?? TABLE_WIDTH) : 0),
    y: table.position.y + TABLE_HEADER_H + TABLE_COL_PAD_TOP + idx * TABLE_ROW_H + TABLE_ROW_H / 2,
  }
}

function makeCurveSegment(a: { x: number; y: number }, b: { x: number; y: number }, move = true) {
  const { c1, c2 } = bezierControls(a, b)
  return `${move ? `M ${a.x} ${a.y} ` : ''}C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
}

function makeCurve(a: { x: number; y: number }, b: { x: number; y: number }) {
  return makeCurveSegment(a, b)
}

function getSmoothCurveSegments(points: { x: number; y: number }[]) {
  if (points.length < 2) return []

  return points.slice(0, -1).map((point, index) => {
    const p0 = points[Math.max(0, index - 1)]
    const p1 = point
    const p2 = points[index + 1]
    const p3 = points[Math.min(points.length - 1, index + 2)]
    const tension = 0.18

    return {
      start: p1,
      c1: {
        x: p1.x + (p2.x - p0.x) * tension,
        y: p1.y + (p2.y - p0.y) * tension,
      },
      c2: {
        x: p2.x - (p3.x - p1.x) * tension,
        y: p2.y - (p3.y - p1.y) * tension,
      },
      end: p2,
    }
  })
}

function bezierControls(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const backward = dx < 0
  const cx = backward
    ? Math.min(Math.max(Math.abs(dx) * 0.14, 28), 56)
    : Math.max(Math.abs(dx) * 0.5, 80)
  return {
    c1: { x: a.x + cx, y: a.y },
    c2: { x: b.x - cx, y: b.y },
  }
}

function cubicPoint(
  a: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
) {
  const mt = 1 - t
  return {
    x: mt ** 3 * a.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * b.x,
    y: mt ** 3 * a.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * b.y,
  }
}

function relationRoutePoints(rel: Relation) {
  const src = connectorPos(rel.sourceTableId, rel.sourceColumnId, relationSourceSide(rel))
  const tgt = connectorPos(rel.targetTableId, rel.targetColumnId, relationTargetSide(rel))
  return [src, ...(relationWaypointById[rel.id] ?? rel.waypoints ?? []), tgt]
}

function relationRenderPoints(rel: Relation) {
  return [...relationRoutePoints(rel)].reverse()
}

function getRelationPath(rel: Relation) {
  const points = relationRenderPoints(rel)
  if (points.length === 2) return makeCurve(points[0], points[1])
  const segments = getSmoothCurveSegments(points)
  if (segments.length === 0) return ''
  return [
    `M ${segments[0].start.x} ${segments[0].start.y}`,
    ...segments.map(segment =>
      `C ${segment.c1.x} ${segment.c1.y}, ${segment.c2.x} ${segment.c2.y}, ${segment.end.x} ${segment.end.y}`
    ),
  ].join(' ')
}

function relLabelPos(rel: Relation) {
  const src = connectorPos(rel.sourceTableId, rel.sourceColumnId, relationSourceSide(rel))
  const tgt = connectorPos(rel.targetTableId, rel.targetColumnId, relationTargetSide(rel))
  return {
    src: { x: src.x + (relationSourceSide(rel) === 'left' ? 14 : -22), y: src.y - 6 },
    tgt: { x: tgt.x + (relationTargetSide(rel) === 'left' ? 14 : -22), y: tgt.y - 6 },
  }
}

function relationMidpoint(rel: Relation) {
  const src = connectorPos(rel.sourceTableId, rel.sourceColumnId, relationSourceSide(rel))
  const tgt = connectorPos(rel.targetTableId, rel.targetColumnId, relationTargetSide(rel))
  return { x: (src.x + tgt.x) / 2, y: (src.y + tgt.y) / 2 }
}

function relationPathMidpoint(rel: Relation) {
  const points = relationRenderPoints(rel)
  const samples: { x: number; y: number; distance: number }[] = []
  let total = 0

  for (let i = 0; i < points.length - 1; i++) {
    const segments = points.length === 2
      ? [{ start: points[0], c1: bezierControls(points[0], points[1]).c1, c2: bezierControls(points[0], points[1]).c2, end: points[1] }]
      : getSmoothCurveSegments(points)
    for (const segment of segments) {
      let prev = segment.start

      for (let step = 1; step <= 24; step++) {
        const point = cubicPoint(segment.start, segment.c1, segment.c2, segment.end, step / 24)
        total += Math.hypot(point.x - prev.x, point.y - prev.y)
        samples.push({ ...point, distance: total })
        prev = point
      }
    }
    break
  }

  if (samples.length === 0) return relationMidpoint(rel)
  const half = total / 2
  return samples.find(sample => sample.distance >= half) ?? samples[samples.length - 1]
}

function relationInsertionPoint(rel: Relation, target: { x: number; y: number }) {
  const points = relationRoutePoints(rel)
  let best = {
    point: relationPathMidpoint(rel),
    insertAt: Math.max(0, points.length - 2),
    distance: Number.POSITIVE_INFINITY,
  }

  for (let i = 0; i < points.length - 1; i++) {
    const segments = points.length === 2
      ? [{ start: points[0], c1: bezierControls(points[0], points[1]).c1, c2: bezierControls(points[0], points[1]).c2, end: points[1], insertAt: i }]
      : getSmoothCurveSegments(points).map((segment, segmentIndex) => ({ ...segment, insertAt: segmentIndex }))
    for (const segment of segments) {
      for (let step = 0; step <= 32; step++) {
        const point = cubicPoint(segment.start, segment.c1, segment.c2, segment.end, step / 32)
        const distance = Math.hypot(point.x - target.x, point.y - target.y)
        if (distance < best.distance) {
          best = {
            point,
            insertAt: segment.insertAt,
            distance,
          }
        }
      }
    }
    break
  }

  return best
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

function requestDeleteRelation() {
  const relationId = store.selectedRelationId
  if (!relationId) return
  confirmState.value = {
    title: 'Delete Relation',
    message: 'Delete selected relation?',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    danger: true,
    onConfirm: () => {
      store.deleteRelation(relationId)
    },
  }
}

function confirmDelete() {
  const pending = confirmState.value
  confirmState.value = null
  if (pending?.onConfirm) {
    pending.onConfirm()
  }
}

function cancelDelete() {
  confirmState.value = null
}

function createBridgeTable() {
  bridgeModalSelection.value = selectedRelData.value?.type === 'many-to-many'
    ? {
        relationId: selectedRelData.value.id,
        sourceTableId: selectedRelData.value.sourceTableId,
        targetTableId: selectedRelData.value.targetTableId,
      }
    : null
}

const bridgeContextTables = computed(() => {
  const selectedIds = store.multiSelectedTableIds.size > 0
    ? [...store.multiSelectedTableIds]
    : store.selectedTableId
      ? [store.selectedTableId]
      : []
  return selectedIds
    .map(id => store.schema.tables.find(table => table.id === id) ?? null)
    .filter((table): table is NonNullable<typeof table> => !!table && (table.kind ?? 'table') === 'table')
})

const bridgeModalSourceTable = computed(() =>
  store.schema.tables.find(table => table.id === bridgeModalSelection.value?.sourceTableId) ?? null
)

const bridgeModalTargetTable = computed(() =>
  store.schema.tables.find(table => table.id === bridgeModalSelection.value?.targetTableId) ?? null
)

function confirmBridgeTable(options: BridgeTableOptions) {
  const selection = bridgeModalSelection.value
  bridgeModalSelection.value = null
  if (!selection) return
  const created = selection.relationId
    ? store.createBridgeTableForRelation(selection.relationId, options)
    : store.createBridgeTableBetweenTables(selection.sourceTableId, selection.targetTableId, options)
  if (!created) alert('Could not generate a junction table for this relation.')
}

function openBridgeTableFromSelection() {
  if (bridgeContextTables.value.length !== 2) return
  bridgeModalSelection.value = {
    sourceTableId: bridgeContextTables.value[0].id,
    targetTableId: bridgeContextTables.value[1].id,
  }
  contextMenu.value = null
}

const relationValidationById = computed(() => {
  const map = new Map<string, {
    hasError: boolean
    typeMismatch: boolean
    invalidTarget: boolean
    circular: boolean
    messages: string[]
  }>()

  const dependencyGraph = new Map<string, Set<string>>()
  for (const relation of store.schema.relations) {
    if (!dependencyGraph.has(relation.targetTableId)) dependencyGraph.set(relation.targetTableId, new Set())
    dependencyGraph.get(relation.targetTableId)!.add(relation.sourceTableId)
  }

  const createsCircularDependency = (relation: Relation) => {
    if (relation.sourceTableId === relation.targetTableId) return false

    const seen = new Set<string>()
    const queue = [...(dependencyGraph.get(relation.sourceTableId) ?? [])]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === relation.targetTableId) return true
      if (seen.has(current)) continue
      seen.add(current)
      queue.push(...(dependencyGraph.get(current) ?? []))
    }

    return false
  }

  for (const rel of store.schema.relations) {
    const sourceTable = store.schema.tables.find(t => t.id === rel.sourceTableId)
    const targetTable = store.schema.tables.find(t => t.id === rel.targetTableId)
    const sourceCol = sourceTable?.columns.find(c => c.id === rel.sourceColumnId)
    const targetCol = targetTable?.columns.find(c => c.id === rel.targetColumnId)
    const sourceIsResource = (sourceTable?.kind ?? 'table') === 'resource'
    const targetIsResource = (targetTable?.kind ?? 'table') === 'resource'
    const isResourceRelation =
      sourceIsResource || targetIsResource
    const messages: string[] = []

    if (!sourceCol) messages.push('Referenced column no longer exists.')
    if (!targetCol) messages.push('Foreign key column no longer exists.')

    const invalidExternalServiceInput = !!(
      sourceTable?.resourceType === 'external-service' &&
      !targetIsResource &&
      targetCol &&
      (
        (!targetCol.primaryKey && !targetCol.unique) ||
        (targetCol.primaryKey && !isQueryLikeResourceInput(sourceCol?.name))
      )
    )
    if (invalidExternalServiceInput) {
      if (targetCol?.primaryKey) {
        messages.push('External services may only target a PRIMARY KEY when the connector is labeled as search, request, query, lookup, or fetch.')
      } else {
        messages.push('External services should target UNIQUE keys, or a PRIMARY KEY with a search/request/query-style connector.')
      }
    }

    const typeMismatch = !!(
      !isResourceRelation &&
      sourceCol &&
      targetCol &&
      !areSqlTypesCompatible(sourceCol.type, targetCol.type)
    )
    if (typeMismatch && sourceCol && targetCol) {
      messages.push(`Type mismatch: ${targetCol.type} cannot safely reference ${sourceCol.type}.`)
    }

    const invalidTarget = !!(!isResourceRelation && sourceCol && !sourceCol.primaryKey && !sourceCol.unique)
    if (invalidTarget) {
      messages.push('Referenced column should be PRIMARY KEY or UNIQUE.')
    }

    const circular = !isResourceRelation && createsCircularDependency(rel)
    if (circular) {
      messages.push('Circular foreign key dependency detected across related tables.')
    }

    if (!isResourceRelation && rel.type === 'one-to-one' && targetCol && !targetCol.primaryKey && !targetCol.unique) {
      messages.push('One-to-one relations require the foreign key column to be UNIQUE or PRIMARY KEY.')
    }

    if (!isResourceRelation && rel.type === 'many-to-many') {
      messages.push('Many-to-many needs a junction table. This direct connection will not generate a valid DB constraint.')
    }

    map.set(rel.id, {
      hasError: messages.length > 0,
      typeMismatch,
      invalidTarget: invalidTarget || invalidExternalServiceInput,
      circular,
      messages,
    })
  }

  return map
})

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

const mismatchedColsByTable = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const rel of store.schema.relations) {
    const validation = relationValidationById.value.get(rel.id)
    if (!validation?.typeMismatch) continue
    if (!map.has(rel.sourceTableId)) map.set(rel.sourceTableId, new Set())
    if (!map.has(rel.targetTableId)) map.set(rel.targetTableId, new Set())
    map.get(rel.sourceTableId)!.add(rel.sourceColumnId)
    map.get(rel.targetTableId)!.add(rel.targetColumnId)
  }
  return map
})

const invalidColsByTable = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const rel of store.schema.relations) {
    const validation = relationValidationById.value.get(rel.id)
    if (!validation || (!validation.invalidTarget && !validation.circular)) continue
    if (!map.has(rel.sourceTableId)) map.set(rel.sourceTableId, new Set())
    map.get(rel.sourceTableId)!.add(rel.sourceColumnId)
    if (validation.circular) {
      if (!map.has(rel.targetTableId)) map.set(rel.targetTableId, new Set())
      map.get(rel.targetTableId)!.add(rel.targetColumnId)
    }
  }
  return map
})

const columnIssuesByTable = computed(() => {
  const map = new Map<string, Record<string, string[]>>()
  const pushIssue = (tableId: string, columnId: string, message: string) => {
    if (!map.has(tableId)) map.set(tableId, {})
    const tableIssues = map.get(tableId)!
    if (!tableIssues[columnId]) tableIssues[columnId] = []
    if (!tableIssues[columnId].includes(message)) tableIssues[columnId].push(message)
  }

  for (const rel of store.schema.relations) {
    const validation = relationValidationById.value.get(rel.id)
    if (!validation) continue

    if (validation.typeMismatch) {
      pushIssue(rel.sourceTableId, rel.sourceColumnId, 'Connected column type is incompatible with this relation.')
      pushIssue(rel.targetTableId, rel.targetColumnId, 'Connected column type is incompatible with this relation.')
    }

    if (validation.invalidTarget) {
      pushIssue(rel.sourceTableId, rel.sourceColumnId, 'This referenced column is not PRIMARY KEY or UNIQUE.')
    }

    if (validation.circular) {
      pushIssue(rel.sourceTableId, rel.sourceColumnId, 'This relation participates in a circular foreign key dependency.')
      pushIssue(rel.targetTableId, rel.targetColumnId, 'This relation participates in a circular foreign key dependency.')
    }

    for (const message of validation.messages) {
      if (rel.sourceColumnId) pushIssue(rel.sourceTableId, rel.sourceColumnId, message)
      if (rel.targetColumnId) pushIssue(rel.targetTableId, rel.targetColumnId, message)
    }
  }

  return map
})

// When a relation is selected, highlight both endpoint tables
const highlightedTableIds = computed(() => {
  const rel = selectedRelData.value
  if (!rel) return new Set<string>()
  return new Set([rel.sourceTableId, rel.targetTableId])
})

function isQueryLikeResourceInput(label: string | undefined) {
  if (!label) return false
  return /(search|request|query|lookup|get|fetch|find)/i.test(label)
}

const editingGroupData = computed(() =>
  store.schema.groups.find(g => g.id === store.editingGroupId) ?? null
)

function closeGroupEditor() {
  const groupId = store.editingGroupId
  if (!groupId) return
  store.discardDraftGroup(groupId)
}

// â”€â”€ Canvas mouse down â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildMultiTableDrag(tableIds: string[], e: MouseEvent): AnyDrag | null {
  const tableOrigPos: Record<string, { x: number; y: number }> = {}
  for (const tableId of tableIds) {
    const table = store.schema.tables.find(entry => entry.id === tableId)
    if (!table) continue
    tableOrigPos[tableId] = { x: table.position.x, y: table.position.y }
  }
  if (Object.keys(tableOrigPos).length < 2) return null
  return {
    kind: 'multi-table',
    tableOrigPos,
    startClientX: e.clientX,
    startClientY: e.clientY,
  }
}

function buildMultiGroupDrag(groupIds: string[], tableIds: string[], e: MouseEvent): AnyDrag | null {
  const selectedGroupSet = new Set(groupIds)
  const groupOrigPos: Record<string, { x: number; y: number }> = {}
  const groupOwnedTablesBefore: Record<string, string[]> = {}
  const groupOwnedGroupsBefore: Record<string, string[]> = {}
  const groupSubtreeGroupOrigPos: Record<string, Record<string, { x: number; y: number }>> = {}
  const groupSubtreeTableOrigPos: Record<string, Record<string, { x: number; y: number }>> = {}
  const coveredTableIds = new Set<string>()

  for (const groupId of groupIds) {
    const group = store.schema.groups.find(entry => entry.id === groupId)
    if (!group) continue
    groupOrigPos[groupId] = { x: group.position.x, y: group.position.y }
    const descGroupIds = getDescendants(groupId, store.schema.groups)
    const subtreeGroupOrig: Record<string, { x: number; y: number }> = {}
    const subtreeTableOrig: Record<string, { x: number; y: number }> = {}
    for (const entry of store.schema.groups) {
      if (descGroupIds.has(entry.id)) {
        subtreeGroupOrig[entry.id] = { x: entry.position.x, y: entry.position.y }
      }
    }
    const subtreeIds = new Set([groupId, ...descGroupIds])
    for (const table of store.schema.tables) {
      if (table.groupId && subtreeIds.has(table.groupId)) {
        subtreeTableOrig[table.id] = { x: table.position.x, y: table.position.y }
        coveredTableIds.add(table.id)
      }
    }
    groupSubtreeGroupOrigPos[groupId] = subtreeGroupOrig
    groupSubtreeTableOrigPos[groupId] = subtreeTableOrig
    groupOwnedTablesBefore[groupId] = Object.keys(subtreeTableOrig)
    groupOwnedGroupsBefore[groupId] = store.schema.groups
      .filter(entry => entry.parentGroupId === groupId && !selectedGroupSet.has(entry.id))
      .map(entry => entry.id)
  }

  const standaloneTableOrigPos: Record<string, { x: number; y: number }> = {}
  for (const tableId of tableIds) {
    if (coveredTableIds.has(tableId)) continue
    const table = store.schema.tables.find(entry => entry.id === tableId)
    if (!table) continue
    standaloneTableOrigPos[tableId] = { x: table.position.x, y: table.position.y }
  }

  if (Object.keys(groupOrigPos).length === 0) return null
  if (Object.keys(groupOrigPos).length + Object.keys(standaloneTableOrigPos).length < 2) return null

  return {
    kind: 'multi-group',
    groupOrigPos,
    groupOwnedTablesBefore,
    groupOwnedGroupsBefore,
    groupSubtreeGroupOrigPos,
    groupSubtreeTableOrigPos,
    standaloneTableOrigPos,
    startClientX: e.clientX,
    startClientY: e.clientY,
  }
}

function onCanvasMouseDown(e: MouseEvent) {
  contextMenu.value = null
  if (props.readOnly) return
  if (e.button === 2) return
  const target = e.target as HTMLElement
  const isBackground =
    target === canvasEl.value ||
    target.classList.contains('canvas-content') ||
    target.classList.contains('relations-svg')
  if (isBackground) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    store.selectedTableId    = null
    store.selectedRelationId = null
    store.selectedGroupId    = null
    store.selectedCommentId  = null
    store.clearMultiSelection()
    drag.value = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY }
  }
}

// â”€â”€ Mouse move â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  } else if (d.kind === 'comment') {
    store.updateCommentPosition(d.id, { x: d.origX + dx, y: d.origY + dy })

  } else if (d.kind === 'multi-table') {
    for (const [tableId, orig] of Object.entries(d.tableOrigPos)) {
      store.updateTablePosition(tableId, { x: orig.x + dx, y: orig.y + dy })
    }

  } else if (d.kind === 'table-resize') {
    store.updateTableWidth(d.id, Math.max(240, d.origW + dx))

  } else if (d.kind === 'comment-resize') {
    store.updateCommentSize(d.id, { w: d.origW + dx, h: d.origH + dy })

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

  } else if (d.kind === 'multi-group') {
    for (const [groupId, orig] of Object.entries(d.groupOrigPos)) {
      store.updateGroupPosition(groupId, { x: orig.x + dx, y: orig.y + dy })
      for (const [nestedGroupId, nestedOrig] of Object.entries(d.groupSubtreeGroupOrigPos[groupId] ?? {})) {
        store.updateGroupPosition(nestedGroupId, { x: nestedOrig.x + dx, y: nestedOrig.y + dy })
      }
      for (const [tableId, tableOrig] of Object.entries(d.groupSubtreeTableOrigPos[groupId] ?? {})) {
        store.updateTablePosition(tableId, { x: tableOrig.x + dx, y: tableOrig.y + dy })
      }
    }
    for (const [tableId, orig] of Object.entries(d.standaloneTableOrigPos)) {
      store.updateTablePosition(tableId, { x: orig.x + dx, y: orig.y + dy })
    }

  } else if (d.kind === 'resize') {
    store.updateGroupSize(d.id, {
      w: Math.max(200, d.origW + dx),
      h: Math.max(120, d.origH + dy),
    })

  } else if (d.kind === 'relation-waypoint') {
    if (!relationWaypointById[d.id]) return
    relationWaypointById[d.id][d.waypointIndex] = { x: d.origX + dx, y: d.origY + dy }
  }
}

function openContextMenu(e: MouseEvent) {
  if (props.readOnly) return
  const pos = toCanvas(e.clientX, e.clientY)
  const rect = canvasEl.value!.getBoundingClientRect()
  contextMenu.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    canvasX: pos.x,
    canvasY: pos.y,
  }
}

function createAtContext(kind: 'table' | 'group' | 'comment' | ResourceNodeType) {
  if (!contextMenu.value) return
  const position = { x: contextMenu.value.canvasX, y: contextMenu.value.canvasY }
  if (kind === 'table') store.createTable(position)
  else if (kind === 'group') store.createGroup(position)
  else if (kind === 'comment') store.createComment(position)
  else store.createResource(kind, position)
  contextMenu.value = null
}

function createPrefabAtContext(kind: 'rag' | 'audit') {
  if (!contextMenu.value) return
  const position = { x: contextMenu.value.canvasX, y: contextMenu.value.canvasY }
  const title = kind === 'rag' ? 'Create RAG System' : 'Create Audit System'
  const message = kind === 'rag'
    ? 'This will create a production-ready RAG schema including documents, chunks, queries, and results tables. Continue?'
    : 'This will create a robust audit system with events and changes tracking tables. Continue?'

  confirmState.value = {
    title,
    message,
    confirmLabel: 'Create',
    cancelLabel: 'Cancel',
    danger: false,
    onConfirm: () => {
      if (kind === 'rag') store.createRagSystem(position)
      else store.createAuditSystem(position)
    },
  }
  contextMenu.value = null
}

function deleteComment(commentId: string) {
  confirmState.value = {
    title: 'Delete Comment',
    message: 'Are you sure you want to delete this comment box?',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    danger: true,
    onConfirm: () => {
      store.deleteComment(commentId)
    },
  }
}

function pasteAtContext() {
  if (!contextMenu.value) return
  store.pasteCopiedCanvasItems()
  contextMenu.value = null
}

// â”€â”€ Mouse up â€” commit containment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function commitActiveDrag() {
  if (!drag.value) return
  const d = drag.value
  drag.value = null   // clear first so re-entrant events don't double-fire

  if (d.kind === 'table') {
    // T1: assign to smallest group containing table centre
    const table = store.schema.tables.find(t => t.id === d.id)
    if (table) store.updateTablePosition(d.id, table.position, true)

  } else if (d.kind === 'comment') {
    const comment = store.schema.comments.find(entry => entry.id === d.id)
    if (comment) store.updateCommentPosition(d.id, comment.position, true)

  } else if (d.kind === 'table-resize') {
    store.commitTableWidth()

  } else if (d.kind === 'comment-resize') {
    store.commitCommentSize()

  } else if (d.kind === 'group') {
    // S1: apply group drop â€” only reassigns owned items, never steals
    store.commitGroupDrop(d.id, d.ownedTablesBefore, d.ownedGroupsBefore)

  } else if (d.kind === 'resize') {
    // S2: already live during resize; just persist
    store.commitGroupSize(d.id)
  } else if (d.kind === 'relation-waypoint') {
    const rel = store.schema.relations.find(current => current.id === d.id)
    if (rel) {
      const next = relationWaypointById[d.id] ?? rel.waypoints ?? []
      store.updateRelation(d.id, { waypoints: next })
      if (next.length === 0) delete relationWaypointById[d.id]
      else relationWaypointById[d.id] = [...next]
    }
  }
}

function onMouseUp() {
  commitActiveDrag()
}

function onWindowMouseUp() {
  commitActiveDrag()
  if (drawingRel.value) {
    window.setTimeout(() => {
      if (drawingRel.value) drawingRel.value = null
    }, 0)
  }
}

function onWindowBlur() {
  commitActiveDrag()
  drawingRel.value = null
}

// â”€â”€ Wheel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Table drag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function startTableDrag(tableId: string, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    store.toggleTableSelection(tableId)
    return
  }
  const table = store.schema.tables.find(t => t.id === tableId)!
  const selectedTableIds = store.multiSelectedTableIds.size > 0
    ? [...store.multiSelectedTableIds]
    : store.selectedTableId
      ? [store.selectedTableId]
      : []
  const selectedGroupIds = store.multiSelectedGroupIds.size > 0
    ? [...store.multiSelectedGroupIds]
    : store.selectedGroupId
      ? [store.selectedGroupId]
      : []
  if (
    (selectedTableIds.includes(tableId) && selectedTableIds.length > 1) ||
    (selectedTableIds.includes(tableId) && selectedGroupIds.length > 0)
  ) {
    const dragSelection = selectedGroupIds.length > 0
      ? buildMultiGroupDrag(selectedGroupIds, selectedTableIds, e)
      : buildMultiTableDrag(selectedTableIds, e)
    if (dragSelection) {
      drag.value = dragSelection
      return
    }
  }

  selectTable(tableId)
  drag.value = {
    kind: 'table', id: tableId,
    origX: table.position.x, origY: table.position.y,
    startClientX: e.clientX, startClientY: e.clientY,
  }
}

function startTableResize(tableId: string, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return
  const table = store.schema.tables.find(t => t.id === tableId)!
  selectTable(tableId)
  drag.value = {
    kind: 'table-resize', id: tableId,
    origW: table.width ?? TABLE_WIDTH,
    startClientX: e.clientX, startClientY: e.clientY,
  }
}

function startCommentDrag(commentId: string, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    store.toggleCommentSelection(commentId)
    return
  }
  const comment = store.schema.comments.find(entry => entry.id === commentId)
  if (!comment) return
  selectComment(commentId)
  drag.value = {
    kind: 'comment',
    id: commentId,
    origX: comment.position.x,
    origY: comment.position.y,
    startClientX: e.clientX,
    startClientY: e.clientY,
  }
}

function startCommentResize(commentId: string, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return
  const comment = store.schema.comments.find(entry => entry.id === commentId)
  if (!comment) return
  selectComment(commentId)
  drag.value = {
    kind: 'comment-resize',
    id: commentId,
    origW: comment.size.w,
    origH: comment.size.h,
    startClientX: e.clientX,
    startClientY: e.clientY,
  }
}

function selectTable(id: string, _event?: MouseEvent) {
  if (store.multiSelectedTableIds.has(id)) return
  store.clearMultiSelection()
  store.selectedTableId    = id
  store.selectedRelationId = null
  store.selectedGroupId    = null
  store.selectedCommentId  = null
}

function selectComment(id: string, _event?: MouseEvent) {
  if (store.multiSelectedCommentIds.has(id)) return
  store.clearMultiSelection()
  store.selectedCommentId  = id
  store.selectedTableId    = null
  store.selectedGroupId    = null
  store.selectedRelationId = null
}

// â”€â”€ Group drag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function startGroupDrag(groupId: string, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    store.toggleGroupSelection(groupId)
    return
  }
  const group = store.schema.groups.find(g => g.id === groupId)!
  const selectedTableIds = store.multiSelectedTableIds.size > 0
    ? [...store.multiSelectedTableIds]
    : store.selectedTableId
      ? [store.selectedTableId]
      : []
  const selectedGroupIds = store.multiSelectedGroupIds.size > 0
    ? [...store.multiSelectedGroupIds]
    : store.selectedGroupId
      ? [store.selectedGroupId]
      : []
  if (selectedGroupIds.includes(groupId) && (selectedGroupIds.length > 1 || selectedTableIds.length > 0)) {
    const dragSelection = buildMultiGroupDrag(selectedGroupIds, selectedTableIds, e)
    if (dragSelection) {
      drag.value = dragSelection
      return
    }
  }

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

  // All group IDs in this subtree (including self) â€” used to find owned tables
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

function selectGroup(id: string, _event?: MouseEvent) {
  if (store.multiSelectedGroupIds.has(id)) return
  store.clearMultiSelection()
  store.selectedGroupId    = id
  store.selectedTableId    = null
  store.selectedRelationId = null
}

// â”€â”€ Group resize â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function startGroupResize(groupId: string, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return
  const group = store.schema.groups.find(g => g.id === groupId)!
  drag.value = {
    kind: 'resize', id: groupId,
    origW: group.size.w, origH: group.size.h,
    startClientX: e.clientX, startClientY: e.clientY,
  }
}

function startRelationWaypointDrag(relationId: string, waypointIndex: number, e: MouseEvent) {
  const handle = (relationWaypointById[relationId]
    ?? store.schema.relations.find(current => current.id === relationId)?.waypoints
    ?? [])[waypointIndex]
  if (!handle) return
  relationWaypointById[relationId] = [
    ...(relationWaypointById[relationId]
      ?? store.schema.relations.find(current => current.id === relationId)?.waypoints
      ?? []),
  ]
  drag.value = {
    kind: 'relation-waypoint',
    id: relationId,
    waypointIndex,
    origX: handle.x,
    origY: handle.y,
    startClientX: e.clientX,
    startClientY: e.clientY,
  }
}

function addRelationWaypoint(relationId: string, event?: MouseEvent) {
  const rel = store.schema.relations.find(current => current.id === relationId)
  if (!rel) return
  const current = [...(relationWaypointById[relationId] ?? rel.waypoints ?? [])]
  const insertion = event
    ? relationInsertionPoint(rel, toCanvas(event.clientX, event.clientY))
    : { point: relationPathMidpoint(rel), insertAt: current.length }
  const next = [...current]
  next.splice(insertion.insertAt, 0, insertion.point)
  relationWaypointById[relationId] = next
  store.updateRelation(relationId, { waypoints: next })
}

function removeRelationWaypoint(relationId: string, waypointIndex: number) {
  const rel = store.schema.relations.find(current => current.id === relationId)
  const next = [...(relationWaypointById[relationId] ?? rel?.waypoints ?? [])]
  next.splice(waypointIndex, 1)
  if (next.length === 0) delete relationWaypointById[relationId]
  else relationWaypointById[relationId] = next
  store.updateRelation(relationId, { waypoints: next })
}

// â”€â”€ Relation drawing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function startRelation(tableId: string, columnId: string, side: 'left' | 'right', e?: MouseEvent) {
  if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) {
    store.toggleTableSelection(tableId)
    return
  }
  const pos = connectorPos(tableId, columnId, side)
  drawingRel.value = {
    fromTableId: tableId, fromColumnId: columnId,
    side, mouseX: pos.x, mouseY: pos.y,
  }
}

function endRelation(tableId: string, columnId: string, side: 'left' | 'right') {
  if (drawingRel.value && drawingRel.value.fromTableId !== tableId) {
    const sourceTable = store.schema.tables.find(t => t.id === drawingRel.value!.fromTableId)
    const sourceCol = sourceTable?.columns.find(c => c.id === drawingRel.value!.fromColumnId)
    const targetTable = store.schema.tables.find(t => t.id === tableId)
    const targetCol = targetTable?.columns.find(c => c.id === columnId)
    const invalidExternalServiceInput = !!(
      sourceTable?.resourceType === 'external-service' &&
      (targetTable?.kind ?? 'table') === 'table' &&
      targetCol &&
      (
        (!targetCol.primaryKey && !targetCol.unique) ||
        (targetCol.primaryKey && !isQueryLikeResourceInput(sourceCol?.name))
      )
    )
    if (invalidExternalServiceInput) {
      alert(
        targetCol?.primaryKey
          ? 'External services may only connect to a PRIMARY KEY when the connector label is query-like, such as search, request, lookup, or fetch.'
          : 'External services may only connect to UNIQUE keys, or to a PRIMARY KEY when the connector label is query-like.'
      )
      drawingRel.value = null
      return
    }
    store.addRelation({
      sourceTableId: drawingRel.value.fromTableId,
      sourceColumnId: drawingRel.value.fromColumnId,
      sourceSide: drawingRel.value.side,
      targetTableId: tableId,
      targetColumnId: columnId,
      targetSide: side,
      type: 'one-to-many',
      label: '',
    })
  }
  drawingRel.value = null
}

function selectRelation(id: string) {
  store.clearMultiSelection()
  store.selectedRelationId = id
  store.selectedTableId    = null
  store.selectedGroupId    = null
  store.selectedCommentId  = null
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
.rel-error { pointer-events: all; }
.rel-waypoint { pointer-events: all; }

.rel-label {
  font-size: 11px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none; dominant-baseline: auto; text-anchor: middle;
}
.rel-labels { pointer-events: none; }
.rel-error circle {
  fill: #19090b;
  stroke: #EF4444;
  stroke-width: 1.5;
}
.rel-error-text {
  fill: #EF4444;
  font-size: 11px;
  font-weight: 800;
  text-anchor: middle;
  pointer-events: none;
}
.rel-waypoint circle {
  fill: rgba(13, 13, 15, 0.25);
  stroke: #94a3b8;
  stroke-width: 1.5;
  cursor: grab;
}
.rel-waypoint circle:hover {
  stroke: #e2e8f0;
  fill: rgba(148, 163, 184, 0.18);
}

.empty-state {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; gap: 10px;
}
.empty-hex { font-size: 56px; opacity: 0.07; margin-bottom: 4px; }
.empty-state p  { font-size: 17px; font-weight: 600; color: #ffffff22; margin: 0; }
.empty-state span { font-size: 13px; color: #ffffff12; }

.canvas-context-menu {
  position: absolute;
  z-index: 260;
  min-width: 190px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: #10131a;
  border: 1px solid #2a3140;
  border-radius: 12px;
  box-shadow: 0 18px 40px #00000075;
}

.context-menu-item {
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #dbe4f0;
  text-align: left;
  padding: 9px 11px;
  font-size: 12px;
  cursor: pointer;
}

.context-menu-item:hover {
  background: #17202b;
  color: #3ECF8E;
}

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
.rel-type-action {
  background: #3ECF8E20;
  border: 1px solid #3ECF8E40;
  color: #3ECF8E;
  border-radius: 5px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.rel-type-action:hover { background: #3ECF8E2d; }

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
.zoom-controls .reset-view-btn { font-size: 11px; width: auto; padding: 0 6px; }
.zoom-controls span {
  font-size: 11px; color: #555; min-width: 40px;
  text-align: center; font-variant-numeric: tabular-nums;
}
</style>


