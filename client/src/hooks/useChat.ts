import { useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAuthStore, useChatStore } from '../store'
import { useWebSocket } from './useWebSocket'
import { DatabaseManager } from '../db'
import type { Message, Conversation } from '../db/schema'
import { SignalCryptoManager } from '../crypto'
import type { KeyBundle as CryptoKeyBundle } from '../crypto'
import { keyApi, userApi } from '../api'
import type { User, KeyBundle as ApiKeyBundle } from '../types'
import type { WSMessage, WSReceiveMessage, WSMessageDelivered, WSMessageRead, WSTyping, WSMessageReceipt } from './useWebSocket'

interface UseChatReturn {
  sendMessage: (conversationId: string, receiverId: string, plaintext: string, messageType?: string) => Promise<void>
  sendTyping: (conversationId: string, isTyping: boolean) => void
  createConversation: (otherUserId: string) => Promise<Conversation>
  loadConversationMessages: (conversationId: string) => Promise<void>
  markAsRead: (conversationId: string) => void
  isConnected: boolean
}

function convertApiKeyBundleToCrypto(apiBundle: ApiKeyBundle): CryptoKeyBundle {
  return {
    identityKey: apiBundle.identityKey,
    signedPreKey: {
      keyId: apiBundle.signedPreKey.id,
      publicKey: apiBundle.signedPreKey.publicKey,
      signature: apiBundle.signedPreKey.signature
    },
    oneTimePreKey: apiBundle.oneTimePreKey
      ? {
          keyId: apiBundle.oneTimePreKey.id,
          publicKey: apiBundle.oneTimePreKey.publicKey
        }
      : undefined
  }
}

function generateConversationId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort()
  return `conv_${sorted[0]}_${sorted[1]}`
}

export function useChat(): UseChatReturn {
  const token = useAuthStore((s) => s.token)
  const currentUser = useAuthStore((s) => s.user)
  const cryptoInitialized = useAuthStore((s) => s.cryptoInitialized)
  const initializeCrypto = useAuthStore((s) => s.initializeCrypto)

  const { send: sendWS, isConnected, onMessage } = useWebSocket(token)

  const {
    conversations,
    messages,
    activeConversationId,
    addOrUpdateConversation,
    addMessage,
    updateMessageStatus,
    setMessages,
    setTyping,
    incrementUnread,
    clearUnread
  } = useChatStore()

  const dbRef = useRef<DatabaseManager | null>(null)
  const cryptoRef = useRef<SignalCryptoManager | null>(null)
  const initializedRef = useRef(false)

  const ensureInitialized = useCallback(async (): Promise<void> => {
    if (!dbRef.current) {
      dbRef.current = DatabaseManager.getInstance()
    }
    await dbRef.current.init()
    if (!cryptoRef.current) {
      cryptoRef.current = SignalCryptoManager.getInstance()
    }
    await cryptoRef.current.init()
    if (!cryptoInitialized) {
      await initializeCrypto()
    }
  }, [cryptoInitialized, initializeCrypto])

  const loadLocalConversations = useCallback(async (): Promise<void> => {
    if (!dbRef.current) return
    const convs = await dbRef.current.getConversations()
    convs.forEach((conv) => {
      addOrUpdateConversation(conv)
    })
  }, [addOrUpdateConversation])

  const handleReceiveMessage = useCallback(
    async (wsMsg: WSReceiveMessage) => {
      if (!dbRef.current || !cryptoRef.current || !currentUser) return

      const { id, conversationId, senderId, ciphertext, messageType, timestamp } = wsMsg.data

      let plaintext: string | undefined
      try {
        plaintext = await cryptoRef.current.decrypt(senderId, ciphertext)
      } catch (e) {
        console.error('Failed to decrypt message:', e)
      }

      const message: Message = {
        id,
        conversationId,
        senderId,
        recipientId: currentUser.id,
        ciphertext,
        plaintext,
        messageType,
        timestamp,
        deliveryStatus: 'delivered',
        isOutgoing: 0
      }

      await dbRef.current.saveMessage(message)
      addMessage(conversationId, message)

      let conv: Conversation | undefined = conversations.get(conversationId)
      if (!conv) {
        try {
          const otherUser = await userApi.getById(senderId)
          conv = {
            id: conversationId,
            type: 'direct',
            name: otherUser.nickname || otherUser.phone,
            avatar: otherUser.avatar ?? undefined,
            lastMessage: plaintext,
            lastMessageTime: timestamp,
            unreadCount: 0,
            createdAt: Date.now()
          }
        } catch {
          conv = {
            id: conversationId,
            type: 'direct',
            name: senderId,
            lastMessage: plaintext,
            lastMessageTime: timestamp,
            unreadCount: 0,
            createdAt: Date.now()
          }
        }
      } else {
        conv = {
          ...conv,
          lastMessage: plaintext,
          lastMessageTime: timestamp
        }
      }

      if (activeConversationId !== conversationId) {
        incrementUnread(conversationId)
      }

      await dbRef.current.saveConversation(conv)
      addOrUpdateConversation(conv)

      sendWS({
        type: 'MESSAGE_DELIVERED',
        data: { messageId: id }
      })
    },
    [currentUser, conversations, activeConversationId, addMessage, addOrUpdateConversation, incrementUnread, sendWS]
  )

  const handleMessageDelivered = useCallback(
    async (wsMsg: WSMessageDelivered) => {
      if (!dbRef.current) return
      const { messageId } = wsMsg.data
      updateMessageStatus(messageId, 'delivered')
      await dbRef.current.updateDeliveryStatus(messageId, 'delivered')
    },
    [updateMessageStatus]
  )

  const handleMessageRead = useCallback(
    async (wsMsg: WSMessageRead) => {
      if (!dbRef.current) return
      const { messageId } = wsMsg.data
      updateMessageStatus(messageId, 'read')
      await dbRef.current.updateDeliveryStatus(messageId, 'read')
    },
    [updateMessageStatus]
  )

  const handleTyping = useCallback(
    (wsMsg: WSTyping) => {
      const { conversationId, userId, isTyping } = wsMsg.data
      if (!currentUser || !userId) return
      if (userId === currentUser.id) return
      setTyping(conversationId, userId, isTyping)
    },
    [currentUser, setTyping]
  )

  const handleMessageReceipt = useCallback(
    async (wsMsg: WSMessageReceipt) => {
      if (!dbRef.current) return
      const { messageId, status } = wsMsg.data
      const mappedStatus = status === 'sent' ? 'sent' : status
      updateMessageStatus(messageId, mappedStatus)
      await dbRef.current.updateDeliveryStatus(messageId, mappedStatus)
    },
    [updateMessageStatus]
  )

  useEffect(() => {
    if (!token || !currentUser) return

    const cleanup = onMessage((msg: WSMessage) => {
      switch (msg.type) {
        case 'RECEIVE_MESSAGE':
          void handleReceiveMessage(msg)
          break
        case 'MESSAGE_DELIVERED':
          void handleMessageDelivered(msg)
          break
        case 'MESSAGE_READ':
          void handleMessageRead(msg)
          break
        case 'TYPING':
          handleTyping(msg)
          break
        case 'MESSAGE_RECEIPT':
          void handleMessageReceipt(msg)
          break
      }
    })

    return cleanup
  }, [token, currentUser, onMessage, handleReceiveMessage, handleMessageDelivered, handleMessageRead, handleTyping, handleMessageReceipt])

  useEffect(() => {
    if (!token || initializedRef.current) return

    let cancelled = false

    void (async () => {
      try {
        await ensureInitialized()
        if (cancelled) return
        await loadLocalConversations()
        initializedRef.current = true
      } catch (e) {
        console.error('Failed to initialize chat:', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, ensureInitialized, loadLocalConversations])

  const sendMessage = useCallback(
    async (conversationId: string, receiverId: string, plaintext: string, messageType: string = 'text'): Promise<void> => {
      if (!currentUser || !cryptoRef.current) {
        await ensureInitialized()
        if (!currentUser || !cryptoRef.current) {
          throw new Error('Chat not initialized')
        }
      }

      let ciphertext: string
      try {
        ciphertext = await cryptoRef.current.encrypt(receiverId, plaintext)
      } catch (e) {
        console.error('Failed to encrypt message:', e)
        throw e
      }

      const messageId = uuidv4()
      const timestamp = Date.now()

      const message: Message = {
        id: messageId,
        conversationId,
        senderId: currentUser.id,
        recipientId: receiverId,
        ciphertext,
        plaintext,
        messageType,
        timestamp,
        deliveryStatus: 'sending',
        isOutgoing: 1
      }

      if (dbRef.current) {
        await dbRef.current.saveMessage(message)
      }
      addMessage(conversationId, message)

      let conv: Conversation | undefined = conversations.get(conversationId)
      if (!conv) {
        try {
          const otherUser = await userApi.getById(receiverId)
          conv = {
            id: conversationId,
            type: 'direct',
            name: otherUser.nickname || otherUser.phone,
            avatar: otherUser.avatar ?? undefined,
            lastMessage: plaintext,
            lastMessageTime: timestamp,
            unreadCount: 0,
            createdAt: Date.now()
          }
        } catch {
          conv = {
            id: conversationId,
            type: 'direct',
            name: receiverId,
            lastMessage: plaintext,
            lastMessageTime: timestamp,
            unreadCount: 0,
            createdAt: Date.now()
          }
        }
      } else {
        conv = {
          ...conv,
          lastMessage: plaintext,
          lastMessageTime: timestamp
        }
      }
      if (dbRef.current) {
        await dbRef.current.saveConversation(conv)
      }
      addOrUpdateConversation(conv)

      sendWS({
        type: 'SEND_MESSAGE',
        data: {
          conversationId,
          receiverId,
          ciphertext,
          messageType
        }
      })
    },
    [currentUser, conversations, addMessage, addOrUpdateConversation, ensureInitialized, sendWS]
  )

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean): void => {
      sendWS({
        type: 'TYPING',
        data: { conversationId, isTyping }
      })
    },
    [sendWS]
  )

  const createConversation = useCallback(
    async (otherUserId: string): Promise<Conversation> => {
      if (!currentUser) {
        await ensureInitialized()
        if (!currentUser) {
          throw new Error('User not authenticated')
        }
      }

      const conversationId = generateConversationId(currentUser.id, otherUserId)

      if (!cryptoRef.current) {
        await ensureInitialized()
      }

      const session = await cryptoRef.current!.loadSession(otherUserId)
      if (!session) {
        const apiBundle = await keyApi.getBundle(otherUserId)
        const cryptoBundle = convertApiKeyBundleToCrypto(apiBundle)
        await cryptoRef.current!.processPreKeyBundle(cryptoBundle, otherUserId)
      }

      let conv: Conversation | undefined = conversations.get(conversationId)
      if (conv) {
        return conv
      }

      let otherUser: User | null = null
      try {
        otherUser = await userApi.getById(otherUserId)
      } catch {
        otherUser = null
      }

      conv = {
        id: conversationId,
        type: 'direct',
        name: otherUser ? otherUser.nickname || otherUser.phone : otherUserId,
        avatar: otherUser?.avatar ?? undefined,
        unreadCount: 0,
        createdAt: Date.now()
      }

      if (dbRef.current) {
        await dbRef.current.saveConversation(conv)
      }
      addOrUpdateConversation(conv)

      return conv
    },
    [currentUser, conversations, addOrUpdateConversation, ensureInitialized]
  )

  const loadConversationMessages = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!dbRef.current) {
        await ensureInitialized()
      }
      if (dbRef.current) {
        const msgs = await dbRef.current.getMessages(conversationId, 100)
        setMessages(conversationId, msgs)
      }
    },
    [ensureInitialized, setMessages]
  )

  const markAsRead = useCallback(
    (conversationId: string): void => {
      if (!dbRef.current) return
      clearUnread(conversationId)
      void dbRef.current.clearUnread(conversationId)

      const convMessages = messages.get(conversationId) ?? []
      convMessages.forEach((msg) => {
        if (msg.isOutgoing === 0 && msg.deliveryStatus !== 'read') {
          sendWS({
            type: 'MESSAGE_READ',
            data: { messageId: msg.id }
          })
        }
      })
    },
    [clearUnread, messages, sendWS]
  )

  return {
    sendMessage,
    sendTyping,
    createConversation,
    loadConversationMessages,
    markAsRead,
    isConnected
  }
}
