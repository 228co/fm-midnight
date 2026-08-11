# 生成 33.3 触发时两侧对联广告的恐怖竖幅 GIF
# 风格对齐 FM-MIDNIGHT 标题：黑底 / 骨白等宽 / 血红「深夜」/ CRT 扫描线 / 电流闪烁
from pathlib import Path
import sys, glob

sys.path.insert(0, str(Path(sys.executable).parent.parent.parent))
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(r"D:\CD\5")
OUT = ROOT / "images" / "doom-ad.gif"

# ---------- 找 CJK 字体 ----------
def find_cjk_font():
    runtime = Path(sys.executable).parent.parent.parent
    pats = ["*CJK*", "*Noto*Sans*", "*SourceHan*", "*wqy*", "*SimSun*"]
    cands = []
    for ext in ("ttf", "otf", "ttc"):
        cands += glob.glob(str(runtime / "**" / f"*.{ext}"), recursive=True)
    for p in pats:
        for c in cands:
            if p.lower().replace("*", "") in Path(c).name.lower():
                return c
    return cands[0] if cands else None

font_path = find_cjk_font()
print("font:", font_path)

W, H = 212, 600
BG = (6, 6, 6)
BONE = (216, 210, 194)
RED = (156, 31, 31)
CHARS = list("欢迎来到深夜电台")
RED_IDX = {4, 5}  # 深 夜

FS = 30
font = ImageFont.truetype(font_path, FS)
STEP = int(FS * 1.55)
total_h = STEP * len(CHARS)
y0 = (H - total_h) // 2 + 6


def text_layer(opacity=1.0, jitter=0):
    """绘制文字层：先画辉光（模糊），再画锐字"""
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sharp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dg, ds = ImageDraw.Draw(glow), ImageDraw.Draw(sharp)
    for i, ch in enumerate(CHARS):
        x = W // 2 + (jitter if i in RED_IDX else 0)
        y = y0 + i * STEP
        if i in RED_IDX:
            dg.text((x, y), ch, font=font, anchor="mm",
                    fill=(RED[0], RED[1], RED[2], 220))
            ds.text((x, y), ch, font=font, anchor="mm",
                    fill=(RED[0] + 40, RED[1] + 20, RED[2] + 20, 255))
        else:
            dg.text((x, y), ch, font=font, anchor="mm",
                    fill=(BONE[0], BONE[1], BONE[2], 90))
            ds.text((x, y), ch, font=font, anchor="mm",
                    fill=(BONE[0], BONE[1], BONE[2], 255))
    glow = glow.filter(ImageFilter.GaussianBlur(7))
    layer = Image.alpha_composite(glow, sharp)
    if opacity < 1.0:
        alpha = layer.getchannel("A").point(lambda a: int(a * opacity))
        layer.putalpha(alpha)
    return layer


def scanlines(img, phase=0):
    d = ImageDraw.Draw(img)
    for y in range(phase, H, 3):
        d.line([(0, y), (W, y)], fill=(0, 0, 0, 110))
    return img


# 帧序列：(不透明度, 红字抖动px, 扫描线相位) —— 模拟灯管不稳 + 电子干扰
FRAMES = [
    (1.00, 0, 0), (1.00, 0, 1), (0.30, 0, 2), (0.85, 0, 0),
    (1.00, 0, 1), (0.90, 2, 2), (1.00, 0, 0), (0.45, 0, 1),
    (1.00, 0, 2), (1.00, 0, 0), (0.95, -2, 1), (1.00, 0, 2),
]

frames = []
for op, jit, ph in FRAMES:
    im = Image.new("RGBA", (W, H), BG + (255,))
    im = Image.alpha_composite(im, text_layer(op, jit))
    im = scanlines(im, ph)
    frames.append(im.convert("P", palette=Image.ADAPTIVE, colors=64))

frames[0].save(
    OUT, save_all=True, append_images=frames[1:],
    duration=[110] * len(frames), loop=0, disposal=2, optimize=True,
)
print("saved:", OUT, f"{OUT.stat().st_size/1024:.1f} KB, {len(frames)} frames")
