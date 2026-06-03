import random
from dataclasses import dataclass
from pathlib import Path

import nibabel as nib
import numpy as np
import torch
from torch.utils.data import Dataset


def _normalize_slice(slice_arr: np.ndarray) -> np.ndarray:
    slice_arr = slice_arr.astype(np.float32)
    vmin = np.percentile(slice_arr, 1)
    vmax = np.percentile(slice_arr, 99)
    if vmax - vmin < 1e-6:
        return np.zeros_like(slice_arr, dtype=np.float32)
    slice_arr = np.clip(slice_arr, vmin, vmax)
    slice_arr = (slice_arr - vmin) / (vmax - vmin)
    return slice_arr


@dataclass
class BraTSCase:
    case_id: str
    t1ce_path: Path
    seg_path: Path


def scan_training_cases(train_root: Path) -> list[BraTSCase]:
    cases: list[BraTSCase] = []
    for case_dir in sorted(train_root.glob("BraTS20_Training_*")):
        if not case_dir.is_dir():
            continue
        case_id = case_dir.name
        t1ce = next(case_dir.glob(f"{case_id}_t1ce.nii"), None)
        seg = next(case_dir.glob(f"{case_id}_seg.nii"), None)
        if t1ce and seg:
            cases.append(BraTSCase(case_id, t1ce, seg))
    return cases


class _VolumeCache:
    def __init__(self, max_items: int = 2):
        self.max_items = max_items
        self._cache: dict[Path, np.ndarray] = {}
        self._order: list[Path] = []

    def get(self, path: Path) -> np.ndarray:
        if path in self._cache:
            self._order.remove(path)
            self._order.append(path)
            return self._cache[path]

        arr = nib.load(str(path)).get_fdata()
        if len(self._order) >= self.max_items:
            oldest = self._order.pop(0)
            self._cache.pop(oldest, None)
        self._cache[path] = arr
        self._order.append(path)
        return arr


class BraTSSliceDataset(Dataset):
    def __init__(
        self,
        cases: list[BraTSCase],
        image_size: int,
        slices_per_volume: int,
        seed: int,
        cache_size: int = 2,
    ):
        self.cases = cases
        self.image_size = image_size
        self.slices_per_volume = slices_per_volume
        self.seed = seed
        self._cache = _VolumeCache(cache_size)

    def __len__(self) -> int:
        return len(self.cases) * self.slices_per_volume

    def _pick_slice_index(self, depth: int, idx: int) -> int:
        rng = random.Random(self.seed + idx)
        return rng.randint(0, depth - 1)

    def __getitem__(self, idx: int):
        case_idx = idx % len(self.cases)
        case = self.cases[case_idx]

        t1ce_vol = self._cache.get(case.t1ce_path)
        seg_vol = self._cache.get(case.seg_path)

        depth = t1ce_vol.shape[-1]
        slice_idx = self._pick_slice_index(depth, idx)

        t1ce_slice = t1ce_vol[:, :, slice_idx]
        seg_slice = seg_vol[:, :, slice_idx]

        image = _normalize_slice(t1ce_slice)
        label = 1 if np.any(seg_slice > 0) else 0

        image = torch.from_numpy(image).unsqueeze(0)
        image = torch.nn.functional.interpolate(
            image.unsqueeze(0),
            size=(self.image_size, self.image_size),
            mode="bilinear",
            align_corners=False,
        ).squeeze(0)

        return image, torch.tensor(label, dtype=torch.long)
