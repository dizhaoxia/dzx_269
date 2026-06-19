export interface User {
  id: string
  phone: string
  nickname?: string | null
  avatar?: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface LoginRequest {
  phone: string
  password: string
}

export interface RegisterRequest {
  phone: string
  password: string
  nickname?: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  ciphertext: string
  messageType: 'text' | 'emoji' | 'image'
  timestamp: number
  deliveryStatus: 'sent' | 'delivered' | 'read' | 'failed'
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name?: string
  avatar?: string
  lastMessage?: string
  lastMessageTime?: number
  unreadCount: number
}

export interface Group {
  id: string
  name: string
  avatar?: string
  ownerId: string
  createdAt: string
  memberCount: number
}

export interface KeyBundle {
  identityKey: string
  signedPreKey: {
    id: number
    publicKey: string
    signature: string
  }
  oneTimePreKey?: {
    id: number
    publicKey: string
  }
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}
