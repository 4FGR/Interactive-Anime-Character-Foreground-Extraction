import cv2
import numpy as np

def create_checkerboard_pattern(h, w, grid_size=20):
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

def convert_to_rgba(img_bgr):
    """转为不透明 RGBA"""
    b, g, r = cv2.split(img_bgr)
    alpha = np.ones(b.shape, dtype=np.uint8) * 255
    return cv2.merge([b, g, r, alpha])

def composite_image(foreground_bgr, alpha_channel):
    """
    合成最终图像
    foreground_bgr: 修复过的前景图
    alpha_channel: 0.0-1.0 的浮点数遮罩
    """
    h, w = foreground_bgr.shape[:2]
    checkerboard_bg = create_checkerboard_pattern(h, w)
    
    # 转换为 float 进行计算
    fg = foreground_bgr.astype(float)
    bg = checkerboard_bg.astype(float)
    
    # 扩展 alpha 为 3 通道
    if alpha_channel.ndim == 2:
        alpha_3ch = cv2.merge([alpha_channel, alpha_channel, alpha_channel])
    else:
        alpha_3ch = alpha_channel

    # 公式: Result = FG * Alpha + BG * (1 - Alpha)
    final_img = cv2.add(fg * alpha_3ch, bg * (1.0 - alpha_3ch))
    
    return final_img.astype(np.uint8)