import { create } from 'zustand'
import type { Message, Conversation } from '../db/schema'

interface ChatState {
  conversations: Map<string, Conversation>
  messages: Map<string, Message[]>
  activeConversationId: string | null
  onlineUsers: Set<string>
  typingUsers: Map<string, Set<string>>

  setActiveConversation: (id: string | null) => void
  addOrUpdateConversation: (conv: Conversation) => void
  addMessage: (conversationId: string, message: Message, insertAtTop?: boolean) => void
  updateMessageStatus: (messageId: string, status: Message['deliveryStatus']) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  setOnline: (userId: string, online: boolean) => void
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void
  incrementUnread: (conversationId: string) => void
  clearUnread: (conversationId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: new Map(),
  messages: new Map(),
  activeConversationId: null,
  onlineUsers: new Set(),
  typingUsers: new Map(),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addOrUpdateConversation: (conv) =>
    set((state) => {
      const newConversations = new Map(state.conversations)
      newConversations.set(conv.id, conv)
      return { conversations: newConversations }
    }),

  addMessage: (conversationId, message, insertAtTop = false) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const convMessages = newMessages.get(conversationId) ?? []
      const exists = convMessages.some((m) => m.id === message.id)
      let updatedMessages: Message[]
      if (exists) {
        updatedMessages = convMessages.map((m) => (m.id === message.id ? message : m))
      } else if (insertAtTop) {
        updatedMessages = [message, ...convMessages]
      } else {
        updatedMessages = [...convMessages, message]
      }
      updatedMessages.sort((a, b) => b.timestamp - a.timestamp)
      newMessages.set(conversationId, updatedMessages)
      return { messages: newMessages }
    }),

  updateMessageStatus: (messageId, status) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      for (const [convId, msgs] of newMessages) {
        const updated = msgs.map((m) => (m.id === messageId ? { ...m, deliveryStatus: status } : m))
        if (updated !== msgs) {
          newMessages.set(convId, updated)
        }
      }
      return { messages: newMessages }
    }),

  setMessages: (conversationId, messages) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const sorted = [...messages].sort((a, b) => b.timestamp - a.timestamp)
      newMessages.set(conversationId, sorted)
      return { messages: newMessages }
    }),

  setOnline: (userId, online) =>
    set((state) => {
      const newOnline = new Set(state.onlineUsers)
      if (online) {
        newOnline.add(userId)
      } else {
        newOnline.delete(userId)
      }
      return { onlineUsers: newOnline }
    }),

  setTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const newTyping = new Map(state.typingUsers)
      const users = new Set(newTyping.get(conversationId) ?? [])
      if (isTyping) {
        users.add(userId)
      } else {
        users.delete(userId)
      }
      newTyping.set(conversationId, users)
      return { typingUsers: newTyping }
    }),

  incrementUnread: (conversationId) =>
    set((state) => {
      const newConversations = new Map(state.conversations)
      const conv = newConversations.get(conversationId)
      if (conv) {
        newConversations.set(conversationId, { ...conv, unreadCount: (conv.unreadCount || 0) + 1 })
      }
      return { conversations: newConversations }
    }),

  clearUnread: (conversationId) =>
    set((state) => {
      const newConversations = new Map(state.conversations)
      const conv = newConversations.get(conversationId)
      if (conv) {
        newConversations.set(conversationId, { ...conv, unreadCount: 0 })
      }
      return { conversations: newConversations }
    })
}))
