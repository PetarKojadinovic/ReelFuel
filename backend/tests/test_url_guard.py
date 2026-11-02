import pytest

from app.core.url_guard import host_ok


@pytest.mark.parametrize(
    "url",
    [
        "https://www.instagram.com/reel/abc/",
        "https://instagram.com/p/xyz",
        "https://vm.tiktok.com/ZM123/",
        "http://www.tiktok.com/@nalog/video/1",
    ],
)
def test_dozvoljeni(url):
    assert host_ok(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://instagram.com.evil.com/reel/abc",
        "https://evilinstagram.com/reel/abc",
        "file:///etc/passwd",
        "ftp://instagram.com/x",
        "http://127.0.0.1:8000/docs",
        "http://169.254.169.254/latest/meta-data",
        "https://youtube.com/watch?v=1",
        "",
        "instagram.com/reel/abc",
    ],
)
def test_zabranjeni(url):
    assert not host_ok(url)
