import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from '@emotion/styled'
import { authApi } from '../api'
import { useAuthStore } from '../store/auth'
import { validatePhone, validatePassword, validateNickname } from '../utils'

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`

const Card = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
`

const Title = styled.h1`
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  text-align: center;
`

const Subtitle = styled.p`
  margin: 0 0 32px;
  font-size: 14px;
  color: #6b7280;
  text-align: center;
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 18px;
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Label = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: #374151;
`

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 15px;
  color: #1f2937;
  background: #f9fafb;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #667eea;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`

const ErrorText = styled.span`
  font-size: 12px;
  color: #ef4444;
`

const PasswordStrength = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 4px;
`

const StrengthBar = styled.div<{ active: boolean; level: number }>`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: ${({ active, level }) =>
    active ? (level <= 1 ? '#ef4444' : level <= 2 ? '#f59e0b' : '#10b981') : '#e5e7eb'};
`

const StrengthText = styled.span`
  font-size: 12px;
  color: #6b7280;
`

const Button = styled.button<{ disabled?: boolean }>`
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const Footer = styled.div`
  margin-top: 24px;
  text-align: center;
  font-size: 14px;
  color: #6b7280;
`

const StyledLink = styled(Link)`
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;

  &:hover {
    text-decoration: underline;
  }
`

const getPasswordStrength = (password: string): { level: number; text: string } => {
  if (!password) return { level: 0, text: '' }
  let level = 0
  if (password.length >= 6) level++
  if (password.length >= 10) level++
  if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) level++
  if (/[^a-zA-Z0-9]/.test(password)) level++
  const texts = ['', '弱', '一般', '较强', '强']
  return { level, text: texts[level] }
}

function Register() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [errors, setErrors] = useState<{
    phone?: string
    password?: string
    confirmPassword?: string
    nickname?: string
    general?: string
  }>({})
  const [loading, setLoading] = useState(false)

  const strength = getPasswordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const newErrors: typeof errors = {}
    if (!validatePhone(phone)) {
      newErrors.phone = '请输入有效的手机号'
    }
    const pwdCheck = validatePassword(password)
    if (!pwdCheck.valid) {
      newErrors.password = pwdCheck.message
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }
    if (nickname && !validateNickname(nickname)) {
      newErrors.nickname = '昵称长度需要在1-20个字符之间'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const data = await authApi.register({
        phone,
        password,
        nickname: nickname || undefined
      })
      login(data.token, data.user)
      localStorage.setItem('auth_token', data.token)
      navigate('/', { replace: true })
    } catch (err) {
      setErrors({ general: '注册失败，请稍后重试' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer>
      <Card>
        <Title>创建账户</Title>
        <Subtitle>注册一个新账户开始使用</Subtitle>
        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label>手机号</Label>
            <Input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
            />
            {errors.phone && <ErrorText>{errors.phone}</ErrorText>}
          </FormGroup>
          <FormGroup>
            <Label>昵称（可选）</Label>
            <Input
              type="text"
              placeholder="请输入昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
            />
            {errors.nickname && <ErrorText>{errors.nickname}</ErrorText>}
          </FormGroup>
          <FormGroup>
            <Label>密码</Label>
            <Input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password && (
              <>
                <PasswordStrength>
                  {[1, 2, 3, 4].map((i) => (
                    <StrengthBar key={i} active={i <= strength.level} level={strength.level} />
                  ))}
                </PasswordStrength>
                <StrengthText>密码强度：{strength.text}</StrengthText>
              </>
            )}
            {errors.password && <ErrorText>{errors.password}</ErrorText>}
          </FormGroup>
          <FormGroup>
            <Label>确认密码</Label>
            <Input
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {errors.confirmPassword && <ErrorText>{errors.confirmPassword}</ErrorText>}
          </FormGroup>
          {errors.general && <ErrorText>{errors.general}</ErrorText>}
          <Button type="submit" disabled={loading}>
            {loading ? '注册中...' : '注 册'}
          </Button>
        </Form>
        <Footer>
          已有账户？
          <StyledLink to="/login">立即登录</StyledLink>
        </Footer>
      </Card>
    </PageContainer>
  )
}

export default Register
