import { useState, useEffect, useCallback } from 'react'
import styled from '@emotion/styled'
import type { User } from '../types'
import { userApi } from '../api'
import { useAuthStore } from '../store/auth'

interface SearchUserModalProps {
  open: boolean
  onClose: () => void
  onSelectUser: (user: User) => void
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`

const ModalContent = styled.div`
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`

const ModalHeader = styled.div`
  padding: 20px 20px 16px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
`

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.15s ease;

  &:hover {
    background: #f1f5f9;
    color: #1f2937;
  }
`

const SearchWrapper = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
`

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  background: #f8fafc;
  box-sizing: border-box;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #6366f1;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`

const UserList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
`

const UserItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #f8fafc;
  }
`

const UserAvatar = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
`

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const UserNickname = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 2px;
`

const UserPhone = styled.div`
  font-size: 13px;
  color: #9ca3af;
`

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
`

const LoadingSpinner = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #6366f1;
  font-size: 14px;

  &::after {
    content: '';
    display: inline-block;
    width: 16px;
    height: 16px;
    margin-left: 8px;
    border: 2px solid #6366f1;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    vertical-align: middle;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

function SearchUserModal({ open, onClose, onSelectUser }: SearchUserModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const currentUser = useAuthStore((s) => s.user)

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUsers([])
      return
    }
    setLoading(true)
    try {
      const results = await userApi.search(query)
      const filtered = currentUser
        ? results.filter((u) => u.id !== currentUser.id)
        : results
      setUsers(filtered)
    } catch (e) {
      console.error('Search failed:', e)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setUsers([])
      return
    }
    const timer = setTimeout(() => {
      void searchUsers(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [open, searchQuery, searchUsers])

  if (!open) return null

  const handleSelect = (user: User) => {
    onSelectUser(user)
    setSearchQuery('')
    setUsers([])
    onClose()
  }

  const renderAvatar = (user: User) => {
    const display = user.nickname?.charAt(0)?.toUpperCase() || user.phone.charAt(0)
    return <UserAvatar>{display}</UserAvatar>
  }

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>搜索用户</ModalTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>

        <SearchWrapper>
          <SearchInput
            type="text"
            placeholder="输入昵称或手机号搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </SearchWrapper>

        <UserList>
          {loading ? (
            <LoadingSpinner>搜索中</LoadingSpinner>
          ) : !searchQuery.trim() ? (
            <EmptyState>输入关键词开始搜索</EmptyState>
          ) : users.length === 0 ? (
            <EmptyState>未找到用户</EmptyState>
          ) : (
            users.map((user) => (
              <UserItem key={user.id} onClick={() => handleSelect(user)}>
                {renderAvatar(user)}
                <UserInfo>
                  <UserNickname>{user.nickname || user.phone}</UserNickname>
                  <UserPhone>{user.phone}</UserPhone>
                </UserInfo>
              </UserItem>
            ))
          )}
        </UserList>
      </ModalContent>
    </ModalOverlay>
  )
}

export default SearchUserModal
