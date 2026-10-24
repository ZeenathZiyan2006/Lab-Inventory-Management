"""
Fault Classifier Service for SMVITM Inventory Management System
Uses trained Scikit-learn TF-IDF + Logistic Regression pipeline.
"""
import numpy as np
from typing import Dict, Any
from app.models.models import FaultPriority
from app.ai.model_registry import registry

PRIORITY_TECHNICIAN_MAP = {
    "Computer or CPU": (FaultPriority.HIGH, "Hardware Technician"),
    "Monitor, keyboard or mouse": (FaultPriority.LOW, "Lab Support Assistant"),
    "Network or connectivity": (FaultPriority.MEDIUM, "Network Administrator"),
    "Electrical fault": (FaultPriority.CRITICAL, "Certified Electrician"),
    "Fan, light or AC": (FaultPriority.HIGH, "Electrician / HVAC Technician"),
    "Furniture damage": (FaultPriority.LOW, "Maintenance Staff"),
    "Missing equipment": (FaultPriority.MEDIUM, "Lab Support Assistant"),
    "Other": (FaultPriority.LOW, "General Lab Assistant")
}

SAFETY_DISCLAIMER = (
    "CRITICAL SAFETY NOTICE: AI model prediction is for categorization assistance only. "
    "AI must NEVER automatically close faults, assign blame, approve replacements, or decide electrical safety. "
    "Human review by authorized Lab Instructors and certified personnel is mandatory."
)

CONFIDENCE_THRESHOLD = 0.40

def classify_fault_text(description: str) -> Dict[str, Any]:
    """
    Classifies equipment fault text description.
    Returns predicted category, model confidence, suggested priority, and technician.
    Returns 'Needs Manual Review' if input is empty, ambiguous, or out-of-distribution.
    """
    clean_text = description.strip() if description else ""
    
    # Check for empty or excessively short text
    if len(clean_text) < 4:
        return {
            "category": "Needs Manual Review",
            "confidence": 0.0,
            "model_version": registry.fault_metadata.get("model_version", "1.0.0-tfidf-logreg"),
            "suggested_priority": FaultPriority.MEDIUM,
            "recommended_technician": "Lab Support Assistant",
            "needs_manual_review": True,
            "is_synthetic_demonstration": True,
            "safety_disclaimer": SAFETY_DISCLAIMER,
            "top_probabilities": {}
        }

    # If model is not loaded in registry, provide transparent fallback
    pipeline = registry.fault_model
    if pipeline is None:
        # Transparent rule-based fallback
        desc_lower = clean_text.lower()
        if any(w in desc_lower for w in ["spark", "shock", "electric", "mcb", "fuse", "ups", "wire"]):
            category = "Electrical fault"
        elif any(w in desc_lower for w in ["cable", "rj45", "lan", "wifi", "router", "switch", "dns"]):
            category = "Network or connectivity"
        elif any(w in desc_lower for w in ["screen", "monitor", "mouse", "keyboard", "display"]):
            category = "Monitor, keyboard or mouse"
        elif any(w in desc_lower for w in ["ac", "fan", "light", "cooler", "air conditioner"]):
            category = "Fan, light or AC"
        elif any(w in desc_lower for w in ["chair", "table", "desk", "drawer", "bench"]):
            category = "Furniture damage"
        elif any(w in desc_lower for w in ["missing", "lost", "stolen"]):
            category = "Missing equipment"
        elif any(w in desc_lower for w in ["cpu", "pc", "computer", "ram", "gpu", "hard drive", "boot"]):
            category = "Computer or CPU"
        else:
            category = "Needs Manual Review"

        prio, tech = PRIORITY_TECHNICIAN_MAP.get(category, (FaultPriority.MEDIUM, "Lab Support Assistant"))
        return {
            "category": category,
            "confidence": 0.50 if category != "Needs Manual Review" else 0.0,
            "model_version": "fallback-rule-heuristic",
            "suggested_priority": prio,
            "recommended_technician": tech,
            "needs_manual_review": category == "Needs Manual Review",
            "is_synthetic_demonstration": True,
            "safety_disclaimer": SAFETY_DISCLAIMER,
            "top_probabilities": {}
        }

    # Model inference
    try:
        probabilities = pipeline.predict_proba([clean_text])[0]
        classes = pipeline.classes_
        top_idx = int(np.argmax(probabilities))
        max_prob = float(probabilities[top_idx])
        predicted_cat = str(classes[top_idx])

        # Top 3 probability distribution for explainability
        sorted_indices = np.argsort(probabilities)[::-1]
        top_probs = {str(classes[i]): round(float(probabilities[i]), 3) for i in sorted_indices[:3]}

        # If probability is below threshold, flag as Needs Manual Review
        if max_prob < CONFIDENCE_THRESHOLD:
            return {
                "category": "Needs Manual Review",
                "confidence": round(max_prob, 3),
                "model_version": registry.fault_metadata.get("model_version", "1.0.0-tfidf-logreg"),
                "suggested_priority": FaultPriority.MEDIUM,
                "recommended_technician": "Lab Support Assistant",
                "needs_manual_review": True,
                "is_synthetic_demonstration": registry.fault_metadata.get("is_synthetic_demonstration", True),
                "safety_disclaimer": SAFETY_DISCLAIMER,
                "top_probabilities": top_probs
            }

        prio, tech = PRIORITY_TECHNICIAN_MAP.get(predicted_cat, (FaultPriority.MEDIUM, "Lab Support Assistant"))
        return {
            "category": predicted_cat,
            "confidence": round(max_prob, 3),
            "model_version": registry.fault_metadata.get("model_version", "1.0.0-tfidf-logreg"),
            "suggested_priority": prio,
            "recommended_technician": tech,
            "needs_manual_review": False,
            "is_synthetic_demonstration": registry.fault_metadata.get("is_synthetic_demonstration", True),
            "safety_disclaimer": SAFETY_DISCLAIMER,
            "top_probabilities": top_probs
        }
    except Exception as e:
        return {
            "category": "Needs Manual Review",
            "confidence": 0.0,
            "model_version": "error-fallback",
            "suggested_priority": FaultPriority.MEDIUM,
            "recommended_technician": "Lab Support Assistant",
            "needs_manual_review": True,
            "is_synthetic_demonstration": True,
            "safety_disclaimer": f"Inference error: {str(e)}. Human inspection required.",
            "top_probabilities": {}
        }
