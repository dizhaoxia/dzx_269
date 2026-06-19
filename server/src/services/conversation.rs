use anyhow::{Context, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Conversation, ConversationType};

pub async fn get_or_create_direct(
    pool: &PgPool,
    user_a_id: Uuid,
    user_b_id: Uuid,
) -> Result<Conversation> {
    let existing = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.id, c.conversation_type, c.last_message_id, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_members cm1 ON c.id = cm1.conversation_id
        JOIN conversation_members cm2 ON c.id = cm2.conversation_id
        WHERE c.conversation_type = 'direct'
          AND cm1.user_id = $1
          AND cm2.user_id = $2
        LIMIT 1
        "#,
    )
    .bind(user_a_id)
    .bind(user_b_id)
    .fetch_optional(pool)
    .await
    .context("Failed to check existing direct conversation")?;

    if let Some(conv) = existing {
        return Ok(conv);
    }

    let mut tx = pool.begin().await.context("Failed to begin transaction")?;

    let conv = sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (conversation_type)
        VALUES ('direct')
        RETURNING id, conversation_type, last_message_id, created_at, updated_at
        "#,
    )
    .fetch_one(&mut *tx)
    .await
    .context("Failed to create direct conversation")?;

    sqlx::query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)",
    )
    .bind(conv.id)
    .bind(user_a_id)
    .execute(&mut *tx)
    .await
    .context("Failed to add user_a to conversation members")?;

    sqlx::query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)",
    )
    .bind(conv.id)
    .bind(user_b_id)
    .execute(&mut *tx)
    .await
    .context("Failed to add user_b to conversation members")?;

    tx.commit().await.context("Failed to commit transaction")?;

    Ok(conv)
}

pub async fn get_user_conversations(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Conversation>> {
    let conversations = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.id, c.conversation_type, c.last_message_id, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        WHERE cm.user_id = $1
        ORDER BY c.updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .context("Failed to fetch user conversations")?;

    Ok(conversations)
}

pub async fn create_conversation(
    pool: &PgPool,
    conv_type: ConversationType,
    name: Option<&str>,
) -> Result<Conversation> {
    let conv = sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (conversation_type)
        VALUES ($1)
        RETURNING id, conversation_type, last_message_id, created_at, updated_at
        "#,
    )
    .bind(conv_type)
    .fetch_one(pool)
    .await
    .context("Failed to create conversation")?;

    if let Some(_name) = name {
        // Name would be used for group conversations stored in groups table
        // This function just creates the base conversation
    }

    Ok(conv)
}
