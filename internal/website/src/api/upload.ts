import client from './client'

// PresignResponse represents the presigned URL response from the backend.
export interface PresignResponse {
  presigned_url: string
  file_url: string
}

// getPresignedURL requests a presigned S3 PUT URL from the backend.
export function getPresignedURL(filename: string, contentType: string, category: string) {
  return client.post<PresignResponse>('/upload/presign', { filename, content_type: contentType, category })
}

// uploadFile handles the complete upload flow: get presigned URL, PUT to S3, return file URL.
export async function uploadFile(
  file: File,
  category: 'covers' | 'videos' | 'images',
  onProgress?: (percent: number) => void,
): Promise<string> {
  const res = await getPresignedURL(file.name, file.type, category)
  const { presigned_url, file_url } = res.data

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presigned_url)
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

  return file_url
}
