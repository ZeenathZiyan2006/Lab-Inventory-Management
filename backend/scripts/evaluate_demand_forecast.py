"""
Evaluation Script for Inventory Demand Forecasting
Performs chronological validation on historical stock movements.
"""
import os
import sys
import logging
from datetime import datetime, timedelta

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.core.database import SessionLocal
from app.models.models import BulkInventory, StockMovementLedger, InventoryHistory

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("EvaluateDemandForecast")

def evaluate_forecasting():
    db = SessionLocal()
    try:
        bulk_items = db.query(BulkInventory).all()
        total_movements = db.query(StockMovementLedger).count()
        total_history = db.query(InventoryHistory).count()
        
        logger.info("=" * 60)
        logger.info("SMVITM DEMAND FORECASTING CHRONOLOGICAL AUDIT")
        logger.info("=" * 60)
        logger.info(f"Bulk Inventory Items:        {len(bulk_items)}")
        logger.info(f"Total Stock Ledger Entries:  {total_movements}")
        logger.info(f"Total Inventory History:     {total_history}")
        logger.info("-" * 60)
        
        for item in bulk_items:
            # Query consumption events specifically
            consumption_records = db.query(StockMovementLedger).filter(
                StockMovementLedger.item_type == "Bulk",
                StockMovementLedger.item_id == item.id,
                StockMovementLedger.reference_type.in_(["Consumption", "Adjustment", "Fault", "Issue"])
            ).order_by(StockMovementLedger.timestamp.asc()).all()
            
            history_records = db.query(InventoryHistory).filter(
                InventoryHistory.bulk_id == item.id
            ).all()
            
            data_points = len(consumption_records) + len(history_records)
            sufficiency = "SUFFICIENT" if data_points >= 12 else ("PARTIAL" if data_points >= 3 else "INSUFFICIENT")
            
            logger.info(f"Item: '{item.name}' (Lab {item.lab_id}) | Stock: {item.working_quantity} | Min Threshold: {item.min_threshold}")
            logger.info(f"  -> Historical Points: {data_points} | Sufficiency: {sufficiency}")
            if sufficiency == "INSUFFICIENT":
                logger.info("  -> Assessment: Insufficient chronological records for machine learning time-series models. Using baseline moving average with explicit buffer deficit notice.")
            else:
                logger.info("  -> Assessment: Adequate records for 30/60-day moving average and exponential smoothing baseline.")
        logger.info("=" * 60)
    finally:
        db.close()

if __name__ == "__main__":
    evaluate_forecasting()
