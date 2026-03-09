<template>
  <div class="modal-backdrop" @mousedown.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="kind-badge" :style="{ background: kindColor + '20', color: kindColor }">{{ node.kind }}</span>
        <span class="modal-title">{{ draft.name }}</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <label>Name</label>
          <input v-model="draft.name" placeholder="TypeName" />
        </div>
        <div class="field-row">
          <label>Description</label>
          <input v-model="draft.description" placeholder="Optional description" />
        </div>
        <div class="field-row">
          <label>Color</label>
          <input type="color" v-model="draft.color" class="color-input" />
        </div>

        <!-- Enum values -->
        <template v-if="draft.kind === 'enum'">
          <div class="section-head">
            <span>Values</span>
            <button class="add-btn" @click="addEnumVal">+ Add</button>
          </div>
          <div v-for="(v, i) in draft.values" :key="i" class="param-row">
            <input :value="v" @input="draft.values[i] = ($event.target as HTMLInputElement).value"
              placeholder="VALUE" class="sm-input flex-1" />
            <button class="del-btn" @click="draft.values.splice(i,1)">✕</button>
          </div>
        </template>

        <!-- Union members -->
        <template v-else-if="draft.kind === 'union'">
          <div class="section-head">
            <span>Members</span>
            <button class="add-btn" @click="draft.values.push('')">+ Add</button>
          </div>
          <div v-for="(v, i) in draft.values" :key="i" class="param-row">
            <input :value="v" @input="draft.values[i] = ($event.target as HTMLInputElement).value"
              placeholder="TypeName" class="sm-input flex-1" />
            <button class="del-btn" @click="draft.values.splice(i,1)">✕</button>
          </div>
        </template>

        <!-- Implements (for type / interface) -->
        <template v-else-if="draft.kind === 'type' || draft.kind === 'interface'">
          <div class="field-row">
            <label>Implements (comma-separated)</label>
            <input v-model="implStr" placeholder="InterfaceA, InterfaceB" />
          </div>
        </template>

        <!-- Fields -->
        <template v-if="!['enum','union','scalar'].includes(draft.kind)">
          <div class="section-head">
            <span>Fields</span>
            <button class="add-btn" @click="addField">+ Add</button>
          </div>
          <div v-for="(f, i) in draft.fields" :key="f.id" class="field-block">
            <div class="param-row">
              <input v-model="f.name" placeholder="fieldName" class="sm-input flex-1" />
              <input v-model="f.type" placeholder="String!" class="sm-input w120" />
              <label class="req-check">
                <input type="checkbox" v-model="f.isDeprecated" /> dep
              </label>
              <button class="del-btn" @click="draft.fields.splice(i,1)">✕</button>
            </div>
            <!-- Args sub-section -->
            <div class="args-section">
              <div v-for="(a, ai) in f.args" :key="a.id" class="param-row indent">
                <span class="arg-prefix">arg</span>
                <input v-model="a.name" placeholder="argName" class="sm-input flex-1" />
                <input v-model="a.type" placeholder="String" class="sm-input w100" />
                <button class="del-btn" @click="f.args.splice(ai,1)">✕</button>
              </div>
              <button class="add-arg-btn" @click="addArg(f)">+ arg</button>
            </div>
          </div>
        </template>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button class="btn-save" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useApiStore } from '../../stores/api'
import type { GqlTypeNode, GqlField } from '../../types/api'
import { GQL_KIND_COLORS } from '../../types/api'

const props = defineProps<{ node: GqlTypeNode }>()
const emit  = defineEmits(['close'])
const store = useApiStore()

const draft = reactive<GqlTypeNode>(JSON.parse(JSON.stringify(props.node)))
const kindColor = computed(() => GQL_KIND_COLORS[draft.kind])

const implStr = computed({
  get: () => draft.implements.join(', '),
  set: (v) => { draft.implements = v.split(',').map(s => s.trim()).filter(Boolean) },
})

function addField() {
  draft.fields.push({ id: uuidv4(), name: '', type: 'String', description: '', isDeprecated: false, args: [], resolverRef: null })
}
function addArg(f: GqlField) {
  f.args.push({ id: uuidv4(), name: '', type: 'String', defaultValue: '', description: '' })
}
function addEnumVal() { draft.values.push('') }

function save() {
  store.updateGqlNode(props.node.id, JSON.parse(JSON.stringify(draft)))
  emit('close')
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: #00000080; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal { background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px; width: 540px; max-height: 82vh; display: flex; flex-direction: column; box-shadow: 0 24px 80px #000000a0; }
.modal-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #1e1e2a; }
.kind-badge { font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.08em; font-family: 'JetBrains Mono', monospace; }
.modal-title { flex: 1; font-size: 14px; font-weight: 700; color: #f0f0f0; }
.close-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }
.close-btn:hover { color: #e0e0e0; }
.modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #1e1e2a; }
.field-row { display: flex; flex-direction: column; gap: 4px; }
.field-row label { font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
.field-row input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 6px; color: #e0e0e0; padding: 7px 10px; font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; }
.color-input { width: 48px; height: 32px; padding: 2px; border-radius: 6px; cursor: pointer; }
.section-head { display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
.add-btn { background: none; border: 1px solid #2a2a3a; color: #3ECF8E; border-radius: 4px; padding: 2px 8px; font-size: 10px; cursor: pointer; }
.add-btn:hover { background: #3ECF8E15; }
.param-row { display: flex; gap: 6px; align-items: center; }
.param-row.indent { padding-left: 12px; }
.field-block { display: flex; flex-direction: column; gap: 3px; background: #161620; border-radius: 6px; padding: 6px; }
.args-section { display: flex; flex-direction: column; gap: 3px; }
.arg-prefix { font-size: 9px; color: #555; font-family: 'JetBrains Mono', monospace; width: 22px; flex-shrink: 0; }
.add-arg-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 10px; padding: 2px 4px; align-self: flex-start; }
.add-arg-btn:hover { color: #3ECF8E; }
.sm-input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 5px; color: #c0c0cc; padding: 5px 7px; font-size: 11px; font-family: 'JetBrains Mono', monospace; outline: none; }
.flex-1 { flex: 1; } .w120 { width: 120px; } .w100 { width: 100px; }
.req-check { display: flex; align-items: center; gap: 3px; font-size: 10px; color: #555; white-space: nowrap; }
.del-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 12px; padding: 0 4px; }
.del-btn:hover { color: #EF4444; }
.btn-cancel { background: none; border: 1px solid #2a2a3a; color: #666; border-radius: 6px; padding: 7px 16px; font-size: 12px; cursor: pointer; }
.btn-save { background: #3ECF8E; color: #0a1a12; border: none; border-radius: 6px; padding: 7px 20px; font-size: 12px; font-weight: 700; cursor: pointer; }
.btn-save:hover { background: #45e09a; }
</style>
