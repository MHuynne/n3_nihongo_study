from __future__ import annotations

import os

os.environ.setdefault("SESSION_SECRET", "test-session-secret-with-at-least-32-chars")
os.environ.setdefault("MYSQL_HOST", "127.0.0.1")
os.environ.setdefault("MYSQL_USER", "n3studio_test")
os.environ.setdefault("MYSQL_PASSWORD", "test-database-password")
os.environ.setdefault("MYSQL_DATABASE", "n3_study_studio_test")
os.environ.setdefault("RATE_LIMIT_STORAGE_URI", "memory://")
