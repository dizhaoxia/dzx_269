use anyhow::{Context, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{DeliveryStatus, Message, MessageType};

pub async fn save_message(
    pool: &PgPool,
    conversation_id: Uuid,
    sender_id: Uuid,
    receiver_id: Option<Uuid>,
    group_id: Option<Uuid>,
    ciphertext: &str,
    message_type: MessageType,
) -> Result<Message> {
    let message = sqlx::query_as::<_, Message>(
        r#"
        INSERT INTO messages (conversation_id, sender_id, receiver_id, group_id, ciphertext, message_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, conversation_id, sender_id, receiver_id, group_id, ciphertext, message_type, timestamp, delivery_status
        "#,
    )
    .bind(conversation_id)
    .bind(sender_id)
    .bind(receiver_id)
    .bind(group_id)
    .bind(ciphertext)
    .bind(message_type)
    .fetch_one(pool)
    .await
    .context("Failed to save message")?;

    sqlx::query(
        "UPDATE conversations SET last_message_id = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(message.id)
    .bind(conversation_id)
    .execute(pool)
    .await
    .context("Failed to update conversation last_message_id")?;

    Ok(message)
}

pub async fn update_message_status(
    pool: &PgPool,
    message_id: Uuid,
    status: DeliveryStatus,
) -> Result<()> {
    sqlx::query(
        "UPDATE messages SET delivery_status = $1 WHERE id = $2",
    )
    .bind(status)
    .bind(message_id)
    .execute(pool)
    .await
    .context("Failed to update message status")?;

    Ok(())
}

pub async fn get_conversation_messages(
    pool: &PgPool,
    conversation_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<Message>> {
    let messages = sqlx::query_as::<_, Message>(
        r#"
        SELECT id, conversation_id, sender_id, receiver_id, group_id, ciphertext, message_type, timestamp, delivery_status
        FROM messages
        WHERE conversation_id = $1
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(conversation_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .context("Failed to fetch conversation messages")?;

    Ok(messages.into_iter().rev().collect())
}

pub async fn mark_as_read(
    pool: &PgPool,
    conversation_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE messages
        SET delivery_status = 'read'
        WHERE conversation_id = $1
          AND sender_id != $2
          AND delivery_status != 'read'
        "#,
    )
    .bind(conversation_id)
    .bind(user_id)
    .execute(pool)
    .await
    .context("Failed to mark messages as read")?;

    Ok(())
}
