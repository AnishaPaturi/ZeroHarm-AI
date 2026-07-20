import sys
import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.engine.ml_anomaly import CompoundRiskMLModel

def run_comparison():
    print("ZeroHarm AI - Telemetry Baseline vs. Compound Risk Classifier Audit")
    print("-------------------------------------------------------------------")
    
    # Instantiate ML Model wrapper
    ml_wrapper = CompoundRiskMLModel()
    
    # Generate synthetic dataset
    print("Generating synthetic telemetry dataset (1800 samples)...")
    X, y = ml_wrapper.generate_synthetic_data(num_samples=1800)
    
    # Split train/test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
    
    # Train Random Forest Classifier
    print("Training Random Forest Classifier on training split...")
    clf = ml_wrapper.rf_model
    clf.fit(X_train, y_train)
    
    # Predict with Random Forest
    rf_preds = clf.predict(X_test)
    
    # Predict with Single-Sensor Threshold Baseline
    # Single-sensor threshold baseline flags a risk (predicts 1) if:
    # - O2 < 19.5%
    # - CO >= 50 ppm
    # - CH4 LFL >= 10%
    # - H2S >= 10 ppm
    # - Temp >= 60 C
    # - Pressure >= 2.0 bar
    baseline_preds = []
    for idx, row in X_test.iterrows():
        is_alarm = (
            row["o2"] < 19.5 or
            row["co"] >= 50.0 or
            row["ch4_lfl"] >= 10.0 or
            row["h2s"] >= 10.0 or
            row["temperature"] >= 60.0 or
            row["pressure"] >= 2.0
        )
        baseline_preds.append(1 if is_alarm else 0)
    baseline_preds = np.array(baseline_preds)
    
    # Evaluate Random Forest
    rf_acc = accuracy_score(y_test, rf_preds)
    rf_prec = precision_score(y_test, rf_preds)
    rf_rec = recall_score(y_test, rf_preds)
    
    tn, fp, fn, tp = confusion_matrix(y_test, rf_preds).ravel()
    rf_fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
    
    # Evaluate Single-Sensor Baseline
    base_acc = accuracy_score(y_test, baseline_preds)
    base_prec = precision_score(y_test, baseline_preds)
    base_rec = recall_score(y_test, baseline_preds)
    
    btn, bfp, bfn, btp = confusion_matrix(y_test, baseline_preds).ravel()
    base_fnr = bfn / (bfn + btp) if (bfn + btp) > 0 else 0.0
    
    # Calculate False Negative Rate Reduction
    fnr_reduction_pct = ((base_fnr - rf_fnr) / base_fnr * 100) if base_fnr > 0 else 0.0
    
    results = {
        "dataset_size": len(X),
        "test_size": len(y_test),
        "single_sensor_baseline": {
            "accuracy": round(base_acc, 4),
            "precision": round(base_prec, 4),
            "recall": round(base_rec, 4),
            "false_negative_rate": round(base_fnr, 4),
            "false_negatives": int(bfn),
            "true_positives": int(btp),
            "false_positives": int(bfp),
            "true_negatives": int(btn)
        },
        "compound_risk_classifier": {
            "accuracy": round(rf_acc, 4),
            "precision": round(rf_prec, 4),
            "recall": round(rf_rec, 4),
            "false_negative_rate": round(rf_fnr, 4),
            "false_negatives": int(fn),
            "true_positives": int(tp),
            "false_positives": int(fp),
            "true_negatives": int(tn)
        },
        "fnr_reduction_percentage": round(fnr_reduction_pct, 2)
    }
    
    print("\n" + "="*50)
    print("EVALUATION RESULTS COMPARISON")
    print("="*50)
    print(f"Single-Sensor Baseline Accuracy: {base_acc*100:.2f}%")
    print(f"Single-Sensor Baseline Recall:   {base_rec*100:.2f}%")
    print(f"Single-Sensor False Negatives:   {bfn} out of {bfn+btp} actual risks (FNR: {base_fnr*100:.2f}%)")
    print("-" * 50)
    print(f"Compound Risk Classifier Accuracy: {rf_acc*100:.2f}%")
    print(f"Compound Risk Classifier Recall:   {rf_rec*100:.2f}%")
    print(f"Compound Risk False Negatives:   {fn} out of {fn+tp} actual risks (FNR: {rf_fnr*100:.2f}%)")
    print("="*50)
    print(f"CRITICAL SAFETY IMPROVEMENT:")
    print(f"  Demonstrated Reduction in False Negative Rate: {fnr_reduction_pct:.2f}%")
    print(f"  (Catches {bfn - fn} additional compound risk events that single sensors missed)")
    print("="*50)
    
    # Save to file
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "baseline_comparison_results.json")
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results written to: {out_path}")

if __name__ == "__main__":
    run_comparison()
