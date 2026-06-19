use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use chrono::Utc;
use futures::{stream::SplitStream, StreamExt};
use serde_json;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::AppState;
use crate::models::{ConversationType, DeliveryStatus, MessageType};
use crate::services::auth::Claims;
use crate::services::message::{save_message, update_message_status};
use crate::ws::connection::ConnectionManager;
use crate::ws::message::{IncomingMessage, OutgoingMessage, WebSocketMessage};

pub async fn ws_handler(
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
    claims: Claims,
) -> impl IntoResponse {
    let cm = state.connection_manager.clone();
    let user_id = claims.user_id;

    ws.on_upgrade(move |socket| handle_socket(socket, user_id, cm, state))
}

async fn handle_socket(socket: WebSocket, user_id: Uuid, cm: ConnectionManager, state: AppState) {
    let (sender, receiver) = socket.split();

    cm.add_connection(user_id, sender).await;
    cm.set_online(user_id, true).await;
    info!("User {} connected", user_id);

    let recv_task = tokio::spawn(handle_receiver(
        receiver,
        user_id,
        cm.clone(),
        state.clone(),
    ));

    recv_task.await.ok();

    cm.remove_connection(user_id).await;
    cm.set_online(user_id, false).await;
    update_last_seen(&state.db.pg, user_id).await;
    info!("User {} disconnected", user_id);
}

async fn handle_receiver(
    mut receiver: SplitStream<WebSocket>,
    user_id: Uuid,
    cm: ConnectionManager,
    state: AppState,
) {
    while let Some(msg_result) = receiver.next().await {
        let msg = match msg_result {
            Ok(msg) => msg,
            Err(e) => {
                warn!("WebSocket receive error for user {}: {}", user_id, e);
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                let incoming: Result<IncomingMessage, _> = serde_json::from_str(&text);
                match incoming {
                    Ok(incoming) => {
                        handle_incoming_message(incoming.message, user_id, &cm, &state).await;
                    }
                    Err(e) => {
                        warn!("Invalid message from user {}: {}", user_id, e);
                        let err_msg = OutgoingMessage::Error {
                            error: format!("Invalid message: {}", e),
                        };
                        let _ = cm.send_to_user(user_id, err_msg).await;
                    }
                }
            }
            Message::Binary(_) => {
                warn!("Binary messages not supported");
            }
            Message::Close(_) => {
                info!("User {} sent close frame", user_id);
                break;
            }
            Message::Ping(_) | Message::Pong(_) => {}
        }
    }
}

async fn handle_incoming_message(
    msg: WebSocketMessage,
    user_id: Uuid,
    cm: &ConnectionManager,
    state: &AppState,
) {
    match msg {
        WebSocketMessage::SendMessage {
            conversation_id,
            receiver_id,
            ciphertext,
            message_type,
        } => {
            handle_send_message(
                user_id,
                conversation_id,
                receiver_id,
                ciphertext,
                message_type,
                cm,
                state,
            )
            .await;
        }
        WebSocketMessage::MessageReceipt { message_id, status } => {
            handle_message_receipt(user_id, message_id, status, cm, state).await;
        }
        WebSocketMessage::Typing {
            conversation_id,
            is_typing,
        } => {
            handle_typing(user_id, conversation_id, is_typing, cm, state).await;
        }
        WebSocketMessage::Presence { user_id: _, .. } => {}
    }
}

async fn handle_send_message(
    sender_id: Uuid,
    conversation_id: Uuid,
    receiver_id: Uuid,
    ciphertext: String,
    message_type: MessageType,
    cm: &ConnectionManager,
    state: &AppState,
) {
    match save_message(
        &state.db.pg,
        conversation_id,
        sender_id,
        Some(receiver_id),
        None,
        &ciphertext,
        message_type,
    )
    .await
    {
        Ok(message) => {
            let sent_confirm = OutgoingMessage::MessageSent {
                message_id: message.id,
                conversation_id,
                timestamp: message.timestamp,
            };
            let _ = cm.send_to_user(sender_id, sent_confirm).await;

            let new_msg = OutgoingMessage::NewMessage {
                message_id: message.id,
                conversation_id,
                sender_id,
                ciphertext,
                message_type,
                timestamp: message.timestamp,
            };

            let conv: Option<(ConversationType,)> = sqlx::query_as(
                "SELECT conversation_type FROM conversations WHERE id = $1",
            )
            .bind(conversation_id)
            .fetch_optional(&state.db.pg)
            .await
            .ok()
            .flatten();

            if let Some((conv_type,)) = conv {
                match conv_type {
                    ConversationType::Direct => {
                        let _ = cm.send_to_user(receiver_id, new_msg).await;
                    }
                    ConversationType::Group => {
                        if let Some(group_id) = get_group_id_by_conversation(&state.db.pg, conversation_id).await {
                            cm.broadcast_to_group(group_id, sender_id, new_msg, &state.db.pg)
                                .await;
                        }
                    }
                }
            }
        }
        Err(e) => {
            error!("Failed to save message: {}", e);
            let err_msg = OutgoingMessage::Error {
                error: format!("Failed to save message: {}", e),
            };
            let _ = cm.send_to_user(sender_id, err_msg).await;
        }
    }
}

async fn handle_message_receipt(
    user_id: Uuid,
    message_id: Uuid,
    status: DeliveryStatus,
    cm: &ConnectionManager,
    state: &AppState,
) {
    if let Err(e) = update_message_status(&state.db.pg, message_id, status).await {
        error!("Failed to update message status: {}", e);
        return;
    }

    let sender_id: Option<Uuid> = sqlx::query_scalar("SELECT sender_id FROM messages WHERE id = $1")
        .bind(message_id)
        .fetch_optional(&state.db.pg)
        .await
        .ok()
        .flatten();

    if let Some(sid) = sender_id {
        let receipt = OutgoingMessage::MessageStatus { message_id, status };
        let _ = cm.send_to_user(sid, receipt).await;
    }

    if matches!(status, DeliveryStatus::Read | DeliveryStatus::Delivered) {
        let _ = user_id;
    }
}

async fn handle_typing(
    user_id: Uuid,
    conversation_id: Uuid,
    is_typing: bool,
    cm: &ConnectionManager,
    state: &AppState,
) {
    let typing_msg = OutgoingMessage::Typing {
        user_id,
        conversation_id,
        is_typing,
    };

    let conv: Option<(ConversationType,)> = sqlx::query_as(
        "SELECT conversation_type FROM conversations WHERE id = $1",
    )
    .bind(conversation_id)
    .fetch_optional(&state.db.pg)
    .await
    .ok()
    .flatten();

    if let Some((conv_type,)) = conv {
        match conv_type {
            ConversationType::Direct => {
                let other_user: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
                    "SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2 LIMIT 1",
                )
                .bind(conversation_id)
                .bind(user_id)
                .fetch_optional(&state.db.pg)
                .await
                .ok()
                .flatten();

                if let Some(other_id) = other_user {
                    let _ = cm.send_to_user(other_id, typing_msg).await;
                }
            }
            ConversationType::Group => {
                if let Some(group_id) = get_group_id_by_conversation(&state.db.pg, conversation_id).await {
                    cm.broadcast_to_group(group_id, user_id, typing_msg, &state.db.pg)
                        .await;
                }
            }
        }
    }
}

async fn get_group_id_by_conversation(pool: &sqlx::PgPool, conversation_id: Uuid) -> Option<Uuid> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM groups WHERE conversation_id = $1")
        .bind(conversation_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

async fn update_last_seen(pool: &sqlx::PgPool, user_id: Uuid) {
    let now = Utc::now();
    let result = sqlx::query(
        "UPDATE users SET updated_at = $1 WHERE id = $2",
    )
    .bind(now)
    .bind(user_id)
    .execute(pool)
    .await;

    if let Err(e) = result {
        error!("Failed to update last_seen for user {}: {}", user_id, e);
    }
}
