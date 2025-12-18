import sys
import os
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import io
import json

# 导入核心处理器
from core.processor import MainProcessor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024

# 全局单例，避免模型重复加载
processor = MainProcessor()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/process', methods=['POST'])
def process_image():
    print("\n[INFO] --- Request Received ---")
    try:
        if 'image' not in request.files: return jsonify({"error": "No image"}), 400
        file = request.files['image']
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
        if img is None: return jsonify({"error": "Decode failed"}), 400

        corrections = []
        if request.form.get('corrections'):
            corrections = json.loads(request.form.get('corrections'))
        
        options = {}
        if request.form.get('options'):
            options = json.loads(request.form.get('options'))

        print(f"[Params] Algo: {options.get('method')}, LaMa: {options.get('use_lama')}")

        # 调用处理
        output_img = processor.process(img, rect=None, corrections=corrections, options=options)

        success, buffer = cv2.imencode('.png', output_img)
        return send_file(io.BytesIO(buffer), mimetype='image/png')

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 使用线程模式，避免阻塞
    app.run(port=5000, threaded=True)
    