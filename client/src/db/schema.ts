export interface Message {
  id: string
  conversationId: string
  senderId: string
  recipientId: string
  ciphertext: string
  plaintext?: string
  messageType: string
  timestamp: number
  deliveryStatus: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  isOutgoing: number
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string
  avatar?: string
  lastMessage?: string
  lastMessageTime?: number
  unreadCount: number
  createdAt: number
}

export interface SignalSessionRecord {
  userId: string
  sessionRecord: string
}

export interface IdentityKeyRecord {
  id?: number
  publicKey: string
  privateKey: string
}

export interface PreKeyRecord {
  keyId: number
  publicKey: string
  privateKey: string
  isUsed: number
}

export interface SignedPreKeyRecord {
  keyId: number
  publicKey: string
  privateKey: string
  signature: string
}

export interface Contact {
  userId: string
  phone: string
  nickname: string
  avatar?: string
}

export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    plaintext TEXT,
    message_type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'sending',
    is_outgoing INTEGER NOT NULL DEFAULT 0
  )
`

export const CREATE_CONVERSATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    last_message TEXT,
    last_message_time INTEGER,
    unread_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`

export const CREATE_SIGNAL_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS signal_sessions (
    user_id TEXT PRIMARY KEY,
    session_record TEXT NOT NULL
  )
`

export const CREATE_IDENTITY_KEYS_TABLE = `
  CREATE TABLE IF NOT EXISTS identity_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL
  )
`

export const CREATE_PRE_KEYS_TABLE = `
  CREATE TABLE IF NOT EXISTS pre_keys (
    key_id INTEGER PRIMARY KEY,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    is_used INTEGER NOT NULL DEFAULT 0
  )
`

export const CREATE_SIGNED_PRE_KEYS_TABLE = `
  CREATE TABLE IF NOT EXISTS signed_pre_keys (
    key_id INTEGER PRIMARY KEY,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    signature TEXT NOT NULL
  )
`

export const CREATE_CONTACTS_TABLE = `
  CREATE TABLE IF NOT EXISTS contacts (
    user_id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT
  )
`

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_conversations_last_message_time ON conversations(last_message_time);
`
