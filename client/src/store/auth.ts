import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '../types'
import { SignalCryptoManager } from '../crypto'
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

async function initializeSignalCrypto(): Promise<void> {
  const db = DatabaseManager.getInstance()
  await db.init()

  const crypto = SignalCryptoManager.getInstance()
  await crypto.init()

  const existingKey = await db.loadIdentityKey()
  if (!existingKey) {
    const identityKeyPair = await crypto.generateIdentityKeyPair()
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
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        cryptoInitialized: state.cryptoInitialized
      })
    }
  )
)
