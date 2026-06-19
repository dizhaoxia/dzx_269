use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use crate::models::key::UploadKeysRequest;
use crate::services::auth::Claims;
use crate::services::key as key_service;

fn error_response(status: StatusCode, message: &str) -> impl IntoResponse {
    (
        status,
        Json(json!({ "error": message })),
    )
}

pub async fn upload_keys_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<UploadKeysRequest>,
) -> impl IntoResponse {
    let user_id = claims.user_id;

    if let Err(e) = key_service::upload_identity_key(
        &state.db.pg,
        user_id,
        &payload.identity_key,
    )
    .await
    {
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to upload identity key: {}", e),
        )
        .into_response();
    }

    if let Err(e) = key_service::upload_signed_pre_key(
        &state.db.pg,
        user_id,
        payload.signed_pre_key.key_id,
        &payload.signed_pre_key.public_key,
        &payload.signed_pre_key.signature,
    )
    .await
    {
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to upload signed pre key: {}", e),
        )
        .into_response();
    }

    let pre_keys: Vec<(i32, String)> = payload
        .pre_keys
        .into_iter()
        .map(|k| (k.key_id, k.public_key))
        .collect();

    let uploaded_count = match key_service::upload_pre_keys(&state.db.pg, user_id, pre_keys).await
    {
        Ok(keys) => keys.len(),
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Failed to upload pre keys: {}", e),
            )
            .into_response();
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "uploaded_pre_keys": uploaded_count
        })),
    )
        .into_response()
}

pub async fn get_key_bundle_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(user_id): Path<Uuid>,
) -> impl IntoResponse {
    match key_service::get_user_key_bundle(&state.db.pg, user_id).await {
        Ok(bundle) => (StatusCode::OK, Json(json!(bundle))).into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("not found") {
                error_response(StatusCode::NOT_FOUND, &msg).into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Failed to get key bundle: {}", e),
                )
                .into_response()
            }
        }
    }
}

pub async fn get_pre_key_count_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> impl IntoResponse {
    match key_service::get_pre_key_count(&state.db.pg, claims.user_id).await {
        Ok(count) => (StatusCode::OK, Json(json!({ "count": count }))).into_response(),
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to get pre key count: {}", e),
        )
        .into_response(),
    }
}
