use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[sqlx(type_name = "conversation_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConversationType {
    Direct,
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub conversation_type: ConversationType,
    pub last_message_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateConversation {
    pub conversation_type: ConversationType,
}
