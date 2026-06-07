<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('cancel')">
      <div class="modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">Create Bridge Table</div>
            <div class="modal-subtitle">{{ sourceTable.name }} to {{ targetTable.name }}</div>
          </div>
          <button class="close-btn" @click="$emit('cancel')">x</button>
        </div>

        <div class="modal-body">
          <p class="modal-message">
            Why are you creating this bridge? We will wire the table to each table's primary key when available and scaffold a more useful starter table for the selected workflow.
          </p>

          <div class="pk-summary">
            <div class="pk-card">
              <span class="pk-label">{{ sourceTable.name }}</span>
              <span class="pk-value">{{ sourceReferenceLabel }}</span>
            </div>
            <div class="pk-card">
              <span class="pk-label">{{ targetTable.name }}</span>
              <span class="pk-value">{{ targetReferenceLabel }}</span>
            </div>
          </div>

          <div class="use-case-grid">
            <button
              v-for="option in useCaseOptions"
              :key="option.value"
              class="use-case-card"
              :class="{ active: draft.useCase === option.value }"
              @click="draft.useCase = option.value"
            >
              <span class="use-case-name">{{ option.label }}</span>
              <span class="use-case-description">{{ option.description }}</span>
              <span class="use-case-extras">{{ option.extras }}</span>
            </button>
          </div>

          <label class="field-block">
            <span class="field-label">Table Name</span>
            <input v-model="draft.tableName" class="field-input" placeholder="bridge_table_name" />
          </label>

          <label class="field-block">
            <span class="field-label">Notes</span>
            <textarea
              v-model="draft.notes"
              class="field-textarea"
              placeholder="Optional notes to carry into the generated table comment."
            />
          </label>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="$emit('cancel')">Cancel</button>
          <button class="btn-confirm" @click="confirm">Create Table</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { BridgeTableOptions, BridgeTableUseCase, Table } from '../../types'

const props = defineProps<{
  sourceTable: Table
  targetTable: Table
}>()

const emit = defineEmits<{
  confirm: [options: BridgeTableOptions]
  cancel: []
}>()

const useCaseOptions: Array<{
  value: BridgeTableUseCase
  label: string
  description: string
  extras: string
}> = [
  {
    value: 'generic',
    label: 'Generic Junction',
    description: 'Plain many-to-many link for tags, categories, flags, feature switches, or any simple cross-reference.',
    extras: 'Adds only the two foreign keys so you can shape the rest yourself.',
  },
  {
    value: 'membership',
    label: 'Membership',
    description: 'For users in organizations, people in teams, accounts in workspaces, or members in groups with roles.',
    extras: 'Adds role and joined_at so the relationship has access-level and start-date context.',
  },
  {
    value: 'line-items',
    label: 'Line Items',
    description: 'For orders with products, invoices with billable items, shopping carts, subscriptions, kits, or bundles.',
    extras: 'Adds quantity and unit_price for transactional pricing and counting.',
  },
  {
    value: 'enrollment',
    label: 'Enrollment',
    description: 'For students in courses, users in programs, members in plans, or customers in subscriptions with lifecycle states.',
    extras: 'Adds status and enrolled_at for active, paused, completed, or cancelled flows.',
  },
  {
    value: 'assignment',
    label: 'Assignment',
    description: 'For tickets assigned to agents, tasks assigned to owners, records assigned to reviewers, or workloads routed to queues.',
    extras: 'Adds assigned_at and assignment_note for routing context.',
  },
  {
    value: 'vector-rag',
    label: 'Vector DB / RAG',
    description: 'For document retrieval across multiple PDFs, files, pages, chunks, or records where each link needs embeddings and retrieval metadata.',
    extras: 'Adds chunk_index, content_text, embedding_vector, metadata_json, and source_uri.',
  },
  {
    value: 'audit-trail',
    label: 'Audit Trail',
    description: 'For change history, compliance logging, approvals, or record-level event tracking across business entities and actors.',
    extras: 'Adds event_type, changed_at, changed_by, change_summary, and change_payload.',
  },
]

const draft = reactive<BridgeTableOptions>({
  useCase: 'generic',
  tableName: `${props.sourceTable.name}_${props.targetTable.name}`,
  notes: '',
})

function preferredReferenceLabel(table: Table) {
  const pk = table.columns.find(column => column.primaryKey)
  if (pk) return `${pk.name} (primary key)`
  const uq = table.columns.find(column => column.unique)
  if (uq) return `${uq.name} (unique key fallback)`
  return `${table.columns[0]?.name ?? 'no columns'} (fallback)`
}

const sourceReferenceLabel = computed(() => preferredReferenceLabel(props.sourceTable))
const targetReferenceLabel = computed(() => preferredReferenceLabel(props.targetTable))

function confirm() {
  emit('confirm', {
    useCase: draft.useCase,
    tableName: draft.tableName?.trim() || undefined,
    notes: draft.notes?.trim() || undefined,
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: #00000082;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2600;
  padding: 18px;
}

.modal {
  width: min(760px, 100%);
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 14px;
  box-shadow: 0 24px 80px #00000099;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #1e1e28;
}

.modal-title {
  color: #f8fafc;
  font-size: 15px;
  font-weight: 700;
}

.modal-subtitle {
  color: #7dd3a7;
  font-size: 11px;
  margin-top: 5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 15px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.close-btn:hover {
  color: #f8fafc;
  background: #20232d;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-message {
  margin: 0;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.55;
}

.pk-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.pk-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #11141a;
  border: 1px solid #243041;
}

.pk-label,
.field-label {
  color: #7c8aa0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pk-value {
  color: #f8fafc;
  font-size: 13px;
}

.use-case-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.use-case-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #2a3140;
  background: #12151b;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.use-case-card:hover {
  border-color: #3ECF8E66;
  background: #161b22;
}

.use-case-card.active {
  border-color: #3ECF8E;
  box-shadow: inset 0 0 0 1px #3ECF8E33;
  background: #102017;
}

.use-case-name {
  color: #f8fafc;
  font-size: 13px;
  font-weight: 700;
}

.use-case-description {
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.45;
}

.use-case-extras {
  color: #7dd3a7;
  font-size: 11px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field-input,
.field-textarea {
  background: #11141a;
  border: 1px solid #2a3140;
  border-radius: 10px;
  color: #e2e8f0;
  padding: 10px 12px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
}

.field-input:focus,
.field-textarea:focus {
  border-color: #3ECF8E66;
}

.field-textarea {
  min-height: 84px;
  resize: vertical;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px 20px;
  border-top: 1px solid #1e1e28;
}

.btn-cancel,
.btn-confirm {
  min-width: 110px;
  height: 40px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-cancel {
  background: #171922;
  border: 1px solid #2b3140;
  color: #cbd5e1;
}

.btn-confirm {
  background: #2c7a5b;
  border: 1px solid #2c7a5b;
  color: #f8fafc;
}
</style>
