import { useEffect, useRef, useState, useCallback } from 'react'

export type WSMessageType =
  | 'SEND_MESSAGE'
  | 'MESSAGE_RECEIPT'
  | 'TYPING'
  | 'RECEIVE_MESSAGE'
  | 'MESSAGE_DELIVERED'
  | 'MESSAGE_READ'
  | 'PING'
  | 'PONG'

export interface WSSendMessage {
  type: 'SEND_MESSAGE'
  data: {
    conversationId: string
    receiverId: string
    ciphertext: string
    messageType: string
  }
}

export interface WSMessageReceipt {
  type: 'MESSAGE_RECEIPT'
  data: {
    messageId: string
    status: 'sent' | 'delivered' | 'read' | 'failed'
  }
}

export interface WSTyping {
  type: 'TYPING'
  data: {
    conversationId: string
    userId?: string
    isTyping: boolean
  }
}

export interface WSReceiveMessage {
  type: 'RECEIVE_MESSAGE'
  data: {
    id: string
    conversationId: string
    senderId: string
    ciphertext: string
    messageType: string
    timestamp: number
  }
}

export interface WSMessageDelivered {
  type: 'MESSAGE_DELIVERED'
  data: {
    messageId: string
  }
}

export interface WSMessageRead {
  type: 'MESSAGE_READ'
  data: {
    messageId: string
  }
}

export interface WSPing {
  type: 'PING'
  data?: never
}

export interface WSPong {
  type: 'PONG'
  data?: never
}

export type WSMessage =
  | WSSendMessage
  | WSMessageReceipt
  | WSTyping
  | WSReceiveMessage
  | WSMessageDelivered
  | WSMessageRead
  | WSPing
  | WSPong

const HEARTBEAT_INTERVAL = 30000
const MAX_RECONNECT_DELAY = 30000
const BASE_RECONNECT_DELAY = 1000

interface UseWebSocketReturn {
  send: (message: WSMessage) => void
  isConnected: boolean
  lastError: Error | null
  onMessage: (handler: (message: WSMessage) => void) => () => void
}

export function useWebSocket(token: string | null): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastError, setLastError] = useState<Error | null>(null)
  const messageHandlersRef = useRef<Set<(message: WSMessage) => void>>(new Set())
  const messageQueueRef = useRef<WSMessage[]>([])
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const heartbeatIntervalRef = useRef<number | null>(null)
  const shouldReconnectRef = useRef(true)

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current !== null) {
      window.clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback(() => {
    clearHeartbeat()
    heartbeatIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }))
      }
    }, HEARTBEAT_INTERVAL)
  }, [clearHeartbeat])

  const flushQueue = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && messageQueueRef.current.length > 0) {
      const queue = [...messageQueueRef.current]
      messageQueueRef.current = []
      queue.forEach((msg) => {
        wsRef.current?.send(JSON.stringify(msg))
      })
    }
  }, [])

  const connect = useCallback(() => {
    if (!token) return

    const baseUrl = import.meta.env.VITE_WS_BASE_URL || window.location.origin.replace(/^http/, 'ws')
    const url = `${baseUrl}/ws?token=${encodeURIComponent(token)}`

    try {
      wsRef.current = new WebSocket(url)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        setLastError(null)
        reconnectAttemptRef.current = 0
        startHeartbeat()
        flushQueue()
      }

      wsRef.current.onclose = () => {
        setIsConnected(false)
        clearHeartbeat()

        if (shouldReconnectRef.current) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY
          )
          reconnectAttemptRef.current += 1

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect()
          }, delay)
        }
      }

      wsRef.current.onerror = () => {
        setLastError(new Error('WebSocket connection error'))
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          messageHandlersRef.current.forEach((handler) => handler(message))
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }
    } catch (e) {
      setLastError(e as Error)
    }
  }, [token, startHeartbeat, clearHeartbeat, flushQueue])

  const send = useCallback(
    (message: WSMessage) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message))
      } else {
        messageQueueRef.current.push(message)
      }
    },
    []
  )

  const onMessage = useCallback((handler: (message: WSMessage) => void) => {
    messageHandlersRef.current.add(handler)
    return () => {
      messageHandlersRef.current.delete(handler)
    }
  }, [])

  useEffect(() => {
    if (token) {
      shouldReconnectRef.current = true
      connect()
    }

    return () => {
      shouldReconnectRef.current = false
      clearHeartbeat()
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      messageHandlersRef.current.clear()
      messageQueueRef.current = []
      setIsConnected(false)
    }
  }, [token, connect, clearHeartbeat])

  return { send, isConnected, lastError, onMessage }
}
