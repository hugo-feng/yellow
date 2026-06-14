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
  const rxAttr = round ? '' : `rx="${size * 0.2}"`;
  const clip = round ? `<clipPath id="c"><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></clipPath><g clip-path="url(#c)">` : '';
  const clipEnd = round ? '</g>' : '';

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    ${clip}
    <rect width="${size}" height="${size}" ${rxAttr} fill="#000000"/>
    <text x="${size/2}" y="${size * 0.55}" text-anchor="middle" dominant-baseline="central" font-family="Impact,Arial Black,Haettenschweiler,'Arial Narrow Bold',sans-serif" font-weight="900" font-size="${size * 0.28}" fill="#FFFFFF" letter-spacing="${size * 0.02}">Yellow</text>
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
