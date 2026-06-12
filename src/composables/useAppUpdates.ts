import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

type UpdateMetadata = {
  version: string
  currentVersion: string
  body?: string | null
  date?: string | null
}

type UpdateCheckResult = {
  configured: boolean
  update: UpdateMetadata | null
}

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'installing'
  | 'unavailable'
  | 'error'

const status = ref<UpdateStatus>('idle')
const availableUpdate = ref<UpdateMetadata | null>(null)
const statusMessage = ref('')
const promptedVersion = ref<string | null>(null)

function buildPromptMessage(update: UpdateMetadata) {
  const lines = [
    `DB Designer ${update.version} is available.`,
    `You are currently on ${update.currentVersion}.`,
  ]

  if (update.body?.trim()) {
    lines.push('', update.body.trim())
  }

  lines.push('', 'Install the update now?')
  return lines.join('\n')
}

async function installAvailableUpdate() {
  const update = availableUpdate.value
  if (!update) return

  status.value = 'installing'
  statusMessage.value = `Installing v${update.version}...`

  await invoke('install_update')
  statusMessage.value = `Restarting into v${update.version}...`
  await invoke('restart_app')
}

async function maybePromptForUpdate(force = false) {
  const update = availableUpdate.value
  if (!update) return
  if (!force && promptedVersion.value === update.version) return

  promptedVersion.value = update.version
  const confirmed = window.confirm(buildPromptMessage(update))
  if (!confirmed) return

  await installAvailableUpdate()
}

export function useAppUpdates() {
  const buttonLabel = computed(() => {
    switch (status.value) {
      case 'checking':
        return 'Checking...'
      case 'available':
        return availableUpdate.value ? `Update v${availableUpdate.value.version}` : 'Update available'
      case 'up-to-date':
        return 'Up to date'
      case 'installing':
        return 'Installing...'
      case 'unavailable':
        return 'Updates unavailable'
      case 'error':
        return 'Update failed'
      default:
        return 'Check Updates'
    }
  })

  const isBusy = computed(() => status.value === 'checking' || status.value === 'installing')
  const hasAvailableUpdate = computed(() => status.value === 'available' && !!availableUpdate.value)

  async function checkForUpdates(options?: { silent?: boolean; promptIfAvailable?: boolean }) {
    const silent = options?.silent ?? false
    const promptIfAvailable = options?.promptIfAvailable ?? !silent

    status.value = 'checking'
    if (!silent) statusMessage.value = 'Checking GitHub releases...'

    try {
      const result = await invoke<UpdateCheckResult>('fetch_update')

      if (!result.configured) {
        availableUpdate.value = null
        status.value = 'unavailable'
        statusMessage.value = 'This build does not have updater signing configured yet.'
        return
      }

      if (!result.update) {
        availableUpdate.value = null
        status.value = 'up-to-date'
        statusMessage.value = 'You already have the latest release.'
        return
      }

      availableUpdate.value = result.update
      status.value = 'available'
      statusMessage.value = `Version ${result.update.version} is available.`

      if (promptIfAvailable) {
        await maybePromptForUpdate()
      }
    } catch (error) {
      availableUpdate.value = null
      status.value = 'error'
      statusMessage.value = error instanceof Error ? error.message : 'Could not check for updates.'
      if (!silent) {
        window.alert(statusMessage.value)
      }
    }
  }

  async function checkOrInstall() {
    if (status.value === 'available' && availableUpdate.value) {
      await maybePromptForUpdate(true)
      return
    }

    if (isBusy.value) return
    await checkForUpdates()
  }

  return {
    availableUpdate,
    buttonLabel,
    checkForUpdates,
    checkOrInstall,
    hasAvailableUpdate,
    isBusy,
    status,
    statusMessage,
  }
}
