import io
from PIL import Image

def _png_bytes(w=2000, h=1000):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()

def test_upload_resizes_and_returns_static_path(editor_client):
    files = {"file": ("hero.png", _png_bytes(), "image/png")}
    r = editor_client.post("/api/admin/uploads/image", files=files)
    assert r.status_code == 201
    body = r.json()
    assert body["url"].startswith("/static/img/")
    assert body["filename"].endswith(".png")

def test_upload_rejects_non_image(editor_client):
    files = {"file": ("notes.txt", b"hello", "text/plain")}
    r = editor_client.post("/api/admin/uploads/image", files=files)
    assert r.status_code == 415

def test_upload_requires_editor(reader_client):
    files = {"file": ("x.png", _png_bytes(10, 10), "image/png")}
    assert reader_client.post("/api/admin/uploads/image", files=files).status_code == 403
