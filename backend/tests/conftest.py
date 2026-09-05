"""Pytest configuration and fixtures for Revora test suite."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.database import Base
from scripts.generate_data import generate_synthetic_dataset


@pytest.fixture(scope="function")
def test_db_session():
    """In-memory SQLite database session for unit tests."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def seeded_db_session(test_db_session):
    """Database session seeded with 500 records using seed 42."""
    generate_synthetic_dataset(num_payments=500, seed=42, db_session=test_db_session)
    return test_db_session
