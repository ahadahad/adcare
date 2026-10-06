import React, { useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { PhotoStudio } from './components/workspace/PhotoStudio';
import { ImageItem, ActiveTool } from './types/editor';
import { SampleImageMeta } from './utils/sampleImages';
import { createThumbnail, fileToDataUrl, loadImage } from './utils/canvas';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'studio'>('studio');
  const [initialTool, setInitialTool] = useState<ActiveTool>('object');
  const [studioImages, setStudioImages] = useState<ImageItem[]>([]);

  const handleStartEditing = () => {
    setInitialTool('adjustments');
    setCurrentView('studio');
  };

  const handleOpenPassportMode = () => {
    setInitialTool('passport');
    setCurrentView('studio');
  };

  const handleLandingFilesSelected = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const newItems: ImageItem[] = [];

    for (const file of fileArr) {
      if (!validMimes.includes(file.type)) continue;
      try {
        const { dataUrl, width, height } = await fileToDataUrl(file);
        const imgEl = await loadImage(dataUrl);
        const thumb = createThumbnail(imgEl, 140);

        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          originalFile: file,
          originalUrl: dataUrl,
          currentUrl: dataUrl,
          width,
          height,
          originalWidth: width,
          originalHeight: height,
          thumbnailUrl: thumb,
          sizeBytes: file.size,
          mimeType: file.type,
          adjustments: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            exposure: 0,
            blur: 0,
            sharpness: 0,
          },
          filter: 'original',
          background: { isTransparent: false, color: '#FFFFFF' },
          border: { enabled: false, color: '#FFFFFF', width: 0, radius: 0 },
          transform: { rotation: 0, flipH: false, flipV: false },
          passport: {
            active: false,
            standard: 'us',
            widthMm: 51,
            heightMm: 51,
            aspectRatio: 1,
            showGuides: true,
            targetWidthPx: 600,
            targetHeightPx: 600,
          },
        });
      } catch (err) {
        console.error('Failed to load file on landing:', err);
      }
    }

    if (newItems.length > 0) {
      setStudioImages(newItems);
      setCurrentView('studio');
    }
  };

  const handleSelectSampleImage = async (sample: SampleImageMeta) => {
    try {
      const imgEl = await loadImage(sample.dataUrl);
      const thumb = createThumbnail(imgEl, 140);

      const newItem: ImageItem = {
        id: `sample-${Date.now()}`,
        name: sample.name,
        originalUrl: sample.dataUrl,
        currentUrl: sample.dataUrl,
        width: sample.width,
        height: sample.height,
        originalWidth: sample.width,
        originalHeight: sample.height,
        thumbnailUrl: thumb,
        sizeBytes: 150000,
        mimeType: 'image/jpeg',
        adjustments: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          exposure: 0,
          blur: 0,
          sharpness: 0,
        },
        filter: 'original',
        background: { isTransparent: false, color: '#FFFFFF' },
        border: { enabled: false, color: '#FFFFFF', width: 0, radius: 0 },
        transform: { rotation: 0, flipH: false, flipV: false },
        passport: {
          active: sample.category === 'Passport',
          standard: 'us',
          widthMm: 51,
          heightMm: 51,
          aspectRatio: 1,
          showGuides: true,
          targetWidthPx: 600,
          targetHeightPx: 600,
        },
      };

      setStudioImages([newItem]);
      if (sample.category === 'Passport') {
        setInitialTool('passport');
      } else {
        setInitialTool('adjustments');
      }
      setCurrentView('studio');
    } catch (e) {
      console.error('Failed to load sample image:', e);
    }
  };

  if (currentView === 'landing') {
    return (
      <LandingPage
        onStartEditing={handleStartEditing}
        onOpenPassportMode={handleOpenPassportMode}
        onFilesSelected={handleLandingFilesSelected}
        onSelectSampleImage={handleSelectSampleImage}
      />
    );
  }

  return (
    <PhotoStudio
      initialImages={studioImages}
      initialTool={initialTool}
      onBackToLanding={() => setCurrentView('landing')}
    />
  );
}
