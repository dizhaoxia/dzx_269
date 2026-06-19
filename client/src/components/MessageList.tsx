import { useEffect, useRef, useState } from 'react'
import styled from '@emotion/styled'
import dayjs from 'dayjs'
import type { User, Message } from '../types'

interface MessageWithSender extends Message {
  plaintext?: string
  sender?: User
}

interface MessageListProps {
  messages: MessageWithSender[]
  currentUser: User
  isTyping?: boolean
  typingUser?: User | null
  onLoadMore?: () => void
  hasMore?: boolean
}

const MessageListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f8fafc;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
`

const DateDivider = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px 0;
`

const DateText = styled.span`
  background: #e5e7eb;
  color: #6b7280;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
`

const MessageRow = styled.div<{ isOwn: boolean }>`
  display: flex;
  flex-direction: ${(props) => (props.isOwn ? 'row-reverse' : 'row')};
  align-items: flex-end;
  gap: 8px;
  padding: 4px 0;
`

const MessageAvatar = styled.div`
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

const MessageContent = styled.div<{ isOwn: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${(props) => (props.isOwn ? 'flex-end' : 'flex-start')};
  max-width: 70%;
  min-width: 0;
`

const SenderName = styled.span`
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
  padding: 0 4px;
`

const MessageBubble = styled.div<{ isOwn: boolean; isEmoji: boolean }>`
  padding: ${(props) => (props.isEmoji ? '8px' : '10px 14px')};
  border-radius: ${(props) =>
    props.isOwn
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px'};
  background: ${(props) => (props.isOwn ? '#6366f1' : '#ffffff')};
  color: ${(props) => (props.isOwn ? '#ffffff' : '#1f2937')};
  font-size: ${(props) => (props.isEmoji ? '48px' : '15px')};
  line-height: ${(props) => (props.isEmoji ? '1.2' : '1.5')};
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  max-width: 100%;
  box-sizing: border-box;
`

const MessageMeta = styled.div<{ isOwn: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 0 4px;
`

const MessageTime = styled.span`
  font-size: 11px;
  color: #9ca3af;
`

const DeliveryStatus = styled.span<{ status: Message['deliveryStatus'] }>`
  font-size: 12px;
  color: ${(props) => {
    switch (props.status) {
      case 'read':
        return '#6366f1'
      case 'failed':
        return '#ef4444'
      default:
        return '#9ca3af'
    }
  }};
`

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
`

const TypingDots = styled.div`
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  background: #ffffff;
  border-radius: 18px 18px 18px 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`

const TypingDot = styled.span`
  width: 8px;
  height: 8px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;

  &:nth-of-type(1) {
    animation-delay: 0s;
  }

  &:nth-of-type(2) {
    animation-delay: 0.2s;
  }

  &:nth-of-type(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    30% {
      transform: translateY(-6px);
      opacity: 1;
    }
  }
`

const TypingText = styled.span`
  font-size: 13px;
  color: #6b7280;
`

const LoadMoreTrigger = styled.div`
  text-align: center;
  padding: 12px;
  color: #9ca3af;
  font-size: 13px;
`

function MessageList({
  messages,
  currentUser,
  isTyping = false,
  typingUser = null,
  onLoadMore,
  hasMore = false
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [showLoadMore, setShowLoadMore] = useState(false)
  const prevMessageCountRef = useRef(messages.length)

  useEffect(() => {
    if (listRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = listRef.current
      const atBottom = scrollHeight - scrollTop - clientHeight < 100
      
      if (messages.length > prevMessageCountRef.current && atBottom) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
      prevMessageCountRef.current = messages.length
    }
  }, [messages.length])

  useEffect(() => {
    if (listRef.current && isTyping) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [isTyping])

  const handleScroll = () => {
    if (!listRef.current) return
    const { scrollTop } = listRef.current
    if (scrollTop < 50 && hasMore && onLoadMore && !showLoadMore) {
      setShowLoadMore(true)
      onLoadMore()
      setTimeout(() => setShowLoadMore(false), 1000)
    }
  }

  const formatDate = (timestamp: number) => {
    const now = dayjs()
    const msgDate = dayjs(timestamp)
    if (now.isSame(msgDate, 'day')) {
      return '今天'
    }
    if (now.subtract(1, 'day').isSame(msgDate, 'day')) {
      return '昨天'
    }
    return msgDate.format('YYYY年MM月DD日')
  }

  const formatTime = (timestamp: number) => {
    return dayjs(timestamp).format('HH:mm')
  }

  const renderDeliveryStatus = (status: Message['deliveryStatus']) => {
    switch (status) {
      case 'sent':
        return <DeliveryStatus status={status}>✓</DeliveryStatus>
      case 'delivered':
        return <DeliveryStatus status={status}>✓✓</DeliveryStatus>
      case 'read':
        return <DeliveryStatus status={status}>✓✓</DeliveryStatus>
      case 'failed':
        return <DeliveryStatus status={status}>!</DeliveryStatus>
      default:
        return null
    }
  }

  const isEmojiOnly = (text: string) => {
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u
    return emojiRegex.test(text.trim()) && text.trim().length <= 3
  }

  const groupedMessages: (
    | { type: 'date'; key: string; date: string }
    | { type: 'message'; key: string; message: MessageWithSender }
  )[] = []

  let lastDateKey = ''
  messages.forEach((msg) => {
    const dateKey = dayjs(msg.timestamp).format('YYYY-MM-DD')
    if (dateKey !== lastDateKey) {
      groupedMessages.push({
        type: 'date',
        key: `date-${dateKey}`,
        date: formatDate(msg.timestamp)
      })
      lastDateKey = dateKey
    }
    groupedMessages.push({ type: 'message', key: msg.id, message: msg })
  })

  return (
    <MessageListContainer ref={listRef} onScroll={handleScroll}>
      {hasMore && showLoadMore && <LoadMoreTrigger>加载中...</LoadMoreTrigger>}
      {groupedMessages.map((item) => {
        if (item.type === 'date') {
          return (
            <DateDivider key={item.key}>
              <DateText>{item.date}</DateText>
            </DateDivider>
          )
        }

        const { message } = item
        const isOwn = message.senderId === currentUser.id
        const isEmoji = message.messageType === 'emoji' || isEmojiOnly(message.plaintext || '')
        const sender = message.sender
        const senderInitial = sender?.nickname?.charAt(0) || '?'

        return (
          <MessageRow key={item.key} isOwn={isOwn}>
            {!isOwn && <MessageAvatar>{senderInitial}</MessageAvatar>}
            <MessageContent isOwn={isOwn}>
              {!isOwn && sender && <SenderName>{sender.nickname}</SenderName>}
              <MessageBubble isOwn={isOwn} isEmoji={isEmoji}>
                {message.plaintext}
              </MessageBubble>
              <MessageMeta isOwn={isOwn}>
                <MessageTime>{formatTime(message.timestamp)}</MessageTime>
                {isOwn && renderDeliveryStatus(message.deliveryStatus)}
              </MessageMeta>
            </MessageContent>
          </MessageRow>
        )
      })}
      {isTyping && (
        <TypingIndicator>
          {typingUser && <MessageAvatar>{typingUser.nickname?.charAt(0) || '?'}</MessageAvatar>}
          <div>
            {typingUser && <SenderName>{typingUser.nickname}</SenderName>}
            <TypingDots>
              <TypingDot />
              <TypingDot />
              <TypingDot />
            </TypingDots>
            <TypingText style={{ marginTop: 4 }}>正在输入...</TypingText>
          </div>
        </TypingIndicator>
      )}
    </MessageListContainer>
  )
}

export default MessageList
