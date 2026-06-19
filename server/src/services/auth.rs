use anyhow::{Result, Context, anyhow};
use chrono::{Utc, Duration};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub user_id: Uuid,
    pub phone: String,
    pub exp: usize,
    pub iat: usize,
}

pub fn hash_password(password: &str) -> Result<String> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .context("Failed to hash password")
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    bcrypt::verify(password, hash)
        .context("Failed to verify password")
}

pub fn generate_jwt(
    user_id: Uuid,
    phone: &str,
    secret: &str,
    expiration_hours: i64,
) -> Result<String> {
    let now = Utc::now();
    let exp = now + Duration::hours(expiration_hours);

    let claims = Claims {
        user_id,
        phone: phone.to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .context("Failed to generate JWT token")
}

pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| anyhow!("Invalid JWT token: {}", e))?;

    Ok(token_data.claims)
}
