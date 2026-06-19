mod config;
mod db;
mod models;
mod services;
mod handlers;
mod ws;

use std::sync::Arc;

use axum::{
    async_trait,
    extract::{FromRequestParts, FromRef},
    http::{request::Parts, StatusCode, header::AUTHORIZATION, Method},
    routing::get,
    Json,
    Router,
    response::IntoResponse,
};
use axum::routing::post;
use serde_json::json;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::AppConfig;
use crate::db::DbPool;
use crate::services::auth::{Claims, verify_jwt};
use crate::handlers::auth::{register_handler, login_handler, me_handler};
use crate::handlers::key::{
    upload_keys_handler,
    get_key_bundle_handler,
    get_pre_key_count_handler,
};
use crate::handlers::conversation::{
    list_conversations_handler,
    create_direct_conversation_handler,
    get_messages_handler,
    send_message_handler,
    mark_read_handler,
};
use crate::handlers::group::{
    create_group_handler,
    get_group_handler,
    get_group_members_handler,
    invite_members_handler,
    leave_group_handler,
    list_groups_handler,
};
use crate::handlers::user::{search_users_handler, get_user_handler};
use crate::ws::connection::ConnectionManager;
use crate::ws::handler::ws_handler;

#[derive(Clone, axum::extract::FromRef)]
pub struct AppState {
    pub config: AppConfig,
    pub db: DbPool,
    pub connection_manager: Arc<ConnectionManager>,
}

async fn health_check() -> (StatusCode, Json<serde_json::Value>) {
    (StatusCode::OK, Json(json!({ "status": "ok" })))
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
    AppState: axum::extract::FromRef<S>,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "error": "Missing authorization header" })),
                )
            })?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "error": "Invalid authorization header format" })),
                )
            })?;

        verify_jwt(token, &app_state.config.jwt_secret).map_err(|e| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": format!("Invalid token: {}", e) })),
            )
        })
    }
}

fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any);

    let auth_routes = Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route("/me", get(me_handler));

    let key_routes = Router::new()
        .route("/upload", post(upload_keys_handler))
        .route("/bundle/:user_id", get(get_key_bundle_handler))
        .route("/pre-key-count", get(get_pre_key_count_handler));

    let conversation_routes = Router::new()
        .route("/", get(list_conversations_handler))
        .route("/direct", post(create_direct_conversation_handler))
        .route("/:id/messages", get(get_messages_handler))
        .route("/:id/read", post(mark_read_handler));

    let message_routes = Router::new()
        .route("/", post(send_message_handler));

    let group_routes = Router::new()
        .route("/", post(create_group_handler))
        .route("/", get(list_groups_handler))
        .route("/:id", get(get_group_handler))
        .route("/:id/members", get(get_group_members_handler))
        .route("/:id/invite", post(invite_members_handler))
        .route("/:id/leave", post(leave_group_handler));

    let user_routes = Router::new()
        .route("/search", get(search_users_handler))
        .route("/:id", get(get_user_handler));

    Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .nest("/api/auth", auth_routes)
        .nest("/api/keys", key_routes)
        .nest("/api/conversations", conversation_routes)
        .nest("/api/messages", message_routes)
        .nest("/api/groups", group_routes)
        .nest("/api/users", user_routes)
        .with_state(state)
        .layer(cors)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,dzx_server=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = AppConfig::from_env();

    info!("Connecting to PostgreSQL...");
    let db = DbPool::new(&config.database_url, &config.redis_url).await?;
    info!("Database connections established");

    let connection_manager = Arc::new(ConnectionManager::new(db.clone()));

    let state = AppState {
        config: config.clone(),
        db,
        connection_manager,
    };

    let app = build_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Server starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
