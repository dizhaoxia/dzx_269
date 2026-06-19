import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from '@emotion/styled'
import { authApi } from '../api'
import { useAuthStore } from '../store/auth'
import { validatePhone } from '../utils'

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
  gap: 20px;
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

function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ phone?: string; password?: string; general?: string }>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const newErrors: typeof errors = {}
    if (!validatePhone(phone)) {
      newErrors.phone = '请输入有效的手机号'
    }
    if (!password) {
      newErrors.password = '请输入密码'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const data = await authApi.login({ phone, password })
      login(data.token, data.user)
      localStorage.setItem('auth_token', data.token)
      navigate('/', { replace: true })
    } catch (err) {
      setErrors({ general: '登录失败，请检查手机号和密码' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer>
      <Card>
        <Title>欢迎回来</Title>
        <Subtitle>登录您的账户开始聊天</Subtitle>
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
            <Label>密码</Label>
            <Input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <ErrorText>{errors.password}</ErrorText>}
          </FormGroup>
          {errors.general && <ErrorText>{errors.general}</ErrorText>}
          <Button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </Button>
        </Form>
        <Footer>
          还没有账户？
          <StyledLink to="/register">立即注册</StyledLink>
        </Footer>
      </Card>
    </PageContainer>
  )
}

export default Login
