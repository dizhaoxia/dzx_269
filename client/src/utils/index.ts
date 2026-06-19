import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export const generateId = (): string => uuidv4()

export const formatDate = (date: Date | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
  return dayjs(date).format(format)
}

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  }
  return cleaned
}

export const validatePhone = (phone: string): boolean => {
  const regex = /^1[3-9]\d{9}$/
  return regex.test(phone.trim())
}

export const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 6) {
    return { valid: false, message: '密码长度不能少于6位' }
  }
  if (password.length > 32) {
    return { valid: false, message: '密码长度不能超过32位' }
  }
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: '密码需要包含字母和数字' }
  }
  return { valid: true, message: '' }
}

export const validateNickname = (nickname: string): boolean => {
  const trimmed = nickname.trim()
  return trimmed.length >= 1 && trimmed.length <= 20
}

export const classNames = (...classes: Array<string | undefined | null | false>): string => {
  return classes.filter(Boolean).join(' ')
}

export const getInitials = (name: string): string => {
  if (!name) return ''
  return name.trim().charAt(0).toUpperCase()
}

export const maskPhone = (phone: string): string => {
  if (!validatePhone(phone)) return phone
  return `${phone.slice(0, 3)}****${phone.slice(7)}`
}
