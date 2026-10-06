/**
 * Generates the authentic Bangladesh Birth Registration Certificate
 * matching the user's screenshot: "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার - জন্ম নিবন্ধন সনদ"
 */
export function generateSampleBirthCertificate(): string {
  const canvas = document.createElement('canvas');
  // High-res A4 ratio: 1240 x 1754 px (150 DPI)
  canvas.width = 1240;
  canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Realistic paper background with very slight vintage office texture
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1240, 1754);

  // Outer Certificate Border (Double Line)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(95, 120, 1050, 1520);

  ctx.lineWidth = 1;
  ctx.strokeRect(102, 127, 1036, 1506);

  // Top URL and Timestamp stamp (as seen on web printout in screenshot)
  ctx.fillStyle = '#475569';
  ctx.font = '13px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('11/15/22, 1:09 PM', 105, 95);

  ctx.textAlign = 'right';
  ctx.fillText('https://bdris.gov.bd/admin/certificate/print/5/birth/251171827?certificateType=corrected&certificateLan...', 1145, 95);

  // Top Right "জরুরি তথ্য ও সংশোধিত"
  ctx.textAlign = 'right';
  ctx.font = '14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('জরুরি তথ্য ও', 1100, 155);
  ctx.fillText('সংশোধিত', 1100, 175);

  // Header Center
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', 620, 185);

  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('জন্ম ও মৃত্যু নিবন্ধকের কার্যালয়', 620, 215);

  ctx.font = '15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('পৌরসভা/ইউনিয়ন পরিষদ', 620, 240);
  ctx.fillText('উপজেলা: ভোলাহাট, জেলা: চাঁপাইনবাবগঞ্জ, বাংলাদেশ।', 620, 265);

  ctx.font = 'bold 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('জন্ম নিবন্ধন সনদ', 620, 305);

  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('[ বিধি ৯ ও ১০ দ্রষ্টব্য ]', 620, 330);
  ctx.fillText('(জন্ম নিবন্ধন বহি হইতে উদ্ধৃত)', 620, 350);

  // Issue Dates Row
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('নিবন্ধন বহি নম্বর:   ১২', 140, 395);
  ctx.fillText('নিবন্ধনের তারিখ:   ১১/১০/২০২২', 140, 435);

  ctx.textAlign = 'right';
  ctx.fillText('সনদ প্রদানের তারিখ: ১৯/১০/২০২২', 1100, 435);

  // Birth Registration Number Grid Box
  ctx.textAlign = 'left';
  ctx.fillText('জন্ম নিবন্ধন নম্বর:', 140, 490);

  const numDigits = ['২', '০', '২', '২', '৭', '০', '১', '৩', '৮', '৬', '১', '১', '০', '২', '৫', '৫', '৩'];
  const boxStartX = 340;
  const boxY = 465;
  const boxW = 42;
  const boxH = 40;

  for (let i = 0; i < numDigits.length; i++) {
    const curX = boxStartX + i * boxW;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(curX, boxY, boxW, boxH);

    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(numDigits[i], curX + boxW / 2, boxY + 26);
  }

  // Details Field Grid / Rows
  ctx.textAlign = 'left';
  let y = 560;
  const lineSpacing = 48;

  // Name
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('নাম:', 140, y);
  ctx.font = '17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('মোঃ মাহমুদুল হাসান', 340, y);

  // Date of Birth & Gender
  y += lineSpacing;
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('জন্ম তারিখ:', 140, y);

  // Date of birth box
  const dobBoxes = ['০', '৪', '', '১', '০', '', '২', '০', '০', '২'];
  let dbX = 340;
  for (let d = 0; d < dobBoxes.length; d++) {
    if (dobBoxes[d] === '') {
      dbX += 10;
      continue;
    }
    ctx.strokeRect(dbX, y - 26, 28, 34);
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(dobBoxes[d], dbX + 14, y - 4);
    dbX += 28;
  }

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('লিঙ্গ: পুরুষ', 720, y);

  // In Words
  y += lineSpacing;
  ctx.fillText('কথায়:', 140, y);
  ctx.font = '16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('চার অক্টোবর দুই হাজার বাইশ', 340, y);
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('সন্তানের ক্রম:  ১', 720, y);

  // Birth Place
  y += lineSpacing;
  ctx.fillText('জন্মস্থান:', 140, y);
  ctx.font = '16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('চাঁপাইনবাবগঞ্জ', 340, y);

  // Permanent Address
  y += lineSpacing;
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('স্থায়ী ঠিকানা:', 140, y);
  ctx.font = '15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('গ্রাম: বজরাটেক ওয়ার্ড-০৮, ডাকঘর: বজরাটেক, ওয়ার্ড - ৮', 340, y);
  y += 26;
  ctx.fillText('পৌরসভা/ইউপি: ভোলাহাট, চাঁপাইনবাবগঞ্জ, রাজশাহী বিভাগ', 340, y);

  // Parents Table Section
  y += 55;
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.strokeRect(140, y, 960, 180);

  // Horizontal divisions in table
  ctx.beginPath();
  ctx.moveTo(140, y + 90);
  ctx.lineTo(1100, y + 90);
  ctx.stroke();

  // Father's row
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('পিতার নাম:', 155, y + 35);
  ctx.font = '16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('মোঃ আব্দুস সালাম', 340, y + 35);

  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('পিতার জাতীয়তা: বাংলাদেশী', 700, y + 35);

  ctx.font = '14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('পিতার জন্ম নিবন্ধন নম্বর:', 155, y + 70);
  ctx.fillText('২০২১৭৩১১৫৮৫০০০৪২৪', 340, y + 70);

  // Mother's row
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('মাতার নাম:', 155, y + 125);
  ctx.font = '16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('মোসাঃ কবিতা খাতুন', 340, y + 125);

  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('মাতার জাতীয়তা: বাংলাদেশী', 700, y + 125);

  ctx.font = '14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('মাতার জন্ম নিবন্ধন নম্বর:', 155, y + 158);
  ctx.fillText('২০০৮৭৩১১৫৮৫৩২৯৫৫০', 340, y + 158);

  // Bottom Seals and Signatures Section
  const bottomY = 1380;

  // Left Seal - Official Round Stamp
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(260, bottomY + 30, 68, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(260, bottomY + 30, 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ পৌরসভা কার্যালয় ★', 260, bottomY + 15);
  ctx.fillText('চাঁপাইনবাবগঞ্জ', 260, bottomY + 35);
  ctx.fillText('বাংলাদেশ', 260, bottomY + 52);

  // Middle Signature - Assistant
  ctx.font = 'italic bold 28px cursive';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('মোঃ আব্দুল বারিক', 460, bottomY);

  ctx.font = '14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('প্রস্তুতকারীর স্বাক্ষর', 460, bottomY + 30);
  ctx.fillText('অফিস সহকারী', 460, bottomY + 50);
  ctx.fillText('পৌরসভা কার্যালয়, চাঁপাইনবাবগঞ্জ', 460, bottomY + 70);

  // Right Signature - Chairman / Mayor
  ctx.font = 'italic bold 32px cursive';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('মোঃ ইউসুফ আলী', 900, bottomY - 5);

  ctx.font = '14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('(নিবন্ধকের স্বাক্ষর ও পদবীসহ সিল)', 900, bottomY + 28);
  ctx.fillText('চেয়ারম্যান / মেয়র', 900, bottomY + 50);
  ctx.fillText('পৌরসভা কার্যালয়, ভোলাহাট', 900, bottomY + 70);

  return canvas.toDataURL('image/jpeg', 0.95);
}
