import cv2
import numpy as np

class AdvancedGrabCutProcessor:
    def __init__(self, img_input=None):
        self.img = None
        if img_input is not None:
            if isinstance(img_input, str):
                self.img = cv2.imread(img_input)
            elif isinstance(img_input, np.ndarray):
                self.img = img_input.copy()
            else:
                raise ValueError("Input error")

    def _create_checkerboard_pattern(self, h, w, grid_size=20):
        """生成透明格子背景"""
        color1 = (240, 240, 240)
        color2 = (200, 200, 200)
        pattern = np.full((h, w, 3), color1, dtype=np.uint8)
        for y in range(0, h, grid_size):
            for x in range(0, w, grid_size):
                if (y // grid_size + x // grid_size) % 2 == 1:
                    y_end = min(y + grid_size, h)
                    x_end = min(x + grid_size, w)
                    pattern[y:y_end, x:x_end] = color2
        return pattern

    def _convert_to_rgba(self, img_bgr):
        b, g, r = cv2.split(img_bgr)
        alpha = np.ones(b.shape, dtype=np.uint8) * 255
        return cv2.merge([b, g, r, alpha])

    def process(self, img_input=None, rect=None, corrections=None):
        """
        img_input: 输入图像 (可选，覆盖初始化时的图像)
        rect: 选区范围
        corrections: 用户修正笔画
        """
        # 1. 图像加载逻辑 (支持延迟初始化)
        if img_input is not None:
            if isinstance(img_input, str):
                self.img = cv2.imread(img_input)
            elif isinstance(img_input, np.ndarray):
                self.img = img_input.copy()
        
        if self.img is None:
            raise ValueError("No image provided (Please init with image or pass to process)")
        
        h, w = self.img.shape[:2]
        work_img = self.img

        # 2. Mask 与模型初始化
        mask = np.zeros((h, w), np.uint8)
        bgdModel = np.zeros((1, 65), np.float64)
        fgdModel = np.zeros((1, 65), np.float64)
        
        # 默认边框
        if rect is None or rect[2] <= 1 or rect[3] <= 1:
            margin = 1 
            rect = (margin, margin, w - 2*margin, h - 2*margin)
        x, y, rw, rh = rect

        # 3. 确定工作模式
        has_corrections = (corrections is not None and len(corrections) > 0)

        if has_corrections:
            print("[ALGO] 修正模式：Mask 初始化")
            # A. 初始化 Mask：Rect 区域设为可能前景
            mask[y:y+rh, x:x+rw] = cv2.GC_PR_FGD
            
            # B. 绘制用户笔画
            for stroke in corrections:
                s_type = stroke.get('type')
                points = stroke.get('points')
                width = stroke.get('width', 15)

                if not points or len(points) < 2: continue

                pts = np.array(points, np.int32).reshape((-1, 1, 2))
                # fg -> 绝对前景(1), bg -> 绝对背景(0)
                color = cv2.GC_FGD if s_type == 'fg' else cv2.GC_BGD
                cv2.polylines(mask, [pts], False, color, width)

            # C. 运行 GrabCut (Mask 模式)
            try:
                # 🛠️ 修复点：rect 参数不能传 None，必须传元组，即使在 MASK 模式下会被忽略
                cv2.grabCut(work_img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_MASK)
            except cv2.error as e:
                print(f"[ERROR] GrabCut 失败: {e}")
                return self._convert_to_rgba(self.img)

        else:
            print("[ALGO] 初始模式：Rect 初始化")
            # 纯粹的原始 GrabCut
            try:
                cv2.grabCut(work_img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)
            except cv2.error as e:
                print(f"[ERROR] GrabCut 失败: {e}")
                return self._convert_to_rgba(self.img)

        # 4. 提取结果
        mask_result = np.where((mask == 2) | (mask == 0), 0, 255).astype('uint8')

        # 5. 返回 Alpha 通道 (0.0~1.0 float)，交由外层统一合成
        alpha_channel = (mask_result.astype(np.float32) / 255.0)
        return alpha_channel