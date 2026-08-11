# 生成 33.3 触发时首页中间横幅广告的恐怖 GIF（横版）
# 与 doom-ad.gif 同一套风格：黑底 / 骨白字 / 血红「深夜」/ 扫描线 / 电流闪烁
from pathlib import Path
import sys, glob

sys.path.insert(0, str(Path(sys.executable).parent.parent.parent))
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(r"D:\CD\5")
OUT = ROOT / "images" / "doom-banner.gif"


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

W, H = 880, 110
BG = (6, 6, 6)
BONE = (216, 210, 194)
RED = (156, 31, 31)
TEXT = "欢迎来到深夜电台"
RED_SPAN = (4, 6)   # 「深夜」

FS = 44
font = ImageFont.truetype(font_path, FS)
font_sm = ImageFont.truetype(font_path, 18)


def text_layer(opacity=1.0, jitter=0):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sharp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dg, ds = ImageDraw.Draw(glow), ImageDraw.Draw(sharp)

    # 主标题逐字排开
    spacing = int(FS * 1.5)
    total_w = spacing * (len(TEXT) - 1) + FS
    x0 = (W - total_w) // 2 + FS // 2
    y = H // 2 - 4
    for i, ch in enumerate(TEXT):
        red = RED_SPAN[0] <= i < RED_SPAN[1]
        x = x0 + i * spacing + (jitter if red else 0)
        if red:
            dg.text((x, y), ch, font=font, anchor="mm", fill=(RED[0], RED[1], RED[2], 220))
            ds.text((x, y), ch, font=font, anchor="mm", fill=(RED[0] + 40, RED[1] + 20, RED[2] + 20, 255))
        else:
            dg.text((x, y), ch, font=font, anchor="mm", fill=(BONE[0], BONE[1], BONE[2], 90))
            ds.text((x, y), ch, font=font, anchor="mm", fill=(BONE[0], BONE[1], BONE[2], 255))

    # 左右角落小字：频率标记
    dg.text((28, H - 18), "FM 33.3", font=font_sm, anchor="ls", fill=(RED[0], RED[1], RED[2], 160))
    ds.text((28, H - 18), "FM 33.3", font=font_sm, anchor="ls", fill=(RED[0] + 30, RED[1] + 15, RED[2] + 15, 220))
    dg.text((W - 28, H - 18), "03:00", font=font_sm, anchor="rs", fill=(BONE[0], BONE[1], BONE[2], 70))
    ds.text((W - 28, H - 18), "03:00", font=font_sm, anchor="rs", fill=(BONE[0], BONE[1], BONE[2], 160))

    glow = glow.filter(ImageFilter.GaussianBlur(6))
    layer = Image.alpha_composite(glow, sharp)
    if opacity < 1.0:
        alpha = layer.getchannel("A").point(lambda a: int(a * opacity))
        layer.putalpha(alpha)
    return layer


def scanlines(img, phase=0):
    d = ImageDraw.Draw(img)
    for yy in range(phase, H, 3):
        d.line([(0, yy), (W, yy)], fill=(0, 0, 0, 110))
    return img


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
