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
  (response) => response.data?.data ?? response.data,
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
  me: (): Promise<User> => apiClient.get('/auth/me')
}

export const userApi = {
  search: (query: string): Promise<User[]> =>
    apiClient.get('/users/search', { params: { q: query } }),
  getById: (userId: string): Promise<User> =>
    apiClient.get(`/users/${userId}`)
}

export const keyApi = {
  uploadKeys: (data: { identityKey: string; signedPreKey: unknown; oneTimePreKeys: unknown[] }): Promise<void> =>
    apiClient.post('/keys/upload', data),
  getBundle: (userId: string): Promise<KeyBundle> =>
    apiClient.get(`/keys/bundle/${userId}`)
}

export const messageApi = {
  send: (data: { conversationId: string; ciphertext: string; messageType: string }): Promise<Message> =>
    apiClient.post('/messages', data)
}

export const conversationApi = {
  list: (): Promise<Conversation[]> => apiClient.get('/conversations')
}

export const groupApi = {
  create: (data: { name: string; userIds?: string[] }): Promise<Group> =>
    apiClient.post('/groups', data),
  invite: (groupId: string, userIds: string[]): Promise<void> =>
    apiClient.post(`/groups/${groupId}/invite`, { userIds }),
  leave: (groupId: string): Promise<void> =>
    apiClient.post(`/groups/${groupId}/leave`)
}

export default apiClient
