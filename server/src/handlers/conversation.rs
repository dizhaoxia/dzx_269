use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use crate::models::{Conversation, Message, MessageType};
use crate::services::auth::Claims;
use crate::services::conversation as conversation_service;
use crate::services::message as message_service;

#[derive(Debug, Deserialize)]
pub struct CreateDirectConversationPayload {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct SendMessagePayload {
    pub conversation_id: Uuid,
    pub receiver_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub ciphertext: String,
    pub message_type: MessageType,
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ConversationResponse {
    pub id: Uuid,
    pub conversation_type: String,
    pub last_message_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Conversation> for ConversationResponse {
    fn from(conv: Conversation) -> Self {
        Self {
            id: conv.id,
            conversation_type: match conv.conversation_type {
                crate::models::ConversationType::Direct => "direct".to_string(),
                crate::models::ConversationType::Group => "group".to_string(),
            },
            last_message_id: conv.last_message_id,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub ciphertext: String,
    pub message_type: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub delivery_status: String,
}

impl From<Message> for MessageResponse {
    fn from(msg: Message) -> Self {
        Self {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            receiver_id: msg.receiver_id,
            group_id: msg.group_id,
            ciphertext: msg.ciphertext,
            message_type: match msg.message_type {
                MessageType::Text => "text".to_string(),
                MessageType::Image => "image".to_string(),
                MessageType::Voice => "voice".to_string(),
                MessageType::Video => "video".to_string(),
                MessageType::File => "file".to_string(),
                MessageType::System => "system".to_string(),
            },
            timestamp: msg.timestamp,
            delivery_status: match msg.delivery_status {
                crate::models::DeliveryStatus::Sent => "sent".to_string(),
                crate::models::DeliveryStatus::Delivered => "delivered".to_string(),
                crate::models::DeliveryStatus::Read => "read".to_string(),
                crate::models::DeliveryStatus::Failed => "failed".to_string(),
            },
        }
    }
}

fn error_response(status: StatusCode, message: &str) -> impl IntoResponse {
    (
        status,
        Json(json!({ "error": message })),
    )
}

pub async fn list_conversations_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> impl IntoResponse {
    match conversation_service::get_user_conversations(&state.db.pg, claims.user_id).await {
        Ok(conversations) => {
            let conv_resp: Vec<ConversationResponse> = conversations
                .into_iter()
                .map(ConversationResponse::from)
                .collect();
            (StatusCode::OK, Json(json!({ "conversations": conv_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to list conversations: {}", e),
        )
        .into_response(),
    }
}

pub async fn create_direct_conversation_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateDirectConversationPayload>,
) -> impl IntoResponse {
    if claims.user_id == payload.user_id {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Cannot create conversation with yourself",
        )
        .into_response();
    }
    match conversation_service::get_or_create_direct(
        &state.db.pg,
        claims.user_id,
        payload.user_id,
    )
    .await
    {
        Ok(conversation) => {
            let conv_resp: ConversationResponse = conversation.into();
            (StatusCode::CREATED, Json(json!({ "conversation": conv_resp }))).into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("Cannot create conversation with yourself") {
                error_response(StatusCode::BAD_REQUEST, &msg).into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Failed to create conversation: {}", e),
                )
                .into_response()
            }
        }
    }
}

pub async fn get_messages_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(conversation_id): Path<Uuid>,
    Query(query): Query<GetMessagesQuery>,
) -> impl IntoResponse {
    let is_member = match conversation_service::get_user_conversations(&state.db.pg, claims.user_id)
        .await
    {
        Ok(convs) => convs.iter().any(|c| c.id == conversation_id),
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Failed to check membership: {}", e),
            )
            .into_response();
        }
    };

    if !is_member {
        return error_response(StatusCode::FORBIDDEN, "Not a member of this conversation")
            .into_response();
    }

    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    match message_service::get_conversation_messages(&state.db.pg, conversation_id, limit, offset).await {
        Ok(messages) => {
            let msg_resp: Vec<MessageResponse> = messages
                .into_iter()
                .map(MessageResponse::from)
                .collect();
            (StatusCode::OK, Json(json!({ "messages": msg_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to get messages: {}", e),
        )
        .into_response(),
    }
}

pub async fn send_message_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<SendMessagePayload>,
) -> impl IntoResponse {
    if payload.ciphertext.is_empty() {
        return error_response(StatusCode::BAD_REQUEST, "Ciphertext is required").into_response();
    }

    match message_service::save_message(
        &state.db.pg,
        payload.conversation_id,
        claims.user_id,
        payload.receiver_id,
        payload.group_id,
        &payload.ciphertext,
        payload.message_type,
    )
    .await
    {
        Ok(message) => {
            let msg_resp: MessageResponse = message.into();
            (StatusCode::CREATED, Json(json!({ "message": msg_resp }))).into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("not a member") {
                error_response(StatusCode::FORBIDDEN, &msg).into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Failed to send message: {}", e),
                )
                .into_response()
            }
        }
    }
}

pub async fn mark_read_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(conversation_id): Path<Uuid>,
) -> impl IntoResponse {
    match message_service::mark_as_read(&state.db.pg, conversation_id, claims.user_id).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("not a member") {
                error_response(StatusCode::FORBIDDEN, &msg).into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Failed to mark as read: {}", e),
                )
                .into_response()
            }
        }
    }
}
