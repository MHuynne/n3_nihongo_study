from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine

from app.api.routes.auth import verified_google_avatar
from app.core.config import Settings
from app.db.base import Base
from app.main import create_app
from app.models import StudyData, User

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def client(tmp_path) -> AsyncIterator[httpx.AsyncClient]:
    database_file = tmp_path / "n3-study-test.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_file}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    settings = Settings(
        _env_file=None,
        app_env="test",
        session_secret="test-session-secret-with-at-least-32-chars",
        mysql_host="127.0.0.1",
        mysql_user="n3studio_test",
        mysql_password="test-database-password",
        mysql_database="n3_study_studio_test",
        trusted_hosts=["testserver"],
        rate_limit_storage_uri="memory://",
        frontend_directory=Path(__file__).resolve().parents[2] / "dist",
    )
    application = create_app(settings=settings, engine=engine)
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"Origin": "http://testserver"},
    ) as test_client:
        yield test_client
    await engine.dispose()


async def test_registration_study_data_and_logout_are_account_scoped(
    client: httpx.AsyncClient,
) -> None:
    registration = await client.post(
        "/api/auth/register",
        json={"username": "Study.User", "password": "a-strong-study-password"},
    )
    assert registration.status_code == 201
    assert registration.json()["username"] == "study.user"
    assert registration.json()["avatar_url"] is None

    current_user = await client.get("/api/auth/me")
    assert current_user.status_code == 200
    assert current_user.json()["user"]["avatar_url"] is None

    study_response = await client.get("/api/study-data")
    assert study_response.status_code == 200
    payload = study_response.json()
    assert len(payload["data"]) == 362
    assert payload["notes"] == []
    assert payload["data"][0]["deck_folder"] == ""
    assert payload["data"][0]["deck_name"] == ""
    assert payload["lessons"] == []

    payload["state"]["seed0"] = {"weak": True, "level": 0, "due": 1_800_000_000_000}
    saved = await client.put("/api/study-data", json=payload)
    assert saved.status_code == 200
    assert saved.json() == {"saved": True}

    assert (await client.post("/api/auth/logout")).status_code == 204
    assert (await client.get("/api/study-data")).status_code == 401
    second_account = await client.post(
        "/api/auth/register",
        json={"username": "study.second", "password": "another-strong-password"},
    )
    assert second_account.status_code == 201
    second_data = (await client.get("/api/study-data")).json()
    assert second_data["state"] == {}


async def test_auth_rejects_invalid_password_duplicate_username_and_bad_origin(
    client: httpx.AsyncClient,
) -> None:
    invalid = await client.post(
        "/api/auth/register",
        json={"username": "valid.user", "password": "short"},
    )
    assert invalid.status_code == 422
    assert "short" not in invalid.text

    created = await client.post(
        "/api/auth/register",
        json={"username": "valid.user", "password": "a-strong-study-password"},
    )
    assert created.status_code == 201

    duplicate = await client.post(
        "/api/auth/register",
        json={"username": "VALID.USER", "password": "another-strong-password"},
    )
    assert duplicate.status_code == 409

    await client.post("/api/auth/logout")
    bad_login = await client.post(
        "/api/auth/login",
        json={"username": "valid.user", "password": "wrong-study-password"},
    )
    assert bad_login.status_code == 401
    good_login = await client.post(
        "/api/auth/login",
        json={"username": "VALID.USER", "password": "a-strong-study-password"},
    )
    assert good_login.status_code == 200

    forwarded_https = await client.post(
        "/api/auth/logout",
        headers={
            "Origin": "https://testserver",
            "X-Forwarded-Proto": "https",
        },
    )
    assert forwarded_https.status_code == 204

    await client.post(
        "/api/auth/login",
        json={"username": "valid.user", "password": "a-strong-study-password"},
    )
    wrong_origin = await client.post(
        "/api/auth/logout",
        headers={"Origin": "https://attacker.example"},
    )
    assert wrong_origin.status_code == 403


async def test_google_avatar_url_validation() -> None:
    assert (
        verified_google_avatar({"picture": "https://lh3.googleusercontent.com/avatar"})
        == "https://lh3.googleusercontent.com/avatar"
    )
    assert verified_google_avatar({"picture": "http://lh3.googleusercontent.com/avatar"}) is None
    assert verified_google_avatar({"picture": "https://attacker.example/avatar"}) is None
    assert (
        verified_google_avatar({"picture": "https://user@lh3.googleusercontent.com/avatar"})
        is None
    )


async def test_study_data_rejects_invalid_ids_and_duplicate_items(
    client: httpx.AsyncClient,
) -> None:
    assert (StudyData.__tablename__, User.__tablename__) == ("user_study_data", "users")
    registered = await client.post(
        "/api/auth/register",
        json={"username": "schema.user", "password": "a-strong-study-password"},
    )
    assert registered.status_code == 201
    payload = (await client.get("/api/study-data")).json()
    payload["data"][1]["id"] = payload["data"][0]["id"]
    invalid = await client.put("/api/study-data", json=payload)
    assert invalid.status_code == 422


async def test_study_item_can_be_saved_with_term_or_meaning(client: httpx.AsyncClient) -> None:
    registered = await client.post(
        "/api/auth/register",
        json={"username": "partial.card", "password": "a-strong-study-password"},
    )
    assert registered.status_code == 201
    payload = (await client.get("/api/study-data")).json()
    payload["data"].extend(
        [
            {
                "id": "term_only_card",
                "term": "予約する",
                "meaning": "",
                "lesson": "Bài 01",
                "category": "Từ vựng bài học",
            },
            {
                "id": "meaning_only_card",
                "term": "",
                "meaning": "Đặt chỗ trước",
                "lesson": "Bài 01",
                "category": "Từ vựng bài học",
            },
        ]
    )

    saved = await client.put("/api/study-data", json=payload)
    assert saved.status_code == 200
    returned = await client.get("/api/study-data")
    assert returned.status_code == 200
    cards = {item["id"]: item for item in returned.json()["data"]}
    assert cards["term_only_card"]["term"] == "予約する"
    assert cards["meaning_only_card"]["meaning"] == "Đặt chỗ trước"

    payload["data"].append(
        {
            "id": "empty_card",
            "term": " ",
            "meaning": "",
            "lesson": "Bài 01",
            "category": "Từ vựng bài học",
        }
    )
    rejected = await client.put("/api/study-data", json=payload)
    assert rejected.status_code == 422


async def test_grammar_study_fields_are_saved_and_returned(client: httpx.AsyncClient) -> None:
    registered = await client.post(
        "/api/auth/register",
        json={"username": "grammar.user", "password": "a-strong-study-password"},
    )
    assert registered.status_code == 201
    payload = (await client.get("/api/study-data")).json()
    grammar = {
        "id": "grammar_test_item",
        "term": "〜ことにする",
        "meaning": "Tự quyết định sẽ làm việc gì.",
        "lesson": "Bài ngữ pháp",
        "category": "Ngữ pháp",
        "deck_folder": "Ngữ pháp N3",
        "deck_name": "Quyết định và dự định",
    }
    payload["data"].append(grammar)
    payload["lessons"].append(
        {
            "id": "lesson_test_1",
            "topic": "Từ vựng N3",
            "name": "Bài 01 · Con người",
            "created_at": "2026-10-14T00:00:00Z",
            "description": "Từ vựng chủ đề con người.",
        }
    )
    grammar.update(
        structure="Vる + ことにする",
        usage="Diễn tả quyết định của người nói.",
        context="Dùng khi tự quyết định sẽ làm việc gì.",
        jlpt_note="Phân biệt với ことになる.",
        study_note="Ghi nhớ chủ thể tự đưa ra quyết định.",
    )

    saved = await client.put("/api/study-data", json=payload)
    assert saved.status_code == 200
    returned = (await client.get("/api/study-data")).json()
    saved_grammar = next(item for item in returned["data"] if item["id"] == grammar["id"])
    assert saved_grammar["structure"] == "Vる + ことにする"
    assert saved_grammar["usage"] == "Diễn tả quyết định của người nói."
    assert saved_grammar["context"] == "Dùng khi tự quyết định sẽ làm việc gì."
    assert saved_grammar["jlpt_note"] == "Phân biệt với ことになる."
    assert saved_grammar["study_note"] == "Ghi nhớ chủ thể tự đưa ra quyết định."
    assert saved_grammar["deck_folder"] == "Ngữ pháp N3"
    assert saved_grammar["deck_name"] == "Quyết định và dự định"
    assert returned["lessons"][0]["name"] == "Bài 01 · Con người"

    legacy_payload = returned.copy()
    legacy_payload.pop("lessons")
    legacy_save = await client.put("/api/study-data", json=legacy_payload)
    assert legacy_save.status_code == 200
    preserved = (await client.get("/api/study-data")).json()
    assert preserved["lessons"][0]["id"] == "lesson_test_1"


async def test_health_and_static_frontend_are_served(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/health/live")).json() == {"status": "ok"}
    assert (await client.get("/api/health/ready")).json() == {"status": "ok"}
    page = await client.get("/")
    assert page.status_code == 200
    assert 'src="bootstrap.js"' in page.text
    grammar_script = await client.get("/grammar.js")
    assert grammar_script.status_code == 200
    assert "startGrammarQuiz" in grammar_script.text
