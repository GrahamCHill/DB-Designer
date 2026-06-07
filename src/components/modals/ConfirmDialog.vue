<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('cancel')">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ title }}</div>
          <button class="close-btn" @click="$emit('cancel')">x</button>
        </div>

        <div class="modal-body">
          <p class="modal-message">{{ message }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="$emit('cancel')">{{ cancelLabel }}</button>
          <button class="btn-confirm" :class="{ danger }" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}>(), {
  title: 'Confirm Action',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  danger: false,
})

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: #0000007a;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2500;
  padding: 18px;
}

.modal {
  width: min(440px, 100%);
  background: #16161a;
  border: 1px solid #2a2a35;
  border-radius: 14px;
  box-shadow: 0 24px 80px #00000099;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid #1e1e28;
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
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
  padding: 18px;
}

.modal-message {
  margin: 0;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.55;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 18px 18px;
  border-top: 1px solid #1e1e28;
}

.btn-cancel,
.btn-confirm {
  min-width: 96px;
  height: 38px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.btn-cancel {
  background: #171922;
  border: 1px solid #2b3140;
  color: #cbd5e1;
}

.btn-cancel:hover {
  background: #1d2230;
  color: #f8fafc;
}

.btn-confirm {
  background: #2c7a5b;
  border: 1px solid #2c7a5b;
  color: #f8fafc;
}

.btn-confirm:hover {
  background: #2f8a66;
  border-color: #2f8a66;
}

.btn-confirm.danger {
  background: #7f1d1d;
  border-color: #7f1d1d;
}

.btn-confirm.danger:hover {
  background: #991b1b;
  border-color: #991b1b;
}
</style>
