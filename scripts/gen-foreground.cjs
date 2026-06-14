const sharp = require('sharp');
const path = require('path');

const sizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432
};

function makeForegroundSvg(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <text x="${size/2}" y="${size * 0.5}" text-anchor="middle" dominant-baseline="central" font-family="Impact,Arial Black,Haettenschweiler,'Arial Narrow Bold',sans-serif" font-weight="900" font-size="${size * 0.2}" fill="#FFFFFF" letter-spacing="${size * 0.015}">Yellow</text>
</svg>`;
}

async function generate() {
  for (const [dir, size] of Object.entries(sizes)) {
    const base = path.join('android/app/src/main/res', dir);
    const svg = makeForegroundSvg(size);
    await sharp(Buffer.from(svg)).png().toFile(path.join(base, 'ic_launcher_foreground.png'));
    console.log(`Generated ${dir}/ic_launcher_foreground.png (${size}x${size})`);
  }
  console.log('All foreground icons generated!');
}

generate().catch(e => { console.error(e); process.exit(1); });
