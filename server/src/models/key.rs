use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct IdentityKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub public_key: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PreKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub key_id: i32,
    pub public_key: String,
    pub is_used: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SignedPreKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub key_id: i32,
    pub public_key: String,
    pub signature: String,
    pub is_used: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadPreKey {
    pub key_id: i32,
    pub public_key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadSignedPreKey {
    pub key_id: i32,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadKeysRequest {
    pub identity_key: String,
    pub signed_pre_key: UploadSignedPreKey,
    pub pre_keys: Vec<UploadPreKey>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SignedPreKeyBundle {
    pub key_id: i32,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreKeyBundle {
    pub key_id: i32,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct KeyBundle {
    pub identity_key: String,
    pub signed_pre_key: SignedPreKeyBundle,
    pub one_time_pre_key: Option<PreKeyBundle>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreKeyCount {
    pub count: i64,
}
