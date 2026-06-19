import { useEffect, useState } from 'react'

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return mounted
}

export { useWebSocket } from './useWebSocket'
export type * from './useWebSocket'
export { useChat } from './useChat'
