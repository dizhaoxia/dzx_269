import { create } from 'zustand'

interface AppState {
  initialized: boolean
  setInitialized: (value: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  setInitialized: (value) => set({ initialized: value })
}))

export { useAuthStore } from './auth'
export { useChatStore } from './chat'
