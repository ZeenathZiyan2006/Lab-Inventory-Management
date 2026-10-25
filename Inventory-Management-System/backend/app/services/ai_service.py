import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from typing import Dict, Any
from app.models.models import FaultPriority

# Labeled synthetic demonstration training corpus representing college lab equipment issues
DEMO_TRAINING_DATA = [
    # Hardware
    ("Computer monitor display is completely black and won't turn on", "Hardware", "High", "Computer Hardware Technician"),
    ("CPU fan is making loud rattling noise and machine is overheating", "Hardware", "Medium", "Computer Hardware Technician"),
    ("Hard drive clicking sound observed during boot, operating system not found", "Hardware", "High", "Computer Hardware Technician"),
    ("RAM stick failure causing blue screen of death BSOD in Lab 1", "Hardware", "High", "Computer Hardware Technician"),
    ("Keyboard keys spacebar and enter are stuck and not registering clicks", "Hardware", "Low", "Lab Support Assistant"),
    ("Optical mouse laser sensor blinking but cursor is not moving", "Hardware", "Low", "Lab Support Assistant"),
    ("Motherboard capacitor swollen and system power cycles continuously", "Hardware", "Critical", "Senior Hardware Engineer"),
    ("Printer paper jam inside feeder and roller making squeaking noise", "Hardware", "Medium", "Peripherals Technician"),
    ("Projector lamp is dim with flickering warning indicator", "Hardware", "Medium", "AV Technician"),

    # Electrical
    ("Sparks noticed from switchboard socket near row 3 workbench", "Electrical", "Critical", "Certified College Electrician"),
    ("UPS battery giving continuous beep alarm and smelling burnt", "Electrical", "Critical", "UPS & Power Specialist"),
    ("Ceiling fan regulator sparking and speed is fluctuating erratically", "Electrical", "High", "College Electrician"),
    ("Circuit breaker tripped when all monitors were powered on simultaneously", "Electrical", "High", "College Electrician"),
    ("Wall power socket loose and loose contact causing intermittent shutoffs", "Electrical", "High", "College Electrician"),
    ("Fluorescent tube light flickering and hums loudly in Lab 2", "Electrical", "Low", "College Electrician"),
    ("Exhaust fan stopped spinning, burning smell from the motor", "Electrical", "Critical", "College Electrician"),
    ("Air conditioner unit tripping the miniature circuit breaker MCB", "Electrical", "High", "HVAC / Electrical Technician"),

    # Network
    ("RJ45 Ethernet connector clip broken and network connection drops constantly", "Network", "Medium", "Network Administrator"),
    ("Cisco network switch port 14 amber light blinking, no internet access", "Network", "High", "Network Administrator"),
    ("Wi-Fi access point in laboratory showing authentication failure for all systems", "Network", "High", "Network Administrator"),
    ("CAT6 patch cable chewed or damaged under row 4 cable tray", "Network", "Medium", "Network Technician"),
    ("DNS resolution failure on whole laboratory subnet, unable to reach college gateway", "Network", "High", "Network Administrator"),
    ("D-Link switch overheating in rack and packets dropping", "Network", "High", "Network Administrator"),

    # Software
    ("Windows activation error and operating system license expired", "Software", "Low", "System Administrator"),
    ("Python environment kernel crashing in Jupyter Notebook across all terminals", "Software", "Medium", "AI/DS Lab Instructor"),
    ("Corrupted graphics driver causing screen resolution to lock at 800x600", "Software", "Medium", "System Administrator"),
    ("Antivirus blocking compiler GCC and Python packages from executing", "Software", "Medium", "System Administrator"),
    ("Linux dual boot GRUB rescue prompt appearing on power up", "Software", "High", "System Administrator"),
    ("Database server MySQL service not starting due to permission lock", "Software", "Medium", "System Administrator"),

    # Physical Damage
    ("Lab chair castor wheel broken and chair tilting precariously", "Physical Damage", "Low", "Campus Maintenance / Carpenter"),
    ("Computer table wooden laminate peeled and screws loose", "Physical Damage", "Low", "Campus Maintenance / Carpenter"),
    ("Monitor stand bracket cracked after falling off the desk", "Physical Damage", "Medium", "Hardware Technician"),
    ("Lab door latch broken and won't lock securely", "Physical Damage", "Medium", "Campus Maintenance Staff"),
    ("Keyboard casing cracked and missing keycaps", "Physical Damage", "Low", "Lab Support Assistant"),
    ("Projector ceiling mount vibration causing image to wobble", "Physical Damage", "Medium", "AV Technician"),
]

texts = [item[0] for item in DEMO_TRAINING_DATA]
categories = [item[1] for item in DEMO_TRAINING_DATA]
priorities = [item[2] for item in DEMO_TRAINING_DATA]
technicians = [item[3] for item in DEMO_TRAINING_DATA]

# Initialize and fit TF-IDF + Logistic Regression pipeline
category_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2), lowercase=True, stop_words='english')),
    ('clf', LogisticRegression(C=1.0, max_iter=200, random_state=42))
])
category_pipeline.fit(texts, categories)

# Priority mapping heuristics and dictionary
PRIORITY_MAP = {
    "Hardware": (FaultPriority.HIGH, "Computer Hardware Technician"),
    "Electrical": (FaultPriority.CRITICAL, "Certified College Electrician"),
    "Network": (FaultPriority.MEDIUM, "Network Administrator"),
    "Software": (FaultPriority.MEDIUM, "System Administrator"),
    "Physical Damage": (FaultPriority.LOW, "Campus Maintenance Staff")
}

def classify_fault(description: str) -> Dict[str, Any]:
    """Classifies equipment fault text using Scikit-learn TF-IDF + Logistic Regression."""
    clean_desc = description.strip()
    if not clean_desc:
        return {
            "category": "Hardware",
            "suggested_priority": FaultPriority.MEDIUM,
            "confidence": 0.5,
            "recommended_technician": "General Lab Technician",
            "is_synthetic_demonstration": True,
            "notice": "Trained on synthetic demonstration data. Does not certify electrical or physical safety."
        }
    
    try:
        predicted_category = category_pipeline.predict([clean_desc])[0]
        probabilities = category_pipeline.predict_proba([clean_desc])[0]
        classes = category_pipeline.classes_
        confidence = float(np.max(probabilities))
    except Exception:
        # Transparent rule-based fallback
        desc_lower = clean_desc.lower()
        if any(w in desc_lower for w in ["spark", "smoke", "shock", "electric", "mcb", "fuse", "wire", "switchboard", "socket"]):
            predicted_category = "Electrical"
        elif any(w in desc_lower for w in ["cable", "rj45", "lan", "wifi", "router", "switch", "ping", "dns", "subnet", "network"]):
            predicted_category = "Network"
        elif any(w in desc_lower for w in ["driver", "software", "windows", "linux", "boot", "jupyter", "os", "compiler"]):
            predicted_category = "Software"
        elif any(w in desc_lower for w in ["broken", "chair", "table", "crack", "dent", "wheel", "latch"]):
            predicted_category = "Physical Damage"
        else:
            predicted_category = "Hardware"
        confidence = 0.70

    suggested_priority, recommended_tech = PRIORITY_MAP.get(
        predicted_category,
        (FaultPriority.MEDIUM, "Lab Maintenance Staff")
    )

    # Urgent electrical or fire hazard boost
    desc_lower = clean_desc.lower()
    if any(hazard in desc_lower for hazard in ["spark", "fire", "smoke", "burning smell", "shock", "short circuit"]):
        suggested_priority = FaultPriority.CRITICAL
        recommended_tech = "Certified College Electrician (URGENT SAFETY HAZARD)"

    return {
        "category": predicted_category,
        "suggested_priority": suggested_priority,
        "confidence": round(confidence, 2),
        "recommended_technician": recommended_tech,
        "is_synthetic_demonstration": True,
        "notice": "Trained on synthetic demonstration dataset. For human review only; does not certify electrical/structural safety."
    }
