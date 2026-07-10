"""Tests auth : signup, login, /me."""


def test_signup_creates_user_and_portfolios(client, db_session):
    resp = client.post("/api/auth/signup", json={
        "email": "new@thepnlab.com",
        "name": "NewUser",
        "school": "ESSEC",
        "password": "supersecret1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["name"] == "NewUser"

    from app.models.portfolio import Portfolio
    pfs = db_session.query(Portfolio).filter(Portfolio.user_id == data["user_id"]).all()
    assert {p.name for p in pfs} == {"USER", "AI"}


def test_signup_rejects_short_password(client):
    resp = client.post("/api/auth/signup", json={
        "email": "short@thepnlab.com",
        "name": "ShortPw",
        "password": "abc",
    })
    assert resp.status_code == 400


def test_signup_rejects_duplicate_email(client, auth_user):
    resp = client.post("/api/auth/signup", json={
        "email": auth_user.email,
        "name": "Autre",
        "password": "password123",
    })
    assert resp.status_code == 400
    assert "déjà" in resp.json()["detail"]


def test_login_ok(client, auth_user):
    resp = client.post("/api/auth/login", data={
        "username": auth_user.email,
        "password": "password123",
    })
    assert resp.status_code == 200
    assert resp.json()["user_id"] == auth_user.id


def test_login_wrong_password(client, auth_user):
    resp = client.post("/api/auth/login", data={
        "username": auth_user.email,
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_token(client, auth_headers, auth_user):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == auth_user.email
