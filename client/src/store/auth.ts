import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '../types'
import { SignalCryptoManager } from '../crypto'
import type { IdentityKeyPair } from '../crypto'
import { DatabaseManager } from '../db'
import { keyApi } from '../api'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  cryptoInitialized: boolean
  login: (token: string, user: User) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  initializeCrypto: () => Promise<void>
}

async function uploadKeyBundle(
  crypto: SignalCryptoManager,
  identityKeyPair: IdentityKeyPair
): Promise<void> {
  const signedPreKey = await crypto.generateSignedPreKey(identityKeyPair, 1)
  const preKeys = await crypto.generatePreKeys(1, 100)
  await keyApi.uploadKeys({
    identityKey: identityKeyPair.publicKey,
    signedPreKey: {
      keyId: signedPreKey.keyId,
      publicKey: signedPreKey.publicKey,
      signature: signedPreKey.signature
    },
    preKeys: preKeys.map((k) => ({
      keyId: k.keyId,
      publicKey: k.publicKey
    }))
  })
}

async function initializeSignalCrypto(): Promise<void> {
  const db = DatabaseManager.getInstance()
  await db.init()

  const crypto = SignalCryptoManager.getInstance()
  await crypto.init()

  const existingKey = await db.loadIdentityKey()
  if (existingKey) {
    try {
      const result = await keyApi.getPreKeyCount()
      if (result.count > 0) {
        return
      }
    } catch {
      // 如果检查失败，继续尝试上传，确保服务端有密钥
    }
    await uploadKeyBundle(crypto, {
      publicKey: existingKey.publicKey,
      privateKey: existingKey.privateKey
    })
  } else {
    const identityKeyPair = await crypto.generateIdentityKeyPair()
    await uploadKeyBundle(crypto, identityKeyPair)
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      cryptoInitialized: false,
      login: async (token, user) => {
        set({ token, user, isAuthenticated: true })
        await get().initializeCrypto()
      },
      logout: () => set({ token: null, user: null, isAuthenticated: false, cryptoInitialized: false }),
      setUser: (user) => set({ user }),
      initializeCrypto: async () => {
        if (get().cryptoInitialized) return
        try {
          await initializeSignalCrypto()
          set({ cryptoInitialized: true })
        } catch (e) {
          console.error('Failed to initialize crypto:', e)
          throw e
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
