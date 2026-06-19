use anyhow::{Result, Context, anyhow};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::User;
use crate::services::auth::{hash_password, verify_password};

pub async fn register_user(
    pool: &PgPool,
    phone: &str,
    password: &str,
    nickname: Option<&str>,
) -> Result<User> {
    let existing = sqlx::query_as::<_, User>(
        "SELECT id, phone, password_hash, nickname, avatar, created_at, updated_at FROM users WHERE phone = $1"
    )
    .bind(phone)
    .fetch_optional(pool)
    .await
    .context("Failed to check existing user")?;

    if existing.is_some() {
        return Err(anyhow!("Phone number already registered"));
    }

    let password_hash = hash_password(password)?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (phone, password_hash, nickname) VALUES ($1, $2, $3) RETURNING id, phone, password_hash, nickname, avatar, created_at, updated_at"
    )
    .bind(phone)
    .bind(&password_hash)
    .bind(nickname)
    .fetch_one(pool)
    .await
    .context("Failed to create user")?;

    Ok(user)
}

pub async fn login_user(
    pool: &PgPool,
    phone: &str,
    password: &str,
) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, phone, password_hash, nickname, avatar, created_at, updated_at FROM users WHERE phone = $1"
    )
    .bind(phone)
    .fetch_optional(pool)
    .await
    .context("Failed to fetch user")?
    .ok_or_else(|| anyhow!("Invalid phone or password"))?;

    let valid = verify_password(password, &user.password_hash)?;
    if !valid {
        return Err(anyhow!("Invalid phone or password"));
    }

    Ok(user)
}

pub async fn get_user_by_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, phone, password_hash, nickname, avatar, created_at, updated_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .context("Failed to fetch user by id")?;

    Ok(user)
}

pub async fn get_user_by_phone(
    pool: &PgPool,
    phone: &str,
) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, phone, password_hash, nickname, avatar, created_at, updated_at FROM users WHERE phone = $1"
    )
    .bind(phone)
    .fetch_one(pool)
    .await
    .context("Failed to fetch user by phone")?;

    Ok(user)
}

pub async fn search_users(
    pool: &PgPool,
    query: &str,
) -> Result<Vec<User>> {
    let search_pattern = format!("%{}%", query);
    let users = sqlx::query_as::<_, User>(
        "SELECT id, phone, password_hash, nickname, avatar, created_at, updated_at FROM users WHERE phone ILIKE $1 OR nickname ILIKE $1 LIMIT 50"
    )
    .bind(&search_pattern)
    .fetch_all(pool)
    .await
    .context("Failed to search users")?;

    Ok(users)
}
