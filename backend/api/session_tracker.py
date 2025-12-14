"""Session tracking service for monitoring user assessments."""

import time
from datetime import datetime
from typing import Optional, Dict, Any, List
from contextlib import contextmanager

from database import Session, SessionStep, ChatMessage
from database.models import SessionStatus, StepType
from database.connection import get_db_context


class SessionTracker:
    """
    Tracks user assessment sessions and their steps.
    
    Usage:
        tracker = SessionTracker()
        
        # When session starts (or is created)
        tracker.get_or_create_session(session_id, company_name="Acme Corp")
        
        # When a step starts
        step_id = tracker.start_step(session_id, StepType.COMPANY_RESEARCHER, request_data)
        
        # During streaming, update metrics
        tracker.increment_step_metrics(step_id, llm_calls=1)
        
        # When step completes
        tracker.complete_step(step_id, response_data)
    """
    
    def get_or_create_session(
        self,
        session_id: str,
        company_name: Optional[str] = None,
        company_domain: Optional[str] = None,
        country: Optional[str] = None,
        is_manual: bool = False,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Session:
        """Get existing session or create a new one."""
        with get_db_context() as db:
            session = db.query(Session).filter(Session.id == session_id).first()
            
            if not session:
                session = Session(
                    id=session_id,
                    company_name=company_name,
                    company_domain=company_domain,
                    country=country,
                    is_manual_entry=is_manual,
                    user_agent=user_agent,
                    ip_address=ip_address,
                    status=SessionStatus.STARTED,
                )
                db.add(session)
                db.commit()
                db.refresh(session)
            else:
                # Update fields if provided
                if company_name and not session.company_name:
                    session.company_name = company_name
                if company_domain and not session.company_domain:
                    session.company_domain = company_domain
                if country and not session.country:
                    session.country = country
                db.commit()
            
            return session
    
    def update_session(
        self,
        session_id: str,
        status: Optional[SessionStatus] = None,
        company_name: Optional[str] = None,
        company_domain: Optional[str] = None,
        service_category: Optional[str] = None,
        is_in_scope: Optional[bool] = None,
        is_vlop: Optional[bool] = None,
        applicable_obligations_count: Optional[int] = None,
        total_obligations_count: Optional[int] = None,
        research_summary: Optional[Dict] = None,
        compliance_report: Optional[Dict] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Update session with new information."""
        with get_db_context() as db:
            session = db.query(Session).filter(Session.id == session_id).first()
            if not session:
                return
            
            if status:
                session.status = status
            if company_name:
                session.company_name = company_name
            if company_domain:
                session.company_domain = company_domain
            if service_category:
                session.service_category = service_category
            if is_in_scope is not None:
                session.is_in_scope = is_in_scope
            if is_vlop is not None:
                session.is_vlop = is_vlop
            if applicable_obligations_count is not None:
                session.applicable_obligations_count = applicable_obligations_count
            if total_obligations_count is not None:
                session.total_obligations_count = total_obligations_count
            if research_summary:
                session.research_summary = research_summary
            if compliance_report:
                session.compliance_report = compliance_report
            if error_message:
                session.error_message = error_message
                session.status = SessionStatus.ERROR
            
            db.commit()
    
    def complete_session(self, session_id: str) -> None:
        """Mark session as completed and calculate totals."""
        with get_db_context() as db:
            session = db.query(Session).filter(Session.id == session_id).first()
            if not session:
                return
            
            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.utcnow()
            
            # Calculate total duration
            if session.created_at:
                session.total_duration_seconds = (
                    session.completed_at - session.created_at
                ).total_seconds()
            
            # Sum up metrics from steps
            total_llm = 0
            total_search = 0
            total_tokens = 0
            
            for step in session.steps:
                total_llm += step.llm_calls or 0
                total_search += step.search_calls or 0
                total_tokens += step.tokens_used or 0
            
            session.total_llm_calls = total_llm
            session.total_search_calls = total_search
            session.total_tokens_used = total_tokens
            
            # Estimate cost (rough estimates)
            # DeepSeek: ~$0.0001 per 1K tokens (very rough)
            # Tavily: ~$0.01 per search
            token_cost = total_tokens * 0.0001 / 1000
            search_cost = total_search * 0.01
            session.estimated_cost_usd = token_cost + search_cost
            
            db.commit()
    
    def start_step(
        self,
        session_id: str,
        step_type: StepType,
        request_data: Optional[Dict] = None,
    ) -> str:
        """Start a new step and return the step ID."""
        with get_db_context() as db:
            step = SessionStep(
                session_id=session_id,
                step_type=step_type,
                request_data=request_data,
                status="streaming",
            )
            db.add(step)
            db.commit()
            db.refresh(step)
            
            # Update session status based on step type
            session = db.query(Session).filter(Session.id == session_id).first()
            if session:
                if step_type == StepType.COMPANY_MATCHER:
                    session.status = SessionStatus.STARTED
                elif step_type == StepType.COMPANY_RESEARCHER:
                    session.status = SessionStatus.RESEARCHING
                elif step_type == StepType.SERVICE_CATEGORIZER:
                    session.status = SessionStatus.CLASSIFYING
                db.commit()
            
            return step.id
    
    def update_step_metrics(
        self,
        step_id: str,
        llm_calls: int = 0,
        search_calls: int = 0,
        cache_hits: int = 0,
        tokens_used: int = 0,
        sources: Optional[List[Dict]] = None,
    ) -> None:
        """Update metrics for a step (increments existing values)."""
        with get_db_context() as db:
            step = db.query(SessionStep).filter(SessionStep.id == step_id).first()
            if not step:
                return
            
            step.llm_calls = (step.llm_calls or 0) + llm_calls
            step.search_calls = (step.search_calls or 0) + search_calls
            step.cache_hits = (step.cache_hits or 0) + cache_hits
            step.tokens_used = (step.tokens_used or 0) + tokens_used
            
            if sources:
                existing = step.sources_found or []
                step.sources_found = existing + sources
            
            db.commit()
    
    def complete_step(
        self,
        step_id: str,
        response_data: Optional[Dict] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Complete a step with optional response data."""
        with get_db_context() as db:
            step = db.query(SessionStep).filter(SessionStep.id == step_id).first()
            if not step:
                return
            
            step.completed_at = datetime.utcnow()
            step.status = "error" if error_message else "completed"
            step.response_data = response_data
            step.error_message = error_message
            
            if step.created_at:
                step.duration_seconds = (step.completed_at - step.created_at).total_seconds()
            
            db.commit()
    
    def add_chat_message(
        self,
        session_id: str,
        role: str,
        content: str,
        frontend_context: Optional[str] = None,
        context_mode: Optional[str] = None,
        duration_seconds: Optional[float] = None,
        tools_used: Optional[List[str]] = None,
        sources_cited: Optional[List[Dict]] = None,
    ) -> str:
        """Add a chat message to the session."""
        with get_db_context() as db:
            message = ChatMessage(
                session_id=session_id,
                role=role,
                content=content,
                frontend_context=frontend_context,
                context_mode=context_mode,
                duration_seconds=duration_seconds,
                tools_used=tools_used,
                sources_cited=sources_cited,
            )
            db.add(message)
            db.commit()
            db.refresh(message)
            return message.id


# Global tracker instance
tracker = SessionTracker()


class StepContext:
    """
    Context manager for tracking a step's lifecycle.
    
    Usage:
        with StepContext(session_id, StepType.COMPANY_RESEARCHER, request_data) as ctx:
            # ... do work ...
            ctx.add_llm_call()
            ctx.add_search_call()
            ctx.set_response(response_data)
    """
    
    def __init__(
        self,
        session_id: str,
        step_type: StepType,
        request_data: Optional[Dict] = None,
    ):
        self.session_id = session_id
        self.step_type = step_type
        self.request_data = request_data
        self.step_id: Optional[str] = None
        self.response_data: Optional[Dict] = None
        self.error: Optional[str] = None
        self._llm_calls = 0
        self._search_calls = 0
        self._cache_hits = 0
        self._sources: List[Dict] = []
    
    def __enter__(self):
        self.step_id = tracker.start_step(
            self.session_id,
            self.step_type,
            self.request_data,
        )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.error = str(exc_val)
        
        # Flush any accumulated metrics
        if self._llm_calls or self._search_calls or self._cache_hits or self._sources:
            tracker.update_step_metrics(
                self.step_id,
                llm_calls=self._llm_calls,
                search_calls=self._search_calls,
                cache_hits=self._cache_hits,
                sources=self._sources,
            )
        
        tracker.complete_step(
            self.step_id,
            response_data=self.response_data,
            error_message=self.error,
        )
        
        return False  # Don't suppress exceptions
    
    def add_llm_call(self, count: int = 1):
        """Record LLM call(s)."""
        self._llm_calls += count
    
    def add_search_call(self, count: int = 1):
        """Record search call(s)."""
        self._search_calls += count
    
    def add_cache_hit(self, count: int = 1):
        """Record cache hit(s)."""
        self._cache_hits += count
    
    def add_source(self, url: str, title: Optional[str] = None):
        """Record a source found."""
        self._sources.append({"url": url, "title": title})
    
    def set_response(self, data: Dict):
        """Set the response data."""
        self.response_data = data
    
    def set_error(self, message: str):
        """Set an error message."""
        self.error = message

