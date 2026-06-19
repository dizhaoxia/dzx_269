export { DatabaseManager } from './database'
export type {
  Message,
  Conversation,
  SignalSessionRecord,
  IdentityKeyRecord,
  PreKeyRecord,
  SignedPreKeyRecord,
  Contact,
} from './schema'
export {
  CREATE_MESSAGES_TABLE,
  CREATE_CONVERSATIONS_TABLE,
  CREATE_SIGNAL_SESSIONS_TABLE,
  CREATE_IDENTITY_KEYS_TABLE,
  CREATE_PRE_KEYS_TABLE,
  CREATE_SIGNED_PRE_KEYS_TABLE,
  CREATE_CONTACTS_TABLE,
  CREATE_INDEXES,
} from './schema'
