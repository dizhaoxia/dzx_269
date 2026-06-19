import { useState } from 'react'
import styled from '@emotion/styled'
import dayjs from 'dayjs'
import type { User, Conversation } from '../types'

interface SidebarProps {
  currentUser: User
  conversations: (Conversation & {
    online?: boolean
    targetUser?: User
  })[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onCreateGroupClick: () => void
  onSearchUserClick: () => void
}

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
`

const UserHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 12px;
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

const UserName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const UserPhone = styled.div`
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
`

const SearchSection = styled.div`
  padding: 12px 16px;
  display: flex;
  gap: 8px;
`

const SearchInputWrapper = styled.div`
  flex: 1;
  position: relative;
`

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px 10px 36px;
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

const SearchIcon = styled.span`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 14px;
`

const AddButton = styled.button`
  width: 40px;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #6366f1;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: #eef2ff;
    border-color: #6366f1;
  }
`

const ConversationList = styled.div`
  flex: 1;
  overflow-y: auto;
`

const ConversationItem = styled.div<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
  background: ${(props) => (props.active ? '#eef2ff' : 'transparent')};
  border-bottom: 1px solid #f8fafc;
  position: relative;

  &:hover {
    background: ${(props) => (props.active ? '#eef2ff' : '#f8fafc')};
  }
`

const ConversationAvatarWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`

const ConversationAvatar = styled.div<{ type: 'direct' | 'group' }>`
  width: 48px;
  height: 48px;
  border-radius: ${(props) => (props.type === 'group' ? '12px' : '50%')};
  background: ${(props) =>
    props.type === 'group'
      ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 16px;
`

const OnlineDot = styled.span`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12px;
  height: 12px;
  background: #22c55e;
  border: 2px solid #ffffff;
  border-radius: 50%;
`

const ConversationContent = styled.div`
  flex: 1;
  min-width: 0;
`

const ConversationTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`

const ConversationName = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ConversationTime = styled.span`
  font-size: 11px;
  color: #9ca3af;
  flex-shrink: 0;
  margin-left: 8px;
`

const ConversationBottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const LastMessage = styled.span`
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`

const UnreadBadge = styled.span`
  background: #ef4444;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  flex-shrink: 0;
`

const CreateGroupButton = styled.button`
  margin: 12px 16px;
  padding: 10px 16px;
  border: 1px dashed #6366f1;
  border-radius: 10px;
  background: transparent;
  color: #6366f1;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover {
    background: #eef2ff;
  }
`

function Sidebar({
  currentUser,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateGroupClick,
  onSearchUserClick
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const name = (conv.type === 'direct' ? conv.targetUser?.nickname : conv.name) || ''
    return name.toLowerCase().includes(query)
  })

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return ''
    const now = dayjs()
    const msgTime = dayjs(timestamp)
    if (now.isSame(msgTime, 'day')) {
      return msgTime.format('HH:mm')
    }
    if (now.subtract(1, 'day').isSame(msgTime, 'day')) {
      return '昨天'
    }
    return msgTime.format('MM/DD')
  }

  const getInitial = (str?: string) => {
    return str ? str.charAt(0).toUpperCase() : '?'
  }

  return (
    <SidebarContainer>
      <UserHeader>
        <UserAvatar>{getInitial(currentUser.nickname)}</UserAvatar>
        <UserInfo>
          <UserName>{currentUser.nickname}</UserName>
          <UserPhone>{currentUser.phone}</UserPhone>
        </UserInfo>
      </UserHeader>

      <SearchSection>
        <SearchInputWrapper>
          <SearchIcon>🔍</SearchIcon>
          <SearchInput
            type="text"
            placeholder="搜索用户或会话"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </SearchInputWrapper>
        <AddButton onClick={onSearchUserClick} title="添加好友">
          +
        </AddButton>
      </SearchSection>

      <ConversationList>
        {filteredConversations.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            暂无会话，点击上方 + 开始聊天
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const displayName = conv.type === 'direct' ? conv.targetUser?.nickname : conv.name
            const initial = getInitial(displayName)
            return (
              <ConversationItem
                key={conv.id}
                active={activeConversationId === conv.id}
                onClick={() => onSelectConversation(conv.id)}
              >
                <ConversationAvatarWrapper>
                  <ConversationAvatar type={conv.type}>{initial}</ConversationAvatar>
                  {conv.type === 'direct' && conv.online && <OnlineDot />}
                </ConversationAvatarWrapper>
                <ConversationContent>
                  <ConversationTop>
                    <ConversationName>{displayName || '会话'}</ConversationName>
                    <ConversationTime>{formatTime(conv.lastMessageTime)}</ConversationTime>
                  </ConversationTop>
                  <ConversationBottom>
                    <LastMessage>{conv.lastMessage || '暂无消息'}</LastMessage>
                    {conv.unreadCount > 0 && (
                      <UnreadBadge>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</UnreadBadge>
                    )}
                  </ConversationBottom>
                </ConversationContent>
              </ConversationItem>
            )
          })
        )}
      </ConversationList>

      <CreateGroupButton onClick={onCreateGroupClick}>
        <span>👥</span>
        创建群聊
      </CreateGroupButton>
    </SidebarContainer>
  )
}

export default Sidebar
