use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Group {
    pub id: Uuid,
    pub name: String,
    pub avatar: Option<String>,
    pub description: Option<String>,
    pub owner_id: Uuid,
    pub conversation_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GroupMember {
    pub group_id: Uuid,
    pub user_id: Uuid,
    pub nickname: Option<String>,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Validate)]
pub struct CreateGroup {
    #[validate(length(min = 2, max = 32))]
    pub name: String,
    pub avatar: Option<String>,
    pub description: Option<String>,
    pub owner_id: Uuid,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AddGroupMember {
    pub group_id: Uuid,
    pub user_id: Uuid,
    pub nickname: Option<String>,
}
