from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = (
    API_ROOT.parent.parent
    if API_ROOT.name == "api" and API_ROOT.parent.name == "apps"
    else API_ROOT.parent
)
ENV_FILE = (WORKSPACE_ROOT / ".env").resolve()
DEFAULT_VISION_MODEL_WEIGHTS = (API_ROOT / "models" / "best.pt").resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "https://localhost:8443",
            "https://127.0.0.1:8443",
        ]
    )
    redis_url: str = "redis://localhost:6379/0"
    vision_model_weights: Path = DEFAULT_VISION_MODEL_WEIGHTS
    vision_confidence_threshold: float = Field(default=0.25, ge=0.0, le=1.0)
    monitored_ppe_classes: list[str] = Field(default_factory=lambda: ["hardhat", "vest"])
    camera_left_video: Path = API_ROOT / "videos" / "testleft.mp4"
    camera_right_video: Path = API_ROOT / "videos" / "testright.mp4"
    cameras_enabled: bool = True
    camera_max_fps: float = Field(default=15, ge=1, le=30)
    vision_width: int = Field(default=640, ge=320, le=1280)
    vision_height: int = Field(default=384, ge=192, le=768)
    vision_cpu_threads: int = Field(default=2, ge=1, le=8)
    worker_api_tokens: list[str] = Field(default_factory=lambda: ["dev_device_worker_001"])
    worker_telemetry_ttl_seconds: int = Field(default=30, ge=10, le=3600)
    hardware_api_tokens: list[str] = Field(default_factory=lambda: ["dev_device_machine_001"])
    hardware_telemetry_ttl_seconds: int = Field(default=60, ge=10, le=3600)
    database_url: SecretStr = SecretStr("")

    @field_validator("cors_origins")
    @classmethod
    def explicit_origins(cls, origins: list[str]) -> list[str]:
        from urllib.parse import urlsplit

        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or "*" in origin
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
            ):
                raise ValueError(
                    "CORS origins must be exact HTTP(S) origins without a trailing slash"
                )
        return origins

    @field_validator(
        "vision_model_weights", "camera_left_video", "camera_right_video", mode="before",
    )
    @classmethod
    def resolve_vision_model_weights(cls, value: str | Path) -> Path:
        path = Path(value)
        if path.is_absolute():
            return path
        if path.parts[:2] == ("apps", "api"):
            return (WORKSPACE_ROOT / path).resolve()
        return (API_ROOT / path).resolve()

    @field_validator("monitored_ppe_classes")
    @classmethod
    def normalize_monitored_ppe_classes(cls, value: list[str]) -> list[str]:
        normalized = [item.strip().casefold() for item in value if item.strip()]
        if not normalized:
            raise ValueError("At least one monitored PPE class must be configured")
        return normalized

    @field_validator("hardware_api_tokens")
    @classmethod
    def nonempty_hardware_tokens(cls, value: list[str]) -> list[str]:
        tokens = [token.strip() for token in value if token.strip()]
        if not tokens:
            raise ValueError("At least one hardware API token must be configured")
        return tokens

    @field_validator("worker_api_tokens")
    @classmethod
    def nonempty_worker_tokens(cls, value: list[str]) -> list[str]:
        tokens = [token.strip() for token in value if token.strip()]
        if not tokens:
            raise ValueError("At least one worker API token must be configured")
        return tokens
