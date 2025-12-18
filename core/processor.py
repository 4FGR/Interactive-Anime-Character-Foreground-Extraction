from .inpainting import InpaintingService
from .matting.grabcut import AdvancedGrabCutProcessor
from .matting.dl_model import DLMatting
from .utils import composite_image

class MainProcessor:
    def __init__(self):
        # 初始化各个服务
        self.inpainter = InpaintingService()
        self.grabcut = AdvancedGrabCutProcessor()
        self.dl_matting = DLMatting()

    def process(self, img_input, rect=None, corrections=None, options=None):
        if options is None: options = {}
        
        use_lama = options.get('use_lama', False)
        method = options.get('method', 'grabcut')

        # 1. 去字阶段 (Inpainting)
        # 无论后面选什么抠图，先去字。返回的是 BGR 图片。
        work_img = self.inpainter.process(img_input, corrections, use_lama)

        # 2. 抠图阶段 (Matting)
        # 返回的是 Alpha 通道 (0.0 - 1.0 float)
        alpha_channel = None

        if method == 'dl':
            alpha_channel = self.dl_matting.run(work_img)
        
        # 如果没选 DL，或者 DL 失败，回退到 GrabCut
        if alpha_channel is None:
            # 现在 grabcut.process 返回的是 alpha 通道
            alpha_channel = self.grabcut.process(work_img, rect, corrections)

        # 3. 合成阶段 (Compositing)
        # 将去字后的图 + Alpha 通道 + 格子背景合成为一张图
        final_img = composite_image(work_img, alpha_channel)
        
        return final_img