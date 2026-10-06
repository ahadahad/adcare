export type EditOperation =
  | { type: 'setBrightness'; value: number }
  | { type: 'setContrast'; value: number }
  | { type: 'setSaturation'; value: number }
  | { type: 'setExposure'; value: number }
  | {
      type: 'setFilter';
      filter:
        | 'original'
        | 'grayscale'
        | 'sepia'
        | 'vivid'
        | 'warm'
        | 'cool'
        | 'vintage'
        | 'soft'
        | 'highContrast';
    }
  | {
      type: 'crop';
      x?: number;
      y?: number;
      width: number;
      height: number;
      aspect?: string;
    }
  | {
      type: 'resize';
      width: number;
      height: number;
      lockAspectRatio?: boolean;
    }
  | { type: 'rotate'; degrees: 90 | 180 | 270 }
  | { type: 'flipHorizontal'; value?: boolean }
  | { type: 'flipVertical'; value?: boolean }
  | { type: 'setBackground'; color: string }
  | { type: 'setTransparency'; enabled: boolean }
  | {
      type: 'setBorder';
      enabled: boolean;
      color?: string;
      width?: number;
      radius?: number;
    }
  | { type: 'removeBackground'; targetColor?: string }
  | { type: 'enhancePhoto'; level?: 'subtle' | 'balanced' | 'vivid' }
  | { type: 'resetAdjustments' }
  | { type: 'exportSuggestion'; format?: 'png' | 'jpeg' | 'webp'; quality?: number }
  | { type: 'unsupported'; reason: string };

export interface AIResponse {
  operations: EditOperation[];
  explanation: string;
}

export interface ClientAssistantRequest {
  instruction: string;
  editorState: {
    currentDimensions: {
      width: number;
      height: number;
    };
    adjustments: {
      brightness: number;
      contrast: number;
      saturation: number;
      exposure: number;
    };
    filter: string;
    background: {
      isTransparent: boolean;
      color: string;
    };
    border: {
      enabled: boolean;
      color: string;
      width: number;
      radius: number;
    };
    rotation: number;
    isPassportMode?: boolean;
  };
}
