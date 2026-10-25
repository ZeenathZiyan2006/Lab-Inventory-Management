"""
Pydantic Schemas for Phase 5 AI Features
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.models import FaultPriority

class FaultClassifyRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=2000, description="Equipment fault description entered by lab staff")

class FaultClassifyResponse(BaseModel):
    category: str
    confidence: float
    model_version: str
    suggested_priority: FaultPriority
    recommended_technician: str
    needs_manual_review: bool
    is_synthetic_demonstration: bool
    safety_disclaimer: str
    top_probabilities: Optional[Dict[str, float]] = None

class AssistantQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=1000, description="Natural language question")

class AssistantQueryResponse(BaseModel):
    query: str
    answer: str
    sql_intent: str
    lab_context: str
    record_count: int
    results: List[Dict[str, Any]]
    authorized_labs: List[str]
    timestamp: str
    disclaimer: str
    spoken_text: Optional[str] = None

class DemandForecastItem(BaseModel):
    item_id: int
    item_name: str
    category: str
    lab_id: int
    lab_name: str
    current_stock: int
    min_threshold: int
    historical_consumption_rate: float
    forecast_quantity: int
    forecast_horizon: str
    data_sufficiency: str  # "INSUFFICIENT", "PARTIAL", "SUFFICIENT"
    model_used: str
    limitations_notice: str
    assumptions: str

class ReorderRecommendationItem(BaseModel):
    item_id: int
    item_name: str
    category: str
    lab_id: int
    lab_name: str
    current_stock: int
    min_threshold: int
    shortfall: int
    outstanding_po_quantity: int
    outstanding_po_ref: Optional[str] = None
    suggested_action: str  # "REORDER_URGENT", "REORDER_RECOMMENDED", "ORDER_ALREADY_PLACED", "STOCK_HEALTHY"
    recommendation_type: str  # "RULE_BASED", "FORECAST_DRIVEN", "ILLUSTRATIVE"
    explanation: str
    safety_notice: str
    last_evaluated_at: str

class AIModelStatusResponse(BaseModel):
    fault_classifier: Dict[str, Any]
    assistant: Dict[str, Any]
    demand_forecasting: Dict[str, Any]
    reorder_engine: Dict[str, Any]
    server_time: str
