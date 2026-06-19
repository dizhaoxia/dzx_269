use anyhow::{Result, Context, anyhow};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::key::{
    IdentityKey, KeyBundle, PreKey, PreKeyBundle, SignedPreKey, SignedPreKeyBundle,
};

pub async fn upload_identity_key(
    pool: &PgPool,
    user_id: Uuid,
    public_key: &str,
) -> Result<IdentityKey> {
    let key = sqlx::query_as::<_, IdentityKey>(
        r#"
        INSERT INTO identity_keys (user_id, public_key)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET public_key = EXCLUDED.public_key
        RETURNING id, user_id, public_key, created_at
        "#,
    )
    .bind(user_id)
    .bind(public_key)
    .fetch_one(pool)
    .await
    .context("Failed to upload identity key")?;

    Ok(key)
}

pub async fn upload_signed_pre_key(
    pool: &PgPool,
    user_id: Uuid,
    key_id: i32,
    public_key: &str,
    signature: &str,
) -> Result<SignedPreKey> {
    let mut tx = pool.begin().await.context("Failed to begin transaction")?;

    sqlx::query(
        r#"
        UPDATE signed_pre_keys
        SET is_used = TRUE
        WHERE user_id = $1 AND is_used = FALSE
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .context("Failed to mark old signed pre keys as used")?;

    let key = sqlx::query_as::<_, SignedPreKey>(
        r#"
        INSERT INTO signed_pre_keys (user_id, key_id, public_key, signature)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, key_id, public_key, signature, is_used, created_at
        "#,
    )
    .bind(user_id)
    .bind(key_id)
    .bind(public_key)
    .bind(signature)
    .fetch_one(&mut *tx)
    .await
    .context("Failed to upload signed pre key")?;

    tx.commit().await.context("Failed to commit transaction")?;

    Ok(key)
}

pub async fn upload_pre_keys(
    pool: &PgPool,
    user_id: Uuid,
    keys: Vec<(i32, String)>,
) -> Result<Vec<PreKey>> {
    if keys.is_empty() {
        return Ok(vec![]);
    }

    let mut result = Vec::with_capacity(keys.len());

    for (key_id, public_key) in keys {
        let key = sqlx::query_as::<_, PreKey>(
            r#"
            INSERT INTO pre_keys (user_id, key_id, public_key)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, key_id) DO NOTHING
            RETURNING id, user_id, key_id, public_key, is_used, created_at
            "#,
        )
        .bind(user_id)
        .bind(key_id)
        .bind(public_key)
        .fetch_optional(pool)
        .await
        .context("Failed to upload pre key")?;

        if let Some(k) = key {
            result.push(k);
        }
    }

    Ok(result)
}

pub async fn get_identity_key(pool: &PgPool, user_id: Uuid) -> Result<IdentityKey> {
    let key = sqlx::query_as::<_, IdentityKey>(
        r#"
        SELECT id, user_id, public_key, created_at
        FROM identity_keys
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .context("Failed to fetch identity key")?
    .ok_or_else(|| anyhow!("Identity key not found for user"))?;

    Ok(key)
}

pub async fn get_signed_pre_key(pool: &PgPool, user_id: Uuid) -> Result<SignedPreKey> {
    let key = sqlx::query_as::<_, SignedPreKey>(
        r#"
        SELECT id, user_id, key_id, public_key, signature, is_used, created_at
        FROM signed_pre_keys
        WHERE user_id = $1 AND is_used = FALSE
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .context("Failed to fetch signed pre key")?
    .ok_or_else(|| anyhow!("Signed pre key not found for user"))?;

    Ok(key)
}

pub async fn consume_pre_key(pool: &PgPool, user_id: Uuid) -> Result<Option<PreKey>> {
    let mut tx = pool.begin().await.context("Failed to begin transaction")?;

    let key = sqlx::query_as::<_, PreKey>(
        r#"
        SELECT id, user_id, key_id, public_key, is_used, created_at
        FROM pre_keys
        WHERE user_id = $1 AND is_used = FALSE
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        "#,
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .context("Failed to fetch pre key for consumption")?;

    if let Some(ref k) = key {
        sqlx::query(
            r#"
            UPDATE pre_keys
            SET is_used = TRUE
            WHERE id = $1
            "#,
        )
        .bind(k.id)
        .execute(&mut *tx)
        .await
        .context("Failed to mark pre key as used")?;
    }

    tx.commit().await.context("Failed to commit transaction")?;

    Ok(key)
}

pub async fn get_pre_key_count(pool: &PgPool, user_id: Uuid) -> Result<i64> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM pre_keys
        WHERE user_id = $1 AND is_used = FALSE
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .context("Failed to count pre keys")?;

    Ok(count)
}

pub async fn get_user_key_bundle(pool: &PgPool, user_id: Uuid) -> Result<KeyBundle> {
    let identity_key = get_identity_key(pool, user_id).await?;
    let signed_pre_key = get_signed_pre_key(pool, user_id).await?;
    let one_time_pre_key = consume_pre_key(pool, user_id).await?;

    Ok(KeyBundle {
        identity_key: identity_key.public_key,
        signed_pre_key: SignedPreKeyBundle {
            key_id: signed_pre_key.key_id,
            public_key: signed_pre_key.public_key,
            signature: signed_pre_key.signature,
        },
        one_time_pre_key: one_time_pre_key.map(|k| PreKeyBundle {
            key_id: k.key_id,
            public_key: k.public_key,
        }),
    })
}
