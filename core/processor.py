from .inpainting import InpaintingService
from .matting.grabcut import AdvancedGrabCutProcessor
from .utils import composite_image

class MainProcessor:
    def __init__(self):
        self.inpainter = InpaintingService()
        self.grabcut = AdvancedGrabCutProcessor()

    def process(self, img_input, rect=None, corrections=None, options=None):
        if options is None: options = {}
        
        use_lama = options.get('use_lama', False)

        # 去字
        work_img = self.inpainter.process(img_input, corrections, use_lama)

        # 抠图 (Matting)
        alpha_channel = self.grabcut.process(work_img, rect, corrections)
        final_img = composite_image(work_img, alpha_channel)
        
        return final_img