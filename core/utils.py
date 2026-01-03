import cv2
import numpy as np

def composite_image(img_bgr, alpha_channel):
    # 确保 Alpha 是 0-255 的 uint8 格式
    if alpha_channel.dtype != np.uint8:
        # 如果是 float (0.0-1.0)，则映射到 0-255
        alpha_uint8 = (alpha_channel * 255).astype(np.uint8)
    else:
        alpha_uint8 = alpha_channel

    # 拆分原图通道
    b, g, r = cv2.split(img_bgr)
    
    # 合并为 4 通道 (Blue, Green, Red, Alpha)
    return cv2.merge([b, g, r, alpha_uint8])
