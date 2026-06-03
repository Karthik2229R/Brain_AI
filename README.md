# Brain Tumor AI Diagnostic System

## Overview
This project provides a FastAPI backend for brain tumor analysis and a Vite-based frontend for uploading MRI images and viewing results. The backend loads a trained PyTorch model and returns a classification (Tumor vs No Tumor) plus a Grad-CAM overlay and a mask visualization.

## Project Structure
- backend/ - FastAPI app, training pipeline, and model artifacts
- frontend/ - UI for upload, results, and history
- Dataset/ - BraTS2020 training and validation data (NIfTI .nii files)

## Backend Contents
- backend/main.py - FastAPI app and /analyze endpoint
- backend/train.py - Training loop for tumor vs no-tumor classifier
- backend/data.py - BraTS dataset scan and slice sampling
- backend/model.py - Simple CNN model definition
- backend/infer.py - Model loading + Grad-CAM visualization
- backend/config.py - Training and data defaults
- backend/artifacts/ - Saved weights and training summary

### API Endpoints
- GET / - Health check
- POST /analyze - Upload an image and get classification + Grad-CAM + mask

Request format: multipart/form-data with a single file field named file.

## Frontend Contents
- frontend/index.html - SPA layout (Upload, Results, History)
- frontend/app.js - UI logic, API calls, localStorage history
- frontend/style.css - Styling and animations

### Frontend Features
- Drag-and-drop image upload with preview
- API status indicator (online/offline)
- Results view with confidence, uncertainty, and metrics cards
- Grad-CAM and mask toggles
- History page stored in localStorage

## Requirements
- Python 3.10+ (recommended)
- Node.js 18+

## Backend Setup
1) Create/activate virtual environment
   - Windows: .venv\Scripts\activate.bat

2) Install Python dependencies
   - pip install -r backend\requirements.txt

## Train the Model
Run training with the current defaults (low-heat friendly):
- python -m backend.train

This saves weights to:
- backend/artifacts/tumor_classifier.pt

## Run the API
- python -m uvicorn backend.main:app --reload

API base URL:
- http://127.0.0.1:8000

## Frontend Setup
1) Install dependencies
   - npm install

2) Start the dev server
   - npm run dev

Open the URL shown in the terminal (usually http://localhost:5173).

## Notes
- The classifier is Tumor vs No Tumor (BraTS does not provide 4-class tumor labels).
- The mask visualization is derived from Grad-CAM and is not a true segmentation model.
