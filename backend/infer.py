import io
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter, ImageDraw

from backend.config import CLASS_NAMES, IMAGE_SIZE, MODEL_PATH
from backend.model import get_model


@dataclass
class ModelBundle:
    model: torch.nn.Module
    class_names: list[str]
    image_size: int
    device: torch.device


class GradCAM:
    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.activations = None
        self.gradients = None
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(_, __, output):
            self.activations = output

        def backward_hook(_, grad_in, grad_out):
            self.gradients = grad_out[0]

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate(self, x: torch.Tensor, class_idx: int) -> np.ndarray:
        self.model.zero_grad(set_to_none=True)
        logits = self.model(x)
        score = logits[:, class_idx].sum()
        score.backward()

        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = torch.relu(cam)
        cam = cam.squeeze().detach().cpu().numpy()

        cam = cam - cam.min()
        if cam.max() > 0:
            cam = cam / cam.max()
        return cam


def load_model(model_path: Path = MODEL_PATH) -> ModelBundle:
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    payload = torch.load(model_path, map_location=device)

    class_names = payload.get("class_names", CLASS_NAMES)
    image_size = payload.get("image_size", IMAGE_SIZE)

    model = get_model(num_classes=len(class_names))
    model.load_state_dict(payload["model_state"])
    model.to(device)
    model.eval()

    return ModelBundle(model=model, class_names=class_names, image_size=image_size, device=device)


def _prepare_image(img: Image.Image, image_size: int) -> torch.Tensor:
    img = img.convert("L").resize((image_size, image_size))
    arr = np.array(img).astype(np.float32)
    vmin = np.percentile(arr, 1)
    vmax = np.percentile(arr, 99)
    if vmax - vmin < 1e-6:
        arr = np.zeros_like(arr, dtype=np.float32)
    else:
        arr = np.clip(arr, vmin, vmax)
        arr = (arr - vmin) / (vmax - vmin)
    tensor = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0)
    return tensor


def _colorize_heatmap(heatmap: np.ndarray) -> Image.Image:
    heatmap = (heatmap * 255).astype(np.uint8)
    heatmap = np.stack([heatmap, np.zeros_like(heatmap), 255 - heatmap], axis=-1)
    return Image.fromarray(heatmap, "RGB")


def _make_segmentation_mask(heatmap: np.ndarray, size: tuple[int, int]) -> Image.Image:
    mask = (heatmap > 0.6).astype(np.uint8)
    mask_img = Image.new("RGB", size, (10, 15, 30))
    draw = ImageDraw.Draw(mask_img)

    ys, xs = np.where(mask > 0)
    if len(xs) > 0:
        min_x, max_x = int(xs.min()), int(xs.max())
        min_y, max_y = int(ys.min()), int(ys.max())
        draw.rectangle([(min_x, min_y), (max_x, max_y)], outline=(0, 210, 255), width=3)
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=1))
    return mask_img


def predict_with_model(img: Image.Image, bundle: ModelBundle) -> dict:
    tensor = _prepare_image(img, bundle.image_size).to(bundle.device)
    with torch.no_grad():
        logits = bundle.model(tensor)
        probs = torch.softmax(logits, dim=1).cpu().numpy().squeeze()

    class_idx = int(np.argmax(probs))
    confidence = float(probs[class_idx] * 100)

    gradcam = GradCAM(bundle.model, bundle.model.features[-1])
    heatmap = gradcam.generate(tensor, class_idx)
    heatmap_img = _colorize_heatmap(heatmap)
    heatmap_img = heatmap_img.resize(img.size)
    heatmap_resized = np.array(heatmap_img.convert("L"), dtype=np.float32) / 255.0

    base = img.convert("RGB")
    gradcam_overlay = Image.blend(base, heatmap_img, alpha=0.55)

    seg_mask = _make_segmentation_mask(heatmap_resized, img.size)

    return {
        "classification": {
            "predicted_class": bundle.class_names[class_idx],
            "class_index": class_idx,
            "confidence": round(confidence, 2),
            "uncertainty": 0.0,
            "all_scores": {
                bundle.class_names[i]: round(float(probs[i] * 100), 2)
                for i in range(len(bundle.class_names))
            },
        },
        "gradcam_image": gradcam_overlay,
        "segmentation_mask": seg_mask,
    }
