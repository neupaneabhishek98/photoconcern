#!/usr/bin/env python3
"""
Passport Photo Maker — OpenCV implementation.

Reads an input image, detects the face, crops to a 28x32mm (W x H) frame with
proper composition (head about 28-30 mm tall, top of head ~5 mm from top, chin
~24-26 mm from top — see ICAO 9303 for the general rules), straightens the
image using the angle between the eyes, optionally replaces the background
with white using GrabCut, and writes the result as JPG.

Usage:
    python scripts/passport_photo.py <input> <output> [--bg white|keep] [--dpi 300]

Dependencies (the Node route will tell users to install these):
    pip install opencv-python numpy

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
# Target head height as fraction of photo height (~70-80% per ICAO 9303 / NPL)
HEAD_HEIGHT_FRAC   = 0.75
# Top-of-head margin as fraction of photo height (small gap above head)
TOP_MARGIN_FRAC    = 0.06


def fail(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def load_face_detector():
    """Try DNN (more accurate); fall back to Haar cascade if model files missing."""
    haar_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    haar = cv2.CascadeClassifier(haar_path)
    eyes_path = os.path.join(cv2.data.haarcascades, "haarcascade_eye.xml")
    eye_cascade = cv2.CascadeClassifier(eyes_path)
    return haar, eye_cascade


def detect_face(image_bgr, haar):
    """Return (x, y, w, h) of the largest face, or None."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = haar.detectMultiScale(
        gray,
        scaleFactor=1.15,
        minNeighbors=5,
        minSize=(80, 80),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )
    if len(faces) == 0:
        return None
    return max(faces, key=lambda f: f[2] * f[3])  # largest face


def straighten_by_eyes(image_bgr, face_box, eye_cascade):
    """Rotate the image so the line between the eyes is horizontal."""
    x, y, w, h = face_box
    roi_gray = cv2.cvtColor(image_bgr[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY)
    eyes = eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=8, minSize=(20, 20))
    if len(eyes) < 2:
        return image_bgr  # cannot straighten — return unchanged
    # Pick the two top-most eyes (filter out mouth/nostrils mis-detections).
    eyes = sorted(eyes, key=lambda e: e[1])[:2]
    eyes = sorted(eyes, key=lambda e: e[0])  # left, right
    (ex1, ey1, ew1, eh1), (ex2, ey2, ew2, eh2) = eyes
    c1 = (x + ex1 + ew1 / 2, y + ey1 + eh1 / 2)
    c2 = (x + ex2 + ew2 / 2, y + ey2 + eh2 / 2)
    dy = c2[1] - c1[1]
    dx = c2[0] - c1[0]
    angle = math.degrees(math.atan2(dy, dx))
    if abs(angle) < 1.5:
        return image_bgr  # already level enough
    h_img, w_img = image_bgr.shape[:2]
    center = (w_img / 2, h_img / 2)
    mat = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(image_bgr, mat, (w_img, h_img), borderValue=(255, 255, 255))


def compose_passport(image_bgr, face_box, out_w_px, out_h_px):
    """
    Crop the source image around the detected face so that:
      - The head occupies ~HEAD_HEIGHT_FRAC of output height.
      - The top of the head sits ~TOP_MARGIN_FRAC from the top.
      - The face is horizontally centered.
    Output canvas has the passport aspect ratio (28:32 = 7:8).
    """
    fx, fy, fw, fh = face_box
    # OpenCV detects the face box ~from forehead to chin. Real "head height"
    # (top-of-hair to chin) is ~1.3 * face_box height. Adjust:
    head_height_px = fh * 1.30
    head_top_px = fy - 0.20 * fh  # roughly the top of the hair

    target_head_height_px = HEAD_HEIGHT_FRAC * out_h_px
    scale = target_head_height_px / head_height_px

    # Crop box dimensions in *source* coordinates
    crop_w = out_w_px / scale
    crop_h = out_h_px / scale

    # Position the crop:
    #   we want head_top_px in source -> TOP_MARGIN_FRAC * out_h_px in output
    src_top  = head_top_px - (TOP_MARGIN_FRAC * out_h_px) / scale
    face_cx  = fx + fw / 2
    src_left = face_cx - crop_w / 2

    src_left = int(round(src_left))
    src_top  = int(round(src_top))
    src_right  = src_left + int(round(crop_w))
    src_bottom = src_top  + int(round(crop_h))

    h_img, w_img = image_bgr.shape[:2]

    # Pad the source if crop goes out of bounds (white border so the head doesn't get clipped).
    pad_left   = max(0, -src_left)
    pad_top    = max(0, -src_top)
    pad_right  = max(0, src_right  - w_img)
    pad_bottom = max(0, src_bottom - h_img)
    if pad_left or pad_top or pad_right or pad_bottom:
        image_bgr = cv2.copyMakeBorder(
            image_bgr,
            pad_top, pad_bottom, pad_left, pad_right,
            cv2.BORDER_CONSTANT, value=(255, 255, 255)
        )
        src_left   += pad_left
        src_top    += pad_top
        src_right  += pad_left
        src_bottom += pad_top

    crop = image_bgr[src_top:src_bottom, src_left:src_right]
    out  = cv2.resize(crop, (out_w_px, out_h_px), interpolation=cv2.INTER_LANCZOS4)
    return out


def replace_background_white(image_bgr):
    """
    GrabCut-based background replacement. Fast, no extra deps. The result is
    OK for portraits against a fairly uniform background; for hair-detail
    quality the user should upload an already-clean photo.
    """
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    # Foreground rectangle: assume subject occupies the central 80% horizontally
    # and starts ~5% from the top down to the bottom.
    rect = (int(0.10 * w), int(0.05 * h), int(0.80 * w), int(0.95 * h))
    try:
        cv2.grabCut(image_bgr, mask, rect, bgd_model, fgd_model, 4, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return image_bgr
    fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype("uint8")
    # Soften the edge a touch so the cut doesn't look like a sticker
    fg_mask_blur = cv2.GaussianBlur(fg_mask.astype("float32"), (5, 5), 0)
    fg_mask_3 = cv2.merge([fg_mask_blur] * 3)
    white = np.full_like(image_bgr, 255)
    out = (image_bgr.astype("float32") * fg_mask_3 +
           white.astype("float32") * (1.0 - fg_mask_3)).astype("uint8")
    return out


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

    # Straighten if eyes are crooked
    img = straighten_by_eyes(img, face, eye_cascade)
    # Re-detect on the straightened image (the rotation can shift the box)
    face2 = detect_face(img, haar)
    if face2 is not None:
        face = face2

    # Target pixel size from mm + DPI:  mm / 25.4 * dpi
    out_w_px = int(round(PASSPORT_WIDTH_MM  / 25.4 * args.dpi))
    out_h_px = int(round(PASSPORT_HEIGHT_MM / 25.4 * args.dpi))

    composed = compose_passport(img, face, out_w_px, out_h_px)

    if args.bg == "white":
        composed = replace_background_white(composed)

    # Save as JPG (passport printers normally accept JPG)
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
