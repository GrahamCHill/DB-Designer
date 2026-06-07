<template>
  <div class="modal-backdrop" @mousedown.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit Endpoint</span>
        <button class="close-btn" @click="$emit('close')">x</button>
      </div>
      <div class="modal-body">
        <!-- Method + Path -->
        <div class="field-row">
          <label>Method</label>
          <div class="method-select-row">
            <button v-for="m in methods" :key="m"
              class="method-btn" :class="{ active: draft.method === m }"
              :style="{ '--mc': methodColor(m), '--mc-rgb': hexToRgb(methodColor(m)) }"
              @click="draft.method = m">{{ m }}</button>
          </div>
        </div>
        <div class="field-row">
          <label>Path</label>
          <input v-model="draft.path" placeholder="/resource/{id}" />
        </div>
        <div class="field-row">
          <label>Summary</label>
          <input v-model="draft.summary" placeholder="Brief description" />
        </div>
        <div class="field-row">
          <label>Description</label>
          <textarea v-model="draft.description" placeholder="What this endpoint does, key rules, and implementation notes"></textarea>
        </div>
        <div class="field-row">
          <label>Tags</label>
          <input v-model="tagsStr" placeholder="users, auth (comma-separated)" />
        </div>
        <div class="field-row" v-if="supportsRequestBody">
          <label>Request Type</label>
          <select v-model="draft.requestBodyRef">
            <option :value="null">Untyped body</option>
            <option v-for="type in restTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
          </select>
        </div>
        <div class="field-row">
          <label>Color</label>
          <input type="color" v-model="draft.color" class="color-input" />
        </div>

        <!-- Parameters -->
        <div class="section-head">
          <span>Parameters</span>
          <button class="add-btn" @click="addParam">+ Add</button>
        </div>
        <div v-for="(p, i) in draft.params" :key="p.id" class="param-row">
          <select v-model="p.in" class="sm-select">
            <option>path</option><option>query</option><option>header</option>
          </select>
          <input v-model="p.name" placeholder="name" class="sm-input flex-1" />
          <input v-model="p.type" placeholder="type" class="sm-input w80" />
          <label class="req-check"><input type="checkbox" v-model="p.required" /> req</label>
          <button class="del-btn" @click="draft.params.splice(i,1)">x</button>
        </div>

        <!-- Responses -->
        <div class="section-head">
          <span>Responses</span>
          <div class="section-actions">
            <button class="add-btn" @click="applyDefaultResponsePack">+ Defaults</button>
            <button class="add-btn" @click="addResponse">+ Add</button>
          </div>
        </div>
        <div class="preset-strip">
          <button
            v-for="preset in responsePresets"
            :key="preset.statusCode"
            class="preset-btn"
            @click="applyResponsePreset(preset)"
          >
            {{ preset.statusCode }} {{ preset.description }}
          </button>
        </div>
        <div v-for="(r, i) in draft.responses" :key="r.id" class="param-row">
          <input v-model.number="r.statusCode" type="number" class="sm-input w60" placeholder="200" />
          <input v-model="r.description" placeholder="description" class="sm-input flex-1" />
          <select v-model="r.bodyTypeRef" class="sm-select type-select">
            <option :value="null">No type</option>
            <option v-for="type in restTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
          </select>
          <button class="del-btn" @click="draft.responses.splice(i,1)">x</button>
        </div>
        <div v-if="typedResponses.length" class="shape-summary">
          <div class="shape-summary-title">Modeled Response Shapes</div>
          <div v-for="item in typedResponses" :key="item.id" class="shape-summary-row">
            <span class="shape-status">{{ item.statusCode }}</span>
            <span class="shape-type">{{ item.typeName }}</span>
            <span class="shape-meta">{{ item.fieldCount }} fields</span>
          </div>
        </div>
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
import type { RestEndpointNode, HttpMethod, RestResponse, RestTypeNode } from '../../types/api'
import { METHOD_COLORS } from '../../types/api'

const props = defineProps<{ node: RestEndpointNode }>()
const emit  = defineEmits(['close'])
const store = useApiStore()

const methods: HttpMethod[] = ['GET','POST','PUT','PATCH','DELETE']
const methodColor = (m: HttpMethod) => METHOD_COLORS[m]
const restTypes = computed(() =>
  store.restNodes.filter((node): node is RestTypeNode => node.kind === 'type')
)
const supportsRequestBody = computed(() => ['POST', 'PUT', 'PATCH'].includes(draft.method))
const responsePresets: Array<Pick<RestResponse, 'statusCode' | 'description'>> = [
  { statusCode: 200, description: 'OK' },
  { statusCode: 201, description: 'Created' },
  { statusCode: 202, description: 'Accepted' },
  { statusCode: 204, description: 'No Content' },
  { statusCode: 400, description: 'Bad Request' },
  { statusCode: 401, description: 'Unauthorized' },
  { statusCode: 403, description: 'Forbidden' },
  { statusCode: 404, description: 'Not Found' },
  { statusCode: 409, description: 'Conflict' },
  { statusCode: 422, description: 'Unprocessable Entity' },
  { statusCode: 429, description: 'Too Many Requests' },
  { statusCode: 500, description: 'Internal Server Error' },
  { statusCode: 501, description: 'Not Implemented' },
  { statusCode: 503, description: 'Service Unavailable' },
]
const typedResponses = computed(() => draft.responses
  .map((response) => {
    const type = restTypes.value.find((entry) => entry.id === response.bodyTypeRef)
    if (!type) return null
    return {
      id: response.id,
      statusCode: response.statusCode,
      typeName: type.name,
      fieldCount: type.fields.length,
    }
  })
  .filter((entry): entry is { id: string; statusCode: number; typeName: string; fieldCount: number } => Boolean(entry))
)

function hexToRgb(hex: string): string {
  if (!hex || hex[0] !== '#') return '62, 207, 142'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
const draft = reactive<RestEndpointNode>(JSON.parse(JSON.stringify(props.node)))
const tagsStr = computed({
  get: () => draft.tags.join(', '),
  set: (v) => { draft.tags = v.split(',').map(s => s.trim()).filter(Boolean) }
})

function addParam() {
  draft.params.push({ id: uuidv4(), name: '', in: 'query', type: 'string', required: false, description: '' })
}
function addResponse() {
  draft.responses.push({ id: uuidv4(), statusCode: 200, description: 'OK', bodyTypeRef: null })
}
function applyResponsePreset(preset: Pick<RestResponse, 'statusCode' | 'description'>) {
  const existing = draft.responses.find(response => response.statusCode === preset.statusCode)
  if (existing) {
    existing.description = preset.description
    return
  }
  draft.responses.push({ id: uuidv4(), statusCode: preset.statusCode, description: preset.description, bodyTypeRef: null })
}
function applyDefaultResponsePack() {
  const defaultStatuses = draft.method === 'GET'
    ? [200, 404, 500]
    : draft.method === 'POST'
      ? [201, 400, 404, 409, 500]
      : draft.method === 'DELETE'
        ? [204, 404, 500]
        : [200, 400, 404, 500]

  defaultStatuses.forEach((statusCode) => {
    const preset = responsePresets.find(candidate => candidate.statusCode === statusCode)
    if (preset) applyResponsePreset(preset)
  })
}
function save() {
  if (!supportsRequestBody.value) {
    draft.requestBodyRef = null
  }
  store.updateRestNode(props.node.id, JSON.parse(JSON.stringify(draft)))
  emit('close')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; background: #00000080; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px;
  width: 560px; max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 80px #000000a0;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid #1e1e2a;
}
.modal-title { font-size: 14px; font-weight: 700; color: #f0f0f0; }
.close-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }
.close-btn:hover { color: #e0e0e0; }
.modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 18px; border-top: 1px solid #1e1e2a;
}

.field-row { display: flex; flex-direction: column; gap: 4px; }
.field-row label { font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
.field-row input, .field-row select {
  background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 6px;
  color: #e0e0e0; padding: 7px 10px; font-size: 12px;
  font-family: 'JetBrains Mono', monospace; outline: none;
  transition: border-color 0.15s;
}
.field-row textarea {
  min-height: 78px;
  resize: vertical;
  background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 6px;
  color: #e0e0e0; padding: 9px 10px; font-size: 12px;
  font-family: 'JetBrains Mono', monospace; outline: none;
  transition: border-color 0.15s;
}
.field-row input:focus, .field-row textarea:focus, .field-row select:focus { border-color: #3ECF8E40; }

.method-select-row { display: flex; gap: 5px; }
.method-btn {
  flex: 1; padding: 6px; border-radius: 5px; border: 1px solid transparent;
  background: #1a1a24; color: #555; cursor: pointer; font-size: 11px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace; letter-spacing: 0.06em;
  transition: all 0.15s;
}
.method-btn:hover { color: var(--mc); border-color: var(--mc); }
.method-btn.active {
  color: var(--mc); border-color: var(--mc);
  background: rgba(var(--mc-rgb, 62, 207, 142), 0.12);
}

.color-input { width: 48px; height: 32px; padding: 2px; border-radius: 6px; cursor: pointer; }

.section-head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase;
  letter-spacing: 0.08em; margin-top: 4px;
}
.section-actions {
  display: flex;
  gap: 6px;
}
.add-btn {
  background: none; border: 1px solid #2a2a3a; color: #3ECF8E;
  border-radius: 4px; padding: 2px 8px; font-size: 10px; cursor: pointer;
  transition: background 0.15s;
}
.add-btn:hover { background: #3ECF8E15; }

.preset-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-btn {
  background: #161620;
  border: 1px solid #2a2a3a;
  color: #9fb1c9;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.preset-btn:hover {
  color: #e7f2ff;
  border-color: #3ECF8E40;
  background: #19241f;
}

.shape-summary {
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  background: #101019;
  padding: 10px;
}

.shape-summary-title {
  color: #7f92af;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.shape-summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #b9cbe0;
  font-size: 11px;
  padding: 4px 0;
}

.shape-status {
  color: #67dfab;
  font-weight: 700;
  min-width: 32px;
}

.shape-type {
  flex: 1;
}

.shape-meta {
  color: #7287a3;
}

.param-row {
  display: flex; gap: 6px; align-items: center;
}
.sm-select, .sm-input {
  background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 5px;
  color: #c0c0cc; padding: 5px 7px; font-size: 11px;
  font-family: 'JetBrains Mono', monospace; outline: none;
}
.sm-select { width: 70px; }
.type-select { width: 132px; }
.flex-1    { flex: 1; }
.w80       { width: 80px; }
.w60       { width: 60px; }
.req-check { display: flex; align-items: center; gap: 3px; font-size: 10px; color: #555; white-space: nowrap; }
.del-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 12px; padding: 0 4px; }
.del-btn:hover { color: #EF4444; }

.btn-cancel {
  background: none; border: 1px solid #2a2a3a; color: #666;
  border-radius: 6px; padding: 7px 16px; font-size: 12px; cursor: pointer;
}
.btn-save {
  background: #3ECF8E; color: #0a1a12; border: none;
  border-radius: 6px; padding: 7px 20px; font-size: 12px; font-weight: 700; cursor: pointer;
  transition: background 0.15s;
}
.btn-save:hover { background: #45e09a; }
</style>
