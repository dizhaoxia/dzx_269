use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub phone: String,
    pub password_hash: String,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Validate)]
pub struct CreateUser {
    #[validate(phone)]
    pub phone: String,
    #[validate(length(min = 8))]
    pub password: String,
    #[validate(length(min = 2, max = 32))]
    pub nickname: Option<String>,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Validate)]
pub struct UpdateUser {
    #[validate(length(min = 2, max = 32))]
    pub nickname: Option<String>,
    pub avatar: Option<String>,
}
