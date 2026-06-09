from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Global Financial Intelligence Dashboard"
    version: str = "1.0.0"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Cache TTL in seconds
    data_cache_ttl: int = 300
    signal_cache_ttl: int = 60

    # Thresholds
    reversal_confidence_threshold: float = 0.55
    strong_signal_threshold: float = 0.75

    class Config:
        env_file = ".env"


settings = Settings()
