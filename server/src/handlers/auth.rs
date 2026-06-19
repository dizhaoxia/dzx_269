use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use validator::Validate;

use crate::AppState;
use crate::models::User;
use crate::services::auth::{Claims, generate_jwt};
use crate::services::user::{register_user, login_user, get_user_by_id};

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterPayload {
    #[validate(length(min = 11, max = 20))]
    pub phone: String,
    #[validate(length(min = 8))]
    pub password: String,
    #[validate(length(min = 2, max = 32))]
    pub nickname: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginPayload {
    pub phone: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: uuid::Uuid,
    pub phone: String,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            avatar: user.avatar,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

fn error_response(status: StatusCode, message: &str) -> impl IntoResponse {
    (
        status,
        Json(json!({ "error": message })),
    )
}

pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<RegisterPayload>,
) -> impl IntoResponse {
    if let Err(e) = payload.validate() {
        return error_response(
            StatusCode::BAD_REQUEST,
            &format!("Validation error: {}", e),
        )
        .into_response();
    }

    match register_user(
        &state.db.pg,
        &payload.phone,
        &payload.password,
        payload.nickname.as_deref(),
    )
    .await
    {
        Ok(user) => {
            let token = match generate_jwt(
                user.id,
                &user.phone,
                &state.config.jwt_secret,
                state.config.jwt_expiration_hours,
            ) {
                Ok(t) => t,
                Err(e) => {
                    return error_response(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        &format!("Failed to generate token: {}", e),
                    )
                    .into_response();
                }
            };

            let user_resp: UserResponse = user.into();
            (
                StatusCode::CREATED,
                Json(json!({
                    "token": token,
                    "user": user_resp
                })),
            )
                .into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("already registered") {
                error_response(StatusCode::CONFLICT, &msg).into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Registration failed: {}", e),
                )
                .into_response()
            }
        }
    }
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginPayload>,
) -> impl IntoResponse {
    if payload.phone.is_empty() || payload.password.is_empty() {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Phone and password are required",
        )
        .into_response();
    }

    match login_user(&state.db.pg, &payload.phone, &payload.password).await {
        Ok(user) => {
            let token = match generate_jwt(
                user.id,
                &user.phone,
                &state.config.jwt_secret,
                state.config.jwt_expiration_hours,
            ) {
                Ok(t) => t,
                Err(e) => {
                    return error_response(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        &format!("Failed to generate token: {}", e),
                    )
                    .into_response();
                }
            };

            let user_resp: UserResponse = user.into();
            (
                StatusCode::OK,
                Json(json!({
                    "token": token,
                    "user": user_resp
                })),
            )
                .into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("Invalid phone or password") {
                error_response(StatusCode::UNAUTHORIZED, "Invalid phone or password")
                    .into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Login failed: {}", e),
                )
                .into_response()
            }
        }
    }
}

pub async fn me_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> impl IntoResponse {
    match get_user_by_id(&state.db.pg, claims.user_id).await {
        Ok(user) => {
            let user_resp: UserResponse = user.into();
            (StatusCode::OK, Json(json!({ "user": user_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::NOT_FOUND,
            &format!("User not found: {}", e),
        )
        .into_response(),
    }
}
