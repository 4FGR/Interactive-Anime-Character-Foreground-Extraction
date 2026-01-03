from .matting.grabcut import AdvancedGrabCutProcessor
from .utils import composite_image

class MainProcessor:
    def __init__(self):
        self.grabcut = AdvancedGrabCutProcessor()

    def process(self, img_input, rect=None, corrections=None, options=None):
        if options is None: options = {}
        
        use_lama = options.get('use_lama', False)


        # 抠图 (Matting)
        alpha_channel = self.grabcut.process(img_input, rect, corrections)
        final_img = composite_image(img_input, alpha_channel)
        
        return final_img