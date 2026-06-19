use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[sqlx(type_name = "message_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    Text,
    Image,
    Voice,
    Video,
    File,
    System,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[sqlx(type_name = "delivery_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryStatus {
    Sent,
    Delivered,
    Read,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub ciphertext: String,
    pub message_type: MessageType,
    pub timestamp: DateTime<Utc>,
    pub delivery_status: DeliveryStatus,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateMessage {
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub ciphertext: String,
    pub message_type: MessageType,
}
