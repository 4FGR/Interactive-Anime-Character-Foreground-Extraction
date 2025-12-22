import cv2
import numpy as np
from PIL import Image
import time # 引入时间模块用于调试

# 尝试导入 LaMa
try:
    from simple_lama_inpainting import SimpleLama
    HAS_LAMA = True
except ImportError:
    HAS_LAMA = False

class InpaintingService:
    def __init__(self):
        self.lama_model = None
        if HAS_LAMA:
            print("LaMa 模块已导入")

    def _get_model(self):
        # 懒加载
        if self.lama_model is None and HAS_LAMA:
            print(f"[DEBUG] {time.strftime('%H:%M:%S')} - (首次运行需下载权重)")
            t_start = time.time()
            self.lama_model = SimpleLama()
            print(f"[DEBUG] {time.strftime('%H:%M:%S')} - 模型加载完成! 耗时: {time.time() - t_start:.2f}s")
        return self.lama_model

    def process(self, img, corrections, use_lama=False):
        h, w = img.shape[:2]
        inpaint_mask = np.zeros((h, w), dtype=np.uint8)
        has_draw = False

        # 生成 Mask
        for stroke in corrections:
            if stroke.get('type') == 'inpaint':
                has_draw = True
                points = stroke.get('points')
                shape = stroke.get('shape', 'line')
                if not points or len(points) < 2: continue
                
                if shape == 'rect':
                    pt1, pt2 = tuple(points[0]), tuple(points[1])
                    cv2.rectangle(inpaint_mask, pt1, pt2, 255, -1)
                else:
                    width = stroke.get('width', 15)
                    pts = np.array(points, np.int32).reshape((-1, 1, 2))
                    cv2.polylines(inpaint_mask, [pts], False, 255, width)

        if not has_draw:
            return img

        # 选择算法执行
        model = self._get_model()
        
        if use_lama and model:
            print(f"[DEBUG] {time.strftime('%H:%M:%S')} - 开始 LaMa AI 计算 (分辨率: {w}x{h})...")
            t_start = time.time()
            try:
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                # 执行推理
                res_pil = model(Image.fromarray(img_rgb), Image.fromarray(inpaint_mask))
                
                t_cost = time.time() - t_start
                print(f"[DEBUG] {time.strftime('%H:%M:%S')} - AI 修复完成! 耗时: {t_cost:.2f}s")
                
                return cv2.cvtColor(np.array(res_pil), cv2.COLOR_RGB2BGR)
            except Exception as e:
                print(f"[ERROR] LaMa Error: {e}, 回退到 OpenCV")

        # 降级方案 (OpenCV)
        print("[ALGO] Running OpenCV Inpainting...")
        inpaint_mask = cv2.dilate(inpaint_mask, np.ones((5,5), np.uint8))
        return cv2.inpaint(img, inpaint_mask, 3, cv2.INPAINT_TELEA)