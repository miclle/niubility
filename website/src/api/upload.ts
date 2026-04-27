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

function supportsImageStyle(url: string): boolean {
  const [base] = url.split('#', 1)
  const [pathname] = base.split('?', 1)
  const normalized = pathname.toLowerCase()
  return !(normalized.endsWith('.svg') || normalized.endsWith('.svgz'))
}

function stripNamedStyleSuffix(pathname: string): string {
  return pathname.replace(/(\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|png|svg|svgz|tif|tiff|webp))-[^/?#]+$/i, '$1')
}

function stripRawStyleQuery(queryString: string): string {
  const normalized = queryString.trim()
  if (!normalized) return ''

  if (!normalized.includes('=')) {
    return ''
  }

  const params = new URLSearchParams(normalized)
  params.delete('style')

  for (const key of Array.from(params.keys())) {
    if (/^(imageView2|imageMogr2|watermark|format|thumb|crop|gravity)$/i.test(key)) {
      params.delete(key)
    }
  }

  return params.toString()
}

// stripImageStyle removes the style query parameter while preserving other query items.
export function stripImageStyle(url: string): string {
  if (!url) return ''

  const [base, hash = ''] = url.split('#', 2)
  const [pathname, queryString = ''] = base.split('?', 2)
  const cleanPathname = stripNamedStyleSuffix(pathname)
  const query = stripRawStyleQuery(queryString)
  return `${cleanPathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}

// appendImageStyle appends a normalized style parameter to a URL.
export function appendImageStyle(url: string, styleFragment?: string): string {
  if (!url) return ''
  url = stripImageStyle(url)
  const normalized = styleFragment?.trim().replace(/^[?&]+/, '') || ''
  if (!normalized) return url
  if (!supportsImageStyle(url)) return url

  const [base, hash = ''] = url.split('#', 2)
  const [pathname, queryString = ''] = base.split('?', 2)
  const params = new URLSearchParams(queryString)
  params.set('style', normalized)
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}

// fileURL constructs the access URL for an attachment S3 object key.
export function fileURL(key: string, styleFragment?: string): string {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return appendImageStyle(key, styleFragment)
  return appendImageStyle('/attachments/' + key, styleFragment)
}

// fileDownloadURL constructs a same-origin download URL for an attachment.
export function fileDownloadURL(key: string, filename?: string): string {
  if (!key) return ''
  const normalizedName = filename?.trim() || ''
  const params = new URLSearchParams()
  if (normalizedName) {
    params.set('download', normalizedName)
  } else {
    params.set('download', '1')
  }

  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) {
    return `${key}${key.includes('?') ? '&' : '?'}${params.toString()}`
  }
  return `/attachments/${key}?${params.toString()}`
}

// avatarURL constructs the access URL for an avatar S3 object key.
export function avatarURL(key: string, styleFragment?: string): string {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return appendImageStyle(key, styleFragment)
  return appendImageStyle('/avatars/' + key, styleFragment)
}

// siteResourceURL constructs the access URL for a site resource S3 object key.
export function siteResourceURL(key: string, styleFragment?: string): string {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return appendImageStyle(key, styleFragment)
  return appendImageStyle('/site-resources/' + key, styleFragment)
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
