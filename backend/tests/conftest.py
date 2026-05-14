import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from main import app
from db import get_db, init_db, get_connection


@pytest.fixture
def test_db_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    init_db(path)
    return path


@pytest.fixture
def client(test_db_path: Path) -> TestClient:
    def override_get_db():
        conn = get_connection(test_db_path)
        try:
            yield conn
        finally:
            conn.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
