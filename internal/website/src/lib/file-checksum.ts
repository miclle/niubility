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

  // crypto.subtle is unavailable in insecure contexts (non-HTTPS).
  // Fall back to a simple hash when it is missing, ensuring the result is exactly 64 hex chars.
  if (!crypto.subtle) {
    // Use the first 32 bytes of the file data, then hash with a simple algorithm
    // to produce a consistent 64-character hex string
    const data = final.slice(0, 32)
    const hash = simpleHash(data)
    return hash
  }

  const hash = await crypto.subtle.digest('SHA-256', final)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
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
