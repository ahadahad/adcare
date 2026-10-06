/**
 * International Passport & ID Specifications Registry
 * Defines biometric ratios and millimeter measurements for official passport photo compliance.
 */

import { PhotoSpecification } from '../types';

export const PASSPORT_SPECIFICATIONS: PhotoSpecification[] = [
  {
    id: 'us_passport',
    name: 'US Passport / Visa',
    country: 'United States',
    category: 'passport',
    widthPx: 600,
    heightPx: 600,
    physicalWidthMm: 51,
    physicalHeightMm: 51,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.50, // 1 to 1 3/8 inches
    faceHeightMaxRatio: 0.69,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'uk_passport',
    name: 'UK Passport',
    country: 'United Kingdom',
    category: 'passport',
    widthPx: 700,
    heightPx: 900,
    physicalWidthMm: 35,
    physicalHeightMm: 45,
    dpi: 300,
    backgroundColor: '#F1F5F9', // Light grey or plain cream
    faceHeightMinRatio: 0.64, // 29mm to 34mm (approx 64-75%)
    faceHeightMaxRatio: 0.75,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'eu_schengen',
    name: 'Schengen / EU Standard',
    country: 'European Union',
    category: 'passport',
    widthPx: 700,
    heightPx: 900,
    physicalWidthMm: 35,
    physicalHeightMm: 45,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.70, // 32mm to 36mm (approx 70-80%)
    faceHeightMaxRatio: 0.80,
    eyeLinePositionRatio: 0.43,
  },
  {
    id: 'canada_passport',
    name: 'Canada Passport',
    country: 'Canada',
    category: 'passport',
    widthPx: 700,
    heightPx: 900,
    physicalWidthMm: 50,
    physicalHeightMm: 70,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.54, // 31mm to 36mm
    faceHeightMaxRatio: 0.68,
    eyeLinePositionRatio: 0.44,
  },
  {
    id: 'australia_passport',
    name: 'Australia Passport',
    country: 'Australia',
    category: 'passport',
    widthPx: 700,
    heightPx: 900,
    physicalWidthMm: 35,
    physicalHeightMm: 45,
    dpi: 300,
    backgroundColor: '#F8FAFC',
    faceHeightMinRatio: 0.71, // 32mm to 36mm
    faceHeightMaxRatio: 0.80,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'india_passport',
    name: 'India Passport',
    country: 'India',
    category: 'passport',
    widthPx: 600,
    heightPx: 600,
    physicalWidthMm: 51,
    physicalHeightMm: 51,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.65,
    faceHeightMaxRatio: 0.75,
    eyeLinePositionRatio: 0.43,
  },
  {
    id: 'bd',
    name: 'Bangladesh Passport (e-Passport & MRP)',
    country: 'Bangladesh',
    category: 'passport',
    widthPx: 531,
    heightPx: 650,
    physicalWidthMm: 45,
    physicalHeightMm: 55,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.65, // 65% to 75%
    faceHeightMaxRatio: 0.75,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'bd_passport',
    name: 'Bangladesh Passport (e-Passport & MRP)',
    country: 'Bangladesh',
    category: 'passport',
    widthPx: 531,
    heightPx: 650,
    physicalWidthMm: 45,
    physicalHeightMm: 55,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.65, // 65% to 75%
    faceHeightMaxRatio: 0.75,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'bd_standard',
    name: 'Bangladesh Passport / Visa (40×50 mm)',
    country: 'Bangladesh',
    category: 'passport',
    widthPx: 472,
    heightPx: 591,
    physicalWidthMm: 40,
    physicalHeightMm: 50,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.65,
    faceHeightMaxRatio: 0.75,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'bd_stamp',
    name: 'Bangladesh Stamp Size',
    country: 'Bangladesh',
    category: 'id',
    widthPx: 236,
    heightPx: 295,
    physicalWidthMm: 20,
    physicalHeightMm: 25,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.60,
    faceHeightMaxRatio: 0.75,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'china_visa',
    name: 'China Visa / Passport',
    country: 'China',
    category: 'visa',
    widthPx: 660,
    heightPx: 960,
    physicalWidthMm: 33,
    physicalHeightMm: 48,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.60,
    faceHeightMaxRatio: 0.72,
    eyeLinePositionRatio: 0.42,
  },
  {
    id: 'joint_pension_3x2',
    name: 'Joint Pension / Marriage (3×2 in)',
    country: 'International',
    category: 'joint',
    widthPx: 900,
    heightPx: 600,
    physicalWidthMm: 75,
    physicalHeightMm: 50,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.60,
    faceHeightMaxRatio: 0.72,
    eyeLinePositionRatio: 0.42,
    isJoint: true,
  },
  {
    id: 'joint_standard_35x45',
    name: 'Joint Standard (35×45 mm)',
    country: 'International',
    category: 'joint',
    widthPx: 700,
    heightPx: 900,
    physicalWidthMm: 35,
    physicalHeightMm: 45,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    faceHeightMinRatio: 0.55,
    faceHeightMaxRatio: 0.68,
    eyeLinePositionRatio: 0.42,
    isJoint: true,
  },
];

export function findPassportSpecification(specId?: string): PhotoSpecification {
  if (!specId) return PASSPORT_SPECIFICATIONS.find((s) => s.id === 'bd') || PASSPORT_SPECIFICATIONS[0];

  const matched = PASSPORT_SPECIFICATIONS.find((s) => {
    if (s.id === specId) return true;
    if ((specId === 'bd' || specId === 'bd_passport') && (s.id === 'bd' || s.id === 'bd_passport')) return true;
    if ((specId === 'us' || specId === 'us_passport') && s.id === 'us_passport') return true;
    if ((specId === 'uk' || specId === 'uk_passport') && s.id === 'uk_passport') return true;
    if ((specId === 'schengen' || specId === 'eu_schengen') && s.id === 'eu_schengen') return true;
    if ((specId === 'ca' || specId === 'canada_passport') && s.id === 'canada_passport') return true;
    if ((specId === 'joint_bd' || specId === 'joint_pension') && s.id === 'joint_pension_3x2') return true;
    if (specId === 'joint_standard' && s.id === 'joint_standard_35x45') return true;
    return false;
  });

  return matched || PASSPORT_SPECIFICATIONS.find((s) => s.id === 'bd') || PASSPORT_SPECIFICATIONS[0];
}

