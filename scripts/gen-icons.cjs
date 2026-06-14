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
  
  // Book dimensions (50% of icon)
  const bw = size * 0.36;
  const bh = size * 0.46;
  const bx = (size - bw) / 2;
  const by = (size - bh) / 2;
  const spine = size * 0.04;
  const radius = size * 0.02;

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    ${clip}
    <rect width="${size}" height="${size}" ${rxAttr} fill="#000000"/>
    <g transform="translate(${bx}, ${by})">
      <rect x="0" y="0" width="${bw}" height="${bh}" rx="${radius}" fill="#f0c040"/>
      <rect x="${spine}" y="0" width="${bw - spine}" height="${bh}" rx="${radius}" fill="#f5d060"/>
      <rect x="${spine * 2}" y="${bh * 0.2}" width="${bw - spine * 3}" height="${bh * 0.015}" rx="${size * 0.005}" fill="rgba(0,0,0,0.15)"/>
      <rect x="${spine * 2}" y="${bh * 0.28}" width="${bw * 0.6}" height="${bh * 0.015}" rx="${size * 0.005}" fill="rgba(0,0,0,0.15)"/>
      <rect x="${spine * 2}" y="${bh * 0.36}" width="${bw * 0.45}" height="${bh * 0.015}" rx="${size * 0.005}" fill="rgba(0,0,0,0.15)"/>
    </g>
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
