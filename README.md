# E2EE IM - 端到端加密即时通讯系统

一个基于 Signal 协议（双棘轮算法）实现的端到端加密即时通讯系统，支持单聊、群聊、消息送达回执、前向保密等特性。

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (Client)                        │
│  React 19 + TypeScript + Vite + Emotion + Zustand           │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐    │
│  │ 聊天界面UI │  │ WebSocket  │  │ Signal 加密层(双棘轮) │    │
│  └────────────┘  └────────────┘  └─────────────────────┘    │
│         │              │                    │                │
│         └──────────────┼────────────────────┘                │
│                        ▼                                     │
│              ┌───────────────────┐                           │
│              │ IndexedDB / SQLite│ (本地消息加密存储)         │
│              └───────────────────┘                           │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / WSS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        后端 (Server)                         │
│              Rust + Axum + tokio-tungstenite                 │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐    │
│  │  REST API  │  │ WebSocket  │  │  Signal 密钥服务     │    │
│  └────────────┘  └────────────┘  └─────────────────────┘    │
│         │              │                    │                │
│         └──────────────┼────────────────────┘                │
│                        ▼                                     │
│         ┌──────────────┐         ┌──────────────┐            │
│         │ PostgreSQL   │         │    Redis     │            │
│         │ (关系数据)    │         │ (在线状态缓存) │            │
│         └──────────────┘         └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## 核心功能

### 🔐 安全特性
- **本地非对称密钥对生成**：身份密钥、签名预密钥、一次性预密钥均在客户端本地生成
- **私钥永不上传**：服务端仅存储公钥，客户端私钥加密保存于本地
- **Signal 协议（双棘轮算法）**：
  - X3DH 初始密钥协商
  - 双棘轮（DH 棘轮 + 对称密钥棘轮）提供前向保密
  - 每条消息使用独立密钥，即使密钥泄露也无法解密历史消息
  - HKDF 密钥派生，符合 Signal 协议规范
- **AES-GCM 256 加密**：Authenticated Encryption，保证机密性与完整性
- **本地消息库加密存储**：客户端消息持久化于 IndexedDB（接口兼容 wa-sqlite）

### 👤 用户系统
- 手机号 + 密码注册/登录
- JWT 身份认证
- 用户搜索

### 💬 即时通讯
- **单聊**：一对一加密会话
- **群聊**：创建群组、邀请成员、退出群组、全员推送
- **消息类型**：文本、Emoji
- **消息送达回执**：Sent → Delivered → Read 三态确认
- **实时推送**：WebSocket 长连接，消息即时送达
- **在线状态**：Redis 缓存用户在线状态
- **正在输入**：实时 Typing 提示

## 目录结构

```
dzx_269/
├── docker-compose.yml          # PostgreSQL + Redis 编排
├── server/                     # 后端 (Rust)
│   ├── Cargo.toml
│   ├── .env
│   ├── migrations/
│   │   └── 001_init.sql       # 数据库 DDL
│   └── src/
│       ├── main.rs             # 服务入口
│       ├── config/mod.rs       # 配置
│       ├── db/mod.rs           # 数据库连接池 (Pg + Redis)
│       ├── models/             # 数据模型
│       │   ├── user.rs
│       │   ├── message.rs
│       │   ├── conversation.rs
│       │   ├── group.rs
│       │   └── key.rs
│       ├── services/           # 业务服务层
│       │   ├── auth.rs         # JWT + 密码哈希
│       │   ├── user.rs
│       │   ├── key.rs          # Signal 密钥管理
│       │   ├── message.rs
│       │   ├── conversation.rs
│       │   └── group.rs
│       ├── handlers/           # HTTP 处理器
│       │   ├── auth.rs
│       │   ├── key.rs
│       │   ├── conversation.rs
│       │   └── group.rs
│       └── ws/                 # WebSocket 模块
│           ├── message.rs
│           ├── connection.rs   # 连接管理器
│           └── handler.rs
└── client/                     # 前端 (React)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/index.ts        # Axios API 客户端
        ├── pages/              # 页面
        │   ├── Login.tsx
        │   ├── Register.tsx
        │   └── Chat.tsx
        ├── components/         # UI 组件
        │   ├── Sidebar.tsx
        │   ├── MessageList.tsx
        │   ├── MessageInput.tsx
        │   ├── ConversationDetail.tsx
        │   ├── SearchUserModal.tsx
        │   └── CreateGroupModal.tsx
        ├── store/              # Zustand 状态管理
        │   ├── auth.ts
        │   └── chat.ts
        ├── hooks/              # 自定义 Hooks
        │   ├── useWebSocket.ts
        │   └── useChat.ts
        ├── crypto/             # Signal 加密层
        │   ├── types.ts
        │   ├── utils.ts
        │   └── signal.ts       # 双棘轮算法实现
        ├── db/                 # 本地持久化
        │   ├── schema.ts
        │   └── database.ts     # IndexedDB 封装
        ├── types/              # TS 类型定义
        └── utils/              # 工具函数
```

## 快速启动

### 前置依赖

- **Rust** ≥ 1.75 (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Node.js** ≥ 18
- **Docker** & **Docker Compose**（用于 PostgreSQL 和 Redis）
- **sqlx-cli**（用于数据库迁移）: `cargo install sqlx-cli --no-default-features --features native-tls,postgres`

### 1. 启动基础设施

```bash
# 在项目根目录
docker-compose up -d
```

启动后：
- PostgreSQL: `localhost:5432` (user: e2ee_im, password: e2ee_im_secret, db: e2ee_im)
- Redis: `localhost:6379`

### 2. 运行数据库迁移

```bash
cd server
sqlx migrate run
```

### 3. 启动后端服务

```bash
cd server
cargo run
```

服务默认运行在 `http://localhost:8080`

### 4. 启动前端开发服务器

```bash
cd client
npm install
npm run dev
```

前端默认运行在 `http://localhost:3000`

## API 文档

### 认证 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册账号 | ❌ |
| POST | `/api/auth/login` | 登录获取 Token | ❌ |
| GET | `/api/auth/me` | 获取当前用户信息 | ✅ |

**注册请求体：**
```json
{
  "phone": "13800138000",
  "password": "password123",
  "nickname": "Alice"
}
```

**登录响应：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "phone": "13800138000",
    "nickname": "Alice",
    "avatar": "",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Signal 密钥 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/keys/upload` | 上传密钥包（公钥） | ✅ |
| GET | `/api/keys/bundle/:user_id` | 获取用户密钥包（建立会话用） | ✅ |
| GET | `/api/keys/pre-key-count` | 获取剩余预密钥数量 | ✅ |

**上传密钥包：**
```json
{
  "identity_key": "base64_identity_public_key",
  "signed_pre_key": {
    "key_id": 1,
    "public_key": "base64_spk_public_key",
    "signature": "base64_signature"
  },
  "pre_keys": [
    { "key_id": 1, "public_key": "base64_opk_public_key" }
  ]
}
```

### 会话与消息 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/conversations` | 获取我的会话列表 | ✅ |
| POST | `/api/conversations/direct` | 创建/获取单聊会话 | ✅ |
| GET | `/api/conversations/:id/messages` | 获取会话消息（分页） | ✅ |
| POST | `/api/messages` | 发送消息（HTTP 方式） | ✅ |
| POST | `/api/conversations/:id/read` | 标记会话已读 | ✅ |

### 群组 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/groups` | 获取我加入的群组 | ✅ |
| POST | `/api/groups` | 创建群组 | ✅ |
| GET | `/api/groups/:id` | 获取群组信息 | ✅ |
| GET | `/api/groups/:id/members` | 获取群成员列表 | ✅ |
| POST | `/api/groups/:id/invite` | 邀请成员 | ✅ |
| POST | `/api/groups/:id/leave` | 退出群组 | ✅ |

## WebSocket 协议

连接地址：`ws://localhost:8080/ws?token=<jwt_token>`

### 客户端 → 服务端消息

**发送消息：**
```json
{
  "type": "send_message",
  "conversation_id": "uuid",
  "receiver_id": "uuid",
  "ciphertext": "base64_encrypted_message",
  "message_type": "text"
}
```

**消息回执：**
```json
{
  "type": "message_receipt",
  "message_id": "uuid",
  "status": "delivered"
}
```

**输入状态：**
```json
{
  "type": "typing",
  "conversation_id": "uuid",
  "is_typing": true
}
```

### 服务端 → 客户端消息

**接收新消息：**
```json
{
  "type": "receive_message",
  "id": "uuid",
  "conversation_id": "uuid",
  "sender_id": "uuid",
  "ciphertext": "base64_encrypted_message",
  "message_type": "text",
  "timestamp": 1704067200000
}
```

**消息状态变更：**
```json
{
  "type": "message_delivered",
  "message_id": "uuid"
}
```

## 加密协议详解

### X3DH 密钥协商

建立新会话时，发起方通过以下步骤计算共享密钥：

1. 获取接收方的密钥包（IdentityKey + SignedPreKey + OneTimePreKey）
2. 生成临时 EphemeralKey
3. 执行 3~4 次 ECDH 密钥交换：
   - `DH(IK_A, SPK_B)`
   - `DH(EK_A, IK_B)`
   - `DH(EK_A, SPK_B)`
   - `DH(EK_A, OPK_B)`（若有一次性预密钥）
4. 使用 HKDF 从组合密钥派生初始 Root Key

### 双棘轮算法

每次发送消息时执行对称棘轮：
1. 使用当前 Chain Key + Counter 派生 Message Key
2. Chain Key = HMAC(Chain Key, "chain")
3. Counter += 1

收到带有新 EphemeralKey 的消息时执行 DH 棘轮：
1. 使用新的对方 EphemeralKey 与我方 IdentityKey 计算新的 DH 共享密钥
2. 使用 HKDF(RootKey, DHSharedSecret) 派生新的 Root Key 和接收 Chain Key
3. 重置接收 Chain Counter

### 消息加密

```
MessageKey = HKDF(ChainKey, Counter)[:32]
AES-GCM-256(MessageKey, Plaintext) → (Ciphertext, IV, Tag)
```

## 安全说明

- **私钥安全**：所有私钥仅存储于客户端本地 IndexedDB，服务端不接触任何私钥
- **前向保密**：双棘轮算法确保每条消息使用独立密钥，即使长期密钥泄露，历史消息仍安全
- **消息完整性**：AES-GCM 提供认证加密，篡改密文会被检测
- **MITM 防护**：生产环境建议增加指纹验证（Safety Number）机制

## 开发说明

### 后端

- 代码风格遵循 Rust 2021 Edition 规范
- 使用 `anyhow` 做错误处理，HTTP 层统一返回 JSON 错误
- 数据库操作使用 `sqlx` 编译时检查宏
- 日志使用 `tracing`，通过 `RUST_LOG` 环境变量控制级别

### 前端

- React 19 + TypeScript 严格模式
- 状态管理使用 Zustand
- 样式使用 Emotion CSS-in-JS
- WebSocket 具备自动重连、消息队列、心跳保活机制

## License

MIT
