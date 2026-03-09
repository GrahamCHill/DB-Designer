<template>
  <div class="modal-backdrop" @mousedown.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit Federation Type</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="two-col">
          <div class="field-row">
            <label>Name</label>
            <input v-model="draft.name" placeholder="TypeName" />
          </div>
          <div class="field-row">
            <label>Service</label>
            <select v-model="draft.serviceId">
              <option v-for="svc in store.fedServices" :key="svc.id" :value="svc.id">
                {{ svc.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="two-col">
          <label class="toggle-row">
            <input type="checkbox" v-model="draft.isEntity" />
            <span>Is Entity <span class="badge-sm entity">@key</span></span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" v-model="draft.isExtension" />
            <span>Is Extension <span class="badge-sm ext">extend</span></span>
          </label>
        </div>

        <!-- @key fields -->
        <div v-if="draft.isEntity" class="field-row">
          <label>@key fields (space-separated)</label>
          <input v-model="keyStr" placeholder="id sku" />
        </div>

        <div class="field-row">
          <label>Color</label>
          <input type="color" v-model="draft.color" class="color-input" />
        </div>

        <!-- Fields -->
        <div class="section-head">
          <span>Fields</span>
          <button class="add-btn" @click="addField">+ Add</button>
        </div>
        <div v-for="(f, i) in draft.fields" :key="f.id" class="field-block">
          <div class="param-row">
            <input v-model="f.name" placeholder="fieldName" class="sm-input flex-1" />
            <input v-model="f.type" placeholder="String!" class="sm-input w120" />
            <button class="del-btn" @click="draft.fields.splice(i,1)">✕</button>
          </div>
          <div class="decorator-row">
            <label class="dec-check"><input type="checkbox" v-model="f.isKey" /> @key</label>
            <label class="dec-check"><input type="checkbox" v-model="f.isExternal" /> @external</label>
            <label class="dec-check"><input type="checkbox" v-model="f.isRequired" /> @requires</label>
            <input v-if="f.isRequired" v-model="f.requiresFields"
              placeholder="fields: &quot;id&quot;" class="sm-input flex-1" />
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
import type { FedTypeNode } from '../../types/api'

const props = defineProps<{ node: FedTypeNode }>()
const emit  = defineEmits(['close'])
const store = useApiStore()

const draft = reactive<FedTypeNode>(JSON.parse(JSON.stringify(props.node)))

const keyStr = computed({
  get: () => draft.keyFields.join(' '),
  set: (v) => { draft.keyFields = v.split(' ').map(s => s.trim()).filter(Boolean) },
})

function addField() {
  draft.fields.push({ id: uuidv4(), name: '', type: 'String', isExternal: false, isRequired: false, requiresFields: '', isKey: false, description: '' })
}
function save() {
  store.updateFedNode(props.node.id, JSON.parse(JSON.stringify(draft)))
  emit('close')
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: #00000080; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal { background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px; width: 560px; max-height: 82vh; display: flex; flex-direction: column; box-shadow: 0 24px 80px #000000a0; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #1e1e2a; }
.modal-title { font-size: 14px; font-weight: 700; color: #f0f0f0; }
.close-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }
.close-btn:hover { color: #e0e0e0; }
.modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #1e1e2a; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.field-row { display: flex; flex-direction: column; gap: 4px; }
.field-row label { font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
.field-row input, .field-row select { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 6px; color: #e0e0e0; padding: 7px 10px; font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; }
.color-input { width: 48px; height: 32px; padding: 2px; border-radius: 6px; cursor: pointer; }
.toggle-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #c0c0cc; cursor: pointer; padding: 6px; }
.badge-sm { font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; }
.badge-sm.entity { background: #F59E0B20; color: #F59E0B; }
.badge-sm.ext    { background: #8B5CF620; color: #8B5CF6; }
.section-head { display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
.add-btn { background: none; border: 1px solid #2a2a3a; color: #3ECF8E; border-radius: 4px; padding: 2px 8px; font-size: 10px; cursor: pointer; }
.add-btn:hover { background: #3ECF8E15; }
.param-row { display: flex; gap: 6px; align-items: center; }
.field-block { display: flex; flex-direction: column; gap: 4px; background: #161620; border-radius: 6px; padding: 6px; }
.decorator-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-left: 4px; }
.dec-check { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #666; cursor: pointer; }
.sm-input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 5px; color: #c0c0cc; padding: 5px 7px; font-size: 11px; font-family: 'JetBrains Mono', monospace; outline: none; }
.flex-1 { flex: 1; } .w120 { width: 120px; }
.del-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 12px; padding: 0 4px; }
.del-btn:hover { color: #EF4444; }
.btn-cancel { background: none; border: 1px solid #2a2a3a; color: #666; border-radius: 6px; padding: 7px 16px; font-size: 12px; cursor: pointer; }
.btn-save { background: #3ECF8E; color: #0a1a12; border: none; border-radius: 6px; padding: 7px 20px; font-size: 12px; font-weight: 700; cursor: pointer; }
.btn-save:hover { background: #45e09a; }
</style>
