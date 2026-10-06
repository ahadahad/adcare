import { useEffect } from 'react';

export function useClipboardPaste(onImagePasted: (file: File) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const filename = `pasted_document_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
            const file = new File([blob], filename, { type: blob.type });
            onImagePasted(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [onImagePasted, enabled]);
}
