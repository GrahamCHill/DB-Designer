<template>
  <div class="modal-backdrop" @mousedown.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit Service</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <label>Service Name</label>
          <input v-model="draft.name" placeholder="users-service" />
        </div>
        <div class="field-row">
          <label>GraphQL URL</label>
          <input v-model="draft.url" placeholder="https://users.example.com/graphql" />
        </div>
        <div class="field-row">
          <label>Color</label>
          <input type="color" v-model="draft.color" class="color-input" />
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
import { reactive } from 'vue'
import { useApiStore } from '../../stores/api'
import type { FedService } from '../../types/api'

const props = defineProps<{ service: FedService }>()
const emit  = defineEmits(['close'])
const store = useApiStore()

const draft = reactive<FedService>(JSON.parse(JSON.stringify(props.service)))

function save() {
  store.updateService(props.service.id, JSON.parse(JSON.stringify(draft)))
  emit('close')
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: #00000080; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal { background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px; width: 420px; display: flex; flex-direction: column; box-shadow: 0 24px 80px #000000a0; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #1e1e2a; }
.modal-title { font-size: 14px; font-weight: 700; color: #f0f0f0; }
.close-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }
.close-btn:hover { color: #e0e0e0; }
.modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #1e1e2a; }
.field-row { display: flex; flex-direction: column; gap: 4px; }
.field-row label { font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
.field-row input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 6px; color: #e0e0e0; padding: 7px 10px; font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; }
.color-input { width: 48px; height: 32px; padding: 2px; border-radius: 6px; cursor: pointer; }
.btn-cancel { background: none; border: 1px solid #2a2a3a; color: #666; border-radius: 6px; padding: 7px 16px; font-size: 12px; cursor: pointer; }
.btn-save { background: #3ECF8E; color: #0a1a12; border: none; border-radius: 6px; padding: 7px 20px; font-size: 12px; font-weight: 700; cursor: pointer; }
.btn-save:hover { background: #45e09a; }
</style>
