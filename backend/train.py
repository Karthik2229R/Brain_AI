import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from backend.config import (
    ARTIFACTS_DIR,
    BATCH_SIZE,
    CLASS_NAMES,
    EPOCHS,
    IMAGE_SIZE,
    LEARNING_RATE,
    MODEL_PATH,
    SEED,
    SLICES_PER_VOLUME,
    SUMMARY_PATH,
    TRAIN_DIR,
)
from backend.data import BraTSSliceDataset, scan_training_cases
from backend.model import get_model


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def split_cases(cases: list, val_ratio: float, seed: int):
    rng = random.Random(seed)
    cases = cases[:]
    rng.shuffle(cases)
    split = int(len(cases) * (1 - val_ratio))
    return cases[:split], cases[split:]


def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    for images, labels in tqdm(loader, desc="Train", leave=False):
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad(set_to_none=True)
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * labels.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return running_loss / total, correct / total


def eval_epoch(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in tqdm(loader, desc="Val", leave=False):
            images = images.to(device)
            labels = labels.to(device)
            logits = model(images)
            loss = criterion(logits, labels)

            running_loss += loss.item() * labels.size(0)
            preds = logits.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    return running_loss / total, correct / total


def main():
    parser = argparse.ArgumentParser(description="Train tumor vs no tumor classifier.")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--image-size", type=int, default=IMAGE_SIZE)
    parser.add_argument("--slices-per-volume", type=int, default=SLICES_PER_VOLUME)
    parser.add_argument("--lr", type=float, default=LEARNING_RATE)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--val-ratio", type=float, default=0.1)
    args = parser.parse_args()

    set_seed(args.seed)

    cases = scan_training_cases(TRAIN_DIR)
    if not cases:
        raise SystemExit(f"No training cases found in {TRAIN_DIR}")

    train_cases, val_cases = split_cases(cases, args.val_ratio, args.seed)

    train_ds = BraTSSliceDataset(
        train_cases,
        image_size=args.image_size,
        slices_per_volume=args.slices_per_volume,
        seed=args.seed,
    )
    val_ds = BraTSSliceDataset(
        val_cases,
        image_size=args.image_size,
        slices_per_volume=max(1, args.slices_per_volume // 2),
        seed=args.seed + 1,
    )

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = get_model(num_classes=len(CLASS_NAMES)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()

    best_val = 0.0
    history = []

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)

        history.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
        })

        print(
            f"Epoch {epoch}/{args.epochs} | "
            f"train_acc={train_acc:.3f} val_acc={val_acc:.3f}"
        )

        if val_acc > best_val:
            best_val = val_acc
            ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "class_names": CLASS_NAMES,
                    "image_size": args.image_size,
                },
                MODEL_PATH,
            )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump({"history": history}, f, indent=2)

    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
