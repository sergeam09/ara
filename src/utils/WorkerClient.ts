const WORKER_URL = 'https://ara.sergeam09.workers.dev'

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export async function uploadFile(
  path: string,
  base64Content: string,
  description: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<any> {
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        content: base64Content,
        message: `ARA 5.0: upload ${path.split('/').pop()}`
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(error.error || `Error uploading ${description}`)
    }

    return response.json()
  } catch (error) {
    throw new Error(`Failed to upload ${description}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function deleteProject(slug: string): Promise<void> {
  const deleteMarker = btoa(JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() }))
  await uploadFile(`proyectos/${slug}/config.json`, deleteMarker, 'delete marker')
}

export async function getConfig(projectSlug: string): Promise<any> {
  try {
    const response = await fetch(`${WORKER_URL}?config=${projectSlug}`)
    if (response.ok) {
      const data = await response.json()
      if (!data.error) return data
    }
  } catch (e) {
    console.warn('Failed to get config from KV')
  }
  return null
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}
