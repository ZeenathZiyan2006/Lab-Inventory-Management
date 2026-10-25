"""
Model Training Script for SMVITM Laboratory Fault Classification
Uses Scikit-learn TF-IDF Vectorizer + Logistic Regression.
"""
import os
import json
import logging
from datetime import datetime, timezone
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, f1_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TrainFaultClassifier")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "synthetic_fault_data.json")
MODEL_DIR = os.path.join(BASE_DIR, "app", "ai", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "fault_classifier.joblib")
METADATA_PATH = os.path.join(MODEL_DIR, "fault_classifier_metadata.json")

def load_data():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Training data not found at {DATA_PATH}")
    
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    
    metadata = payload.get("metadata", {})
    records = payload.get("data", [])
    
    texts = [r["description"] for r in records]
    labels = [r["category"] for r in records]
    priorities = [r.get("suggested_priority", "Medium") for r in records]
    technicians = [r.get("recommended_technician", "General Technician") for r in records]
    
    logger.info(f"Loaded {len(texts)} samples from {DATA_PATH} (Synthetic={metadata.get('is_synthetic_demonstration', True)})")
    return texts, labels, priorities, technicians, metadata

def train_and_save():
    os.makedirs(MODEL_DIR, exist_ok=True)
    texts, labels, priorities, technicians, dataset_meta = load_data()
    
    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.20, random_state=42, stratify=labels
    )
    
    # Define scikit-learn pipeline with tuned hyperparameters for text classification
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 2),
            lowercase=True,
            stop_words='english',
            min_df=1,
            sublinear_tf=True
        )),
        ('clf', LogisticRegression(
            C=6.0,
            max_iter=600,
            class_weight='balanced',
            random_state=42
        ))
    ])
    
    logger.info("Fitting TF-IDF + LogisticRegression pipeline...")
    pipeline.fit(X_train, y_train)
    
    # Evaluation
    y_pred = pipeline.predict(X_test)
    acc = float(accuracy_score(y_test, y_pred))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro"))
    
    report_dict = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    logger.info(f"Evaluation: Accuracy={acc:.4f}, Macro-F1={macro_f1:.4f}")
    
    # Save model artifact
    joblib.dump(pipeline, MODEL_PATH)
    logger.info(f"Saved model pipeline to {MODEL_PATH}")
    
    # Save comprehensive metadata
    meta = {
        "model_name": "SMVITM Fault Category Classifier",
        "model_version": "1.0.0-tfidf-logreg",
        "algorithm": "TF-IDF (1-2 ngrams) + Logistic Regression (C=2.5, balanced)",
        "framework": "scikit-learn",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "is_synthetic_demonstration": dataset_meta.get("is_synthetic_demonstration", True),
        "dataset_name": dataset_meta.get("dataset_name", "Synthetic Demonstration Corpus"),
        "disclaimer": "CRITICAL NOTICE: Model was trained on synthetic demonstration data. Evaluated performance does not guarantee real-world physical or electrical safety. Human review is mandatory for all equipment repair decisions.",
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "test_accuracy": acc,
        "test_macro_f1": macro_f1,
        "classes": list(pipeline.classes_),
        "metrics_summary": {
            "accuracy": acc,
            "macro_f1": macro_f1
        },
        "classification_report": report_dict
    }
    
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    logger.info(f"Saved model metadata to {METADATA_PATH}")
    return meta

if __name__ == "__main__":
    train_and_save()
