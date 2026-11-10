const NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONORS = ['東', '南', '西', '北', '白', '發', '中', '梅', '蘭', '菊', '竹', '春', '夏', '秋', '冬'];
const SUITS = ['萬', '筒', '索'];
const PIN_PATTERNS = [
  [[50, 64, 50]],
  [[50, 32, 30], [50, 96, 30]],
  [[24, 24, 21], [50, 64, 21], [76, 104, 21]],
  [[24, 25, 21], [76, 25, 21], [24, 103, 21], [76, 103, 21]],
  [[24, 25, 20], [76, 25, 20], [50, 64, 20], [24, 103, 20], [76, 103, 20]],
  [[24, 22, 19], [76, 22, 19], [24, 64, 19], [76, 64, 19], [24, 106, 19], [76, 106, 19]],
  [[17, 18, 12.5], [50, 31, 12.5], [83, 44, 12.5], [24, 80, 12.5], [76, 80, 12.5], [24, 112, 12.5], [76, 112, 12.5]],
  [[24, 16, 13], [76, 16, 13], [24, 48, 13], [76, 48, 13], [24, 80, 13], [76, 80, 13], [24, 112, 13], [76, 112, 13]],
  [[16, 20, 13], [50, 20, 13], [84, 20, 13], [16, 64, 13], [50, 64, 13], [84, 64, 13], [16, 108, 13], [50, 108, 13], [84, 108, 13]],
];
const BAMBOO_PATTERNS = [
  [[50, 64, 40, 116]],
  [[29, 64, 22, 116], [71, 64, 22, 116]],
  [[18, 64, 17, 116], [50, 64, 17, 116], [82, 64, 17, 116]],
  [[25, 33, 24, 52], [75, 33, 24, 52], [25, 95, 24, 52], [75, 95, 24, 52]],
  [[25, 33, 24, 50], [75, 33, 24, 50], [50, 64, 16, 38], [25, 95, 24, 50], [75, 95, 24, 50]],
  [[18, 33, 17, 52], [50, 33, 17, 52], [82, 33, 17, 52], [18, 95, 17, 52], [50, 95, 17, 52], [82, 95, 17, 52]],
  [[18, 27, 17, 40], [50, 27, 17, 40], [82, 27, 17, 40], [25, 73, 20, 30], [75, 73, 20, 30], [25, 109, 20, 30], [75, 109, 20, 30]],
  [[25, 16, 17, 26], [75, 16, 17, 26], [25, 48, 17, 26], [75, 48, 17, 26], [25, 80, 17, 26], [75, 80, 17, 26], [25, 112, 17, 26], [75, 112, 17, 26]],
  [[18, 22, 17, 34], [50, 22, 17, 34], [82, 22, 17, 34], [18, 64, 17, 34], [50, 64, 17, 34], [82, 64, 17, 34], [18, 106, 17, 34], [50, 106, 17, 34], [82, 106, 17, 34]],
];
export function faceLabel(face) {
  return face < 27 ? `${NUMBERS[face % 9]}${SUITS[Math.floor(face / 9)]}` : HONORS[face - 27];
}
export function tileArtwork(face) {
  const label = faceLabel(face);
  let drawing;
  let suit;
  if (face < 9) {
    suit = 'man';
    drawing = `<text x="50" y="43" class="numeral">${NUMBERS[face]}</text><text x="50" y="91" class="myriad">萬</text>`;
  } else if (face < 18) {
    suit = 'pin';
    drawing = PIN_PATTERNS[face % 9].map(([x, y, radius]) => `<circle cx="${x}" cy="${y}" r="${radius}"/><circle cx="${x}" cy="${y}" r="${radius * 0.34}" class="pip-center"/>`).join('');
  } else if (face < 27) {
    suit = 'sou';
    drawing = BAMBOO_PATTERNS[face % 9].map(([x, y, width, height]) => {
      const left = x - width / 2;
      return `<rect class="bamboo" x="${left}" y="${y - height / 2}" width="${width}" height="${height}" rx="${width * 0.28}"/><path class="bamboo-node" d="M${left + width * 0.15} ${y - height * 0.2}h${width * 0.7}M${left + width * 0.15} ${y + height * 0.2}h${width * 0.7}"/>`;
    }).join('');
  } else if (face === 31) {
    suit = 'pin';
    drawing = '<rect x="21" y="19" width="58" height="74" rx="4" class="white-dragon"/>';
  } else {
    suit = face === 32 ? 'sou' : face === 33 ? 'man' : face >= 38 ? 'pin' : face >= 34 ? 'sou' : 'honor';
    drawing = `<text x="50" y="80" class="honor">${label}</text>`;
    if (face >= 34) drawing += '<path d="M12 8h24v5H12z" class="bonus-band"/>';
  }
  return `<svg class="art ${suit}" viewBox="0 0 100 ${face >= 9 && face < 27 ? 128 : 112}" aria-hidden="true">${drawing}</svg>`;
}
export function starArtwork(count, total = 3) {
  return Array.from({ length: total }, (_, index) => `<svg class="star ${index < count ? 'earned' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.5 7 1-5 5 1.2 7-6.2-3.3L5.8 21.5 7 14.5 2 9.5l7-1z"/></svg>`).join('');
}
export const lockArtwork = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
