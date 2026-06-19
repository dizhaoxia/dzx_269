import { useState, useMemo, useCallback } from 'react'
import styled from '@emotion/styled'
import {
  Sidebar,
  MessageList,
  MessageInput,
  ConversationDetail,
  SearchUserModal,
  CreateGroupModal
} from '../components'
import { useAuthStore } from '../store/auth'
import { useChatStore } from '../store/chat'
import { useChat } from '../hooks/useChat'
import type { User, Conversation as TypeConversation, Message as TypeMessage } from '../types'
import { userApi } from '../api'
import { SignalCryptoManager } from '../crypto'

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

const EncryptedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #dcfce7;
  color: #15803d;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  margin-left: 8px;
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

interface ExtendedConversation extends TypeConversation {
  online?: boolean
  targetUser?: User
  groupMembers?: Array<User & { role?: 'owner' | 'admin' | 'member' }>
  isEncrypted?: boolean
}

interface ExtendedMessage extends TypeMessage {
  plaintext?: string
  sender?: User
}

function Chat() {
  const { user: currentUser } = useAuthStore()
  const {
    conversations,
    messages,
    activeConversationId,
    setActiveConversation,
    onlineUsers,
    typingUsers
  } = useChatStore()
  const {
    sendMessage,
    sendTyping,
    createConversation,
    loadConversationMessages,
    markAsRead,
    isConnected
  } = useChat()

  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [detailCollapsed, setDetailCollapsed] = useState(false)
  const [showSidebarMobile, setShowSidebarMobile] = useState(true)
  const [showDetailMobile, setShowDetailMobile] = useState(false)
  const [encryptedSessions, setEncryptedSessions] = useState<Set<string>>(new Set())
  const [startingEncryption, setStartingEncryption] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])

  const extendedConversations = useMemo<ExtendedConversation[]>(() => {
    return Array.from(conversations.values()).map((conv) => ({
      ...conv,
      online: conv.type === 'direct' ? onlineUsers.has(conv.id) : undefined,
      isEncrypted: encryptedSessions.has(conv.id)
    }))
  }, [conversations, onlineUsers, encryptedSessions])

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null
    const conv = extendedConversations.find((c) => c.id === activeConversationId) || null
    return conv
  }, [extendedConversations, activeConversationId])

  const activeMessages = useMemo<ExtendedMessage[]>(() => {
    if (!activeConversationId) return []
    const msgs = messages.get(activeConversationId) || []
    return msgs.sort((a, b) => a.timestamp - b.timestamp) as ExtendedMessage[]
  }, [messages, activeConversationId])

  const activeTypingUsers = useMemo(() => {
    if (!activeConversationId) return new Set<string>()
    return typingUsers.get(activeConversationId) || new Set()
  }, [typingUsers, activeConversationId])

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversation(id)
    markAsRead(id)
    await loadConversationMessages(id)
    setShowSidebarMobile(false)
    setShowDetailMobile(false)
  }, [setActiveConversation, markAsRead, loadConversationMessages])

  const handleSendMessage = useCallback(async (text: string, type: 'text' | 'emoji') => {
    if (!activeConversationId || !currentUser || !activeConversation) return
    const receiverId = activeConversation.type === 'direct'
      ? activeConversation.targetUser?.id
      : undefined
    if (!receiverId) return
    try {
      await sendMessage(activeConversationId, receiverId, text, type)
    } catch (e) {
      console.error('Failed to send message:', e)
    }
  }, [activeConversationId, activeConversation, currentUser, sendMessage])

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!activeConversationId) return
    sendTyping(activeConversationId, isTyping)
  }, [activeConversationId, sendTyping])

  const handleSelectUser = useCallback(async (user: User) => {
    try {
      const conv = await createConversation(user.id)
      const targetUserConv = conv as ExtendedConversation
      targetUserConv.targetUser = user
      await handleSelectConversation(conv.id)
    } catch (e) {
      console.error('Failed to create conversation:', e)
    }
  }, [createConversation, handleSelectConversation])

  const handleStartEncrypted = useCallback(async () => {
    if (!activeConversation || !activeConversation.targetUser) return
    const targetUserId = activeConversation.targetUser.id
    setStartingEncryption(true)
    try {
      const crypto = SignalCryptoManager.getInstance()
      await crypto.init()
      const existingSession = await crypto.loadSession(targetUserId)
      if (!existingSession) {
        await createConversation(targetUserId)
      }
      setEncryptedSessions((prev) => {
        const next = new Set(prev)
        next.add(activeConversation.id)
        return next
      })
    } catch (e) {
      console.error('Failed to start encrypted session:', e)
      alert('建立加密会话失败，请确保对方已注册并上传密钥')
    } finally {
      setStartingEncryption(false)
    }
  }, [activeConversation, createConversation])

  const handleCreateGroup = useCallback((name: string, userIds: string[]) => {
    console.log('Create group:', name, userIds)
    alert('群聊功能开发中')
  }, [])

  const handleInviteMember = useCallback(() => {
    alert('邀请成员功能开发中')
  }, [])

  const handleLeaveGroup = useCallback(() => {
    if (!confirm('确定要退出该群组吗？')) return
    alert('退出群组功能开发中')
  }, [])

  const handleToggleDetail = useCallback(() => {
    if (window.innerWidth <= 1024) {
      setShowDetailMobile(!showDetailMobile)
    } else {
      setDetailCollapsed(!detailCollapsed)
    }
  }, [showDetailMobile, detailCollapsed])

  const handleBack = useCallback(() => {
    setShowDetailMobile(false)
    setShowSidebarMobile(true)
    setActiveConversation(null)
  }, [setActiveConversation])

  const handleOpenSearchModal = useCallback(async () => {
    try {
      const results = await userApi.search('')
      setAllUsers(results)
    } catch {
      setAllUsers([])
    }
    setShowSearchModal(true)
  }, [])

  if (!currentUser) {
    return <div>加载中...</div>
  }

  return (
    <ChatContainer>
      <LeftPanel visible={showSidebarMobile}>
        <Sidebar
          currentUser={currentUser}
          conversations={extendedConversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onCreateGroupClick={() => setShowCreateGroupModal(true)}
          onSearchUserClick={handleOpenSearchModal}
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
                    ? activeConversation.targetUser?.nickname || activeConversation.targetUser?.phone
                    : activeConversation.name}
                  {activeConversation.isEncrypted && (
                    <EncryptedBadge>🔐 已加密</EncryptedBadge>
                  )}
                </ChatName>
                {activeConversation.type === 'direct' && (
                  <ChatSubtitle>
                    {isConnected ? (activeConversation.online ? '在线' : '离线') : '连接中...'}
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
              isTyping={activeTypingUsers.size > 0}
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
          onStartEncrypted={startingEncryption ? undefined : handleStartEncrypted}
          onInviteMember={handleInviteMember}
          onLeaveGroup={handleLeaveGroup}
        />
      ) : (
        showDetailMobile && activeConversation && (
          <ConversationDetail
            conversation={activeConversation}
            currentUserId={currentUser.id}
            isCollapsed={false}
            onStartEncrypted={startingEncryption ? undefined : handleStartEncrypted}
            onInviteMember={handleInviteMember}
            onLeaveGroup={handleLeaveGroup}
          />
        )
      )}

      <SearchUserModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectUser={handleSelectUser}
      />

      <CreateGroupModal
        open={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreate={handleCreateGroup}
        users={allUsers.filter((u) => u.id !== currentUser.id)}
      />
    </ChatContainer>
  )
}

export default Chat
