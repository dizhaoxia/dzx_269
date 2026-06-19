use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures::sink::SplitSink;
use futures::SinkExt;
use redis::AsyncCommands;
use serde_json;
use sqlx::PgPool;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::db::DbPool;
use crate::ws::message::OutgoingMessage;

pub type WsSender = SplitSink<WebSocket, Message>;

struct ConnectionManagerInner {
    connections: HashMap<Uuid, WsSender>,
}

#[derive(Clone)]
pub struct ConnectionManager {
    inner: Arc<RwLock<ConnectionManagerInner>>,
    db_pool: DbPool,
}

impl ConnectionManager {
    pub fn new(db_pool: DbPool) -> Self {
        Self {
            inner: Arc::new(RwLock::new(ConnectionManagerInner {
                connections: HashMap::new(),
            })),
            db_pool,
        }
    }

    pub async fn add_connection(&self, user_id: Uuid, sender: WsSender) {
        let mut inner = self.inner.write().await;
        inner.connections.insert(user_id, sender);
    }

    pub async fn remove_connection(&self, user_id: Uuid) {
        let mut inner = self.inner.write().await;
        inner.connections.remove(&user_id);
    }

    pub async fn send_to_user(&self, user_id: Uuid, msg: OutgoingMessage) -> Result<bool> {
        let json = serde_json::to_string(&msg)?;
        let mut inner = self.inner.write().await;

        if let Some(sender) = inner.connections.get_mut(&user_id) {
            match sender.send(Message::Text(json.into())).await {
                Ok(()) => Ok(true),
                Err(_) => {
                    inner.connections.remove(&user_id);
                    Ok(false)
                }
            }
        } else {
            Ok(false)
        }
    }

    pub async fn broadcast_to_group(
        &self,
        group_id: Uuid,
        sender_user_id: Uuid,
        msg: OutgoingMessage,
        pool: &PgPool,
    ) {
        let member_ids: Vec<Uuid> = match sqlx::query_scalar::<_, Uuid>(
            "SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2",
        )
        .bind(group_id)
        .bind(sender_user_id)
        .fetch_all(pool)
        .await
        {
            Ok(ids) => ids,
            Err(e) => {
                tracing::error!("Failed to fetch group members: {}", e);
                return;
            }
        };

        for user_id in member_ids {
            let _ = self.send_to_user(user_id, msg.clone()).await;
        }
    }

    pub async fn is_online(&self, user_id: Uuid) -> bool {
        match self.db_pool.get_redis_conn().await {
            Ok(mut conn) => {
                match conn
                    .sismember::<&str, &str, bool>("online_users", &user_id.to_string())
                    .await
                {
                    Ok(result) => result,
                    Err(e) => {
                        tracing::error!("Redis sismember error: {}", e);
                        false
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to get Redis connection: {}", e);
                false
            }
        }
    }

    pub async fn set_online(&self, user_id: Uuid, online: bool) {
        match self.db_pool.get_redis_conn().await {
            Ok(mut conn) => {
                let user_id_str = user_id.to_string();
                let result: redis::RedisResult<()> = if online {
                    conn.sadd("online_users", &user_id_str).await
                } else {
                    conn.srem("online_users", &user_id_str).await
                };
                if let Err(e) = result {
                    tracing::error!("Redis set online error: {}", e);
                }
            }
            Err(e) => {
                tracing::error!("Failed to get Redis connection: {}", e);
            }
        }
    }
}
