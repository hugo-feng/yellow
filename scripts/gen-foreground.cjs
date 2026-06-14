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
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5d060"/>
      <stop offset="100%" stop-color="#c89030"/>
    </linearGradient>
  </defs>
  <text x="${size/2}" y="${size * 0.38}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${size * 0.14}" fill="url(#g)" letter-spacing="${-size * 0.003}">Yellow</text>
  <rect x="${size * 0.35}" y="${size * 0.44}" width="${size * 0.3}" height="${size * 0.02}" rx="${size * 0.01}" fill="#f0c040" opacity="0.5"/>
  <text x="${size/2}" y="${size * 0.58}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="400" font-size="${size * 0.08}" fill="#c89030" opacity="0.6">READER</text>
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
