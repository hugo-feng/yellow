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
  const bw = size * 0.26;
  const bh = size * 0.34;
  const bx = (size - bw) / 2;
  const by = (size - bh) / 2;
  const spine = size * 0.03;
  const radius = size * 0.015;

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${bx}, ${by})">
    <rect x="0" y="0" width="${bw}" height="${bh}" rx="${radius}" fill="#f0c040"/>
    <rect x="${spine}" y="0" width="${bw - spine}" height="${bh}" rx="${radius}" fill="#f5d060"/>
    <rect x="${spine * 2}" y="${bh * 0.2}" width="${bw - spine * 3}" height="${bh * 0.015}" rx="${size * 0.005}" fill="rgba(0,0,0,0.15)"/>
    <rect x="${spine * 2}" y="${bh * 0.28}" width="${bw * 0.6}" height="${bh * 0.015}" rx="${size * 0.005}" fill="rgba(0,0,0,0.15)"/>
    <rect x="${spine * 2}" y="${bh * 0.36}" width="${bw * 0.45}" height="${bh * 0.015}" rx="${size * 0.005}" fill="rgba(0,0,0,0.15)"/>
  </g>
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
