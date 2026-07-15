import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger("risk_engine.ml")

class CompoundRiskMLModel:
    def __init__(self):
        self.rf_model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.if_model = IsolationForest(contamination=0.15, random_state=42)
        self.is_trained = False
        
        # Features list in exact order
        self.feature_names = [
            "o2", "co", "ch4_lfl", "h2s", "temperature", "pressure",
            "num_permits", "hot_work_active", "confined_space_active",
            "height_work_active", "maintenance_active", "shift_changeover_active"
        ]

    def generate_synthetic_data(self, num_samples: int = 1500) -> Tuple[pd.DataFrame, np.ndarray]:
        """Generates realistic synthetic data for training the risk classifiers."""
        np.random.seed(42)
        
        # 1. Generate Normal Data (approx 85% of samples)
        num_normal = int(num_samples * 0.85)
        
        # Normal distributions
        o2_norm = np.random.normal(20.8, 0.2, num_normal)
        co_norm = np.maximum(0, np.random.normal(2.0, 1.5, num_normal))
        ch4_norm = np.maximum(0, np.random.normal(0.2, 0.15, num_normal))
        h2s_norm = np.maximum(0, np.random.normal(0.1, 0.1, num_normal))
        temp_norm = np.random.normal(28.0, 3.0, num_normal)
        press_norm = np.random.normal(1.0, 0.05, num_normal)
        
        # Normal permit distribution
        num_permits_norm = np.random.choice([0, 1, 2], size=num_normal, p=[0.4, 0.5, 0.1])
        hot_work_norm = np.zeros(num_normal)
        conf_space_norm = np.zeros(num_normal)
        height_work_norm = np.zeros(num_normal)
        
        for i in range(num_normal):
            if num_permits_norm[i] > 0:
                p_types = np.random.choice(["hot_work", "confined_space", "height_work", "cold_work"], 
                                           size=num_permits_norm[i], replace=False)
                if "hot_work" in p_types: hot_work_norm[i] = 1
                if "confined_space" in p_types: conf_space_norm[i] = 1
                if "height_work" in p_types: height_work_norm[i] = 1
                
        maint_norm = np.random.choice([0, 1], size=num_normal, p=[0.93, 0.07])
        shift_norm = np.random.choice([0, 1], size=num_normal, p=[0.95, 0.05])
        
        X_normal = pd.DataFrame({
            "o2": o2_norm, "co": co_norm, "ch4_lfl": ch4_norm, "h2s": h2s_norm,
            "temperature": temp_norm, "pressure": press_norm, "num_permits": num_permits_norm,
            "hot_work_active": hot_work_norm, "confined_space_active": conf_space_norm,
            "height_work_active": height_work_norm, "maintenance_active": maint_norm,
            "shift_changeover_active": shift_norm
        })
        y_normal = np.zeros(num_normal)

        # 2. Generate Anomaly Data (approx 15% of samples)
        num_anom = num_samples - num_normal
        
        # Pre-fill with normal distribution, then inject anomalies
        o2_anom = np.random.normal(20.8, 0.2, num_anom)
        co_anom = np.maximum(0, np.random.normal(2.0, 1.5, num_anom))
        ch4_anom = np.maximum(0, np.random.normal(0.2, 0.15, num_anom))
        h2s_anom = np.maximum(0, np.random.normal(0.1, 0.1, num_anom))
        temp_anom = np.random.normal(28.0, 3.0, num_anom)
        press_anom = np.random.normal(1.0, 0.05, num_anom)
        
        num_permits_anom = np.random.choice([1, 2, 3], size=num_anom, p=[0.4, 0.4, 0.2])
        hot_work_anom = np.zeros(num_anom)
        conf_space_anom = np.zeros(num_anom)
        height_work_anom = np.zeros(num_anom)
        maint_anom = np.random.choice([0, 1], size=num_anom, p=[0.7, 0.3])
        shift_anom = np.random.choice([0, 1], size=num_anom, p=[0.7, 0.3])
        
        # Distribute permits
        for i in range(num_anom):
            p_types = np.random.choice(["hot_work", "confined_space", "height_work", "cold_work"], 
                                       size=num_permits_anom[i], replace=False)
            if "hot_work" in p_types: hot_work_anom[i] = 1
            if "confined_space" in p_types: conf_space_anom[i] = 1
            if "height_work" in p_types: height_work_anom[i] = 1

        # Inject specific anomaly scenarios (labeled as 1)
        # Split anomalies into batches representing different risk profiles
        batch_size = num_anom // 5
        
        # Scenario A: Methane leak during Hot Work (Explosion threat)
        for i in range(0, batch_size):
            hot_work_anom[i] = 1
            ch4_anom[i] = np.random.uniform(4.5, 12.0)
            
        # Scenario B: Asphyxiation / Toxic CO buildup in Confined Space
        for i in range(batch_size, batch_size * 2):
            conf_space_anom[i] = 1
            o2_anom[i] = np.random.uniform(14.0, 18.8)
            co_anom[i] = np.random.uniform(20.0, 60.0)
            
        # Scenario C: H2S Gas Leak in General Area
        for i in range(batch_size * 2, batch_size * 3):
            h2s_anom[i] = np.random.uniform(8.0, 30.0)
            
        # Scenario D: SIMOPs Collision (Hot Work + Confined Space active in same zone)
        for i in range(batch_size * 3, batch_size * 4):
            hot_work_anom[i] = 1
            conf_space_anom[i] = 1
            num_permits_anom[i] = max(num_permits_anom[i], 2)
            temp_anom[i] = np.random.uniform(35.0, 50.0) # Elevated temp due to hot work
            
        # Scenario E: High-risk maintenance + Shift changeover with sub-critical gas drift
        for i in range(batch_size * 4, num_anom):
            maint_anom[i] = 1
            shift_anom[i] = 1
            co_anom[i] = np.random.uniform(15.0, 30.0) # Sub-critical but anomalous
            ch4_anom[i] = np.random.uniform(2.5, 4.5)  # Sub-critical but anomalous
            press_anom[i] = np.random.uniform(1.4, 2.2) # Pressure spike

        X_anomaly = pd.DataFrame({
            "o2": o2_anom, "co": co_anom, "ch4_lfl": ch4_anom, "h2s": h2s_anom,
            "temperature": temp_anom, "pressure": press_anom, "num_permits": num_permits_anom,
            "hot_work_active": hot_work_anom, "confined_space_active": conf_space_anom,
            "height_work_active": height_work_anom, "maintenance_active": maint_anom,
            "shift_changeover_active": shift_anom
        })
        y_anomaly = np.ones(num_anom)
        
        # Combine
        X = pd.concat([X_normal, X_anomaly], ignore_index=True)
        y = np.concatenate([y_normal, y_anomaly])
        
        # Add random noise to make it realistic
        noise = np.random.normal(0, 0.01, size=X.shape)
        # Avoid noisy binary values
        binary_cols = ["hot_work_active", "confined_space_active", "height_work_active", 
                       "maintenance_active", "shift_changeover_active"]
        for col in X.columns:
            if col not in binary_cols and col != "num_permits":
                X[col] = X[col] + noise[:, X.columns.get_loc(col)]
                
        return X, y

    def train(self):
        """Train both models on startup using simulated data."""
        try:
            logger.info("Generating synthetic training data for Compound Risk Detection Engine...")
            X, y = self.generate_synthetic_data(num_samples=1800)
            
            logger.info("Training Random Forest Classifier on simulated industrial risk events...")
            self.rf_model.fit(X, y)
            
            logger.info("Training Isolation Forest Anomaly Detector...")
            self.if_model.fit(X[y == 0]) # Train Isolation Forest only on normal data
            
            self.is_trained = True
            logger.info("ML Models trained and initialized successfully.")
        except Exception as e:
            logger.error(f"Error during ML model training: {e}")
            raise e

    def predict(self, input_data: Dict[str, Any]) -> Tuple[float, float]:
        """
        Evaluate real-time telemetry inputs.
        Returns:
            - rf_prob: Supervised anomaly probability (0.0 to 100.0)
            - if_score: Unsupervised anomaly risk score (0.0 to 100.0)
        """
        if not self.is_trained:
            logger.warning("ML models not trained yet. Defaulting to 0.0 scores.")
            return 0.0, 0.0

        # Construct feature vector
        # Input preprocessing
        gas = input_data.get("gas_readings", {})
        permits = input_data.get("permits", [])
        
        # Extract permit indicators
        active_permits = [p for p in permits if p.get("status", "").lower() == "active"]
        num_permits = len(active_permits)
        
        hot_work = 1 if any(p.get("permit_type", "").lower() == "hot_work" for p in active_permits) else 0
        confined_space = 1 if any(p.get("permit_type", "").lower() == "confined_space" for p in active_permits) else 0
        height_work = 1 if any(p.get("permit_type", "").lower() == "height_work" for p in active_permits) else 0
        
        features = {
            "o2": gas.get("o2", 20.8),
            "co": gas.get("co", 0.0),
            "ch4_lfl": gas.get("ch4_lfl", 0.0),
            "h2s": gas.get("h2s", 0.0),
            "temperature": gas.get("temperature") or 28.0,
            "pressure": gas.get("pressure") or 1.0,
            "num_permits": num_permits,
            "hot_work_active": hot_work,
            "confined_space_active": confined_space,
            "height_work_active": height_work,
            "maintenance_active": 1 if input_data.get("maintenance_active", False) else 0,
            "shift_changeover_active": 1 if input_data.get("shift_changeover_active", False) else 0
        }
        
        # Convert to DataFrame in exact column order
        df = pd.DataFrame([features])[self.feature_names]
        
        # 1. Random Forest probability
        rf_prob = self.rf_model.predict_proba(df)[0][1] * 100.0
        
        # 2. Isolation Forest score
        # decision_function outputs negative values for anomalies, positive values for inliers
        # Range is roughly [-0.5, 0.5].
        if_decision = self.if_model.decision_function(df)[0]
        # Normalize to 0-100 scale: closer to -0.5 is closer to 100, closer to 0.5 is closer to 0
        # Formula: clip( (0.3 - decision) / 0.6, 0, 1 ) * 100
        if_score = np.clip((0.2 - if_decision) / 0.45, 0.0, 1.0) * 100.0
        
        return round(rf_prob, 1), round(if_score, 1)
