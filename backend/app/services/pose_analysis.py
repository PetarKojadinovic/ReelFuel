import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

MODEL_PATH = "models/pose_landmarker.task"

LEFT_HIP = 23
RIGHT_HIP = 24


def count_repetitions(signal: np.ndarray, threshold: float = 0.02) -> int:
    peaks = 0
    direction = None
    last_extreme = signal[0]

    for i in range(1, len(signal)):
        diff = signal[i] - last_extreme
        if direction is None:
            if abs(diff) > threshold:
                direction = "up" if diff > 0 else "down"
                last_extreme = signal[i]
        else:
            if direction == "up" and diff < -threshold:
                peaks += 1
                direction = "down"
                last_extreme = signal[i]
            elif direction == "down" and diff > threshold:
                peaks += 1
                direction = "up"
                last_extreme = signal[i]
            else:
                if (direction == "up" and signal[i] > last_extreme) or (
                    direction == "down" and signal[i] < last_extreme
                ):
                    last_extreme = signal[i]

    return peaks // 2


def analyze_video(video_path: str, sample_every_n_frames: int = 3) -> dict:
    base_options = mp_tasks.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
    )

    hip_y_values = []

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every_n_frames == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = int((frame_idx / fps) * 1000)

                result = landmarker.detect_for_video(mp_image, timestamp_ms)

                if result.pose_landmarks:
                    landmarks = result.pose_landmarks[0]
                    left_hip = landmarks[LEFT_HIP]
                    right_hip = landmarks[RIGHT_HIP]
                    avg_hip_y = (left_hip.y + right_hip.y) / 2
                    hip_y_values.append(avg_hip_y)

            frame_idx += 1

        cap.release()

    if len(hip_y_values) < 10:
        return {
            "detektovano_ponavljanja": None,
            "napomena": "Nedovoljno podataka za analizu pokreta (video prekratak ili osoba nije jasno vidljiva)",
        }

    signal = np.array(hip_y_values)
    reps = count_repetitions(signal)

    return {
        "detektovano_ponavljanja": reps,
        "napomena": "Broj ponavljanja procenjen na osnovu vertikalnog pokreta kukova - aproksimacija, ne 100% precizno",
    }