import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Message,
  Conversation,
  Group,
  KeyBundle
} from '../types'
import { useAuthStore } from '../store/auth'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const parsed = JSON.parse(token)
        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`
        }
      } catch {
        // ignore parse error
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data: LoginRequest): Promise<AuthResponse> =>
    apiClient.post('/auth/login', data),
  register: (data: RegisterRequest): Promise<AuthResponse> =>
    apiClient.post('/auth/register', data),
  me: (): Promise<{ user: User }> => apiClient.get('/auth/me')
}

export interface SearchUsersResponse {
  users: User[]
}

export interface GetUserResponse {
  user: User
}

export const userApi = {
  search: (query: string): Promise<User[]> =>
    apiClient.get<SearchUsersResponse>('/users/search', { params: { q: query } })
      .then((r) => r.data.users),
  getById: (userId: string): Promise<User> =>
    apiClient.get<GetUserResponse>(`/users/${userId}`)
      .then((r) => r.data.user)
}

export const keyApi = {
  uploadKeys: (data: { identityKey: string; signedPreKey: { keyId: number; publicKey: string; signature: string }; preKeys: Array<{ keyId: number; publicKey: string }> }): Promise<void> =>
    apiClient.post('/keys/upload', {
      identity_key: data.identityKey,
      signed_pre_key: {
        key_id: data.signedPreKey.keyId,
        public_key: data.signedPreKey.publicKey,
        signature: data.signedPreKey.signature
      },
      pre_keys: data.preKeys.map((k) => ({
        key_id: k.keyId,
        public_key: k.publicKey
      }))
    }),
  getBundle: (userId: string): Promise<KeyBundle> =>
    apiClient.get<KeyBundle>(`/keys/bundle/${userId}`).then((r) => r.data)
}

export const messageApi = {
  send: (data: { conversationId: string; ciphertext: string; messageType: string }): Promise<Message> =>
    apiClient.post('/messages', {
      conversation_id: data.conversationId,
      ciphertext: data.ciphertext,
      message_type: data.messageType
    })
}

export const conversationApi = {
  list: (): Promise<Conversation[]> => apiClient.get('/conversations')
}

export const groupApi = {
  create: (data: { name: string; userIds?: string[] }): Promise<Group> =>
    apiClient.post('/groups', { name: data.name, member_ids: data.userIds }),
  invite: (groupId: string, userIds: string[]): Promise<void> =>
    apiClient.post(`/groups/${groupId}/invite`, { user_ids: userIds }),
  leave: (groupId: string): Promise<void> =>
    apiClient.post(`/groups/${groupId}/leave`)
}

export default apiClient
