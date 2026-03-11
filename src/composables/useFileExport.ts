import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

type ExportFilter = {
  name: string
  extensions: string[]
}

type ExportPayload = Blob | string | Uint8Array

type SaveExportOptions = {
  data: ExportPayload
  defaultPath: string
  filters?: ExportFilter[]
  mimeType?: string
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function payloadToBlob(data: ExportPayload, mimeType = 'application/octet-stream') {
  if (data instanceof Blob) return data
  if (typeof data === 'string') return new Blob([data], { type: mimeType })
  return new Blob([data], { type: mimeType })
}

async function payloadToBytes(data: ExportPayload, mimeType?: string) {
  const blob = await payloadToBlob(data, mimeType)
  return new Uint8Array(await blob.arrayBuffer())
}

async function browserDownload(options: SaveExportOptions) {
  const blob = await payloadToBlob(options.data, options.mimeType)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = options.defaultPath
  link.click()
  URL.revokeObjectURL(url)
}

export async function saveExportFile(options: SaveExportOptions) {
  if (!isTauriRuntime()) {
    await browserDownload(options)
    return true
  }

  const selectedPath = await save({
    defaultPath: options.defaultPath,
    filters: options.filters,
  })

  if (!selectedPath || Array.isArray(selectedPath)) {
    return false
  }

  const bytes = await payloadToBytes(options.data, options.mimeType)
  await invoke('save_export_file', {
    path: selectedPath,
    bytes: Array.from(bytes),
  })
  return true
}
