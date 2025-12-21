import cv2
import numpy as np
from PIL import Image

try:
    from rembg import new_session, remove
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False

class DLMatting:
    def __init__(self):
        # 改为懒加载，避免阻塞服务启动
        self.session = None
        if HAS_REMBG:
            print("Rembg 模块就绪")

    def run(self, img):
        if not HAS_REMBG:
            print("[WARN] Rembg 未安装")
            return None

        # 懒加载会在首次调用时初始化模型，会有少量延迟
        if self.session is None:
            try:
                print("[INFO] Loading Rembg Model (isnet-anime)...")
                self.session = new_session("isnet-anime")
            except Exception as e:
                print(f"[ERROR] Rembg 模型加载失败: {e}")
                return None

        print("[ALGO] Running Rembg (IS-Net)...")
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # 推理
        out_pil = remove(Image.fromarray(img_rgb), session=self.session)
        
        # 提取 Alpha 通道
        out_np = np.array(out_pil)
        alpha = out_np[:, :, 3] # Alpha channel (0-255)
        
        return alpha.astype(np.float32) / 255.0