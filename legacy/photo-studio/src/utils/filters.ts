import { FilterType } from '../types/editor';

export interface FilterDefinition {
  id: FilterType;
  name: string;
  description: string;
  cssFilter: string;
  previewColor: string;
}

export const FILTERS: FilterDefinition[] = [
  {
    id: 'original',
    name: 'Original',
    description: 'Natural unedited colors',
    cssFilter: 'none',
    previewColor: '#64748B',
  },
  {
    id: 'vivid',
    name: 'Vivid',
    description: 'Punchy saturation and contrast',
    cssFilter: 'saturate(1.5) contrast(1.1)',
    previewColor: '#0EA5E9',
  },
  {
    id: 'warm',
    name: 'Warm Glow',
    description: 'Golden sunlit warmth',
    cssFilter: 'sepia(0.25) saturate(1.3) hue-rotate(-10deg)',
    previewColor: '#F59E0B',
  },
  {
    id: 'cool',
    name: 'Cool Breeze',
    description: 'Calm blue tone',
    cssFilter: 'saturate(1.1) hue-rotate(20deg) brightness(1.05)',
    previewColor: '#06B6D4',
  },
  {
    id: 'grayscale',
    name: 'B&W Classic',
    description: 'Timeless monochrome',
    cssFilter: 'grayscale(1)',
    previewColor: '#475569',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'Antique nostalgic brown tone',
    cssFilter: 'sepia(0.85) contrast(1.05)',
    previewColor: '#B45309',
  },
  {
    id: 'vintage',
    name: 'Vintage Film',
    description: 'Faded film tones with deep shadows',
    cssFilter: 'sepia(0.35) contrast(1.2) brightness(0.95) saturate(0.9)',
    previewColor: '#D97706',
  },
  {
    id: 'soft',
    name: 'Soft Portrait',
    description: 'Flattering gentle lighting',
    cssFilter: 'brightness(1.08) contrast(0.94) saturate(1.1)',
    previewColor: '#EC4899',
  },
  {
    id: 'highContrast',
    name: 'Dramatic',
    description: 'Bold highlights and deep darks',
    cssFilter: 'contrast(1.55) brightness(1.05)',
    previewColor: '#10B981',
  },
];

export function getFilterCss(filterId: FilterType): string {
  const f = FILTERS.find((item) => item.id === filterId);
  return f ? f.cssFilter : 'none';
}
