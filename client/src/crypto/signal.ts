import {
  IdentityKeyPair,
  PreKey,
  SignedPreKey,
  KeyBundle,
  InternalSessionState,
  EncryptedMessage,
} from './types'
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  generateRandomBytes,
  hkdf,
  stringToUint8Array,
  uint8ArrayToString,
} from './utils'
import { DatabaseManager } from '../db/database'

const EC_PARAMS = { name: 'ECDH', namedCurve: 'P-256' }
const AES_PARAMS = { name: 'AES-GCM', length: 256 }
const HKDF_INFO = stringToUint8Array('dzx_signal_ratchet_v1')
const HKDF_SALT = stringToUint8Array('dzx_signal_salt_v1')

export class SignalCryptoManager {
  private static instance: SignalCryptoManager
  private db: DatabaseManager
  private identityKeyPair: IdentityKeyPair | null = null
  private initialized = false

  public static getInstance(): SignalCryptoManager {
    if (!SignalCryptoManager.instance) {
      SignalCryptoManager.instance = new SignalCryptoManager()
    }
    return SignalCryptoManager.instance
  }

  private constructor() {
    this.db = DatabaseManager.getInstance()
  }

  public async init(): Promise<void> {
    if (this.initialized) return

    const storedKey = await this.db.loadIdentityKey()
    if (storedKey) {
      this.identityKeyPair = {
        publicKey: storedKey.publicKey,
        privateKey: storedKey.privateKey,
      }
    }
    this.initialized = true
  }

  public async getIdentityKeyPair(): Promise<IdentityKeyPair> {
    if (!this.identityKeyPair) {
      this.identityKeyPair = await this.generateIdentityKeyPair()
    }
    return this.identityKeyPair
  }

  public async generateIdentityKeyPair(): Promise<IdentityKeyPair> {
    const keyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits'])
    const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

    const identityKeyPair: IdentityKeyPair = {
      publicKey: uint8ArrayToBase64(new Uint8Array(publicKey)),
      privateKey: uint8ArrayToBase64(new Uint8Array(privateKey)),
    }

    await this.db.saveIdentityKey(identityKeyPair)
    this.identityKeyPair = identityKeyPair
    return identityKeyPair
  }

  private async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const rawKey = base64ToUint8Array(base64Key)
    return await crypto.subtle.importKey('raw', rawKey as BufferSource, EC_PARAMS, false, ['deriveKey', 'deriveBits'])
  }

  private async importPrivateKey(base64Key: string): Promise<CryptoKey> {
    const pkcs8Key = base64ToUint8Array(base64Key)
    return await crypto.subtle.importKey('pkcs8', pkcs8Key as BufferSource, EC_PARAMS, true, ['deriveKey', 'deriveBits'])
  }

  private async exportPublicKey(key: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', key)
    return uint8ArrayToBase64(new Uint8Array(raw))
  }

  public async generatePreKeys(startId: number, count: number): Promise<PreKey[]> {
    const preKeys: PreKey[] = []

    for (let i = 0; i < count; i++) {
      const keyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits'])
      const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
      const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

      preKeys.push({
        keyId: startId + i,
        publicKey: uint8ArrayToBase64(new Uint8Array(publicKey)),
        privateKey: uint8ArrayToBase64(new Uint8Array(privateKey)),
      })
    }

    await this.db.savePreKeys(
      preKeys.map((k) => ({
        ...k,
        isUsed: 0,
      }))
    )

    return preKeys
  }

  public async generateSignedPreKey(identityKeyPair: IdentityKeyPair, keyId: number): Promise<SignedPreKey> {
    const keyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits'])
    const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

    const publicKeyStr = uint8ArrayToBase64(new Uint8Array(publicKey))
    const privateKeyStr = uint8ArrayToBase64(new Uint8Array(privateKey))

    const signingKey = await crypto.subtle.importKey(
      'pkcs8',
      base64ToUint8Array(identityKeyPair.privateKey) as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    )
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      base64ToUint8Array(publicKeyStr) as BufferSource
    )

    const signedPreKey: SignedPreKey = {
      keyId,
      publicKey: publicKeyStr,
      privateKey: privateKeyStr,
      signature: uint8ArrayToBase64(new Uint8Array(signature)),
    }

    await this.db.saveSignedPreKey(signedPreKey)
    return signedPreKey
  }

  private async deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> {
    const derivedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
    return new Uint8Array(derivedBits)
  }

  private async deriveRootAndChainKeys(
    rootKey: Uint8Array,
    sharedSecret: Uint8Array
  ): Promise<{ newRootKey: Uint8Array; chainKey: Uint8Array }> {
    const combined = new Uint8Array(rootKey.length + sharedSecret.length)
    combined.set(rootKey, 0)
    combined.set(sharedSecret, rootKey.length)

    const derived = await hkdf(HKDF_SALT, combined, HKDF_INFO, 64)
    return {
      newRootKey: derived.subarray(0, 32),
      chainKey: derived.subarray(32, 64),
    }
  }

  private async deriveMessageKey(chainKey: Uint8Array, counter: number): Promise<Uint8Array> {
    const counterBytes = new Uint8Array(4)
    new DataView(counterBytes.buffer).setUint32(0, counter, false)

    const combined = new Uint8Array(chainKey.length + counterBytes.length)
    combined.set(chainKey, 0)
    combined.set(counterBytes, chainKey.length)

    const derived = await hkdf(HKDF_SALT, combined, stringToUint8Array('dzx_msg_key'), 48)
    return derived
  }

  private async aesEncrypt(key: Uint8Array, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    const iv = generateRandomBytes(12)
    const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, AES_PARAMS, false, ['encrypt'])
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      cryptoKey,
      stringToUint8Array(plaintext) as BufferSource
    )
    return {
      ciphertext: uint8ArrayToBase64(new Uint8Array(encrypted)),
      iv: uint8ArrayToBase64(iv),
    }
  }

  private async aesDecrypt(key: Uint8Array, ciphertextB64: string, ivB64: string): Promise<string> {
    const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, AES_PARAMS, false, ['decrypt'])
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToUint8Array(ivB64) as BufferSource },
      cryptoKey,
      base64ToUint8Array(ciphertextB64) as BufferSource
    )
    return uint8ArrayToString(new Uint8Array(decrypted))
  }

  public async processPreKeyBundle(bundle: KeyBundle, recipientId: string): Promise<void> {
    const identityKeyPair = await this.getIdentityKeyPair()
    const ourIdentityPrivateKey = await this.importPrivateKey(identityKeyPair.privateKey)
    const theirIdentityPublicKey = await this.importPublicKey(bundle.identityKey)
    const theirSignedPreKey = await this.importPublicKey(bundle.signedPreKey.publicKey)

    const ephemeralKeyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits'])
    const ephemeralPublicKey = await this.exportPublicKey(ephemeralKeyPair.publicKey)

    const sharedSecret1 = await this.deriveSharedSecret(ourIdentityPrivateKey, theirSignedPreKey)
    const sharedSecret2 = await this.deriveSharedSecret(ephemeralKeyPair.privateKey, theirIdentityPublicKey)
    const sharedSecret3 = await this.deriveSharedSecret(ephemeralKeyPair.privateKey, theirSignedPreKey)

    let combinedSecret = new Uint8Array([...sharedSecret1, ...sharedSecret2, ...sharedSecret3])

    if (bundle.oneTimePreKey) {
      const theirOneTimePreKey = await this.importPublicKey(bundle.oneTimePreKey.publicKey)
      const sharedSecret4 = await this.deriveSharedSecret(ephemeralKeyPair.privateKey, theirOneTimePreKey)
      combinedSecret = new Uint8Array([...combinedSecret, ...sharedSecret4])
    }

    const initialRootKey = await hkdf(HKDF_SALT, combinedSecret, stringToUint8Array('dzx_initial_root'), 32)
    const derived = await this.deriveRootAndChainKeys(initialRootKey, new Uint8Array(32))

    const sessionState: InternalSessionState = {
      recipientIdentityKey: bundle.identityKey,
      senderIdentityKey: identityKeyPair.publicKey,
      rootKey: uint8ArrayToBase64(derived.newRootKey),
      sendingChainKey: uint8ArrayToBase64(derived.chainKey),
      receivingChainKey: uint8ArrayToBase64(derived.chainKey),
      sendingEphemeralKey: ephemeralPublicKey,
      sendingCounter: 0,
      receivingCounter: 0,
    }

    await this.saveSession(recipientId, sessionState)
  }

  public async encrypt(recipientId: string, plaintext: string): Promise<string> {
    const session = await this.loadSession(recipientId)
    if (!session) {
      throw new Error(`No session found for recipient: ${recipientId}`)
    }

    const chainKey = base64ToUint8Array(session.sendingChainKey)
    const messageKey = await this.deriveMessageKey(chainKey, session.sendingCounter)

    const aesKey = messageKey.subarray(0, 32)
    const { ciphertext, iv } = await this.aesEncrypt(aesKey, plaintext)

    const ephemeralKeyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits'])
    const newEphemeralPublicKey = await this.exportPublicKey(ephemeralKeyPair.publicKey)
    const theirIdentityPublicKey = await this.importPublicKey(session.recipientIdentityKey)
    const sharedSecret = await this.deriveSharedSecret(ephemeralKeyPair.privateKey, theirIdentityPublicKey)

    const currentRootKey = base64ToUint8Array(session.rootKey)
    const { newRootKey, chainKey: newChainKey } = await this.deriveRootAndChainKeys(currentRootKey, sharedSecret)

    session.rootKey = uint8ArrayToBase64(newRootKey)
    session.sendingChainKey = uint8ArrayToBase64(newChainKey)
    session.sendingEphemeralKey = newEphemeralPublicKey
    session.sendingCounter++

    await this.saveSession(recipientId, session)

    const encryptedMessage: EncryptedMessage = {
      ciphertext: ciphertext + ':' + iv,
      senderIdentityKey: session.senderIdentityKey,
      ephemeralKey: newEphemeralPublicKey,
      sendingCounter: session.sendingCounter - 1,
      receivingCounter: session.receivingCounter,
    }

    return uint8ArrayToBase64(stringToUint8Array(JSON.stringify(encryptedMessage)))
  }

  public async decrypt(senderId: string, ciphertextB64: string): Promise<string> {
    const session = await this.loadSession(senderId)
    if (!session) {
      throw new Error(`No session found for sender: ${senderId}`)
    }

    const encryptedMessage: EncryptedMessage = JSON.parse(
      uint8ArrayToString(base64ToUint8Array(ciphertextB64))
    )

    const [ciphertext, iv] = encryptedMessage.ciphertext.split(':')

    const chainKey = base64ToUint8Array(session.receivingChainKey)
    const messageKey = await this.deriveMessageKey(chainKey, encryptedMessage.sendingCounter)

    const aesKey = messageKey.subarray(0, 32)
    const plaintext = await this.aesDecrypt(aesKey, ciphertext, iv)

    if (encryptedMessage.ephemeralKey && encryptedMessage.ephemeralKey !== session.receivingEphemeralKey) {
      const theirEphemeralPublicKey = await this.importPublicKey(encryptedMessage.ephemeralKey)
      const ourIdentityPrivateKey = await this.importPrivateKey(
        (await this.getIdentityKeyPair()).privateKey
      )
      const sharedSecret = await this.deriveSharedSecret(ourIdentityPrivateKey, theirEphemeralPublicKey)

      const currentRootKey = base64ToUint8Array(session.rootKey)
      const { newRootKey, chainKey: newChainKey } = await this.deriveRootAndChainKeys(currentRootKey, sharedSecret)

      session.rootKey = uint8ArrayToBase64(newRootKey)
      session.receivingChainKey = uint8ArrayToBase64(newChainKey)
      session.receivingEphemeralKey = encryptedMessage.ephemeralKey
      session.receivingCounter = encryptedMessage.sendingCounter + 1
    } else {
      session.receivingCounter = Math.max(session.receivingCounter, encryptedMessage.sendingCounter + 1)
    }

    await this.saveSession(senderId, session)
    return plaintext
  }

  public async saveSession(userId: string, session: InternalSessionState): Promise<void> {
    const sessionRecord = JSON.stringify(session)
    await this.db.saveSignalSession(userId, sessionRecord)
  }

  public async loadSession(userId: string): Promise<InternalSessionState | null> {
    const sessionRecord = await this.db.loadSignalSession(userId)
    if (!sessionRecord) return null
    return JSON.parse(sessionRecord) as InternalSessionState
  }

  public async clearSession(userId: string): Promise<void> {
    await this.db.clearSignalSession(userId)
  }

  public async buildKeyBundle(): Promise<KeyBundle> {
    const identityKeyPair = await this.getIdentityKeyPair()
    const signedPreKey = await this.db.loadLatestSignedPreKey()

    if (!signedPreKey) {
      throw new Error('No signed pre-key available')
    }

    const unusedPreKeys = await this.db.loadUnusedPreKeys()
    let oneTimePreKey: { keyId: number; publicKey: string } | undefined

    if (unusedPreKeys.length > 0) {
      const preKey = unusedPreKeys[0]
      oneTimePreKey = {
        keyId: preKey.keyId,
        publicKey: preKey.publicKey,
      }
      await this.db.markPreKeyUsed(preKey.keyId)
    }

    return {
      identityKey: identityKeyPair.publicKey,
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
      },
      oneTimePreKey,
    }
  }
}

export default SignalCryptoManager
