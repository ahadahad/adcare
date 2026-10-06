export function exportToImage(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' = 'png',
  filename = 'DocScan_Document.png'
): void {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpeg' ? 0.95 : undefined;

  const dataUrl = canvas.toDataURL(mimeType, quality);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
