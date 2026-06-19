use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::{DeliveryStatus, MessageType};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WebSocketMessage {
    SendMessage {
        conversation_id: Uuid,
        receiver_id: Uuid,
        ciphertext: String,
        message_type: MessageType,
    },
    MessageReceipt {
        message_id: Uuid,
        status: DeliveryStatus,
    },
    Typing {
        conversation_id: Uuid,
        is_typing: bool,
    },
    Presence {
        user_id: Uuid,
        is_online: bool,
        last_seen: Option<DateTime<Utc>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomingMessage {
    #[serde(flatten)]
    pub message: WebSocketMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OutgoingMessage {
    NewMessage {
        message_id: Uuid,
        conversation_id: Uuid,
        sender_id: Uuid,
        ciphertext: String,
        message_type: MessageType,
        timestamp: DateTime<Utc>,
    },
    MessageSent {
        message_id: Uuid,
        conversation_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    MessageStatus {
        message_id: Uuid,
        status: DeliveryStatus,
    },
    Typing {
        user_id: Uuid,
        conversation_id: Uuid,
        is_typing: bool,
    },
    Presence {
        user_id: Uuid,
        is_online: bool,
        last_seen: Option<DateTime<Utc>>,
    },
    Error {
        error: String,
    },
}
