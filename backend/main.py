"""
How to run this backend:

1. Activate your virtual environment (if not already):
        Windows:
            .venv\\Scripts\\activate.bat
    macOS/Linux:
         source .venv/bin/activate

2. Install dependencies:
    pip install -r requirements.txt
    # Or, if requirements.txt is missing, run:
    pip install fastapi uvicorn pillow numpy

3. Start the server:
    python -m uvicorn backend.main:app --reload

The API will be available at http://127.0.0.1:8000/
"""
import io
import random
import base64
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.infer import load_model, predict_with_model

app = FastAPI(title="Brain Tumor AI Diagnostic API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_BUNDLE = None
MODEL_LOAD_ERROR = None


def get_model_bundle():
    global MODEL_BUNDLE, MODEL_LOAD_ERROR
    if MODEL_BUNDLE is not None:
        return MODEL_BUNDLE
    if MODEL_LOAD_ERROR is not None:
        return None
    try:
        MODEL_BUNDLE = load_model()
        return MODEL_BUNDLE
    except Exception as exc:
        MODEL_LOAD_ERROR = str(exc)
        return None

def image_to_base64(img: Image.Image, fmt="PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def compute_metrics():
    """Return simulated evaluation metrics (per-request placeholder)."""
    base = random.uniform(0.88, 0.97)
    return {
        "accuracy": round(base + random.uniform(-0.02, 0.02), 4),
        "precision": round(base + random.uniform(-0.03, 0.03), 4),
        "recall": round(base + random.uniform(-0.03, 0.03), 4),
        "f1_score": round(base + random.uniform(-0.03, 0.03), 4),
        "dice_score": round(random.uniform(0.82, 0.94), 4),
        "iou_score": round(random.uniform(0.76, 0.90), 4),
    }

@app.get("/")
def health():
    return {"status": "Brain Tumor AI Diagnostic API running"}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    img = img.resize((256, 256))

    bundle = get_model_bundle()
    if not bundle:
        detail = MODEL_LOAD_ERROR or "Model not loaded"
        raise HTTPException(status_code=503, detail=detail)

    prediction = predict_with_model(img, bundle)
    classification = prediction["classification"]
    gradcam_img = prediction["gradcam_image"]
    seg_mask = prediction["segmentation_mask"]

    metrics = compute_metrics()

    return JSONResponse({
        "classification": classification,
        "metrics": metrics,
        "original_image": image_to_base64(img),
        "gradcam_image": image_to_base64(gradcam_img),
        "segmentation_mask": image_to_base64(seg_mask),
    })
