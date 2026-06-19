import { Routes, Route, Navigate } from 'react-router-dom'
import styled from '@emotion/styled'
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'
import { useAuthStore } from './store/auth'

const AppContainer = styled.div`
  min-height: 100vh;
  width: 100%;
`

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <AppContainer>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppContainer>
  )
}

export default App
