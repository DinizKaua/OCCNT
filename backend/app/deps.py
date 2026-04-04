from __future__ import annotations

from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from .config import SESSION_COOKIE_NAME
from .database import get_db
from .models import AppSession
from .services.session_storage import ensure_session


def get_current_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AppSession:
    session_record, cookie_needs_refresh = ensure_session(db, request.cookies.get(SESSION_COOKIE_NAME))
    if cookie_needs_refresh:
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_record.id,
            httponly=True,
            samesite="lax",
            secure=False,
            max_age=60 * 60 * 24 * 30,
        )
    return session_record
