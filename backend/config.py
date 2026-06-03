from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parent

DATASET_DIR = ROOT_DIR / "Dataset"
TRAIN_DIR = DATASET_DIR / "BraTS2020_TrainingData" / "MICCAI_BraTS2020_TrainingData"
VAL_DIR = DATASET_DIR / "BraTS2020_ValidationData" / "MICCAI_BraTS2020_ValidationData"

ARTIFACTS_DIR = BACKEND_DIR / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "tumor_classifier.pt"
SUMMARY_PATH = ARTIFACTS_DIR / "training_summary.json"

IMAGE_SIZE = 160
NUM_CLASSES = 2
CLASS_NAMES = ["Tumor", "No Tumor"]
SEED = 42
SLICES_PER_VOLUME = 8
BATCH_SIZE = 4
LEARNING_RATE = 1e-4
EPOCHS = 5
