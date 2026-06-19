export interface KeyPair {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

export interface IdentityKeyPair {
  publicKey: string
  privateKey: string
}

export interface PreKey {
  keyId: number
  publicKey: string
  privateKey: string
}

export interface SignedPreKey {
  keyId: number
  publicKey: string
  privateKey: string
  signature: string
}

export interface KeyBundle {
  identityKey: string
  signedPreKey: {
    keyId: number
    publicKey: string
    signature: string
  }
  oneTimePreKey?: {
    keyId: number
    publicKey: string
  }
}

export interface SignalSession {
  userId: string
  sessionRecord: string
}

export interface InternalSessionState {
  recipientIdentityKey: string
  senderIdentityKey: string
  rootKey: string
  sendingChainKey: string
  receivingChainKey: string
  sendingEphemeralKey?: string
  receivingEphemeralKey?: string
  sendingCounter: number
  receivingCounter: number
}

export interface EncryptedMessage {
  ciphertext: string
  senderIdentityKey: string
  ephemeralKey?: string
  sendingCounter: number
  receivingCounter: number
}
