import {
  Message,
  Conversation,
  SignalSessionRecord,
  IdentityKeyRecord,
  PreKeyRecord,
  SignedPreKeyRecord,
  Contact,
} from './schema'

const DB_NAME = 'dzx_chat_db'
const DB_VERSION = 1

const STORE_MESSAGES = 'messages'
const STORE_CONVERSATIONS = 'conversations'
const STORE_SIGNAL_SESSIONS = 'signal_sessions'
const STORE_IDENTITY_KEYS = 'identity_keys'
const STORE_PRE_KEYS = 'pre_keys'
const STORE_SIGNED_PRE_KEYS = 'signed_pre_keys'
const STORE_CONTACTS = 'contacts'

export class DatabaseManager {
  private static instance: DatabaseManager
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  public async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise
    this.initPromise = this.doInit()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  private doInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve()
        return
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const messagesStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' })
          messagesStore.createIndex('conversation_id', 'conversationId', { unique: false })
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
          const convStore = db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' })
          convStore.createIndex('last_message_time', 'lastMessageTime', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORE_SIGNAL_SESSIONS)) {
          db.createObjectStore(STORE_SIGNAL_SESSIONS, { keyPath: 'userId' })
        }

        if (!db.objectStoreNames.contains(STORE_IDENTITY_KEYS)) {
          db.createObjectStore(STORE_IDENTITY_KEYS, { keyPath: 'id', autoIncrement: true })
        }

        if (!db.objectStoreNames.contains(STORE_PRE_KEYS)) {
          db.createObjectStore(STORE_PRE_KEYS, { keyPath: 'keyId' })
        }

        if (!db.objectStoreNames.contains(STORE_SIGNED_PRE_KEYS)) {
          db.createObjectStore(STORE_SIGNED_PRE_KEYS, { keyPath: 'keyId' })
        }

        if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
          db.createObjectStore(STORE_CONTACTS, { keyPath: 'userId' })
        }
      }
    })
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    return this.db
  }

  private async executeTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T> | Promise<T> | T
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)

      transaction.oncomplete = () => resolve(result as T)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)

      let result: T | undefined
      const request = callback(store)

      if (request instanceof IDBRequest) {
        request.onsuccess = () => {
          result = request.result
        }
        request.onerror = () => reject(request.error)
      } else if (request instanceof Promise) {
        request.then((val) => {
          result = val
        }).catch(reject)
      } else {
        result = request
      }
    })
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    return Promise.resolve()
  }

  public async saveMessage(message: Message): Promise<void> {
    await this.executeTransaction(STORE_MESSAGES, 'readwrite', (store) => store.put(message))
  }

  public async getMessages(conversationId: string, limit = 50, offset = 0): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_MESSAGES, 'readonly')
      const store = transaction.objectStore(STORE_MESSAGES)
      const index = store.index('conversation_id')
      const request = index.getAll(conversationId)

      request.onsuccess = () => {
        const messages: Message[] = request.result
        messages.sort((a, b) => b.timestamp - a.timestamp)
        resolve(messages.slice(offset, offset + limit))
      }
      request.onerror = () => reject(request.error)
    })
  }

  public async saveConversation(conversation: Conversation): Promise<void> {
    await this.executeTransaction(STORE_CONVERSATIONS, 'readwrite', (store) => store.put(conversation))
  }

  public async getConversations(): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_CONVERSATIONS, 'readonly')
      const store = transaction.objectStore(STORE_CONVERSATIONS)
      const request = store.getAll()

      request.onsuccess = () => {
        const conversations: Conversation[] = request.result
        conversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
        resolve(conversations)
      }
      request.onerror = () => reject(request.error)
    })
  }

  public async updateDeliveryStatus(messageId: string, status: Message['deliveryStatus']): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_MESSAGES, 'readwrite')
      const store = transaction.objectStore(STORE_MESSAGES)
      const getRequest = store.get(messageId)

      getRequest.onsuccess = () => {
        const message = getRequest.result as Message | undefined
        if (message) {
          message.deliveryStatus = status
          store.put(message)
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  public async incrementUnread(conversationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_CONVERSATIONS, 'readwrite')
      const store = transaction.objectStore(STORE_CONVERSATIONS)
      const getRequest = store.get(conversationId)

      getRequest.onsuccess = () => {
        const conversation = getRequest.result as Conversation | undefined
        if (conversation) {
          conversation.unreadCount = (conversation.unreadCount || 0) + 1
          store.put(conversation)
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  public async clearUnread(conversationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_CONVERSATIONS, 'readwrite')
      const store = transaction.objectStore(STORE_CONVERSATIONS)
      const getRequest = store.get(conversationId)

      getRequest.onsuccess = () => {
        const conversation = getRequest.result as Conversation | undefined
        if (conversation) {
          conversation.unreadCount = 0
          store.put(conversation)
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  public async saveSignalSession(userId: string, sessionRecord: string): Promise<void> {
    const record: SignalSessionRecord = { userId, sessionRecord }
    await this.executeTransaction(STORE_SIGNAL_SESSIONS, 'readwrite', (store) => store.put(record))
  }

  public async loadSignalSession(userId: string): Promise<string | null> {
    const record = await this.executeTransaction<SignalSessionRecord | undefined>(
      STORE_SIGNAL_SESSIONS,
      'readonly',
      (store) => store.get(userId)
    )
    return record ? record.sessionRecord : null
  }

  public async clearSignalSession(userId: string): Promise<void> {
    await this.executeTransaction(STORE_SIGNAL_SESSIONS, 'readwrite', (store) => store.delete(userId))
  }

  public async saveIdentityKey(keyPair: IdentityKeyRecord): Promise<number> {
    const result = await this.executeTransaction<IDBValidKey>(
      STORE_IDENTITY_KEYS,
      'readwrite',
      (store) => store.put(keyPair)
    )
    return result as number
  }

  public async loadIdentityKey(): Promise<IdentityKeyRecord | null> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_IDENTITY_KEYS, 'readonly')
      const store = transaction.objectStore(STORE_IDENTITY_KEYS)
      const request = store.getAll()

      request.onsuccess = () => {
        const keys = request.result as IdentityKeyRecord[]
        resolve(keys.length > 0 ? keys[0] : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  public async savePreKey(preKey: PreKeyRecord): Promise<void> {
    await this.executeTransaction(STORE_PRE_KEYS, 'readwrite', (store) => store.put(preKey))
  }

  public async savePreKeys(preKeys: PreKeyRecord[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_PRE_KEYS, 'readwrite')
      const store = transaction.objectStore(STORE_PRE_KEYS)

      for (const key of preKeys) {
        store.put(key)
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  public async loadPreKey(keyId: number): Promise<PreKeyRecord | null> {
    const record = await this.executeTransaction<PreKeyRecord | undefined>(
      STORE_PRE_KEYS,
      'readonly',
      (store) => store.get(keyId)
    )
    return record || null
  }

  public async loadUnusedPreKeys(): Promise<PreKeyRecord[]> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_PRE_KEYS, 'readonly')
      const store = transaction.objectStore(STORE_PRE_KEYS)
      const request = store.getAll()

      request.onsuccess = () => {
        const keys = request.result as PreKeyRecord[]
        resolve(keys.filter((k) => k.isUsed === 0))
      }
      request.onerror = () => reject(request.error)
    })
  }

  public async markPreKeyUsed(keyId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_PRE_KEYS, 'readwrite')
      const store = transaction.objectStore(STORE_PRE_KEYS)
      const getRequest = store.get(keyId)

      getRequest.onsuccess = () => {
        const preKey = getRequest.result as PreKeyRecord | undefined
        if (preKey) {
          preKey.isUsed = 1
          store.put(preKey)
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  public async saveSignedPreKey(signedPreKey: SignedPreKeyRecord): Promise<void> {
    await this.executeTransaction(STORE_SIGNED_PRE_KEYS, 'readwrite', (store) => store.put(signedPreKey))
  }

  public async loadSignedPreKey(keyId: number): Promise<SignedPreKeyRecord | null> {
    const record = await this.executeTransaction<SignedPreKeyRecord | undefined>(
      STORE_SIGNED_PRE_KEYS,
      'readonly',
      (store) => store.get(keyId)
    )
    return record || null
  }

  public async loadLatestSignedPreKey(): Promise<SignedPreKeyRecord | null> {
    return new Promise((resolve, reject) => {
      const db = this.getDb()
      const transaction = db.transaction(STORE_SIGNED_PRE_KEYS, 'readonly')
      const store = transaction.objectStore(STORE_SIGNED_PRE_KEYS)
      const request = store.getAll()

      request.onsuccess = () => {
        const keys = request.result as SignedPreKeyRecord[]
        if (keys.length === 0) {
          resolve(null)
        } else {
          keys.sort((a, b) => b.keyId - a.keyId)
          resolve(keys[0])
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  public async saveContact(contact: Contact): Promise<void> {
    await this.executeTransaction(STORE_CONTACTS, 'readwrite', (store) => store.put(contact))
  }

  public async loadContact(userId: string): Promise<Contact | null> {
    const record = await this.executeTransaction<Contact | undefined>(
      STORE_CONTACTS,
      'readonly',
      (store) => store.get(userId)
    )
    return record || null
  }

  public async loadAllContacts(): Promise<Contact[]> {
    return await this.executeTransaction<Contact[]>(STORE_CONTACTS, 'readonly', (store) => store.getAll())
  }
}

export default DatabaseManager
