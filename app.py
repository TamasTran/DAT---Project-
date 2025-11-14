import io
from pathlib import Path
from typing import Dict

import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, render_template, request
from tensorflow import keras
from tensorflow.keras.applications.efficientnet import preprocess_input
from tensorflow.keras.models import load_model

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "best_b4" / "best_b4.h5"


class CosineWithWarmup(tf.keras.optimizers.schedules.LearningRateSchedule):
    def __init__(self, base_lr: float, total_steps: int, warmup_steps: int):
        super().__init__()
        self.base_lr = float(base_lr)
        self.total_steps = int(total_steps)
        self.warmup_steps = int(warmup_steps)

    def __call__(self, step: tf.Tensor) -> tf.Tensor:
        step = tf.cast(step, tf.float32)
        total = tf.cast(self.total_steps, tf.float32)
        warmup = tf.cast(self.warmup_steps, tf.float32)

        warm = tf.minimum(step / tf.maximum(warmup, 1.0), 1.0)

        denom = tf.maximum(total - warmup, 1.0)
        progress = tf.clip_by_value((step - warmup) / denom, 0.0, 1.0)
        cosine = 0.5 * (1.0 + tf.cos(np.pi * progress))

        lr = self.base_lr * (warm * cosine + (1.0 - warm) * 0.0)
        return tf.cast(lr, tf.float32)


class Cast(keras.layers.Layer):
    def call(self, inputs: tf.Tensor) -> tf.Tensor:
        return tf.cast(inputs, tf.float32)


custom_objects = {
    "Cast": Cast,
    "CosineWithWarmup": CosineWithWarmup,
}

model = load_model(MODEL_PATH, custom_objects=custom_objects, compile=False)
input_height, input_width = model.input_shape[1:3]

CLASS_NAMES = ["CBB", "CBSD", "CGM", "CMD", "Healthy"]

app = Flask(__name__)


def preprocess_image(file_bytes: bytes) -> np.ndarray:
    with io.BytesIO(file_bytes) as buffer:
        image = tf.keras.utils.load_img(buffer, target_size=(input_height, input_width))
    array = tf.keras.utils.img_to_array(image)
    array = preprocess_input(array)
    return np.expand_dims(array, axis=0)


def predict_from_bytes(file_bytes: bytes) -> Dict[str, object]:
    batch = preprocess_image(file_bytes)
    preds = model.predict(batch, verbose=0)[0]

    if preds.ndim == 0:
        preds = np.array([float(preds)])

    result: Dict[str, object] = {}

    if preds.shape[-1] == 1:
        positive_prob = float(preds[0])
        label = CLASS_NAMES[1] if positive_prob >= 0.5 else CLASS_NAMES[0]
        probs = {
            CLASS_NAMES[0]: float(1.0 - positive_prob),
            CLASS_NAMES[1]: positive_prob,
        }
        confidence = max(probs.values())
    else:
        idx = int(np.argmax(preds))
        label = CLASS_NAMES[idx]
        confidence = float(preds[idx])
        probs = {cls: float(preds[i]) for i, cls in enumerate(CLASS_NAMES[: len(preds)])}

    result["label"] = label
    result["confidence"] = confidence
    result["probabilities"] = probs
    return result


@app.get("/")
def index():
    return render_template("index.html", class_names=CLASS_NAMES)


@app.post("/predict")
def predict():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "Vui lòng chọn hoặc chụp một ảnh lá sắn."}), 400

    try:
        payload = predict_from_bytes(file.read())
        return jsonify(payload)
    except Exception as exc:  # pylint: disable=broad-except
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
