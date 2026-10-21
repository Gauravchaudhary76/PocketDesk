import io
import pytest
from pathlib import Path
from app.services.auth import AuthService
from app.config import settings


@pytest.fixture(autouse=True)
def setup_test_sandbox(tmp_path, monkeypatch):
    """Ensure a clean sandbox root for file tests."""
    sandbox = tmp_path / "sandbox_test"
    sandbox.mkdir(parents=True, exist_ok=True)
    
    # Create sample files
    (sandbox / "sample_doc.txt").write_text("Hello PocketDesk Stage 7!", encoding="utf-8")
    (sandbox / "nested_dir").mkdir(exist_ok=True)
    (sandbox / "nested_dir" / "nested_file.txt").write_text("Nested content", encoding="utf-8")

    # Override get_approved_roots
    mock_roots = {
        "test_root": {
            "name": "Test Sandbox",
            "path": str(sandbox),
            "display": "Sandbox",
        }
    }
    monkeypatch.setattr(settings, "get_approved_roots", lambda: mock_roots)
    return sandbox


def get_auth_headers(client):
    """Helper to pair and return valid authorization headers."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()
    res = client.post("/api/pair", json={"pairing_code": code})
    assert res.status_code == 200
    token = res.json()["session_token"]
    return {"Authorization": f"Bearer {token}"}


def test_files_unauthorized(client):
    """Verify all file endpoints reject unauthenticated requests."""
    assert client.get("/api/files/roots").status_code == 401
    assert client.get("/api/files/list?root_id=test_root").status_code == 401
    assert client.get("/api/files/download?root_id=test_root&path=sample_doc.txt").status_code == 401
    assert client.post("/api/files/upload", data={"root_id": "test_root"}).status_code == 401
    assert client.post("/api/files/mkdir", json={"root_id": "test_root", "folder_name": "new"}).status_code == 401


def test_get_roots(client):
    """Verify GET /api/files/roots returns approved roots."""
    headers = get_auth_headers(client)
    res = client.get("/api/files/roots", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "roots" in data
    assert len(data["roots"]) > 0
    assert data["roots"][0]["id"] == "test_root"
    assert data["roots"][0]["name"] == "Test Sandbox"


def test_list_directory(client):
    """Verify GET /api/files/list lists contents accurately."""
    headers = get_auth_headers(client)
    res = client.get("/api/files/list?root_id=test_root", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["root_id"] == "test_root"
    assert data["current_path"] == ""
    assert data["parent_path"] is None

    names = [item["name"] for item in data["items"]]
    assert "sample_doc.txt" in names
    assert "nested_dir" in names

    doc_item = next(i for i in data["items"] if i["name"] == "sample_doc.txt")
    assert doc_item["is_dir"] is False
    assert doc_item["size_bytes"] > 0
    assert doc_item["extension"] == "txt"


def test_list_nested_directory(client):
    """Verify listing a subfolder returns items and correct parent_path."""
    headers = get_auth_headers(client)
    res = client.get("/api/files/list?root_id=test_root&path=nested_dir", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["current_path"] == "nested_dir"
    assert data["parent_path"] == ""
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "nested_file.txt"


def test_path_traversal_blocked(client):
    """Verify various path traversal attack vectors are blocked with 403."""
    headers = get_auth_headers(client)

    vectors = [
        "../",
        "../../",
        "../../Windows",
        r"..\..\Windows",
        "nested_dir/../../outside",
        "/etc/passwd",
        "C:/Windows",
        "C:\\Windows\\System32",
    ]

    for vec in vectors:
        res = client.get(f"/api/files/list?root_id=test_root&path={vec}", headers=headers)
        assert res.status_code == 403, f"Expected 403 for traversal vector '{vec}', got {res.status_code}"


def test_null_byte_blocked():
    """Verify null bytes in path raise 400 Bad Request."""
    from fastapi import HTTPException
    from app.services.file_manager import file_manager

    with pytest.raises(HTTPException) as exc_info:
        file_manager.resolve_safe_path("test_root", "nested\x00dir")
    assert exc_info.value.status_code == 400
    assert "null byte" in exc_info.value.detail.lower()


def test_sensitive_files_blocked(client, setup_test_sandbox):
    """Verify sensitive files cannot be listed or accessed."""
    headers = get_auth_headers(client)
    sandbox = setup_test_sandbox

    # Create sensitive files
    (sandbox / ".env").write_text("SECRET_KEY=12345", encoding="utf-8")
    (sandbox / "id_rsa").write_text("PRIVATE KEY", encoding="utf-8")
    (sandbox / "test.key").write_text("CERT KEY", encoding="utf-8")

    # Verify listing does not expose them
    res = client.get("/api/files/list?root_id=test_root", headers=headers)
    assert res.status_code == 200
    names = [i["name"] for i in res.json()["items"]]
    assert ".env" not in names
    assert "id_rsa" not in names
    assert "test.key" not in names

    # Verify direct download is rejected with 403
    assert client.get("/api/files/download?root_id=test_root&path=.env", headers=headers).status_code == 403
    assert client.get("/api/files/download?root_id=test_root&path=id_rsa", headers=headers).status_code == 403
    assert client.get("/api/files/download?root_id=test_root&path=test.key", headers=headers).status_code == 403


def test_download_file(client):
    """Verify downloading an authorized file works."""
    headers = get_auth_headers(client)
    res = client.get("/api/files/download?root_id=test_root&path=sample_doc.txt", headers=headers)
    assert res.status_code == 200
    assert res.text == "Hello PocketDesk Stage 7!"
    assert "sample_doc.txt" in res.headers["Content-Disposition"]


def test_create_folder(client):
    """Verify creating a new folder."""
    headers = get_auth_headers(client)
    res = client.post(
        "/api/files/mkdir",
        json={"root_id": "test_root", "path": "", "folder_name": "My New Folder"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Check directory now has the new folder
    list_res = client.get("/api/files/list?root_id=test_root", headers=headers)
    names = [i["name"] for i in list_res.json()["items"]]
    assert "My New Folder" in names


def test_create_folder_invalid_names(client):
    """Verify invalid folder names and Windows reserved names are rejected."""
    headers = get_auth_headers(client)

    # Windows reserved name
    res = client.post(
        "/api/files/mkdir",
        json={"root_id": "test_root", "path": "", "folder_name": "CON"},
        headers=headers,
    )
    assert res.status_code == 400

    # Illegal character
    res = client.post(
        "/api/files/mkdir",
        json={"root_id": "test_root", "path": "", "folder_name": "folder/name"},
        headers=headers,
    )
    assert res.status_code == 400


def test_upload_file(client):
    """Verify uploading a file to an approved destination."""
    headers = get_auth_headers(client)
    file_content = b"Upload test content for Stage 7"
    file_obj = io.BytesIO(file_content)

    res = client.post(
        "/api/files/upload",
        data={"root_id": "test_root", "path": ""},
        files={"file": ("uploaded_file.txt", file_obj, "text/plain")},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert res.json()["size_bytes"] == len(file_content)

    # Verify download of uploaded file
    down_res = client.get("/api/files/download?root_id=test_root&path=uploaded_file.txt", headers=headers)
    assert down_res.status_code == 200
    assert down_res.content == file_content


def test_upload_size_limit_rejection(client, monkeypatch):
    """Verify uploading a file exceeding size limit is rejected with 413."""
    headers = get_auth_headers(client)

    # Set artificially low upload limit for test (100 bytes)
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 100)

    oversized_content = b"A" * 500
    file_obj = io.BytesIO(oversized_content)

    res = client.post(
        "/api/files/upload",
        data={"root_id": "test_root", "path": ""},
        files={"file": ("oversized.txt", file_obj, "text/plain")},
        headers=headers,
    )
    assert res.status_code == 413
    assert "exceeded" in res.json()["detail"].lower()
