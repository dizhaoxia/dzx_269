export function uint8ArrayToBase64(buf: Uint8Array): string {
  let binary = ''
  const len = buf.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buf[i])
  }
  return btoa(binary)
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function generateRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return array
}

export async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  return await crypto.subtle.digest('SHA-256', data as BufferSource)
}

export async function hkdf(
  salt: Uint8Array,
  inputKeyMaterial: Uint8Array,
  info: Uint8Array,
  outputLength: number
): Promise<Uint8Array> {
  const saltKey = salt.length > 0 ? salt : new Uint8Array(32)
  const prkKey = await crypto.subtle.importKey(
    'raw',
    saltKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, inputKeyMaterial as BufferSource))

  const okmKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  let t = new Uint8Array(0)
  const okm = new Uint8Array(outputLength)
  let okmOffset = 0
  let counter = 1

  while (okmOffset < outputLength) {
    const input = new Uint8Array(t.length + info.length + 1)
    input.set(t, 0)
    input.set(info, t.length)
    input[t.length + info.length] = counter

    t = new Uint8Array(await crypto.subtle.sign('HMAC', okmKey, input as BufferSource))
    const remaining = outputLength - okmOffset
    const toCopy = Math.min(t.length, remaining)
    okm.set(t.subarray(0, toCopy), okmOffset)
    okmOffset += toCopy
    counter++
  }

  return okm
}

export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

export function uint8ArrayToString(buf: Uint8Array): string {
  return new TextDecoder().decode(buf)
}
