<template>
  <div
    class="gql-node"
    :class="{ selected, highlighted, [`kind-${node.kind.replace('-root','')}`]: true }"
    :style="{
      left:  node.position.x + 'px',
      top:   node.position.y + 'px',
      width: node.width + 'px',
      '--kc': kindColor,
      '--kc-rgb': hexToRgb(kindColor),
    }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('select')"
  >
    <!-- Header -->
    <div class="gql-header">
      <div class="kind-gem">{{ kindGlyph }}</div>
      <div class="gql-title">
        <span class="gql-name">{{ node.name }}</span>
        <span class="kind-label">{{ kindLabel }}</span>
      </div>
      <div class="node-actions">
        <button class="icon-btn" @click.stop="$emit('edit')">✎</button>
        <button class="icon-btn danger" @click.stop="$emit('delete')">✕</button>
      </div>
    </div>

    <!-- Implements badge -->
    <div v-if="node.implements.length" class="impl-row">
      <span class="impl-label">implements</span>
      <span v-for="i in node.implements" :key="i" class="impl-chip">{{ i }}</span>
    </div>

    <!-- Enum values -->
    <template v-if="node.kind === 'enum'">
      <div class="section-divider"><span class="section-lbl">Values</span><span class="section-cnt">{{ node.values.length }}</span></div>
      <div v-for="val in node.values" :key="val" class="field-row enum-val">
        <span class="enum-bullet">▸</span>
        <span class="field-name enum-name">{{ val }}</span>
      </div>
    </template>

    <!-- Union members -->
    <template v-else-if="node.kind === 'union'">
      <div class="section-divider"><span class="section-lbl">Members</span></div>
      <div v-for="val in node.values" :key="val" class="field-row">
        <span class="union-bullet">◆</span>
        <span class="field-name">{{ val }}</span>
        <div class="connector conn-right" @mousedown.stop="$emit('start-relation', val)" />
      </div>
    </template>

    <!-- Scalar -->
    <template v-else-if="node.kind === 'scalar'">
      <div class="scalar-body">
        <span class="scalar-label">Custom Scalar</span>
      </div>
    </template>

    <!-- Fields (type / input / interface / roots) -->
    <template v-else>
      <div class="section-divider">
        <span class="section-lbl">Fields</span>
        <span class="section-cnt">{{ node.fields.length }}</span>
      </div>
      <div
        v-for="field in node.fields"
        :key="field.id"
        class="field-row"
        :class="{ deprecated: field.isDeprecated }"
      >
        <div class="connector conn-left"
          :class="{ connected: connectedAsTarget.has(field.id) }"
          @mouseup.stop="$emit('end-relation', field.id)" />
        <span class="field-name">{{ field.name }}</span>
        <span v-if="field.args.length" class="args-badge">({{ field.args.length }})</span>
        <span class="field-type">{{ field.type }}</span>
        <div class="connector conn-right"
          :class="{ connected: connectedAsSource.has(field.id) }"
          @mousedown.stop="$emit('start-relation', field.id)" />
      </div>
      <div v-if="!node.fields.length" class="no-fields">No fields yet</div>
    </template>

    <!-- Footer -->
    <div class="gql-footer">
      <span class="footer-stat">{{ footerStat }}</span>
      <span class="footer-kind">{{ node.kind }}</span>
    </div>

    <div class="resize-handle" @mousedown.stop="$emit('resize-start', $event)" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GqlTypeNode } from '../../../types/api'
import { GQL_KIND_COLORS } from '../../../types/api'

const props = defineProps<{
  node: GqlTypeNode
  selected: boolean
  highlighted: boolean
  connectedAsSource: Set<string>
  connectedAsTarget: Set<string>
}>()

defineEmits<{
  mousedown: [e: MouseEvent]; select: []; edit: []; delete: []
  'start-relation': [fieldId: string]; 'end-relation': [fieldId: string]; 'resize-start': [e: MouseEvent]
}>()

function hexToRgb(hex: string): string {
  if (!hex || hex[0] !== '#') return '168, 85, 247'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

const kindColor = computed(() => GQL_KIND_COLORS[props.node.kind])

const kindGlyph = computed(() => ({
  'type': '⬡', 'input': '⬠', 'enum': '◈', 'interface': '◇',
  'union': '⬡', 'scalar': '●',
  'query-root': 'Q', 'mutation-root': 'M', 'subscription-root': 'S',
}[props.node.kind] ?? '⬡'))

const kindLabel = computed(() => ({
  'type': 'type', 'input': 'input', 'enum': 'enum', 'interface': 'interface',
  'union': 'union', 'scalar': 'scalar',
  'query-root': 'Query', 'mutation-root': 'Mutation', 'subscription-root': 'Subscription',
}[props.node.kind] ?? props.node.kind))

const footerStat = computed(() => {
  if (props.node.kind === 'enum') return `${props.node.values.length} values`
  if (props.node.kind === 'union') return `${props.node.values.length} members`
  if (props.node.kind === 'scalar') return 'scalar'
  return `${props.node.fields.length} fields`
})
</script>

<style scoped>
.gql-node {
  position: absolute; border-radius: 12px;
  background: #13131c; border: 1.5px solid #22222e;
  box-shadow: 0 6px 32px #00000060;
  overflow: visible; cursor: grab; min-width: 260px; box-sizing: border-box;
  transition: border-color 0.18s, box-shadow 0.18s;
  font-family: 'JetBrains Mono', monospace;
}
.gql-node:active { cursor: grabbing; }
.gql-node.selected {
  border-color: var(--kc);
  box-shadow: 0 0 0 2.5px rgba(var(--kc-rgb, 168, 85, 247), 0.28), 0 8px 40px #00000080;
}
.gql-node.highlighted {
  box-shadow: 0 0 0 2px rgba(var(--kc-rgb, 168, 85, 247), 0.45),
              0 0 40px rgba(var(--kc-rgb, 168, 85, 247), 0.15);
}

.gql-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px;
  background: linear-gradient(135deg,
    rgba(var(--kc-rgb, 168, 85, 247), 0.22) 0%,
    rgba(var(--kc-rgb, 168, 85, 247), 0.08) 100%);
  border-bottom: 1px solid rgba(var(--kc-rgb, 168, 85, 247), 0.2);
  border-radius: 11px 11px 0 0;
}

.kind-gem {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: rgba(var(--kc-rgb, 168, 85, 247), 0.2);
  border: 1px solid rgba(var(--kc-rgb, 168, 85, 247), 0.35);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: var(--kc); font-weight: 900;
}

.gql-title { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gql-name { font-size: 13px; font-weight: 800; color: #f0f0f8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kind-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--kc); opacity: 0.7; }

.node-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.gql-node:hover .node-actions, .gql-node.selected .node-actions { opacity: 1; }
.icon-btn { width: 22px; height: 22px; background: none; border: none; color: #555; cursor: pointer; font-size: 12px; border-radius: 5px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
.icon-btn:hover { color: #ddd; background: rgba(255,255,255,0.07); }
.icon-btn.danger:hover { color: #EF4444; background: #EF444418; }

/* Implements */
.impl-row { display: flex; align-items: center; gap: 5px; padding: 5px 12px; border-bottom: 1px solid #1a1a26; flex-wrap: wrap; }
.impl-label { font-size: 9px; color: #38384e; text-transform: uppercase; letter-spacing: 0.08em; }
.impl-chip { font-size: 9.5px; padding: 1px 6px; border-radius: 8px; background: rgba(var(--kc-rgb, 168, 85, 247), 0.12); color: var(--kc); border: 1px solid rgba(var(--kc-rgb, 168, 85, 247), 0.25); }

/* Section dividers */
.section-divider { display: flex; align-items: center; justify-content: space-between; padding: 5px 12px 3px; background: #0d0d13; }
.section-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38384e; }
.section-cnt { font-size: 9px; color: #2a2a40; background: #161622; padding: 1px 5px; border-radius: 8px; }

/* Fields */
.field-row { display: flex; align-items: center; gap: 7px; padding: 0 12px; height: 32px; position: relative; transition: background 0.1s; }
.field-row:hover { background: #181824; }
.field-row.deprecated { opacity: 0.4; text-decoration: line-through; }

.field-name { flex: 1; font-size: 12px; color: #b0b0c8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.field-type { font-size: 11px; color: var(--kc); opacity: 0.65; flex-shrink: 0; }
.args-badge { font-size: 9.5px; color: #444; flex-shrink: 0; }

/* Enum */
.enum-val { }
.enum-bullet { font-size: 8px; color: var(--kc); flex-shrink: 0; }
.enum-name { color: var(--kc) !important; opacity: 0.9; }

/* Union */
.union-bullet { font-size: 7px; color: var(--kc); flex-shrink: 0; }

/* Scalar */
.scalar-body { padding: 14px 12px; text-align: center; }
.scalar-label { font-size: 10px; color: #38384e; font-style: italic; }

.no-fields { padding: 12px; text-align: center; font-size: 11px; color: #28283a; font-style: italic; }

/* Connectors */
.connector { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #2a2a3a; background: #13131c; cursor: crosshair; z-index: 10; transition: border-color 0.12s, background 0.12s, transform 0.12s; }
.conn-right { right: -6px; }
.conn-left  { left: -6px; }
.connector.connected { border-color: var(--kc); background: var(--kc); }
.conn-right:hover { border-color: #fff !important; background: #fff !important; transform: scale(1.5); }
.conn-left:hover  { border-color: #fff !important; background: #fff !important; transform: scale(1.5); }

/* Footer */
.gql-footer { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-top: 1px solid #181824; background: #0d0d13; border-radius: 0 0 11px 11px; }
.footer-stat { font-size: 10px; color: #30304a; }
.footer-kind { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(var(--kc-rgb, 168, 85, 247), 0.6); }

.resize-handle {
  position: absolute; bottom: 4px; right: 5px; width: 13px; height: 13px; cursor: se-resize; opacity: 0; transition: opacity 0.15s;
  background: radial-gradient(circle at 100% 100%, rgba(var(--kc-rgb, 168, 85, 247), 0.6) 30%, transparent 30%);
}
.gql-node:hover .resize-handle, .gql-node.selected .resize-handle { opacity: 1; }
</style>
