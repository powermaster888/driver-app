import { apiUpload } from './client'

export async function uploadFile(uri: string, type: 'photo' | 'signature') {
  const name = type === 'photo' ? 'pod_photo.jpg' : 'signature.png'
  const mimeType = type === 'photo' ? 'image/jpeg' : 'image/png'
  return apiUpload({ uri, type: mimeType, name }, type)
}
