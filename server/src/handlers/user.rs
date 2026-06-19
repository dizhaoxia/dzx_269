use axum::{
    extract::{State, Query, Path},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use crate::models::User;
use crate::services::auth::Claims;
use crate::services::user::{search_users, get_user_by_id};
use crate::handlers::auth::{error_response, UserResponse};

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

pub async fn search_users_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    if query.q.trim().is_empty() {
        let empty: Vec<UserResponse> = vec![];
        return (StatusCode::OK, Json(json!({ "users": empty }))).into_response();
    }

    match search_users(&state.db.pg, &query.q).await {
        Ok(users) => {
            let users_resp: Vec<UserResponse> = users.into_iter().map(Into::into).collect();
            (StatusCode::OK, Json(json!({ "users": users_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Search failed: {}", e),
        )
        .into_response(),
    }
}

pub async fn get_user_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(user_id): Path<Uuid>,
) -> impl IntoResponse {
    match get_user_by_id(&state.db.pg, user_id).await {
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
