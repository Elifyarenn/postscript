/**
 * What to tell someone whose file is over the limit, or null when it fits
 * (D-301). Shared by the browser check, so the sentence is tested once.
 */
export function oversizeMessage(bytes: number, maxMb: number): string | null {
  if (bytes <= maxMb * 1024 * 1024) return null;
  // Rounded up, so a file just over the limit never reads as "4,0 MB"
  const size = (Math.ceil((bytes / (1024 * 1024)) * 10) / 10).toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `Bu dosya ${size} MB; en fazla ${maxMb} MB yüklenebilir. PDF'i küçültüp tekrar deneyin: taramayı daha düşük çözünürlükte (150 dpi) ve siyah-beyaz kaydetmek ya da bir PDF sıkıştırma aracı kullanmak genellikle yeter.`;
}
