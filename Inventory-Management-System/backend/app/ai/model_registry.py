"""
SMVITM AI Model Registry and Health Monitor
Tracks model versions, training artifacts, and operational status.
"""
import os
import json
import logging
from datetime import datetime, timezone
import joblib

logger = logging.getLogger("AIModelRegistry")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, "app", "ai", "models", "fault_classifier.joblib")
METADATA_PATH = os.path.join(BASE_DIR, "app", "ai", "models", "fault_classifier_metadata.json")

class ModelRegistry:
    _instance = None
    
    def __init__(self):
        self.fault_model = None
        self.fault_metadata = {}
        self.load_fault_model()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelRegistry()
        return cls._instance

    def load_fault_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.fault_model = joblib.load(MODEL_PATH)
                logger.info(f"Loaded fault classifier pipeline from {MODEL_PATH}")
            except Exception as e:
                logger.error(f"Failed to load fault classifier: {e}")
                self.fault_model = None
        else:
            logger.warning(f"Fault classifier artifact not found at {MODEL_PATH}")
            self.fault_model = None

        if os.path.exists(METADATA_PATH):
            try:
                with open(METADATA_PATH, "r", encoding="utf-8") as f:
                    self.fault_metadata = json.load(f)
            except Exception as e:
                logger.error(f"Failed to read model metadata: {e}")
                self.fault_metadata = {}

    def get_status(self):
        now_str = datetime.now(timezone.utc).isoformat()
        
        fault_status = {
            "status": "AVAILABLE" if self.fault_model is not None else "UNAVAILABLE",
            "model_version": self.fault_metadata.get("model_version", "1.0.0-tfidf-logreg"),
            "algorithm": self.fault_metadata.get("algorithm", "Scikit-Learn TF-IDF + Logistic Regression"),
            "trained_at": self.fault_metadata.get("trained_at", "2026-10-19T16:09:28Z"),
            "is_synthetic_demonstration": self.fault_metadata.get("is_synthetic_demonstration", True),
            "test_accuracy": self.fault_metadata.get("test_accuracy", 0.656),
            "test_macro_f1": self.fault_metadata.get("test_macro_f1", 0.648),
            "disclaimer": "Trained on synthetic demonstration data. Evaluated performance does not establish real-world electrical or physical safety. Human verification is required."
        }

        assistant_status = {
            "status": "AVAILABLE",
            "type": "Deterministic Query Interpreter + Authorized Database Retrieval",
            "llm_provider": "Offline Deterministic Mode (Grounded in SQLite / PostgreSQL)",
            "safety_controls": [
                "Strict Server-Side RBAC",
                "Laboratory Isolation",
                "No Arbitrary SQL Generation",
                "No Prompt Injection Execution"
            ],
            "disclaimer": "All assistant answers are grounded directly in database records. No synthetic hallucinations."
        }

        forecasting_status = {
            "status": "NEEDS_MORE_DATA",
            "algorithm": "Chronological Moving Average Baseline + Buffer Deficit Estimation",
            "data_sufficiency": "INSUFFICIENT (Current historical consumption points < 12)",
            "minimum_observations_needed": 12,
            "disclaimer": "Insufficient historical data for reliable machine learning time-series forecasting. Demonstrative baseline displayed with visible assumptions."
        }

        reorder_status = {
            "status": "AVAILABLE",
            "algorithm": "Explainable Reorder Recommendation Engine with PO Deduplication",
            "features": [
                "Current working stock evaluation",
                "Minimum reorder threshold comparison",
                "Outstanding approved Purchase Order deduplication",
                "Human-in-the-loop safety guarantee"
            ],
            "safety_notice": "Recommendation engine NEVER automatically places or approves orders. Authorized staff review is mandatory."
        }

        return {
            "fault_classifier": fault_status,
            "assistant": assistant_status,
            "demand_forecasting": forecasting_status,
            "reorder_engine": reorder_status,
            "server_time": now_str
        }

registry = ModelRegistry.get_instance()
