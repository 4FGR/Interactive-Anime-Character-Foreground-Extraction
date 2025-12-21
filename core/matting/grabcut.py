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

    def _convert_to_rgba(self, img_bgr):
        b, g, r = cv2.split(img_bgr)
        alpha = np.ones(b.shape, dtype=np.uint8) * 255
        return cv2.merge([b, g, r, alpha])

    # 专门用于保留动漫勾线的处理函数
    def preserve_anime_outlines(self, mask_uint8):
        h, w = mask_uint8.shape[:2]
        min_dim = min(h, w) # 取短边作为参考
        
        # 动态计算核大小
        # 根据720p的图片来取5x5的核，对其它分辨率按比例缩放
        k_size = int(min_dim/720 * 5) 
        
        # 必须是奇数
        if k_size % 2 == 0: k_size += 1
        
        # 限制范围：最小 3x3，最大 11x11
        k_size = max(3, min(k_size, 11))
        
        # 执行形态学扩张
        # 使用动态计算出的 k_size
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
        mask_dilated = cv2.dilate(mask_uint8, kernel, iterations=1)
        
        # 边缘羽化
        # 核变大了，模糊也要跟着变大一点点，否则边缘会显得硬
        blur_size = k_size
        mask_float = mask_dilated.astype(np.float32) / 255.0
        mask_blurred = cv2.GaussianBlur(mask_float, (blur_size, blur_size), 0)
        
        # 锐化重塑
        mask_refined = (mask_blurred - 0.5) * 6.0 + 0.5
        mask_refined = np.clip(mask_refined, 0, 1)
        
        return mask_refined

    def process(self, img_input=None, rect=None, corrections=None):
        """
        img_input: 输入图像
        rect: 选区范围
        corrections: 用户修正笔画
        """
        # 图像加载
        if img_input is not None:
            if isinstance(img_input, str):
                self.img = cv2.imread(img_input)
            elif isinstance(img_input, np.ndarray):
                self.img = img_input.copy()
        
        if self.img is None:
            raise ValueError("No image provided")
        
        h, w = self.img.shape[:2]
        work_img = self.img

        # Mask 与模型初始化
        mask = np.zeros((h, w), np.uint8)
        bgdModel = np.zeros((1, 65), np.float64)
        fgdModel = np.zeros((1, 65), np.float64)
        
        # 默认边框
        if rect is None or rect[2] <= 1 or rect[3] <= 1:
            margin = 1 
            rect = (margin, margin, w - 2*margin, h - 2*margin)
        x, y, rw, rh = rect

        # 确定工作模式
        has_corrections = (corrections is not None and len(corrections) > 0)

        if has_corrections:
            print("[ALGO] 修正模式：Mask 初始化")
            # 初始化 Mask：Rect 区域设为可能前景
            mask[y:y+rh, x:x+rw] = cv2.GC_PR_FGD
            
            # 绘制用户笔画
            for stroke in corrections:
                s_type = stroke.get('type')
                points = stroke.get('points')
                width = stroke.get('width', 15)

                if not points or len(points) < 2: continue

                pts = np.array(points, np.int32).reshape((-1, 1, 2))
                # fg -> 绝对前景(1), bg -> 绝对背景(0)
                color = cv2.GC_FGD if s_type == 'fg' else cv2.GC_BGD
                cv2.polylines(mask, [pts], False, color, width)

            # 运行 GrabCut
            try:
                cv2.grabCut(work_img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_MASK)
            except cv2.error as e:
                print(f"GrabCut 失败: {e}")
                return self._convert_to_rgba(self.img)

        else:
            try:
                cv2.grabCut(work_img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)
            except cv2.error as e:
                print(f"GrabCut 失败: {e}")
                return self._convert_to_rgba(self.img)

        # 提取结果
        mask_result = np.where((mask == 2) | (mask == 0), 0, 255).astype('uint8')

        # 返回 Alpha (不再直接除以255，而是调用优化函数)
        alpha_channel = self.preserve_anime_outlines(mask_result)
        
        return alpha_channel