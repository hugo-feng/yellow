const sharp = require('sharp');
const path = require('path');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

function makeSvg(size, round) {
  const r = round ? size / 2 : size * 0.18;
  const clip = round ? `<clipPath id="c"><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></clipPath><g clip-path="url(#c)">` : '';
  const clipEnd = round ? '</g>' : '';
  const rx = round ? '' : `rx="${size * 0.18}"`;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#f5d060"/>
        <stop offset="100%" stop-color="#c49a20"/>
      </linearGradient>
    </defs>
    ${clip}
    <rect width="${size}" height="${size}" ${rx} fill="white"/>
    <text x="${size/2}" y="${size * 0.55}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${size * 0.36}" fill="url(#g)" letter-spacing="${-size * 0.01}">Yellow</text>
    <rect x="${size * 0.18}" y="${size * 0.68}" width="${size * 0.64}" height="${size * 0.028}" rx="${size * 0.014}" fill="#f0c040" opacity="0.5"/>
    ${clipEnd}
  </svg>`;
}

async function generate() {
  for (const [dir, size] of Object.entries(sizes)) {
    const base = path.join('android/app/src/main/res', dir);
    
    const svg1 = makeSvg(size, false);
    await sharp(Buffer.from(svg1)).png().toFile(path.join(base, 'ic_launcher.png'));
    console.log(`Generated ${dir}/ic_launcher.png (${size}x${size})`);

    const svg2 = makeSvg(size, true);
    await sharp(Buffer.from(svg2)).png().toFile(path.join(base, 'ic_launcher_round.png'));
    console.log(`Generated ${dir}/ic_launcher_round.png (${size}x${size})`);
  }
  console.log('All icons generated!');
}

generate().catch(e => { console.error(e); process.exit(1); });
