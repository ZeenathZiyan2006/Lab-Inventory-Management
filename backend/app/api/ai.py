"""
AI API Endpoints for SMVITM Inventory Management System
Serves Fault Classification, Smart Assistant, Demand Forecasting, Reorder Recommendations, and Model Health.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.core.permissions import get_current_user, verify_lab_access
from app.models.models import User, Laboratory, UserRole
from app.schemas.ai import (
    FaultClassifyRequest, FaultClassifyResponse,
    AssistantQueryRequest, AssistantQueryResponse,
    DemandForecastItem, ReorderRecommendationItem,
    AIModelStatusResponse
)
from app.ai.fault_classifier import classify_fault_text
from app.ai.inventory_assistant import process_assistant_query
from app.ai.demand_forecasting import compute_inventory_demand_forecast
from app.ai.reorder_recommendations import generate_reorder_recommendations
from app.ai.model_registry import registry

router = APIRouter(prefix="/ai", tags=["AI Modules"])

@router.post("/classify", response_model=FaultClassifyResponse)
def classify_fault_endpoint(
    payload: FaultClassifyRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Classifies equipment fault text using Scikit-Learn TF-IDF + Logistic Regression pipeline.
    Returns predicted category, model confidence, suggested priority, and technician.
    Returns 'Needs Manual Review' if input is ambiguous, empty, or out-of-distribution.
    """
    return classify_fault_text(payload.description)

@router.post("/assistant", response_model=AssistantQueryResponse)
def assistant_query_endpoint(
    payload: AssistantQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Answers natural language inquiries strictly grounded in authentic database records.
    Enforces server-side RBAC, laboratory scoping, and anti-prompt-injection safeguards.
    """
    return process_assistant_query(payload.query, current_user, db)

@router.get("/forecast", response_model=List[DemandForecastItem])
def demand_forecast_endpoint(
    lab_id: int = Query(..., description="Target laboratory ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates chronological consumable and bulk stock demand forecasts.
    Distinguishes genuine consumption from transfers and transparently reports data sufficiency.
    """
    if not verify_lab_access(current_user, lab_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view demand forecasts for this laboratory."
        )
    return compute_inventory_demand_forecast(db, lab_id)

@router.get("/recommendations", response_model=List[ReorderRecommendationItem])
def reorder_recommendations_endpoint(
    lab_id: Optional[int] = Query(None, description="Optional laboratory ID filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates explainable replenishment recommendations with active Purchase Order deduplication.
    Never automatically submits or places orders; human review is mandatory.
    """
    if lab_id is not None:
        if not verify_lab_access(current_user, lab_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized for this laboratory."
            )
        return generate_reorder_recommendations(db, lab_id=lab_id)
    
    # If lab_id not specified, restrict to user's authorized labs if instructor
    if current_user.role == UserRole.LAB_INSTRUCTOR:
        recs = []
        for lab in current_user.assigned_labs:
            recs.extend(generate_reorder_recommendations(db, lab_id=lab.id))
        return recs

    return generate_reorder_recommendations(db)

@router.get("/status", response_model=AIModelStatusResponse)
@router.get("/model-readiness", response_model=AIModelStatusResponse)
def model_status_endpoint(
    current_user: User = Depends(get_current_user)
):
    """
    Returns live health, versioning, evaluation metrics, and data sufficiency status for all AI modules.
    """
    return registry.get_status()
