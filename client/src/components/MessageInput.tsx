import { useState, useRef, useEffect } from 'react'
import styled from '@emotion/styled'

const EMOJI_LIST = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆',
  '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗',
  '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐',
  '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐',
  '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜',
  '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑',
  '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '❤️',
  '🔥', '🎉', '✨', '💯', '⭐', '🌟', '💖', '💗'
]

interface MessageInputProps {
  onSend: (text: string, type: 'text' | 'emoji') => void
  onTyping?: (isTyping: boolean) => void
  disabled?: boolean
}

const InputContainer = styled.div`
  padding: 12px 16px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: flex-end;
  gap: 8px;
`

const InputWrapper = styled.div`
  flex: 1;
  position: relative;
`

const TextArea = styled.textarea`
  width: 100%;
  min-height: 40px;
  max-height: 120px;
  padding: 10px 40px 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 15px;
  background: #f8fafc;
  resize: none;
  box-sizing: border-box;
  font-family: inherit;
  line-height: 1.5;
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

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }
`

const EmojiButton = styled.button`
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.15s ease;

  &:hover {
    background: #e5e7eb;
  }
`

const SendButton = styled.button<{ disabled?: boolean }>`
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: ${(props) => (props.disabled ? '#cbd5e1' : '#6366f1')};
  color: #ffffff;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: #4f46e5;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }
`

const EmojiPanel = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
`

const EmojiItem = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.15s ease;

  &:hover {
    background: #f1f5f9;
  }
`

function MessageInput({ onSend, onTyping, disabled = false }: MessageInputProps) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [text])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)

    if (onTyping && value.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      onTyping(true)
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false)
      }, 2000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmojiOnly = (str: string) => {
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u
    return emojiRegex.test(str.trim()) && str.trim().length <= 3
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return

    const type = isEmojiOnly(trimmed) ? 'emoji' : 'text'
    onSend(trimmed, type)
    setText('')
    setShowEmoji(false)
  }

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  return (
    <InputContainer>
      <InputWrapper>
        {showEmoji && (
          <EmojiPanel onClick={(e) => e.stopPropagation()}>
            {EMOJI_LIST.map((emoji, index) => (
              <EmojiItem key={index} onClick={() => handleEmojiClick(emoji)}>
                {emoji}
              </EmojiItem>
            ))}
          </EmojiPanel>
        )}
        <TextArea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          disabled={disabled}
        />
        <EmojiButton
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          disabled={disabled}
        >
          😊
        </EmojiButton>
      </InputWrapper>
      <SendButton
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || disabled}
      >
        ➤
      </SendButton>
    </InputContainer>
  )
}

export default MessageInput
