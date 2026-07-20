"""
Test client for Computer Vision & CCTV Analytics Integration.

This script tests:
  1. POST /api/cctv/event - Trigger a CCTV alert (Metadata ingestion)
  2. POST /api/cctv/analyze-frame - Upload & analyze keyframe snapshot (Real frame analysis)
  3. POST /api/cctv/clear - Clear alerts in a zone

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_cctv.py
"""

import urllib.request
import urllib.parse
import json
import time
import io

BASE_URL = "http://127.0.0.1:8000"

def call_api(endpoint, data=None, method="POST"):
    url = f"{BASE_URL}{endpoint}"
    req_body = json.dumps(data).encode("utf-8") if data else None
    
    req = urllib.request.Request(
        url,
        data=req_body,
        headers={"Content-Type": "application/json"} if req_body else {},
        method=method
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"Error connecting: {e}")
        return None

def post_image_file(endpoint, zone, filename, image_bytes):
    # Construct multipart/form-data body
    boundary = "----ZeroHarmCCTVBoundary"
    body = []
    
    body.append(f"--{boundary}".encode('utf-8'))
    body.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode('utf-8'))
    body.append(b'Content-Type: image/png')
    body.append(b'')
    body.append(image_bytes)
    
    body.append(f"--{boundary}--".encode('utf-8'))
    body.append(b'')
    
    payload = b'\r\n'.join(body)
    url = f"{BASE_URL}{endpoint}?zone={urllib.parse.quote(zone)}"
    
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(payload))
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"Error connecting: {e}")
        return None

def create_mock_image(color=(128, 128, 128)):
    from PIL import Image
    img = Image.new("RGB", (100, 100), color=color)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

def section(title):
    print(f"\n==================================================")
    print(f"{title.upper()}")
    print(f"==================================================")

if __name__ == "__main__":
    print("ZeroHarm AI - CCTV Analytics & Visual Processing Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")
    
    # Check baseline state
    section("1. Baseline State (Coke Oven Battery 1)")
    baseline = call_api("/api/state", method="GET")
    if not baseline:
        print("ERROR: Is the FastAPI server running?")
        exit(1)
        
    coke_oven = baseline.get("Coke Oven Battery 1", {})
    print(f"Initial CCTV alerts: {coke_oven.get('cctv_alerts')}")
    
    # 1. Trigger PPE violation alert via metadata
    section("2. Trigger PPE Alert (Metadata Ingestion)")
    ppe_data = {
        "zone": "Coke Oven Battery 1",
        "event_type": "no_ppe",
        "confidence": 0.85
    }
    res = call_api("/api/cctv/event", data=ppe_data)
    if res:
        risk = res["risk_assessment"]
        print(f"Status: {res['status']}")
        print(f"Composite Risk Score: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
        print("Factors flagged:")
        for factor in risk.get("factors", []):
            print(f" - [{factor['name']}] Score: {factor['score']} | {factor['details']}")
            
    # 2. Clear CCTV alerts before testing real frame analysis
    section("3. Clear CCTV Alerts")
    res_clear = call_api(f"/api/cctv/clear?zone=Coke%20Oven%20Battery%201", method="POST")
    print(f"Clear Alerts Status: {res_clear.get('status') if res_clear else 'Failed'}")

    # 3. Test Real CCTV Frame Analysis - Normal Image
    section("4. Upload CCTV Keyframe: Normal Frame")
    normal_img = create_mock_image(color=(120, 130, 125)) # normal industrial gray-green
    res_normal = post_image_file("/api/cctv/analyze-frame", "Coke Oven Battery 1", "cam_feed_nominal.png", normal_img)
    if res_normal:
        print(f"Analysis Status: {res_normal['status']}")
        print(f"Properties Extracted: Brightness={res_normal['image_properties']['brightness']:.1f}, Contrast={res_normal['image_properties']['contrast']:.1f}")
        print(f"Alert Triggered? {res_normal['alert_triggered']}")
        print(f"Details: {res_normal.get('details')}")

    # 4. Test Real CCTV Frame Analysis - Camera Occlusion (lens covered)
    section("5. Upload CCTV Keyframe: Camera Lens Obstructed (Occlusion)")
    occluded_img = create_mock_image(color=(4, 5, 4)) # pitch black / low contrast image
    res_occlusion = post_image_file("/api/cctv/analyze-frame", "Coke Oven Battery 1", "cam_04_occluded.png", occluded_img)
    if res_occlusion:
        print(f"Analysis Status: {res_occlusion['status']}")
        print(f"Alert Triggered? {res_occlusion['alert_triggered']} (Event: {res_occlusion.get('event_type')})")
        print(f"Confidence: {res_occlusion.get('confidence')}")
        print(f"Details: {res_occlusion.get('details')}")
        if "risk_assessment" in res_occlusion:
            print(f"Composite Risk Score: {res_occlusion['risk_assessment']['composite_risk_score']}")

    # 5. Test Real CCTV Frame Analysis - Fire/Thermal Spark Detection
    section("6. Upload CCTV Keyframe: Thermal Flare / Flame Detected")
    fire_img = create_mock_image(color=(250, 20, 10)) # high-redness, high-brightness fire signature
    res_fire = post_image_file("/api/cctv/analyze-frame", "Coke Oven Battery 1", "cam_04_flare_event.png", fire_img)
    if res_fire:
        print(f"Analysis Status: {res_fire['status']}")
        print(f"Alert Triggered? {res_fire['alert_triggered']} (Event: {res_fire.get('event_type')})")
        print(f"Confidence: {res_fire.get('confidence')}")
        print(f"Details: {res_fire.get('details')}")
        if "risk_assessment" in res_fire:
            print(f"Composite Risk Score: {res_fire['risk_assessment']['composite_risk_score']}")
            print(f"Permits suspended: {res_fire['risk_assessment'].get('suspend_permits')}")

    # 6. Test Real CCTV Frame Analysis - Simulated PPE Violation
    section("7. Upload CCTV Keyframe: Simulated PPE Violation via Camera Feed")
    ppe_img = create_mock_image(color=(128, 128, 128))
    res_ppe = post_image_file("/api/cctv/analyze-frame", "Coke Oven Battery 1", "ppe_violation_cam1.png", ppe_img)
    if res_ppe:
        print(f"Analysis Status: {res_ppe['status']}")
        print(f"Alert Triggered? {res_ppe['alert_triggered']} (Event: {res_ppe.get('event_type')})")
        print(f"Details: {res_ppe.get('details')}")

    # Clean up at the end
    section("8. Reset Safety State")
    res_cleanup = call_api(f"/api/cctv/clear?zone=Coke%20Oven%20Battery%201", method="POST")
    if res_cleanup:
        print(f"Cleanup Status: {res_cleanup['status']}")
        print(f"Composite Risk Score returned to: {res_cleanup['risk_assessment']['composite_risk_score']}")
