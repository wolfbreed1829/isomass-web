"""Regenerate the Facebook preview image (requires Pillow)."""
from pathlib import Path
from math import pi, cos, sin
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1]
scale = 2
image = Image.new("RGB", (1200*scale, 630*scale), "#10171c")
draw = ImageDraw.Draw(image)
font_path = next((p for p in [Path("C:/Windows/Fonts/segoeui.ttf"),Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")] if p.exists()), None)
def text(value, x, y, size, fill="#eeeade"):
    font = ImageFont.truetype(str(font_path), size*scale)
    draw.text((x*scale,y*scale),value,font=font,fill=fill)
text("I S O M A S S", 65, 42, 26, "#e2b873")
text("THE CHALLENGE", 65, 90, 16, "#78c4bc")
text("Three discoveries.",65,157,61)
text("One conserved whole.",65,237,55)
text("300 possible points. No time limit.",65,340,27,"#a1b1b4")
draw.rounded_rectangle((65*scale,427*scale,440*scale,485*scale),radius=6*scale,fill="#e2b873")
text("Change the form. Keep 64.",85,438,23,"#10171c")
text("wolfbreed1829.github.io/isomass-web",65,555,23,"#78c4bc")
cx,cy,r=974,281,145
for i in range(4):
    start=-90+i*90+3
    draw.arc(((cx-r)*scale,(cy-r)*scale,(cx+r)*scale,(cy+r)*scale),start=start,end=start+84,fill="#e2b873" if i==0 else "#78c4bc",width=17*scale)
# An abstract triangular radial motif echoes the instrument.
points=[]
for i in range(257):
    theta=i/256*2*pi
    pulse=1-abs((i/32)%2-1)
    radius=65+29*pulse
    points.append(((cx+radius*cos(theta))*scale,(cy+radius*sin(theta))*scale))
draw.line(points,fill="#78c4bc",width=2*scale)
text("64",cx-39,cy-41,52,"#e2b873")
text("ALWAYS",cx-38,cy+28,15,"#a1b1b4")
text("PLAY IN YOUR BROWSER",845,465,18,"#a1b1b4")
image.resize((1200,630),Image.Resampling.LANCZOS).save(root/"docs/challenge-preview.png",optimize=True)
print("Generated docs/challenge-preview.png (1200 × 630)")
