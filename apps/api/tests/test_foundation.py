from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from redis.exceptions import ConnectionError

from core.config import Settings
from main import create_app


@pytest.fixture
def client_and_redis():
    redis = AsyncMock()
    redis.ping.return_value = True
    settings = Settings(_env_file=None, app_env="test", cors_origins=["http://localhost:3000"])
    with patch("main.Redis.from_url", return_value=redis):
        with TestClient(create_app(settings)) as client:
            yield client, redis
    redis.aclose.assert_awaited_once()


def test_liveness_does_not_require_redis(client_and_redis):
    client, redis = client_and_redis
    redis.ping.side_effect = ConnectionError("unavailable")
    assert client.get("/health/live").json()["status"] == "alive"
    redis.ping.assert_not_awaited()


def test_readiness_tracks_failure_and_recovery(client_and_redis):
    client, redis = client_and_redis
    redis.ping.side_effect = [ConnectionError("secret Redis URL"), True]

    failed = client.get("/health/ready")
    assert failed.status_code == 503
    assert failed.json()["dependencies"] == {"redis": "down"}
    assert "secret" not in failed.text
    assert failed.headers["cache-control"] == "no-store"

    recovered = client.get("/health/ready")
    assert recovered.status_code == 200
    assert recovered.json()["status"] == "ready"
    assert recovered.json()["dependencies"] == {"redis": "up"}


def test_false_ping_is_not_ready(client_and_redis):
    client, redis = client_and_redis
    redis.ping.return_value = False
    assert client.get("/health/ready").status_code == 503


def test_cors_only_allows_configured_origin(client_and_redis):
    client, _ = client_and_redis
    allowed = client.options(
        "/v1",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"

    denied = client.options(
        "/v1",
        headers={"Origin": "https://unconfigured.example", "Access-Control-Request-Method": "GET"},
    )
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers


@pytest.mark.parametrize("origin", ["*", "https://*.example.com", "https://example.com/path"])
def test_cors_rejects_non_origin_configuration(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=[origin])


def test_platform_reports_current_phase_capabilities(client_and_redis):
    client, _ = client_and_redis
    response = client.get("/v1")
    assert response.status_code == 200
    body = response.json()
    assert body["phase"] == "worker-vision-hardware"
    assert body["monitoring_enabled"] is True
    assert body["worker"]["transport"] == "websocket"
    assert body["hardware"]["transport"] == "http"
    assert body["vision"]["model_loaded"] is False
