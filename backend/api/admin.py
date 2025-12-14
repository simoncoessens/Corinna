"""Admin API endpoints for session monitoring and analytics."""

import os
import io
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import desc, func
import secrets

from database import get_db, Session, SessionStep, ChatMessage
from database.models import SessionStatus, StepType

# =============================================================================
# Authentication
# =============================================================================

security = HTTPBasic()

# Admin credentials from environment
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "corinna-admin-2024")  # Change in production!


def verify_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """Verify admin credentials using HTTP Basic Auth."""
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# =============================================================================
# Router
# =============================================================================

router = APIRouter(prefix="/admin", tags=["admin"])


# =============================================================================
# Dashboard Stats
# =============================================================================

@router.get("/stats")
def get_dashboard_stats(
    admin: str = Depends(verify_admin),
    db: DBSession = Depends(get_db),
    days: int = Query(default=7, ge=1, le=90),
):
    """Get dashboard statistics for the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Total sessions
    total_sessions = db.query(Session).filter(Session.created_at >= cutoff).count()
    
    # Sessions by status
    status_counts = dict(
        db.query(Session.status, func.count(Session.id))
        .filter(Session.created_at >= cutoff)
        .group_by(Session.status)
        .all()
    )
    
    # Completed sessions
    completed = status_counts.get(SessionStatus.COMPLETED, 0)
    
    # Error rate
    errors = status_counts.get(SessionStatus.ERROR, 0)
    error_rate = (errors / total_sessions * 100) if total_sessions > 0 else 0
    
    # Average duration for completed sessions
    avg_duration_result = (
        db.query(func.avg(Session.total_duration_seconds))
        .filter(Session.created_at >= cutoff)
        .filter(Session.status == SessionStatus.COMPLETED)
        .scalar()
    )
    avg_duration = avg_duration_result or 0
    
    # Total API calls
    total_llm_calls = (
        db.query(func.sum(Session.total_llm_calls))
        .filter(Session.created_at >= cutoff)
        .scalar() or 0
    )
    total_search_calls = (
        db.query(func.sum(Session.total_search_calls))
        .filter(Session.created_at >= cutoff)
        .scalar() or 0
    )
    
    # Estimated cost
    total_cost = (
        db.query(func.sum(Session.estimated_cost_usd))
        .filter(Session.created_at >= cutoff)
        .scalar() or 0
    )
    
    # Sessions per day for chart
    sessions_per_day = []
    for i in range(days):
        day = datetime.now(timezone.utc).date() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time(), timezone.utc)
        day_end = datetime.combine(day, datetime.max.time(), timezone.utc)
        count = (
            db.query(Session)
            .filter(Session.created_at >= day_start)
            .filter(Session.created_at <= day_end)
            .count()
        )
        sessions_per_day.append({
            "date": day.isoformat(),
            "count": count,
        })
    sessions_per_day.reverse()
    
    # Top companies researched
    top_companies = (
        db.query(Session.company_name, func.count(Session.id).label("count"))
        .filter(Session.created_at >= cutoff)
        .filter(Session.company_name.isnot(None))
        .group_by(Session.company_name)
        .order_by(desc("count"))
        .limit(10)
        .all()
    )
    
    # Service category distribution
    category_distribution = dict(
        db.query(Session.service_category, func.count(Session.id))
        .filter(Session.created_at >= cutoff)
        .filter(Session.service_category.isnot(None))
        .group_by(Session.service_category)
        .all()
    )
    
    return {
        "period_days": days,
        "total_sessions": total_sessions,
        "completed_sessions": completed,
        "error_count": errors,
        "error_rate_percent": round(error_rate, 1),
        "avg_duration_seconds": round(avg_duration, 1),
        "total_llm_calls": total_llm_calls,
        "total_search_calls": total_search_calls,
        "estimated_cost_usd": round(total_cost, 2),
        "sessions_per_day": sessions_per_day,
        "top_companies": [{"name": name, "count": count} for name, count in top_companies],
        "category_distribution": category_distribution,
        "status_distribution": {k.value if k else "unknown": v for k, v in status_counts.items()},
    }


# =============================================================================
# Session List
# =============================================================================

@router.get("/sessions")
def list_sessions(
    admin: str = Depends(verify_admin),
    db: DBSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    company: Optional[str] = Query(default=None),
    days: Optional[int] = Query(default=None, ge=1, le=365),
):
    """List sessions with pagination and filtering."""
    query = db.query(Session)
    
    # Filters
    if status:
        try:
            query = query.filter(Session.status == SessionStatus(status))
        except ValueError:
            pass
    
    if company:
        query = query.filter(Session.company_name.ilike(f"%{company}%"))
    
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.filter(Session.created_at >= cutoff)
    
    # Total count
    total = query.count()
    
    # Paginate
    query = query.order_by(desc(Session.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    sessions = query.all()
    
    return {
        "sessions": [s.to_dict() for s in sessions],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# =============================================================================
# Session Detail
# =============================================================================

@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    admin: str = Depends(verify_admin),
    db: DBSession = Depends(get_db),
):
    """Get detailed session information including steps and chat messages."""
    session = db.query(Session).filter(Session.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session.to_detail_dict()


# =============================================================================
# Session Timeline
# =============================================================================

@router.get("/sessions/{session_id}/timeline")
def get_session_timeline(
    session_id: str,
    admin: str = Depends(verify_admin),
    db: DBSession = Depends(get_db),
):
    """Get a timeline of all events in a session."""
    session = db.query(Session).filter(Session.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    timeline = []
    
    # Add session start
    timeline.append({
        "timestamp": session.created_at.isoformat(),
        "type": "session_start",
        "title": "Assessment Started",
        "details": {"status": session.status.value if session.status else None},
    })
    
    # Add steps
    for step in session.steps:
        timeline.append({
            "timestamp": step.created_at.isoformat(),
            "type": f"step_{step.step_type.value}",
            "title": f"{step.step_type.value.replace('_', ' ').title()} Started",
            "details": {
                "request": step.request_data,
                "status": step.status,
            },
        })
        if step.completed_at:
            timeline.append({
                "timestamp": step.completed_at.isoformat(),
                "type": f"step_{step.step_type.value}_complete",
                "title": f"{step.step_type.value.replace('_', ' ').title()} Completed",
                "details": {
                    "duration_seconds": step.duration_seconds,
                    "llm_calls": step.llm_calls,
                    "search_calls": step.search_calls,
                    "response_preview": str(step.response_data)[:500] if step.response_data else None,
                },
            })
    
    # Add chat messages
    for msg in session.chat_messages:
        timeline.append({
            "timestamp": msg.created_at.isoformat(),
            "type": f"chat_{msg.role}",
            "title": f"Chat: {msg.role.title()}",
            "details": {
                "content": msg.content[:500] if msg.content else None,
                "tools_used": msg.tools_used,
            },
        })
    
    # Add session completion if applicable
    if session.completed_at:
        timeline.append({
            "timestamp": session.completed_at.isoformat(),
            "type": "session_complete",
            "title": "Assessment Completed",
            "details": {
                "duration_seconds": session.total_duration_seconds,
                "service_category": session.service_category,
                "obligations_count": session.applicable_obligations_count,
            },
        })
    
    # Sort by timestamp
    timeline.sort(key=lambda x: x["timestamp"])
    
    return {"session_id": session_id, "timeline": timeline}


# =============================================================================
# PDF Export
# =============================================================================

@router.get("/sessions/{session_id}/export/pdf")
def export_session_pdf(
    session_id: str,
    admin: str = Depends(verify_admin),
    db: DBSession = Depends(get_db),
):
    """Export session as PDF report."""
    session = db.query(Session).filter(Session.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF export requires reportlab. Install with: pip install reportlab"
        )
    
    # Create PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
    )
    body_style = styles['BodyText']
    
    story = []
    
    # Title
    story.append(Paragraph("DSA Compliance Assessment Report", title_style))
    story.append(Paragraph(f"Generated by Corinna", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Session Info
    story.append(Paragraph("Session Information", heading_style))
    session_data = [
        ["Company", session.company_name or "N/A"],
        ["Domain", session.company_domain or "N/A"],
        ["Country", session.country or "N/A"],
        ["Date", session.created_at.strftime("%Y-%m-%d %H:%M UTC") if session.created_at else "N/A"],
        ["Status", session.status.value if session.status else "N/A"],
        ["Duration", f"{session.total_duration_seconds:.1f}s" if session.total_duration_seconds else "N/A"],
    ]
    t = Table(session_data, colWidths=[100, 350])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t)
    story.append(Spacer(1, 20))
    
    # Classification Result
    if session.service_category:
        story.append(Paragraph("Classification Result", heading_style))
        classification_data = [
            ["Service Category", session.service_category],
            ["In Scope (DSA)", "Yes" if session.is_in_scope else "No"],
            ["VLOP/VLOSE", "Yes" if session.is_vlop else "No"],
            ["Applicable Obligations", f"{session.applicable_obligations_count or 0} of {session.total_obligations_count or 0}"],
        ]
        t = Table(classification_data, colWidths=[150, 300])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
    
    # Research Findings
    if session.research_summary:
        story.append(Paragraph("Research Findings", heading_style))
        for section, answers in session.research_summary.items():
            story.append(Paragraph(f"<b>{section}</b>", body_style))
            if isinstance(answers, list):
                for answer in answers:
                    if isinstance(answer, dict):
                        q = answer.get("question", "")
                        a = answer.get("answer", "")
                        story.append(Paragraph(f"• <i>{q}</i>", body_style))
                        story.append(Paragraph(f"  {a}", body_style))
            story.append(Spacer(1, 10))
    
    # Compliance Report
    if session.compliance_report:
        story.append(PageBreak())
        story.append(Paragraph("Compliance Obligations", heading_style))
        
        report = session.compliance_report
        obligations = report.get("obligations", [])
        
        for obl in obligations:
            applies = obl.get("applies", False)
            status_text = "✓ Applies" if applies else "○ Does not apply"
            story.append(Paragraph(
                f"<b>Article {obl.get('article', '?')}: {obl.get('title', 'Unknown')}</b> - {status_text}",
                body_style
            ))
            if applies:
                implications = obl.get("implications", "")
                if implications:
                    story.append(Paragraph(f"<i>{implications[:300]}...</i>" if len(implications) > 300 else f"<i>{implications}</i>", body_style))
                action_items = obl.get("action_items", [])
                if action_items:
                    story.append(Paragraph("Action items:", body_style))
                    for item in action_items[:5]:
                        story.append(Paragraph(f"  • {item}", body_style))
            story.append(Spacer(1, 10))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    filename = f"corinna_assessment_{session.company_name or session_id}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    filename = filename.replace(" ", "_").replace("/", "_")
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================================
# Delete Session
# =============================================================================

@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    admin: str = Depends(verify_admin),
    db: DBSession = Depends(get_db),
):
    """Delete a session and all related data."""
    session = db.query(Session).filter(Session.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.delete(session)
    db.commit()
    
    return {"status": "deleted", "session_id": session_id}


# =============================================================================
# Bulk Operations
# =============================================================================

@router.delete("/sessions/cleanup/old")
def cleanup_old_sessions(
    admin: str = Depends(verify_admin),
    db: DBSession = Depends(get_db),
    days: int = Query(default=30, ge=7, le=365),
):
    """Delete sessions older than N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    count = db.query(Session).filter(Session.created_at < cutoff).count()
    db.query(Session).filter(Session.created_at < cutoff).delete()
    db.commit()
    
    return {"deleted_count": count, "cutoff_date": cutoff.isoformat()}

