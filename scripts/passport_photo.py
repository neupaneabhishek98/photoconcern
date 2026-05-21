#!/usr/bin/env python3
"""
Passport Photo Maker — OpenCV implementation (professional pipeline).

Reads an input image, detects the face, straightens by eyes, crops to a
28 x 32 mm (W x H) frame with proper headroom (top-of-head -> upper chest),
optionally replaces the background with white using GrabCut, runs a
gentle retouch pipeline (skin smoothing, even tones via CLAHE, contrast
normalisation, unsharp mask), and writes a JPG.

Usage:
    python scripts/passport_photo.py <input> <output> [--bg white|keep] [--dpi 300]

Dependencies:
    pip install opencv-python-headless numpy

Exit codes:
    0 on success, 2 if no face was detected, 1 on other errors.
"""

import argparse
import os
import sys
import math
import cv2
import numpy as np


# Passport size (Nepal/India common): 28 mm wide x 32 mm tall, white background.
PASSPORT_WIDTH_MM  = 28.0
PASSPORT_HEIGHT_MM = 32.0
# Target head height as fraction of photo height (~70-80% per ICAO 9303 / NPL).
HEAD_HEIGHT_FRAC   = 0.72
# Top-of-head margin as fraction of photo height (breathing space above hair).
TOP_MARGIN_FRAC    = 0.08


# ------------------------------------------------------------------
# Utility
# ------------------------------------------------------------------
def fail(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


# ------------------------------------------------------------------
# Face detection
# ------------------------------------------------------------------
def load_face_detector():
    """Haar cascades — bundled with OpenCV, no model download needed."""
    haar_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    eyes_path = os.path.join(cv2.data.haarcascades, "haarcascade_eye.xml")
    return cv2.CascadeClassifier(haar_path), cv2.CascadeClassifier(eyes_path)


def detect_face(image_bgr, haar):
    """Return (x, y, w, h) of the largest face, or None."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = haar.detectMultiScale(
        gray, scaleFactor=1.12, minNeighbors=5,
        minSize=(80, 80), flags=cv2.CASCADE_SCALE_IMAGE,
    )
    if len(faces) == 0:
        return None
    return max(faces, key=lambda f: f[2] * f[3])


def straighten_by_eyes(image_bgr, face_box, eye_cascade):
    """Rotate so the line between the eyes is horizontal."""
    x, y, w, h = face_box
    roi_gray = cv2.cvtColor(image_bgr[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY)
    eyes = eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=8, minSize=(20, 20))
    if len(eyes) < 2:
        return image_bgr
    eyes = sorted(eyes, key=lambda e: e[1])[:2]           # top-most two
    eyes = sorted(eyes, key=lambda e: e[0])                # left, right
    (ex1, ey1, ew1, eh1), (ex2, ey2, ew2, eh2) = eyes
    c1 = (x + ex1 + ew1 / 2, y + ey1 + eh1 / 2)
    c2 = (x + ex2 + ew2 / 2, y + ey2 + eh2 / 2)
    angle = math.degrees(math.atan2(c2[1] - c1[1], c2[0] - c1[0]))
    if abs(angle) < 1.2:
        return image_bgr
    h_img, w_img = image_bgr.shape[:2]
    mat = cv2.getRotationMatrix2D((w_img / 2, h_img / 2), angle, 1.0)
    return cv2.warpAffine(image_bgr, mat, (w_img, h_img), borderValue=(255, 255, 255))


# ------------------------------------------------------------------
# Composition — crop to top-of-head -> upper chest @ 28x32mm
# ------------------------------------------------------------------
def compose_passport(image_bgr, face_box, out_w_px, out_h_px):
    fx, fy, fw, fh = face_box
    head_height_px = fh * 1.30          # Haar box is forehead->chin; pad to real head height
    head_top_px    = fy - 0.22 * fh     # ~top of hair

    target_head_height_px = HEAD_HEIGHT_FRAC * out_h_px
    scale = target_head_height_px / head_height_px

    crop_w = out_w_px / scale
    crop_h = out_h_px / scale

    src_top  = head_top_px - (TOP_MARGIN_FRAC * out_h_px) / scale
    face_cx  = fx + fw / 2
    src_left = face_cx - crop_w / 2

    src_left   = int(round(src_left))
    src_top    = int(round(src_top))
    src_right  = src_left + int(round(crop_w))
    src_bottom = src_top  + int(round(crop_h))

    h_img, w_img = image_bgr.shape[:2]
    pad_left   = max(0, -src_left)
    pad_top    = max(0, -src_top)
    pad_right  = max(0, src_right  - w_img)
    pad_bottom = max(0, src_bottom - h_img)
    if pad_left or pad_top or pad_right or pad_bottom:
        image_bgr = cv2.copyMakeBorder(
            image_bgr, pad_top, pad_bottom, pad_left, pad_right,
            cv2.BORDER_CONSTANT, value=(255, 255, 255)
        )
        src_left   += pad_left
        src_top    += pad_top
        src_right  += pad_left
        src_bottom += pad_top

    crop = image_bgr[src_top:src_bottom, src_left:src_right]
    return cv2.resize(crop, (out_w_px, out_h_px), interpolation=cv2.INTER_LANCZOS4)


# ------------------------------------------------------------------
# Background → white (GrabCut)
# ------------------------------------------------------------------
def replace_background_white(image_bgr):
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    bgd  = np.zeros((1, 65), np.float64)
    fgd  = np.zeros((1, 65), np.float64)
    rect = (int(0.10 * w), int(0.04 * h), int(0.80 * w), int(0.94 * h))
    try:
        cv2.grabCut(image_bgr, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return image_bgr
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype("uint8")
    # Feather the alpha edge a little so the cut doesn't look harsh
    fg = cv2.GaussianBlur(fg.astype("float32"), (7, 7), 0)
    fg = np.clip(fg, 0.0, 1.0)
    alpha = cv2.merge([fg] * 3)
    white = np.full_like(image_bgr, 255)
    out = (image_bgr.astype("float32") * alpha + white.astype("float32") * (1.0 - alpha))
    return np.clip(out, 0, 255).astype("uint8")


# ------------------------------------------------------------------
# Retouch pipeline — skin cleanup, even tones, contrast, sharpen
# ------------------------------------------------------------------
def detect_skin_mask(image_bgr):
    """Rough skin mask in YCrCb space — used to localise smoothing."""
    ycrcb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2YCrCb)
    lower = np.array([0,  133, 77 ], dtype=np.uint8)
    upper = np.array([255, 173, 127], dtype=np.uint8)
    skin  = cv2.inRange(ycrcb, lower, upper)
    skin  = cv2.medianBlur(skin, 5)
    skin  = cv2.dilate(skin, np.ones((3, 3), np.uint8), iterations=1)
    skin  = cv2.GaussianBlur(skin, (15, 15), 0)
    return skin.astype("float32") / 255.0  # 0..1 mask


def smooth_skin(image_bgr):
    """Bilateral filter blended only into the skin mask (preserves eyes/lips/hair)."""
    skin = detect_skin_mask(image_bgr)
    # Two passes of bilateral filter: even out tone + remove minor blemishes
    smooth = cv2.bilateralFilter(image_bgr, d=9, sigmaColor=45, sigmaSpace=9)
    smooth = cv2.bilateralFilter(smooth,    d=7, sigmaColor=35, sigmaSpace=7)
    alpha = cv2.merge([skin * 0.85] * 3)   # 85% effect inside skin, 0 outside
    out = image_bgr.astype("float32") * (1.0 - alpha) + smooth.astype("float32") * alpha
    return np.clip(out, 0, 255).astype("uint8")


def remove_spots(image_bgr):
    """Inpaint dark/saturated spots (acne, moles, larger blemishes) over skin."""
    skin = detect_skin_mask(image_bgr)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    # Difference from a heavily blurred copy highlights spots
    blur = cv2.medianBlur(gray, 21)
    diff = cv2.absdiff(blur, gray)
    _, spot_mask = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
    spot_mask = (spot_mask.astype("float32") * skin).astype("uint8")
    # Only keep small blobs (avoid removing eyes/eyebrows)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(spot_mask, connectivity=8)
    keep = np.zeros_like(spot_mask)
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if 4 <= area <= 120:           # very small blemishes only
            keep[labels == i] = 255
    if cv2.countNonZero(keep) == 0:
        return image_bgr
    keep = cv2.dilate(keep, np.ones((3, 3), np.uint8), iterations=1)
    return cv2.inpaint(image_bgr, keep, 3, cv2.INPAINT_TELEA)


def even_tones_clahe(image_bgr):
    """CLAHE on the L channel for even local contrast / tone."""
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def auto_contrast(image_bgr, clip_percent=1.5):
    """Per-channel histogram stretch — sets the darkest/brightest 1.5% to 0/255."""
    out = np.empty_like(image_bgr)
    for c in range(3):
        ch = image_bgr[:, :, c]
        lo = np.percentile(ch, clip_percent)
        hi = np.percentile(ch, 100 - clip_percent)
        if hi <= lo:
            out[:, :, c] = ch
            continue
        stretched = (ch.astype("float32") - lo) * (255.0 / (hi - lo))
        out[:, :, c] = np.clip(stretched, 0, 255).astype("uint8")
    return out


def unsharp_mask(image_bgr, amount=0.6, radius=1.2, threshold=2):
    """Gentle final sharpening — keeps eyes and hair crisp without halos."""
    blurred = cv2.GaussianBlur(image_bgr, (0, 0), radius)
    sharpened = cv2.addWeighted(image_bgr, 1 + amount, blurred, -amount, 0)
    if threshold > 0:
        low_contrast = np.abs(image_bgr.astype("int16") - blurred.astype("int16")) < threshold
        np.copyto(sharpened, image_bgr, where=low_contrast)
    return sharpened


def retouch_pipeline(image_bgr):
    """Full retouch chain — order matters."""
    out = remove_spots(image_bgr)        # 1. spot inpaint
    out = smooth_skin(out)               # 2. localised skin smoothing
    out = even_tones_clahe(out)          # 3. even out lighting
    out = auto_contrast(out, 1.5)        # 4. contrast normalisation
    out = unsharp_mask(out, amount=0.6)  # 5. final sharpen
    return out


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--bg", choices=["white", "keep"], default="white")
    ap.add_argument("--dpi", type=int, default=300)
    args = ap.parse_args()

    if not os.path.exists(args.input):
        fail(f"Input not found: {args.input}")

    img = cv2.imread(args.input)
    if img is None:
        fail("Could not read input image (unsupported format?)")

    haar, eye_cascade = load_face_detector()

    face = detect_face(img, haar)
    if face is None:
        fail("No face detected. Try a clearer, front-facing portrait.", code=2)

    img = straighten_by_eyes(img, face, eye_cascade)
    face2 = detect_face(img, haar)
    if face2 is not None:
        face = face2

    # Output pixel size: mm / 25.4 * dpi
    out_w_px = int(round(PASSPORT_WIDTH_MM  / 25.4 * args.dpi))
    out_h_px = int(round(PASSPORT_HEIGHT_MM / 25.4 * args.dpi))

    composed = compose_passport(img, face, out_w_px, out_h_px)

    if args.bg == "white":
        composed = replace_background_white(composed)

    # Professional retouch chain
    composed = retouch_pipeline(composed)

    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
    ok = cv2.imwrite(args.output, composed, encode_params)
    if not ok:
        fail("Could not write output image")

    print(f"OK width={out_w_px}px height={out_h_px}px dpi={args.dpi}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa
        fail(f"Error: {e}")
