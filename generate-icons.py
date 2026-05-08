"""Generate beautiful app & tray icons with gradient and bold checkmark."""
from PIL import Image, ImageDraw, ImageFilter

# Modern blue-violet gradient colors
C_TOP = (99, 102, 241, 255)       # indigo-500
C_BOTTOM = (59, 130, 246, 255)    # blue-500
C_BORDER = (165, 180, 252, 255)   # indigo-300
C_WHITE = (255, 255, 255, 255)
C_SHADOW = (49, 46, 129, 180)     # dark indigo semi-transparent


def draw_rounded_rect(draw, xy, r, fill):
    """Draw filled rounded rectangle."""
    x1, y1, x2, y2 = xy
    r = min(r, (x2 - x1) // 2, (y2 - y1) // 2)
    draw.rectangle([x1 + r, y1, x2 - r, y2], fill=fill)
    draw.rectangle([x1, y1 + r, x2, y2 - r], fill=fill)
    draw.pieslice([x1, y1, x1 + 2 * r, y1 + 2 * r], 180, 270, fill=fill)
    draw.pieslice([x2 - 2 * r, y1, x2, y1 + 2 * r], 270, 360, fill=fill)
    draw.pieslice([x1, y2 - 2 * r, x1 + 2 * r, y2], 90, 180, fill=fill)
    draw.pieslice([x2 - 2 * r, y2 - 2 * r, x2, y2], 0, 90, fill=fill)


def draw_rounded_rect_outline(draw, xy, r, outline, width):
    """Draw rounded rect outline (border)."""
    x1, y1, x2, y2 = xy
    r = min(r, (x2 - x1) // 2, (y2 - y1) // 2)
    w = width
    # outer
    draw.arc([x1, y1, x1 + 2 * r, y1 + 2 * r], 180, 270, fill=outline, width=w)
    draw.arc([x2 - 2 * r, y1, x2, y1 + 2 * r], 270, 360, fill=outline, width=w)
    draw.arc([x1, y2 - 2 * r, x1 + 2 * r, y2], 90, 180, fill=outline, width=w)
    draw.arc([x2 - 2 * r, y2 - 2 * r, x2, y2], 0, 90, fill=outline, width=w)
    draw.line([(x1 + r, y1), (x2 - r, y1)], fill=outline, width=w)
    draw.line([(x1 + r, y2), (x2 - r, y2)], fill=outline, width=w)
    draw.line([(x1, y1 + r), (x1, y2 - r)], fill=outline, width=w)
    draw.line([(x2, y1 + r), (x2, y2 - r)], fill=outline, width=w)


def gradient_bg(size):
    """Create a gradient background from indigo to blue."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(C_TOP[0] + (C_BOTTOM[0] - C_TOP[0]) * t)
        g = int(C_TOP[1] + (C_BOTTOM[1] - C_TOP[1]) * t)
        b = int(C_TOP[2] + (C_BOTTOM[2] - C_TOP[2]) * t)
        for x in range(size):
            img.putpixel((x, y), (r, g, b, 255))
    return img


def add_gloss_highlight(draw, xy, r):
    """Add a subtle white gloss highlight at top-left for 3D effect."""
    x1, y1, x2, y2 = xy
    if x2 - x1 < 24:
        return
    # Gloss ellipse in top portion
    glow_w = int((x2 - x1) * 0.55)
    glow_h = int((y2 - y1) * 0.22)
    cx = (x1 + x2) // 2
    cy = y1 + int((y2 - y1) * 0.16)
    gloss_color = (255, 255, 255, 60)
    draw.ellipse(
        [cx - glow_w // 2, cy - glow_h // 2, cx + glow_w // 2, cy + glow_h // 2],
        fill=gloss_color
    )


def make_icon(size):
    """Create modern icon with gradient, border, gloss, and bold checkmark."""
    margin = max(1, size // 20)
    r = max(3, size // 6)
    xy = (margin, margin, size - margin - 1, size - margin - 1)

    # Start with gradient background
    img = gradient_bg(size)
    draw = ImageDraw.Draw(img)

    # Clip to rounded rect (use the gradient bg beneath)
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    draw_rounded_rect(mask_draw, xy, r, fill=255)

    # Apply mask to gradient (only keep rounded area)
    img_rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img_rounded.paste(img, (0, 0), mask)

    draw = ImageDraw.Draw(img_rounded)

    # Draw subtle inner shadow (dark line at top)
    if size >= 32:
        shadow_alpha = 80 if size >= 64 else 40
        shadow_color = (49, 46, 129, shadow_alpha)
        inner_xy = (margin + 1, margin + 1, size - margin - 2, size - margin - 2)
        draw_rounded_rect_outline(draw, inner_xy, r - 1, shadow_color, width=max(1, size // 48))

    # Draw border
    border_width = max(1, size // 24)
    border_alpha = 200 if size >= 64 else 160
    border_color = (C_BORDER[0], C_BORDER[1], C_BORDER[2], border_alpha)
    draw_rounded_rect_outline(draw, xy, r, border_color, width=border_width)

    # Add gloss highlight for larger icons
    if size >= 64:
        add_gloss_highlight(draw, xy, r)

    # Draw bold checkmark
    stroke = max(3, size // 8)
    x1, y1, x2, y2 = xy
    w, h = x2 - x1, y2 - y1

    # Checkmark points (relative to icon bounds, centered)
    start_x = x1 + w * 0.22
    start_y = y1 + h * 0.48
    mid_x = x1 + w * 0.38
    mid_y = y1 + h * 0.65
    corner_x = x1 + w * 0.42
    corner_y = y1 + h * 0.34
    tip_x = x1 + w * 0.74
    tip_y = y1 + h * 0.78

    # Short arm (upward stroke)
    draw.line(
        [(start_x, start_y), (mid_x, mid_y), (corner_x, corner_y)],
        fill=C_WHITE, width=stroke, joint='curve'
    )
    # Long arm (downward stroke)
    draw.line(
        [(corner_x, corner_y), (tip_x, tip_y)],
        fill=C_WHITE, width=stroke, joint='curve'
    )

    # Add white glow under checkmark for pop
    if size >= 64:
        glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_stroke = stroke + max(2, size // 16)
        glow_color = (255, 255, 255, 40)
        glow_draw.line(
            [(start_x, start_y), (mid_x, mid_y), (corner_x, corner_y)],
            fill=glow_color, width=glow_stroke, joint='curve'
        )
        glow_draw.line(
            [(corner_x, corner_y), (tip_x, tip_y)],
            fill=glow_color, width=glow_stroke, joint='curve'
        )
        glow = glow.filter(ImageFilter.GaussianBlur(radius=size / 32))
        img_rounded.paste(glow, (0, 0), glow)

    return img_rounded


def make_tray_icon():
    """Create a simpler tray icon optimized for 16x16 taskbar display."""
    size = 32
    img = gradient_bg(size)

    margin = 2
    r = 6
    xy = (margin, margin, size - margin - 1, size - margin - 1)

    # Rounded mask
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    draw_rounded_rect(mask_draw, xy, r, fill=255)

    img_rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img_rounded.paste(img, (0, 0), mask)
    draw = ImageDraw.Draw(img_rounded)

    # Border
    draw_rounded_rect_outline(draw, xy, r, C_BORDER, width=1)

    # Bold centered checkmark
    stroke = 6
    cx, cy = size / 2, size / 2
    w_off = size * 0.28
    h_off = size * 0.26

    s_x = cx - w_off * 1.1
    s_y = cy + h_off * 0.15
    m_x = cx - w_off * 0.2
    m_y = cy + h_off * 0.55
    c_x = cx + w_off * 0.05
    c_y = cy - h_off * 0.5
    t_x = cx + w_off * 1.0
    t_y = cy + h_off * 0.85

    draw.line([(s_x, s_y), (m_x, m_y), (c_x, c_y)],
              fill=C_WHITE, width=stroke, joint='curve')
    draw.line([(c_x, c_y), (t_x, t_y)],
              fill=C_WHITE, width=stroke, joint='curve')

    return img_rounded


# ── Generate all sizes ─────────────────────────────────────────

OUT = 'C:/Users/86152/Desktop/Agent/Software/todo-app/src-tauri/icons'

sizes = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    'icon.png': 512,
}

for filename, size in sizes.items():
    img = make_icon(size)
    path = f'{OUT}/{filename}'
    img.save(path, 'PNG')
    print(f'Generated {filename} ({size}x{size})')

# Tray icon (32x32 with extra-bold design)
tray_img = make_tray_icon()
tray_path = f'{OUT}/32x32.png'
tray_img.save(tray_path, 'PNG')
print('Generated tray-optimized 32x32.png')

# ICO with multiple sizes for Windows
img16 = make_icon(16)
img24 = make_icon(24)
img32 = make_icon(32)
img48 = make_icon(48)
img256 = make_icon(256)

ico_path = f'{OUT}/icon.ico'
img256.save(ico_path, 'ICO', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (256, 256)])
print('Generated icon.ico (16/24/32/48/256)')

print('\nDone - all icons regenerated!')
