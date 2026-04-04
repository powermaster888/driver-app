import { apiUpload } from './client'

export async function uploadFile(uri: string, type: 'photo' | 'signature') {
  const name = type === 'photo' ? 'pod_photo.jpg' : 'signature.png'
  const mimeType = type === 'photo' ? 'image/jpeg' : 'image/png'
  return apiUpload({ uri, type: mimeType, name }, type)
}

/**
 * Upload multiple photos in parallel with a concurrency limit.
 * Returns upload IDs for successful uploads (skips failures silently —
 * failed uploads will be retried by the sync engine).
 */
export async function uploadPhotoBatch(
  uris: string[],
  concurrency = 3,
): Promise<string[]> {
  const uploadIds: string[] = []
  // Process in chunks of `concurrency`
  for (let i = 0; i < uris.length; i += concurrency) {
    const chunk = uris.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      chunk.map((uri) => uploadFile(uri, 'photo')),
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        uploadIds.push(result.value.upload_id)
      }
    }
  }
  return uploadIds
}
