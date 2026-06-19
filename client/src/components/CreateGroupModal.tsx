import { useState } from 'react'
import styled from '@emotion/styled'
import type { User } from '../types'

interface CreateGroupModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, userIds: string[]) => void
  users: User[]
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
  max-width: 480px;
  max-height: 85vh;
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

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
`

const FormGroup = styled.div`
  margin-bottom: 20px;
`

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
`

const GroupNameInput = styled.input`
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

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  background: #f8fafc;
  box-sizing: border-box;
  margin-bottom: 12px;
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

const SelectedCount = styled.div`
  font-size: 13px;
  color: #6366f1;
  margin-bottom: 8px;
  font-weight: 500;
`

const UserList = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  max-height: 280px;
  overflow-y: auto;
`

const UserItem = styled.div<{ selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s ease;
  background: ${(props) => (props.selected ? '#eef2ff' : 'transparent')};
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${(props) => (props.selected ? '#e0e7ff' : '#f8fafc')};
  }
`

const Checkbox = styled.div<{ checked: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid ${(props) => (props.checked ? '#6366f1' : '#d1d5db')};
  background: ${(props) => (props.checked ? '#6366f1' : '#ffffff')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.15s ease;
`

const UserAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
`

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const UserNickname = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
`

const UserPhone = styled.div`
  font-size: 12px;
  color: #9ca3af;
`

const EmptyState = styled.div`
  padding: 32px 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
`

const ModalFooter = styled.div`
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  gap: 12px;
`

const CancelButton = styled.button`
  flex: 1;
  padding: 12px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f8fafc;
  }
`

const CreateButton = styled.button<{ disabled?: boolean }>`
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  background: ${(props) => (props.disabled ? '#cbd5e1' : '#6366f1')};
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #4f46e5;
  }
`

function CreateGroupModal({ open, onClose, onCreate, users }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  if (!open) return null

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      (user.nickname || '').toLowerCase().includes(query) ||
      user.phone.includes(query)
    )
  })

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleCreate = () => {
    if (!groupName.trim() || selectedUserIds.length === 0) return
    onCreate(groupName.trim(), selectedUserIds)
    setGroupName('')
    setSelectedUserIds([])
    setSearchQuery('')
    onClose()
  }

  const handleClose = () => {
    setGroupName('')
    setSelectedUserIds([])
    setSearchQuery('')
    onClose()
  }

  return (
    <ModalOverlay onClick={handleClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>创建群聊</ModalTitle>
          <CloseButton onClick={handleClose}>×</CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label>群名称</Label>
            <GroupNameInput
              type="text"
              placeholder="请输入群名称"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </FormGroup>

          <FormGroup>
            <Label>选择成员</Label>
            <SearchInput
              type="text"
              placeholder="搜索用户昵称或手机号"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <SelectedCount>已选择 {selectedUserIds.length} 人</SelectedCount>
            {filteredUsers.length === 0 ? (
              <EmptyState>未找到用户</EmptyState>
            ) : (
              <UserList>
                {filteredUsers.map((user) => (
                  <UserItem
                    key={user.id}
                    selected={selectedUserIds.includes(user.id)}
                    onClick={() => toggleUser(user.id)}
                  >
                    <Checkbox checked={selectedUserIds.includes(user.id)}>
                      {selectedUserIds.includes(user.id) && '✓'}
                    </Checkbox>
                    <UserAvatar>{(user.nickname || user.phone).charAt(0).toUpperCase()}</UserAvatar>
                    <UserInfo>
                      <UserNickname>{user.nickname || user.phone}</UserNickname>
                      <UserPhone>{user.phone}</UserPhone>
                    </UserInfo>
                  </UserItem>
                ))}
              </UserList>
            )}
          </FormGroup>
        </ModalBody>

        <ModalFooter>
          <CancelButton onClick={handleClose}>取消</CancelButton>
          <CreateButton
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUserIds.length === 0}
          >
            创建群聊
          </CreateButton>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  )
}

export default CreateGroupModal
