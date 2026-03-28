import client from './client'

// PresignResponse represents the presigned URL response from the backend.
export interface PresignResponse {
  presigned_url: string
  key: string
}

// getPresignedURL requests a presigned S3 PUT URL from the backend.
export function getPresignedURL(filename: string, contentType: string) {
  return client.post<PresignResponse>('/upload/presign', { filename, content_type: contentType })
}

// getProfilePresignedURL requests a presigned S3 PUT URL for avatar upload (authenticated users).
export function getProfilePresignedURL(filename: string, contentType: string) {
  return client.post<PresignResponse>('/profile/upload', { filename, content_type: contentType })
}

// getSiteResourcePresignedURL requests a presigned S3 PUT URL for site resources (logo, favicon).
// Requires admin role.
export function getSiteResourcePresignedURL(filename: string, contentType: string) {
  return client.post<PresignResponse>('/admin/upload/site-resource', { filename, content_type: contentType })
}

// fileURL constructs the access URL for an attachment S3 object key.
export function fileURL(key: string): string {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return key
  return '/attachments/' + key
}

// avatarURL constructs the access URL for an avatar S3 object key.
export function avatarURL(key: string): string {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return key
  return '/avatars/' + key
}

// siteResourceURL constructs the access URL for a site resource S3 object key.
export function siteResourceURL(key: string): string {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return key
  return '/site-resources/' + key
}

// uploadFile handles the complete upload flow: get presigned URL, PUT to S3, return S3 object key.
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const res = await getPresignedURL(file.name, file.type)
  const { presigned_url, key } = res.data

  await putToS3(presigned_url, file, onProgress)
  return key
}

// uploadAvatar handles avatar upload via the profile upload endpoint.
export async function uploadAvatar(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const res = await getProfilePresignedURL(file.name, file.type)
  const { presigned_url, key } = res.data

  await putToS3(presigned_url, file, onProgress)
  return key
}

// uploadSiteResource handles the complete upload flow for site resources (logo, favicon).
// Requires admin role.
export async function uploadSiteResource(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const res = await getSiteResourcePresignedURL(file.name, file.type)
  const { presigned_url, key } = res.data

  await putToS3(presigned_url, file, onProgress)
  return key
}

// putToS3 uploads a file directly to S3 using a presigned PUT URL.
function putToS3(presignedURL: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presignedURL)
    xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Upload network error'))
    xhr.send(file)
  })
}
