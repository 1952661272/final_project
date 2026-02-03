import io
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

out_dir = Path('/Users/mac/Downloads/毕设产品说明书/campus-trade-app/public/assets/real')
out_dir.mkdir(parents=True, exist_ok=True)

items = {
    'item_01': 'https://images.pexels.com/photos/9128854/pexels-photo-9128854.jpeg?cs=srgb&dl=pexels-bertellifotografia-9128854.jpg&fm=jpg',
    'item_02': 'https://images.pexels.com/photos/15372894/pexels-photo-15372894.jpeg?cs=srgb&dl=pexels-nguyendesigner-15372894.jpg&fm=jpg',
    'item_03': 'https://images.pexels.com/photos/19736973/pexels-photo-19736973.jpeg?cs=srgb&dl=pexels-merve-205352359-19736973.jpg&fm=jpg',
    'item_04': 'https://images.pexels.com/photos/28028229/pexels-photo-28028229.jpeg?cs=srgb&dl=pexels-ekrulila-28028229.jpg&fm=jpg',
    'item_05': 'https://images.pexels.com/photos/762687/pexels-photo-762687.jpeg?cs=srgb&dl=pexels-jessbaileydesign-762687.jpg&fm=jpg',
    'item_06': 'https://images.pexels.com/photos/6929215/pexels-photo-6929215.jpeg?cs=srgb&dl=pexels-polina-tankilevitch-6929215.jpg&fm=jpg',
    'item_07': 'https://images.pexels.com/photos/6929210/pexels-photo-6929210.jpeg?cs=srgb&dl=pexels-polina-tankilevitch-6929210.jpg&fm=jpg',
    'item_08': 'https://images.pexels.com/photos/19053211/pexels-photo-19053211.jpeg?cs=srgb&dl=pexels-mintworkspace-19053211.jpg&fm=jpg',
    'item_09': 'https://images.pexels.com/photos/28993061/pexels-photo-28993061.jpeg?cs=srgb&dl=pexels-bertellifotografia-28993061.jpg&fm=jpg',
    'item_10': 'https://images.pexels.com/photos/15608762/pexels-photo-15608762.jpeg?cs=srgb&dl=pexels-svitch-bike-423973945-15608762.jpg&fm=jpg',
    'item_11': 'https://cdn.pixabay.com/photo/2016/11/28/11/00/bicycle-1864733_1280.jpg',
    'item_12': 'https://images.pexels.com/photos/3675622/pexels-photo-3675622.jpeg?cs=srgb&dl=pexels-enriquezafra-3675622.jpg&fm=jpg',
    'item_13': 'https://images.pexels.com/photos/5850342/pexels-photo-5850342.jpeg?cs=srgb&dl=pexels-fox-58267-5850342.jpg&fm=jpg',
    'item_14': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Clip_fan.jpg',
    'item_15': 'https://images.pexels.com/photos/21391577/pexels-photo-21391577.jpeg?cs=srgb&dl=pexels-diimejii-21391577.jpg&fm=jpg',
    'item_16': 'https://images.pexels.com/photos/19561464/pexels-photo-19561464.jpeg?cs=srgb&dl=pexels-jessikaarraes-19561464.jpg&fm=jpg'
}

headers = {"User-Agent": "Mozilla/5.0"}

for key, url in items.items():
    req = Request(url, headers=headers)
    with urlopen(req, timeout=30) as resp:
        data = resp.read()
    img = Image.open(io.BytesIO(data)).convert('RGB')
    out_path = out_dir / f"{key}.jpg"
    img.save(out_path, quality=88)

    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    crop = img.crop((left, top, left + side, top + side)).resize((800, 800))
    crop.save(out_dir / f"{key}_2.jpg", quality=85)

print('downloaded', len(items))
