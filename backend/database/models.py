"""SQLAlchemy models for session tracking and analytics."""

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    Boolean,
    Integer,
    Float,
    ForeignKey,
    JSON,
    Enum as SQLEnum,
    TypeDecorator,
)
from sqlalchemy.orm import relationship, declarative_base
import enum

Base = declarative_base()


class EnumValueType(TypeDecorator):
    """Type decorator to ensure enum values (not names) are stored in the database."""
    impl = String
    cache_ok = True
    
    def __init__(self, enum_class, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.enum_class = enum_class
    
    def process_bind_param(self, value, dialect):
        """Convert enum to its value (string) when storing."""
        if value is None:
            return None
        if isinstance(value, enum.Enum):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        """Convert string back to enum when reading."""
        if value is None:
            return None
        return self.enum_class(value)


class SessionStatus(str, enum.Enum):
    """Status of an assessment session."""
    STARTED = "started"
    COMPANY_MATCHED = "company_matched"
    RESEARCHING = "researching"
    RESEARCH_COMPLETE = "research_complete"
    CLASSIFYING = "classifying"
    COMPLETED = "completed"
    ERROR = "error"
    ABANDONED = "abandoned"


class StepType(str, enum.Enum):
    """Types of steps in an assessment."""
    COMPANY_MATCHER = "company_matcher"
    COMPANY_RESEARCHER = "company_researcher"
    SERVICE_CATEGORIZER = "service_categorizer"
    MAIN_AGENT = "main_agent"


class Session(Base):
    """
    Represents a complete assessment session.
    
    One session = one user going through the full assessment flow
    (company lookup → research → classification → compliance report).
    """
    __tablename__ = "sessions"

    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Timestamps (timezone-aware)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Session info
    # Use EnumValueType to ensure enum values (lowercase strings) are stored, not enum names
    status = Column(EnumValueType(SessionStatus, length=50), default=SessionStatus.STARTED, nullable=False)
    
    # Company info (populated as user progresses)
    company_name = Column(String(500), nullable=True)
    company_domain = Column(String(500), nullable=True)
    country = Column(String(100), nullable=True)
    
    # Research summary (populated after research phase)
    is_manual_entry = Column(Boolean, default=False)
    research_summary = Column(JSON, nullable=True)  # Stores confirmed answers per section
    
    # Classification result (populated after classification)
    service_category = Column(String(100), nullable=True)
    is_in_scope = Column(Boolean, nullable=True)
    is_vlop = Column(Boolean, nullable=True)
    applicable_obligations_count = Column(Integer, nullable=True)
    total_obligations_count = Column(Integer, nullable=True)
    
    # Final compliance report (JSON)
    compliance_report = Column(JSON, nullable=True)
    
    # Metrics
    total_duration_seconds = Column(Float, nullable=True)
    total_llm_calls = Column(Integer, default=0)
    total_search_calls = Column(Integer, default=0)
    total_tokens_used = Column(Integer, default=0)  # If available
    estimated_cost_usd = Column(Float, default=0.0)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    
    # User agent / metadata
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(50), nullable=True)  # Consider privacy implications
    
    # Relationships
    steps = relationship("SessionStep", back_populates="session", cascade="all, delete-orphan", order_by="SessionStep.created_at")
    chat_messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status.value if self.status else None,
            "company_name": self.company_name,
            "company_domain": self.company_domain,
            "country": self.country,
            "is_manual_entry": self.is_manual_entry,
            "research_summary": self.research_summary,
            "service_category": self.service_category,
            "is_in_scope": self.is_in_scope,
            "is_vlop": self.is_vlop,
            "applicable_obligations_count": self.applicable_obligations_count,
            "total_obligations_count": self.total_obligations_count,
            "compliance_report": self.compliance_report,
            "total_duration_seconds": self.total_duration_seconds,
            "total_llm_calls": self.total_llm_calls,
            "total_search_calls": self.total_search_calls,
            "total_tokens_used": self.total_tokens_used,
            "estimated_cost_usd": self.estimated_cost_usd,
            "error_message": self.error_message,
            "steps_count": len(self.steps) if self.steps else 0,
            "chat_messages_count": len(self.chat_messages) if self.chat_messages else 0,
        }

    def to_detail_dict(self) -> Dict[str, Any]:
        """Convert to detailed dictionary including steps and messages."""
        base = self.to_dict()
        base["steps"] = [step.to_dict() for step in self.steps] if self.steps else []
        base["chat_messages"] = [msg.to_dict() for msg in self.chat_messages] if self.chat_messages else []
        return base


class SessionStep(Base):
    """
    Represents a single step/API call within a session.
    
    Each call to company_matcher, company_researcher, service_categorizer
    creates one SessionStep record.
    """
    __tablename__ = "session_steps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    
    # Timestamps (timezone-aware)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Step info
    # Use EnumValueType to ensure enum values (lowercase strings) are stored, not enum names
    step_type = Column(EnumValueType(StepType, length=50), nullable=False)
    status = Column(String(50), default="started")  # started, streaming, completed, error
    
    # Request/Response data
    request_data = Column(JSON, nullable=True)
    response_data = Column(JSON, nullable=True)
    
    # Metrics for this step
    duration_seconds = Column(Float, nullable=True)
    llm_calls = Column(Integer, default=0)
    search_calls = Column(Integer, default=0)
    cache_hits = Column(Integer, default=0)
    tokens_used = Column(Integer, default=0)
    
    # Sources found (for researcher)
    sources_found = Column(JSON, nullable=True)  # List of {url, title}
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    
    # Relationship
    session = relationship("Session", back_populates="steps")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "step_type": self.step_type.value if self.step_type else None,
            "status": self.status,
            "request_data": self.request_data,
            "response_data": self.response_data,
            "duration_seconds": self.duration_seconds,
            "llm_calls": self.llm_calls,
            "search_calls": self.search_calls,
            "cache_hits": self.cache_hits,
            "tokens_used": self.tokens_used,
            "sources_found": self.sources_found,
            "error_message": self.error_message,
        }


class ChatMessage(Base):
    """
    Represents a single chat message with the main agent.
    
    Stores both user messages and assistant responses.
    """
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    
    # Timestamps (timezone-aware)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Message info
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    
    # Context that was passed
    frontend_context = Column(Text, nullable=True)
    context_mode = Column(String(50), nullable=True)
    
    # Metrics
    duration_seconds = Column(Float, nullable=True)
    tools_used = Column(JSON, nullable=True)  # List of tool names used
    sources_cited = Column(JSON, nullable=True)  # List of sources from web search
    
    # Relationship
    session = relationship("Session", back_populates="chat_messages")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "role": self.role,
            "content": self.content,
            "frontend_context": self.frontend_context,
            "context_mode": self.context_mode,
            "duration_seconds": self.duration_seconds,
            "tools_used": self.tools_used,
            "sources_cited": self.sources_cited,
        }

