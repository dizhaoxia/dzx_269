use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use redis::Client as RedisClient;
use redis::aio::MultiplexedConnection;
use std::time::Duration;

#[derive(Clone)]
pub struct DbPool {
    pub pg: PgPool,
    pub redis_client: RedisClient,
}

impl DbPool {
    pub async fn new(database_url: &str, redis_url: &str) -> Result<Self> {
        let pg = PgPoolOptions::new()
            .max_connections(20)
            .acquire_timeout(Duration::from_secs(5))
            .connect(database_url)
            .await?;

        let redis_client = RedisClient::open(redis_url)?;

        Ok(Self { pg, redis_client })
    }

    pub async fn get_redis_conn(&self) -> Result<MultiplexedConnection> {
        let conn = self.redis_client.get_multiplexed_async_connection().await?;
        Ok(conn)
    }
}
