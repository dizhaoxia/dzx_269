use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::models::Group;
use crate::services::auth::Claims;
use crate::services::group as group_service;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateGroupPayload {
    #[validate(length(min = 2, max = 32))]
    pub name: String,
    pub member_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct InviteMembersPayload {
    pub user_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct GroupResponse {
    pub id: Uuid,
    pub name: String,
    pub avatar: Option<String>,
    pub description: Option<String>,
    pub owner_id: Uuid,
    pub conversation_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Group> for GroupResponse {
    fn from(group: Group) -> Self {
        Self {
            id: group.id,
            name: group.name,
            avatar: group.avatar,
            description: group.description,
            owner_id: group.owner_id,
            conversation_id: group.conversation_id,
            created_at: group.created_at,
            updated_at: group.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct GroupMemberResponse {
    pub id: Uuid,
    pub phone: String,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

fn error_response(status: StatusCode, message: &str) -> impl IntoResponse {
    (
        status,
        Json(json!({ "error": message })),
    )
}

pub async fn create_group_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateGroupPayload>,
) -> impl IntoResponse {
    if let Err(e) = payload.validate() {
        return error_response(
            StatusCode::BAD_REQUEST,
            &format!("Validation error: {}", e),
        )
        .into_response();
    }

    if payload.name.is_empty() {
        return error_response(StatusCode::BAD_REQUEST, "Group name is required").into_response();
    }

    match group_service::create_group(
        &state.db.pg,
        claims.user_id,
        &payload.name,
        payload.member_ids,
    )
    .await
    {
        Ok(group) => {
            let group_resp: GroupResponse = group.into();
            (StatusCode::CREATED, Json(json!({ "group": group_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to create group: {}", e),
        )
        .into_response(),
    }
}

pub async fn get_group_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(group_id): Path<Uuid>,
) -> impl IntoResponse {
    let is_member = match group_service::is_member(&state.db.pg, group_id, claims.user_id).await {
        Ok(b) => b,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Failed to check membership: {}", e),
            )
            .into_response();
        }
    };

    if !is_member {
        return error_response(StatusCode::FORBIDDEN, "Not a member of this group")
            .into_response();
    }

    match group_service::get_group(&state.db.pg, group_id).await {
        Ok(group) => {
            let group_resp: GroupResponse = group.into();
            (StatusCode::OK, Json(json!({ "group": group_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::NOT_FOUND,
            &format!("Group not found: {}", e),
        )
        .into_response(),
    }
}

pub async fn get_group_members_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(group_id): Path<Uuid>,
) -> impl IntoResponse {
    let is_member = match group_service::is_member(&state.db.pg, group_id, claims.user_id).await {
        Ok(b) => b,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Failed to check membership: {}", e),
            )
            .into_response();
        }
    };

    if !is_member {
        return error_response(StatusCode::FORBIDDEN, "Not a member of this group")
            .into_response();
    }

    match group_service::get_group_members(&state.db.pg, group_id).await {
        Ok(users) => {
            let members_resp: Vec<GroupMemberResponse> = users
                .into_iter()
                .map(|u| GroupMemberResponse {
                    id: u.id,
                    phone: u.phone,
                    nickname: u.nickname,
                    avatar: u.avatar,
                    created_at: u.created_at,
                    updated_at: u.updated_at,
                })
                .collect();
            (StatusCode::OK, Json(json!({ "members": members_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to get group members: {}", e),
        )
        .into_response(),
    }
}

pub async fn invite_members_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<InviteMembersPayload>,
) -> impl IntoResponse {
    if payload.user_ids.is_empty() {
        return error_response(StatusCode::BAD_REQUEST, "No user IDs provided").into_response();
    }

    match group_service::add_members(
        &state.db.pg,
        group_id,
        claims.user_id,
        payload.user_ids,
    )
    .await
    {
        Ok(_members) => (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("not a member") {
                error_response(StatusCode::FORBIDDEN, &msg).into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Failed to invite members: {}", e),
                )
                .into_response()
            }
        }
    }
}

pub async fn leave_group_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(group_id): Path<Uuid>,
) -> impl IntoResponse {
    match group_service::leave_group(&state.db.pg, group_id, claims.user_id).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("not a member") {
                error_response(StatusCode::BAD_REQUEST, &msg).into_response()
            } else {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Failed to leave group: {}", e),
                )
                .into_response()
            }
        }
    }
}

pub async fn list_groups_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> impl IntoResponse {
    match group_service::get_user_groups(&state.db.pg, claims.user_id).await {
        Ok(groups) => {
            let groups_resp: Vec<GroupResponse> = groups
                .into_iter()
                .map(GroupResponse::from)
                .collect();
            (StatusCode::OK, Json(json!({ "groups": groups_resp }))).into_response()
        }
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to list groups: {}", e),
        )
        .into_response(),
    }
}
