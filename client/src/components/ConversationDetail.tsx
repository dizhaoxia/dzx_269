import styled from '@emotion/styled'
import type { User, Conversation } from '../types'

interface GroupMember extends User {
  role?: 'owner' | 'admin' | 'member'
}

interface ConversationDetailProps {
  conversation: Conversation & {
    targetUser?: User
    targetUserOnline?: boolean
    groupMembers?: GroupMember[]
    isEncrypted?: boolean
  } | null
  onStartEncrypted?: () => void
  onInviteMember?: () => void
  onLeaveGroup?: () => void
  currentUserId: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const DetailContainer = styled.div<{ isCollapsed: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  overflow: hidden;
  width: ${(props) => (props.isCollapsed ? '0' : '320px')};
  min-width: ${(props) => (props.isCollapsed ? '0' : '280px')};
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    width: ${(props) => (props.isCollapsed ? '0' : '100%')};
    min-width: ${(props) => (props.isCollapsed ? '0' : '100%')};
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 20;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
  }
`

const CollapseButton = styled.button`
  position: absolute;
  left: -32px;
  top: 16px;
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-right: none;
  background: #ffffff;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #6b7280;
  z-index: 10;

  &:hover {
    background: #f8fafc;
    color: #6366f1;
  }

  @media (max-width: 768px) {
    display: none;
  }
`

const DetailContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
`

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
  padding: 20px;
`

const AvatarSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
`

const LargeAvatar = styled.div<{ type: 'direct' | 'group' }>`
  width: 80px;
  height: 80px;
  border-radius: ${(props) => (props.type === 'group' ? '20px' : '50%')};
  background: ${(props) =>
    props.type === 'group'
      ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 28px;
  margin-bottom: 12px;
  position: relative;
`

const OnlineBadge = styled.span`
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 16px;
  height: 16px;
  background: #22c55e;
  border: 3px solid #ffffff;
  border-radius: 50%;
`

const DisplayName = styled.h2`
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
`

const SubText = styled.p`
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
`

const InfoSection = styled.div`
  margin-bottom: 20px;
`

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
`

const InfoLabel = styled.span`
  font-size: 14px;
  color: #6b7280;
`

const InfoValue = styled.span`
  font-size: 14px;
  color: #1f2937;
`

const OnlineStatus = styled.span<{ online: boolean }>`
  font-size: 13px;
  color: ${(props) => (props.online ? '#22c55e' : '#9ca3af')};
`

const ActionButton = styled.button<{ variant?: 'primary' | 'danger' | 'default' }>`
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  background: ${(props) => {
    switch (props.variant) {
      case 'primary':
        return '#6366f1'
      case 'danger':
        return '#fef2f2'
      case 'default':
      default:
        return '#f1f5f9'
    }
  }};

  color: ${(props) => {
    switch (props.variant) {
      case 'primary':
        return '#ffffff'
      case 'danger':
        return '#ef4444'
      case 'default':
      default:
        return '#1f2937'
    }
  }};

  &:hover {
    background: ${(props) => {
      switch (props.variant) {
        case 'primary':
          return '#4f46e5'
        case 'danger':
          return '#fee2e2'
        case 'default':
        default:
          return '#e2e8f0'
      }
    }};
  }
`

const SectionTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const MemberList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const MemberItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 8px;
  transition: background 0.15s ease;

  &:hover {
    background: #f8fafc;
  }
`

const MemberAvatar = styled.div`
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

const MemberInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const MemberName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const MemberRole = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #eef2ff;
  color: #6366f1;
  font-weight: 500;
`

function ConversationDetail({
  conversation,
  onStartEncrypted,
  onInviteMember,
  onLeaveGroup,
  currentUserId,
  isCollapsed = false,
  onToggleCollapse
}: ConversationDetailProps) {
  if (!conversation) {
    return (
      <DetailContainer isCollapsed={isCollapsed}>
        {onToggleCollapse && (
          <CollapseButton onClick={onToggleCollapse}>
            {isCollapsed ? '◀' : '▶'}
          </CollapseButton>
        )}
        <DetailContent>
          <EmptyState>选择一个会话查看详情</EmptyState>
        </DetailContent>
      </DetailContainer>
    )
  }

  const isGroup = conversation.type === 'group'
  const displayName = isGroup ? conversation.name : conversation.targetUser?.nickname
  const initial = displayName?.charAt(0)?.toUpperCase() || '?'

  if (isGroup) {
    const members = conversation.groupMembers || []
    const isOwner = members.find((m) => m.id === currentUserId)?.role === 'owner'

    return (
      <DetailContainer isCollapsed={isCollapsed}>
        {onToggleCollapse && (
          <CollapseButton onClick={onToggleCollapse}>
            {isCollapsed ? '◀' : '▶'}
          </CollapseButton>
        )}
        <DetailContent>
          <AvatarSection>
            <LargeAvatar type="group">{initial}</LargeAvatar>
            <DisplayName>{displayName}</DisplayName>
            <SubText>{members.length} 位成员</SubText>
          </AvatarSection>

          <InfoSection>
            <SectionTitle>操作</SectionTitle>
            <ActionButton variant="default" onClick={onInviteMember}>
              <span>➕</span> 邀请成员
            </ActionButton>
            {!isOwner && (
              <ActionButton variant="danger" onClick={onLeaveGroup}>
                <span>🚪</span> 退出群组
              </ActionButton>
            )}
          </InfoSection>

          <InfoSection>
            <SectionTitle>群成员</SectionTitle>
            <MemberList>
              {members.map((member) => (
                <MemberItem key={member.id}>
                  <MemberAvatar>{member.nickname?.charAt(0) || '?'}</MemberAvatar>
                  <MemberInfo>
                    <MemberName>{member.nickname}</MemberName>
                  </MemberInfo>
                  {member.role && member.role !== 'member' && (
                    <MemberRole>{member.role === 'owner' ? '群主' : '管理员'}</MemberRole>
                  )}
                </MemberItem>
              ))}
            </MemberList>
          </InfoSection>
        </DetailContent>
      </DetailContainer>
    )
  }

  const targetUser = conversation.targetUser
  const isOnline = conversation.targetUserOnline

  return (
    <DetailContainer isCollapsed={isCollapsed}>
      {onToggleCollapse && (
        <CollapseButton onClick={onToggleCollapse}>
          {isCollapsed ? '◀' : '▶'}
        </CollapseButton>
      )}
      <DetailContent>
        <AvatarSection>
          <LargeAvatar type="direct">
            {initial}
            {isOnline && <OnlineBadge />}
          </LargeAvatar>
          <DisplayName>{targetUser?.nickname}</DisplayName>
          <OnlineStatus online={!!isOnline}>
            {isOnline ? '在线' : '离线'}
          </OnlineStatus>
        </AvatarSection>

        <InfoSection>
          <InfoRow>
            <InfoLabel>手机号</InfoLabel>
            <InfoValue>{targetUser?.phone}</InfoValue>
          </InfoRow>
        </InfoSection>

        <InfoSection>
          <SectionTitle>操作</SectionTitle>
          {!conversation.isEncrypted && (
            <ActionButton variant="primary" onClick={onStartEncrypted}>
              <span>🔐</span> 开始加密会话
            </ActionButton>
          )}
          {conversation.isEncrypted && (
            <InfoRow>
              <InfoLabel>🔐 端到端加密</InfoLabel>
              <InfoValue style={{ color: '#22c55e' }}>已启用</InfoValue>
            </InfoRow>
          )}
        </InfoSection>
      </DetailContent>
    </DetailContainer>
  )
}

export default ConversationDetail
