use anyhow::{Result, Context, anyhow};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Group, GroupMember, User, ConversationType};

pub async fn create_group(
    pool: &PgPool,
    owner_id: Uuid,
    name: &str,
    member_ids: Vec<Uuid>,
) -> Result<Group> {
    let mut tx = pool.begin().await.context("Failed to begin transaction")?;

    let conversation = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO conversations (conversation_type) VALUES ($1) RETURNING id"
    )
    .bind(ConversationType::Group)
    .fetch_one(&mut *tx)
    .await
    .context("Failed to create conversation")?;

    let group = sqlx::query_as::<_, Group>(
        "INSERT INTO groups (name, owner_id, conversation_id) VALUES ($1, $2, $3) RETURNING id, name, avatar, description, owner_id, conversation_id, created_at, updated_at"
    )
    .bind(name)
    .bind(owner_id)
    .bind(conversation.0)
    .fetch_one(&mut *tx)
    .await
    .context("Failed to create group")?;

    sqlx::query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)"
    )
    .bind(conversation.0)
    .bind(owner_id)
    .execute(&mut *tx)
    .await
    .context("Failed to add owner to conversation members")?;

    sqlx::query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)"
    )
    .bind(group.id)
    .bind(owner_id)
    .execute(&mut *tx)
    .await
    .context("Failed to add owner to group members")?;

    for member_id in &member_ids {
        if *member_id == owner_id {
            continue;
        }
        sqlx::query(
            "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(conversation.0)
        .bind(member_id)
        .execute(&mut *tx)
        .await
        .context("Failed to add member to conversation members")?;

        sqlx::query(
            "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(group.id)
        .bind(member_id)
        .execute(&mut *tx)
        .await
        .context("Failed to add member to group members")?;
    }

    tx.commit().await.context("Failed to commit transaction")?;

    Ok(group)
}

pub async fn add_members(
    pool: &PgPool,
    group_id: Uuid,
    inviter_id: Uuid,
    user_ids: Vec<Uuid>,
) -> Result<Vec<GroupMember>> {
    let inviter_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)"
    )
    .bind(group_id)
    .bind(inviter_id)
    .fetch_one(pool)
    .await
    .context("Failed to check inviter membership")?;

    if !inviter_exists {
        return Err(anyhow!("Inviter is not a member of this group"));
    }

    let group = sqlx::query_as::<_, Group>(
        "SELECT id, name, avatar, description, owner_id, conversation_id, created_at, updated_at FROM groups WHERE id = $1"
    )
    .bind(group_id)
    .fetch_one(pool)
    .await
    .context("Failed to fetch group")?;

    let mut tx = pool.begin().await.context("Failed to begin transaction")?;
    let mut added_members = Vec::new();

    for user_id in &user_ids {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)"
        )
        .bind(group_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .context("Failed to check existing membership")?;

        if exists {
            continue;
        }

        sqlx::query(
            "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)"
        )
        .bind(group.conversation_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .context("Failed to add member to conversation")?;

        let member = sqlx::query_as::<_, GroupMember>(
            "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) RETURNING group_id, user_id, nickname, joined_at"
        )
        .bind(group_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .context("Failed to add member to group")?;

        added_members.push(member);
    }

    tx.commit().await.context("Failed to commit transaction")?;

    Ok(added_members)
}

pub async fn remove_member(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let group = sqlx::query_as::<_, Group>(
        "SELECT id, name, avatar, description, owner_id, conversation_id, created_at, updated_at FROM groups WHERE id = $1"
    )
    .bind(group_id)
    .fetch_one(pool)
    .await
    .context("Failed to fetch group")?;

    if group.owner_id == user_id {
        return Err(anyhow!("Cannot remove group owner"));
    }

    let mut tx = pool.begin().await.context("Failed to begin transaction")?;

    sqlx::query(
        "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2"
    )
    .bind(group_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .context("Failed to remove member from group")?;

    sqlx::query(
        "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2"
    )
    .bind(group.conversation_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .context("Failed to remove member from conversation")?;

    tx.commit().await.context("Failed to commit transaction")?;

    Ok(())
}

pub async fn leave_group(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let group = sqlx::query_as::<_, Group>(
        "SELECT id, name, avatar, description, owner_id, conversation_id, created_at, updated_at FROM groups WHERE id = $1"
    )
    .bind(group_id)
    .fetch_one(pool)
    .await
    .context("Failed to fetch group")?;

    let is_member_check = is_member(pool, group_id, user_id).await?;
    if !is_member_check {
        return Err(anyhow!("User is not a member of this group"));
    }

    let mut tx = pool.begin().await.context("Failed to begin transaction")?;

    if group.owner_id == user_id {
        let earliest_member = sqlx::query_as::<_, (Uuid,)>(
            "SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2 ORDER BY joined_at ASC LIMIT 1"
        )
        .bind(group_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await
        .context("Failed to find earliest member")?;

        match earliest_member {
            Some((new_owner_id,)) => {
                sqlx::query(
                    "UPDATE groups SET owner_id = $1 WHERE id = $2"
                )
                .bind(new_owner_id)
                .bind(group_id)
                .execute(&mut *tx)
                .await
                .context("Failed to transfer ownership")?;

                sqlx::query(
                    "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2"
                )
                .bind(group_id)
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .context("Failed to remove owner from group")?;

                sqlx::query(
                    "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2"
                )
                .bind(group.conversation_id)
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .context("Failed to remove owner from conversation")?;
            }
            None => {
                sqlx::query(
                    "DELETE FROM groups WHERE id = $1"
                )
                .bind(group_id)
                .execute(&mut *tx)
                .await
                .context("Failed to delete group")?;

                sqlx::query(
                    "DELETE FROM conversations WHERE id = $1"
                )
                .bind(group.conversation_id)
                .execute(&mut *tx)
                .await
                .context("Failed to delete conversation")?;
            }
        }
    } else {
        sqlx::query(
            "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2"
        )
        .bind(group_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .context("Failed to remove member from group")?;

        sqlx::query(
            "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2"
        )
        .bind(group.conversation_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .context("Failed to remove member from conversation")?;
    }

    tx.commit().await.context("Failed to commit transaction")?;

    Ok(())
}

pub async fn get_group(
    pool: &PgPool,
    group_id: Uuid,
) -> Result<Group> {
    let group = sqlx::query_as::<_, Group>(
        "SELECT id, name, avatar, description, owner_id, conversation_id, created_at, updated_at FROM groups WHERE id = $1"
    )
    .bind(group_id)
    .fetch_one(pool)
    .await
    .context("Failed to fetch group")?;

    Ok(group)
}

pub async fn get_group_members(
    pool: &PgPool,
    group_id: Uuid,
) -> Result<Vec<User>> {
    let users = sqlx::query_as::<_, User>(
        "SELECT u.id, u.phone, u.password_hash, u.nickname, u.avatar, u.created_at, u.updated_at 
         FROM users u 
         INNER JOIN group_members gm ON u.id = gm.user_id 
         WHERE gm.group_id = $1
         ORDER BY gm.joined_at ASC"
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .context("Failed to fetch group members")?;

    Ok(users)
}

pub async fn get_user_groups(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Group>> {
    let groups = sqlx::query_as::<_, Group>(
        "SELECT g.id, g.name, g.avatar, g.description, g.owner_id, g.conversation_id, g.created_at, g.updated_at 
         FROM groups g 
         INNER JOIN group_members gm ON g.id = gm.group_id 
         WHERE gm.user_id = $1
         ORDER BY g.updated_at DESC"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .context("Failed to fetch user groups")?;

    Ok(groups)
}

pub async fn is_member(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
) -> Result<bool> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)"
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .context("Failed to check membership")?;

    Ok(exists)
}
