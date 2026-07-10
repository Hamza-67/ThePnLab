"""
conftest.py — fixtures pytest : DB SQLite in-memory + TestClient + user authentifié.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.models.portfolio import Portfolio
from app.auth import hash_password, create_access_token
from app.config import STARTING_CASH


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    # Pas de context manager → le lifespan (scheduler bot) ne démarre pas en test
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_user(db_session):
    """User créé directement en DB (évite le rate-limit signup) + ses 2 portfolios."""
    user = User(
        email="test@thepnlab.com",
        name="TestUser",
        school="Test School",
        password_hash=hash_password("password123"),
    )
    db_session.add(user)
    db_session.flush()
    db_session.add(Portfolio(user_id=user.id, name="USER", cash=STARTING_CASH))
    db_session.add(Portfolio(user_id=user.id, name="AI",   cash=STARTING_CASH))
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def auth_headers(auth_user):
    token = create_access_token(auth_user.id)
    return {"Authorization": f"Bearer {token}"}
