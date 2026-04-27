// CHUNK_SIZE is the number of bytes to read from each end of the file.
const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB

// computeFileChecksum calculates a partial SHA-256 fingerprint for a file.
// It reads the first 2MB + last 2MB + file size to produce a fast, reliable hash.
// For files smaller than 4MB the entire content is hashed.
// Returns a hex-encoded string (64 characters for SHA-256).
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

  // Use crypto.subtle if available (HTTPS or localhost)
  // Fall back to a simple hash that includes more data for uniqueness
  if (crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', final)
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback: hash the entire data (not just first 32 bytes) for better uniqueness
  return simpleHash(final)
}

// simpleHash produces a 64-character hex hash from a byte array using a simple algorithm.
// This is used as a fallback when crypto.subtle is unavailable (non-HTTPS contexts).
function simpleHash(data: Uint8Array): string {
  let hash = 0n
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31n + BigInt(data[i])) % (2n ** 256n)
  }
  return hash.toString(16).padStart(64, '0')
}
