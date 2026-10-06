export interface SampleImageMeta {
  name: string;
  category: string;
  width: number;
  height: number;
  dataUrl: string;
}

export function generateSampleImages(): SampleImageMeta[] {
  // 1. Portrait / Studio Sample
  const c1 = document.createElement('canvas');
  c1.width = 800;
  c1.height = 1000;
  const ctx1 = c1.getContext('2d');
  if (ctx1) {
    // Elegant studio background gradient
    const bgGrad = ctx1.createRadialGradient(400, 450, 50, 400, 500, 600);
    bgGrad.addColorStop(0, '#475569');
    bgGrad.addColorStop(0.6, '#1E293B');
    bgGrad.addColorStop(1, '#0F172A');
    ctx1.fillStyle = bgGrad;
    ctx1.fillRect(0, 0, 800, 1000);

    // Studio soft lighting effect
    ctx1.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx1.beginPath();
    ctx1.arc(400, 380, 260, 0, Math.PI * 2);
    ctx1.fill();

    // Stylized silhouette portrait for photo testing
    // Shoulders
    ctx1.fillStyle = '#334155';
    ctx1.beginPath();
    ctx1.ellipse(400, 850, 240, 180, 0, 0, Math.PI * 2);
    ctx1.fill();

    // Neck
    ctx1.fillStyle = '#E2B18E';
    ctx1.fillRect(360, 560, 80, 140);

    // Face / Head
    ctx1.fillStyle = '#F3D2B8';
    ctx1.beginPath();
    ctx1.ellipse(400, 460, 120, 150, 0, 0, Math.PI * 2);
    ctx1.fill();

    // Hair
    ctx1.fillStyle = '#271E17';
    ctx1.beginPath();
    ctx1.arc(400, 390, 135, Math.PI * 0.8, Math.PI * 2.2);
    ctx1.fill();

    // Eyes
    ctx1.fillStyle = '#3E2723';
    ctx1.beginPath();
    ctx1.ellipse(355, 450, 14, 8, 0, 0, Math.PI * 2);
    ctx1.ellipse(445, 450, 14, 8, 0, 0, Math.PI * 2);
    ctx1.fill();

    // Eyebrows
    ctx1.strokeStyle = '#271E17';
    ctx1.lineWidth = 4;
    ctx1.beginPath();
    ctx1.arc(355, 435, 20, Math.PI * 1.1, Math.PI * 1.9);
    ctx1.stroke();
    ctx1.beginPath();
    ctx1.arc(445, 435, 20, Math.PI * 1.1, Math.PI * 1.9);
    ctx1.stroke();

    // Gentle smile
    ctx1.strokeStyle = '#A35338';
    ctx1.lineWidth = 4;
    ctx1.beginPath();
    ctx1.arc(400, 530, 28, 0.2, Math.PI - 0.2);
    ctx1.stroke();

    // Label watermark
    ctx1.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx1.font = 'bold 24px sans-serif';
    ctx1.textAlign = 'center';
    ctx1.fillText('ShebaFlow Studio - Portrait Test', 400, 950);
  }

  // 2. Passport Spec Sample (Light Blue Background, 600x600 square)
  const c2 = document.createElement('canvas');
  c2.width = 600;
  c2.height = 600;
  const ctx2 = c2.getContext('2d');
  if (ctx2) {
    // Official light blue background
    ctx2.fillStyle = '#E0F2FE';
    ctx2.fillRect(0, 0, 600, 600);

    // Business attire
    ctx2.fillStyle = '#0F172A';
    ctx2.beginPath();
    ctx2.ellipse(300, 550, 190, 130, 0, 0, Math.PI * 2);
    ctx2.fill();

    // Shirt collar
    ctx2.fillStyle = '#FFFFFF';
    ctx2.beginPath();
    ctx2.moveTo(270, 460);
    ctx2.lineTo(300, 520);
    ctx2.lineTo(330, 460);
    ctx2.closePath();
    ctx2.fill();

    // Tie
    ctx2.fillStyle = '#0284C7';
    ctx2.beginPath();
    ctx2.moveTo(290, 515);
    ctx2.lineTo(310, 515);
    ctx2.lineTo(315, 600);
    ctx2.lineTo(285, 600);
    ctx2.closePath();
    ctx2.fill();

    // Neck
    ctx2.fillStyle = '#E8BD9B';
    ctx2.fillRect(275, 380, 50, 90);

    // Face
    ctx2.fillStyle = '#F5D0B5';
    ctx2.beginPath();
    ctx2.ellipse(300, 310, 85, 110, 0, 0, Math.PI * 2);
    ctx2.fill();

    // Hair
    ctx2.fillStyle = '#18181B';
    ctx2.beginPath();
    ctx2.arc(300, 260, 95, Math.PI * 0.85, Math.PI * 2.15);
    ctx2.fill();

    // Eyes
    ctx2.fillStyle = '#27272A';
    ctx2.beginPath();
    ctx2.ellipse(268, 305, 10, 6, 0, 0, Math.PI * 2);
    ctx2.ellipse(332, 305, 10, 6, 0, 0, Math.PI * 2);
    ctx2.fill();

    // Neutral expression
    ctx2.strokeStyle = '#713F12';
    ctx2.lineWidth = 3;
    ctx2.beginPath();
    ctx2.moveTo(285, 370);
    ctx2.lineTo(315, 370);
    ctx2.stroke();
  }

  // 3. Landscape Sunset Photo
  const c3 = document.createElement('canvas');
  c3.width = 1200;
  c3.height = 800;
  const ctx3 = c3.getContext('2d');
  if (ctx3) {
    const sky = ctx3.createLinearGradient(0, 0, 0, 550);
    sky.addColorStop(0, '#4C1D95');
    sky.addColorStop(0.4, '#C026D3');
    sky.addColorStop(0.7, '#F97316');
    sky.addColorStop(1, '#FBBF24');
    ctx3.fillStyle = sky;
    ctx3.fillRect(0, 0, 1200, 800);

    // Sun
    const sunGrad = ctx3.createRadialGradient(600, 480, 20, 600, 480, 120);
    sunGrad.addColorStop(0, '#FFFBEB');
    sunGrad.addColorStop(0.3, '#FEF08A');
    sunGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx3.fillStyle = sunGrad;
    ctx3.beginPath();
    ctx3.arc(600, 480, 120, 0, Math.PI * 2);
    ctx3.fill();

    // Mountain silhouettes
    ctx3.fillStyle = '#311042';
    ctx3.beginPath();
    ctx3.moveTo(0, 800);
    ctx3.lineTo(0, 580);
    ctx3.lineTo(250, 430);
    ctx3.lineTo(480, 560);
    ctx3.lineTo(750, 390);
    ctx3.lineTo(1000, 570);
    ctx3.lineTo(1200, 480);
    ctx3.lineTo(1200, 800);
    ctx3.closePath();
    ctx3.fill();

    ctx3.fillStyle = '#1A0B2E';
    ctx3.beginPath();
    ctx3.moveTo(0, 800);
    ctx3.lineTo(0, 670);
    ctx3.lineTo(380, 530);
    ctx3.lineTo(720, 690);
    ctx3.lineTo(920, 580);
    ctx3.lineTo(1200, 680);
    ctx3.lineTo(1200, 800);
    ctx3.closePath();
    ctx3.fill();
  }

  return [
    {
      name: 'Studio-Portrait.jpg',
      category: 'Portrait',
      width: 800,
      height: 1000,
      dataUrl: c1.toDataURL('image/jpeg', 0.9),
    },
    {
      name: 'Passport-Photo-Sample.jpg',
      category: 'Passport',
      width: 600,
      height: 600,
      dataUrl: c2.toDataURL('image/jpeg', 0.9),
    },
    {
      name: 'Sunset-Landscape.jpg',
      category: 'Landscape',
      width: 1200,
      height: 800,
      dataUrl: c3.toDataURL('image/jpeg', 0.9),
    },
  ];
}

export const sampleImages: SampleImageMeta[] =
  typeof window !== 'undefined' ? generateSampleImages() : [];

