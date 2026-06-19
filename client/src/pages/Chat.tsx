import { useState, useMemo } from 'react'
import styled from '@emotion/styled'
import { v4 as uuidv4 } from 'uuid'
import {
  Sidebar,
  MessageList,
  MessageInput,
  ConversationDetail,
  SearchUserModal,
  CreateGroupModal
} from '../components'
import { useAuthStore } from '../store/auth'
import type { User, Conversation, Message } from '../types'

const ChatContainer = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr 320px;
  height: 100vh;
  width: 100vw;
  background: #f8fafc;
  overflow: hidden;
  position: relative;

  @media (max-width: 1024px) {
    grid-template-columns: 280px 1fr;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const LeftPanel = styled.div<{ visible: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  @media (max-width: 768px) {
    display: ${(props) => (props.visible ? 'flex' : 'none')};
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    z-index: 10;
  }
`

const CenterPanel = styled.div<{ visible: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
  position: relative;

  @media (max-width: 768px) {
    display: ${(props) => (props.visible ? 'flex' : 'none')};
  }
`

const ChatHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  gap: 12px;
  min-height: 60px;
`

const BackButton = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  color: #6b7280;
  display: none;
  align-items: center;
  justify-content: center;
  border-radius: 8px;

  &:hover {
    background: #f1f5f9;
  }

  @media (max-width: 768px) {
    display: flex;
  }
`

const ChatTitle = styled.div`
  flex: 1;
  min-width: 0;
`

const ChatName = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
`

const ChatSubtitle = styled.span`
  font-size: 12px;
  color: #22c55e;
`

const ToggleDetailButton = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  color: #6b7280;
  display: none;
  align-items: center;
  justify-content: center;
  border-radius: 8px;

  &:hover {
    background: #f1f5f9;
  }

  @media (max-width: 1024px) {
    display: flex;
  }
`

const EmptyChat = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  background: #f8fafc;
  gap: 12px;
`

const EmptyChatIcon = styled.div`
  font-size: 48px;
`

const EmptyChatText = styled.span`
  font-size: 16px;
`

const MockUsers: User[] = [
  {
    id: 'user-1',
    phone: '13800138001',
    nickname: '张三',
    avatar: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user-2',
    phone: '13800138002',
    nickname: '李四',
    avatar: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user-3',
    phone: '13800138003',
    nickname: '王五',
    avatar: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user-4',
    phone: '13800138004',
    nickname: '赵六',
    avatar: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user-5',
    phone: '13800138005',
    nickname: '钱七',
    avatar: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]

interface ExtendedConversation extends Conversation {
  online?: boolean
  targetUser?: User
  groupMembers?: Array<User & { role?: 'owner' | 'admin' | 'member' }>
  isEncrypted?: boolean
}

interface ExtendedMessage extends Message {
  plaintext?: string
  sender?: User
}

function Chat() {
  const { user: currentUser } = useAuthStore()
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [detailCollapsed, setDetailCollapsed] = useState(false)
  const [showSidebarMobile, setShowSidebarMobile] = useState(true)
  const [showDetailMobile, setShowDetailMobile] = useState(false)

  const now = Date.now()

  const [conversations, setConversations] = useState<ExtendedConversation[]>([
    {
      id: 'conv-1',
      type: 'direct',
      lastMessage: '好的，明天见！',
      lastMessageTime: now - 1000 * 60 * 5,
      unreadCount: 2,
      online: true,
      targetUser: MockUsers[0]
    },
    {
      id: 'conv-2',
      type: 'direct',
      lastMessage: '那个文档我发到你邮箱了',
      lastMessageTime: now - 1000 * 60 * 60,
      unreadCount: 0,
      online: false,
      targetUser: MockUsers[1]
    },
    {
      id: 'conv-3',
      type: 'group',
      name: '项目讨论组',
      lastMessage: '张三: 周末有时间吗？',
      lastMessageTime: now - 1000 * 60 * 60 * 3,
      unreadCount: 5,
      groupMembers: [
        { ...MockUsers[0], role: 'owner' },
        { ...MockUsers[1], role: 'member' },
        { ...MockUsers[2], role: 'member' }
      ]
    },
    {
      id: 'conv-4',
      type: 'direct',
      lastMessage: '哈哈哈笑死我了 😂',
      lastMessageTime: now - 1000 * 60 * 60 * 24,
      unreadCount: 0,
      online: true,
      targetUser: MockUsers[3]
    }
  ])

  const [messagesMap, setMessagesMap] = useState<Record<string, ExtendedMessage[]>>({
    'conv-1': [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: MockUsers[0].id,
        ciphertext: '',
        messageType: 'text',
        timestamp: now - 1000 * 60 * 30,
        deliveryStatus: 'read',
        plaintext: '在吗？',
        sender: MockUsers[0]
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderId: currentUser?.id || 'me',
        ciphertext: '',
        messageType: 'text',
        timestamp: now - 1000 * 60 * 25,
        deliveryStatus: 'read',
        plaintext: '在的，怎么了？'
      },
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        senderId: MockUsers[0].id,
        ciphertext: '',
        messageType: 'text',
        timestamp: now - 1000 * 60 * 10,
        deliveryStatus: 'read',
        plaintext: '明天有空一起吃饭吗？',
        sender: MockUsers[0]
      },
      {
        id: 'msg-4',
        conversationId: 'conv-1',
        senderId: currentUser?.id || 'me',
        ciphertext: '',
        messageType: 'text',
        timestamp: now - 1000 * 60 * 6,
        deliveryStatus: 'read',
        plaintext: '好啊，几点？在哪里？'
      },
      {
        id: 'msg-5',
        conversationId: 'conv-1',
        senderId: MockUsers[0].id,
        ciphertext: '',
        messageType: 'text',
        timestamp: now - 1000 * 60 * 5,
        deliveryStatus: 'delivered',
        plaintext: '好的，明天见！',
        sender: MockUsers[0]
      }
    ],
    'conv-3': [
      {
        id: 'gmsg-1',
        conversationId: 'conv-3',
        senderId: MockUsers[1].id,
        ciphertext: '',
        messageType: 'text',
        timestamp: now - 1000 * 60 * 60 * 4,
        deliveryStatus: 'read',
        plaintext: '大家好！',
        sender: MockUsers[1]
      },
      {
        id: 'gmsg-2',
        conversationId: 'conv-3',
        senderId: MockUsers[2].id,
        ciphertext: '',
        messageType: 'emoji',
        timestamp: now - 1000 * 60 * 60 * 3.5,
        deliveryStatus: 'read',
        plaintext: '👋',
        sender: MockUsers[2]
      },
      {
        id: 'gmsg-3',
        conversationId: 'conv-3',
        senderId: MockUsers[0].id,
        ciphertext: '',
        messageType: 'text',
        timestamp: now - 1000 * 60 * 60 * 3,
        deliveryStatus: 'delivered',
        plaintext: '周末有时间吗？',
        sender: MockUsers[0]
      }
    ]
  })

  const [isTyping, setIsTyping] = useState(false)

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  )

  const activeMessages = useMemo(
    () => (activeConversationId ? messagesMap[activeConversationId] || [] : []),
    [messagesMap, activeConversationId]
  )

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    )
    setShowSidebarMobile(false)
    setShowDetailMobile(false)
  }

  const handleSendMessage = (text: string, type: 'text' | 'emoji') => {
    if (!activeConversationId || !currentUser) return

    const newMessage: ExtendedMessage = {
      id: uuidv4(),
      conversationId: activeConversationId,
      senderId: currentUser.id,
      ciphertext: text,
      messageType: type,
      timestamp: Date.now(),
      deliveryStatus: 'sent',
      plaintext: text
    }

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), newMessage]
    }))

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, lastMessage: text, lastMessageTime: Date.now() }
          : c
      )
    )

    setTimeout(() => {
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] || []).map((m) =>
          m.id === newMessage.id ? { ...m, deliveryStatus: 'delivered' as const } : m
        )
      }))
    }, 1000)
  }

  const handleTyping = () => {
    setIsTyping(true)
    setTimeout(() => setIsTyping(false), 2000)
  }

  const handleSelectUser = (user: User) => {
    let existingConv = conversations.find(
      (c) => c.type === 'direct' && c.targetUser?.id === user.id
    )

    if (!existingConv) {
      const newConv: ExtendedConversation = {
        id: uuidv4(),
        type: 'direct',
        unreadCount: 0,
        online: true,
        targetUser: user,
        lastMessage: '',
        lastMessageTime: Date.now()
      }
      setConversations((prev) => [newConv, ...prev])
      setMessagesMap((prev) => ({ ...prev, [newConv.id]: [] }))
      existingConv = newConv
    }

    handleSelectConversation(existingConv.id)
  }

  const handleCreateGroup = (name: string, userIds: string[]) => {
    const members = MockUsers.filter((u) => userIds.includes(u.id))
    const groupMembers: Array<User & { role?: 'owner' | 'admin' | 'member' }> = [
      { ...currentUser, role: 'owner' } as User & { role: 'owner' },
      ...members.map((m) => ({ ...m, role: 'member' as const }))
    ]

    const newConv: ExtendedConversation = {
      id: uuidv4(),
      type: 'group',
      name,
      unreadCount: 0,
      groupMembers,
      lastMessage: '群已创建',
      lastMessageTime: Date.now()
    }

    setConversations((prev) => [newConv, ...prev])
    setMessagesMap((prev) => ({ ...prev, [newConv.id]: [] }))
    handleSelectConversation(newConv.id)
  }

  const handleToggleDetail = () => {
    if (window.innerWidth <= 1024) {
      setShowDetailMobile(!showDetailMobile)
    } else {
      setDetailCollapsed(!detailCollapsed)
    }
  }

  const handleBack = () => {
    setShowDetailMobile(false)
    setShowSidebarMobile(true)
    setActiveConversationId(null)
  }

  if (!currentUser) {
    return <div>加载中...</div>
  }

  return (
    <ChatContainer>
      <LeftPanel visible={showSidebarMobile}>
        <Sidebar
          currentUser={currentUser}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onCreateGroupClick={() => setShowCreateGroupModal(true)}
          onSearchUserClick={() => setShowSearchModal(true)}
        />
      </LeftPanel>

      <CenterPanel visible={!showSidebarMobile}>
        {activeConversation ? (
          <>
            <ChatHeader>
              <BackButton onClick={handleBack}>←</BackButton>
              <ChatTitle>
                <ChatName>
                  {activeConversation.type === 'direct'
                    ? activeConversation.targetUser?.nickname
                    : activeConversation.name}
                </ChatName>
                {activeConversation.type === 'direct' && (
                  <ChatSubtitle>
                    {activeConversation.online ? '在线' : '离线'}
                  </ChatSubtitle>
                )}
              </ChatTitle>
              <ToggleDetailButton onClick={handleToggleDetail}>
                ⓘ
              </ToggleDetailButton>
            </ChatHeader>

            <MessageList
              messages={activeMessages}
              currentUser={currentUser}
              isTyping={isTyping}
              typingUser={null}
              onLoadMore={() => {}}
              hasMore={false}
            />

            <MessageInput
              onSend={handleSendMessage}
              onTyping={handleTyping}
              disabled={!activeConversation}
            />
          </>
        ) : (
          <EmptyChat>
            <EmptyChatIcon>💬</EmptyChatIcon>
            <EmptyChatText>选择一个会话开始聊天</EmptyChatText>
          </EmptyChat>
        )}
      </CenterPanel>

      {window.innerWidth > 1024 ? (
        <ConversationDetail
          conversation={activeConversation}
          currentUserId={currentUser.id}
          isCollapsed={detailCollapsed}
          onToggleCollapse={handleToggleDetail}
        />
      ) : (
        showDetailMobile && activeConversation && (
          <ConversationDetail
            conversation={activeConversation}
            currentUserId={currentUser.id}
            isCollapsed={false}
          />
        )
      )}

      <SearchUserModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectUser={handleSelectUser}
        users={MockUsers.filter((u) => u.id !== currentUser.id)}
      />

      <CreateGroupModal
        open={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreate={handleCreateGroup}
        users={MockUsers.filter((u) => u.id !== currentUser.id)}
      />
    </ChatContainer>
  )
}

export default Chat
