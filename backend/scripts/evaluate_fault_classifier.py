"""
Model Evaluation and Diagnostic Script for SMVITM Fault Classifier
Evaluates saved model on holdout test set and checks out-of-distribution behavior.
"""
import os
import json
import logging
import joblib
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("EvaluateFaultClassifier")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "app", "ai", "models", "fault_classifier.joblib")
DATA_PATH = os.path.join(BASE_DIR, "data", "synthetic_fault_data.json")

def evaluate_model():
    if not os.path.exists(MODEL_PATH):
        logger.error(f"Model file not found at {MODEL_PATH}. Please run train_fault_classifier.py first.")
        return False
    
    pipeline = joblib.load(MODEL_PATH)
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    
    records = payload.get("data", [])
    texts = [r["description"] for r in records]
    y_true = [r["category"] for r in records]
    
    y_pred = pipeline.predict(texts)
    probs = pipeline.predict_proba(texts)
    max_probs = np.max(probs, axis=1)
    
    acc = accuracy_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred, average="macro")
    
    logger.info("=" * 60)
    logger.info("SMVITM FAULT CLASSIFIER EVALUATION REPORT")
    logger.info("=" * 60)
    logger.info(f"Total Evaluated Samples: {len(texts)}")
    logger.info(f"Overall Accuracy:        {acc:.4f} ({acc*100:.1f}%)")
    logger.info(f"Macro F1-Score:          {f1:.4f}")
    logger.info(f"Mean Prediction Prob:    {np.mean(max_probs):.4f}")
    logger.info("-" * 60)
    print("\nDetailed Per-Category Classification Report:")
    print(classification_report(y_true, y_pred, zero_division=0))
    
    # Check out-of-distribution / uncertain queries
    ood_tests = [
        "The sky is blue today and campus weather is pleasant",
        "12345 67890 ???",
        "Students are enjoying tea at the cafeteria",
        "random gibberish qwerty asdf zxcv"
    ]
    logger.info("-" * 60)
    logger.info("Out-of-Distribution / Ambiguity Diagnostics:")
    for query in ood_tests:
        pred = pipeline.predict([query])[0]
        prob = np.max(pipeline.predict_proba([query])[0])
        status = "NEEDS_MANUAL_REVIEW" if prob < 0.45 else "ACCEPT"
        logger.info(f"Query: '{query}' -> Pred: '{pred}' (Score: {prob:.3f}) [{status}]")
    
    logger.info("=" * 60)
    return True

if __name__ == "__main__":
    evaluate_model()
