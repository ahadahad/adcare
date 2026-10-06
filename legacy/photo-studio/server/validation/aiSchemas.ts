import { z } from 'zod';

export const FilterEnum = z.enum([
  'original',
  'grayscale',
  'sepia',
  'vivid',
  'warm',
  'cool',
  'vintage',
  'soft',
  'highContrast',
]);

export const EditOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setBrightness'),
    value: z.number().min(-100).max(100),
  }),
  z.object({
    type: z.literal('setContrast'),
    value: z.number().min(-100).max(100),
  }),
  z.object({
    type: z.literal('setSaturation'),
    value: z.number().min(-100).max(100),
  }),
  z.object({
    type: z.literal('setExposure'),
    value: z.number().min(-100).max(100),
  }),
  z.object({
    type: z.literal('setFilter'),
    filter: FilterEnum,
  }),
  z.object({
    type: z.literal('crop'),
    x: z.number().nonnegative().optional(),
    y: z.number().nonnegative().optional(),
    width: z.number().positive().max(10000),
    height: z.number().positive().max(10000),
    aspect: z.string().optional(),
  }),
  z.object({
    type: z.literal('resize'),
    width: z.number().int().min(1).max(8000),
    height: z.number().int().min(1).max(8000),
    lockAspectRatio: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('rotate'),
    degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
  }),
  z.object({
    type: z.literal('flipHorizontal'),
    value: z.boolean().optional().default(true),
  }),
  z.object({
    type: z.literal('flipVertical'),
    value: z.boolean().optional().default(true),
  }),
  z.object({
    type: z.literal('setBackground'),
    color: z.string().max(50),
  }),
  z.object({
    type: z.literal('setTransparency'),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('setBorder'),
    enabled: z.boolean(),
    color: z.string().max(50).optional(),
    width: z.number().min(0).max(100).optional(),
    radius: z.number().min(0).max(100).optional(),
  }),
  z.object({
    type: z.literal('removeBackground'),
    targetColor: z.string().max(50).optional(),
  }),
  z.object({
    type: z.literal('enhancePhoto'),
    level: z.enum(['subtle', 'balanced', 'vivid']).optional(),
  }),
  z.object({
    type: z.literal('resetAdjustments'),
  }),
  z.object({
    type: z.literal('exportSuggestion'),
    format: z.enum(['png', 'jpeg', 'webp']).optional(),
    quality: z.number().min(10).max(100).optional(),
  }),
  z.object({
    type: z.literal('unsupported'),
    reason: z.string().max(500),
  }),
]);

export const AIResponseSchema = z.object({
  operations: z.array(EditOperationSchema),
  explanation: z.string().max(1000),
});

export const ClientAssistantRequestSchema = z.object({
  instruction: z.string().min(1).max(1000),
  editorState: z.object({
    currentDimensions: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
    }),
    adjustments: z.object({
      brightness: z.number(),
      contrast: z.number(),
      saturation: z.number(),
      exposure: z.number(),
    }),
    filter: z.string(),
    background: z.object({
      isTransparent: z.boolean(),
      color: z.string(),
    }),
    border: z.object({
      enabled: z.boolean(),
      color: z.string(),
      width: z.number(),
      radius: z.number(),
    }),
    rotation: z.number(),
    isPassportMode: z.boolean().optional(),
  }),
});

export type EditOperation = z.infer<typeof EditOperationSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
export type ClientAssistantRequest = z.infer<typeof ClientAssistantRequestSchema>;
