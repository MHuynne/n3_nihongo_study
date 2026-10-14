from __future__ import annotations

import ssl

from app.core.config import Settings


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "session_secret": "test-session-secret-with-at-least-32-chars",
        "mysql_user": "n3studio_test",
        "mysql_password": "test-database-password",
        "mysql_database": "n3_study_studio_test",
    }
    values.update(overrides)
    return Settings(**values)


def test_database_tls_is_disabled_by_default() -> None:
    assert make_settings().database_connect_args == {}


def test_database_tls_uses_verified_system_trust_roots() -> None:
    connect_args = make_settings(mysql_ssl=True).database_connect_args

    tls_context = connect_args["ssl"]
    assert isinstance(tls_context, ssl.SSLContext)
    assert tls_context.verify_mode == ssl.CERT_REQUIRED
    assert tls_context.check_hostname
