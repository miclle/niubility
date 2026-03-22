// CHUNK_SIZE is the number of bytes to read from each end of the file.
const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB

// computeFileChecksum calculates a partial SHA-256 fingerprint for a file.
// It reads the first 2MB + last 2MB + file size to produce a fast, reliable hash.
// For files smaller than 4MB the entire content is hashed.
export async function computeFileChecksum(file: File): Promise<string> {
  const size = file.size

  let buffer: ArrayBuffer
  if (size <= CHUNK_SIZE * 2) {
    // Small file — read entire content
    buffer = await file.arrayBuffer()
  } else {
    // Large file — read first 2MB + last 2MB
    const head = await file.slice(0, CHUNK_SIZE).arrayBuffer()
    const tail = await file.slice(size - CHUNK_SIZE).arrayBuffer()
    const combined = new Uint8Array(CHUNK_SIZE * 2)
    combined.set(new Uint8Array(head), 0)
    combined.set(new Uint8Array(tail), CHUNK_SIZE)
    buffer = combined.buffer
  }

  // Append file size as 8 bytes (BigUint64)
  const sizeBytes = new ArrayBuffer(8)
  new DataView(sizeBytes).setBigUint64(0, BigInt(size))
  const final = new Uint8Array(buffer.byteLength + 8)
  final.set(new Uint8Array(buffer), 0)
  final.set(new Uint8Array(sizeBytes), buffer.byteLength)

  // crypto.subtle is unavailable in insecure contexts (non-HTTPS).
  // Fall back to a simple size-based fingerprint when it is missing.
  if (!crypto.subtle) {
    const fallback = Array.from(final.slice(0, 32)).map((b) => b.toString(16).padStart(2, '0')).join('')
    return fallback + size.toString(16).padStart(16, '0')
  }

  const hash = await crypto.subtle.digest('SHA-256', final)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
