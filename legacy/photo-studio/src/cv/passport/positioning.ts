/**
 * Passport Biometric Positioning & Cropping Engine
 * Calculates optimal crop coordinates based on facial landmarks, eye line, and country specifications.
 */

import { FaceDetectionResult, PhotoSpecification, PassportCropResult, BoundingBox } from '../types';

export class PassportPositioningEngine {
  /**
   * Computes official biometric crop bounding box based on detected face and target standard
   */
  public calculateCrop(
    imageWidth: number,
    imageHeight: number,
    face: FaceDetectionResult,
    spec: PhotoSpecification
  ): PassportCropResult {
    const warnings: string[] = [];

    // Target aspect ratio (width / height)
    const targetAspect = spec.widthPx / spec.heightPx;

    // Biometric face height target: average between min and max allowed ratios
    const targetFaceHeightRatio = (spec.faceHeightMinRatio + spec.faceHeightMaxRatio) / 2;

    // Detected face height in source image
    const faceHeight = face.boundingBox.height;
    const faceWidth = face.boundingBox.width;

    // Desired crop height so that face occupies targetFaceHeightRatio of crop height
    let desiredCropH = faceHeight / targetFaceHeightRatio;
    let desiredCropW = desiredCropH * targetAspect;

    // If desired dimensions exceed image bounds, clamp while keeping aspect ratio
    if (desiredCropW > imageWidth || desiredCropH > imageHeight) {
      const scaleH = imageHeight / desiredCropH;
      const scaleW = imageWidth / desiredCropW;
      const scale = Math.min(scaleH, scaleW);
      desiredCropH *= scale;
      desiredCropW *= scale;
    }

    // Align vertical position so that eye line matches spec.eyeLinePositionRatio
    const eyeY = face.landmarks.leftEye.y;
    let cropY = eyeY - desiredCropH * spec.eyeLinePositionRatio;

    // Horizontal centering on the face center
    const faceCenterX = face.faceCenter.x;
    let cropX = faceCenterX - desiredCropW / 2;

    // Clamp coordinates within image boundaries
    if (cropX < 0) {
      cropX = 0;
    } else if (cropX + desiredCropW > imageWidth) {
      cropX = Math.max(0, imageWidth - desiredCropW);
    }

    if (cropY < 0) {
      cropY = 0;
    } else if (cropY + desiredCropH > imageHeight) {
      cropY = Math.max(0, imageHeight - desiredCropH);
    }

    // Biometric validation checks
    const finalFaceRatio = faceHeight / desiredCropH;
    if (finalFaceRatio < spec.faceHeightMinRatio - 0.05) {
      warnings.push(`Face is slightly small (${Math.round(finalFaceRatio * 100)}% vs min ${Math.round(spec.faceHeightMinRatio * 100)}%).`);
    } else if (finalFaceRatio > spec.faceHeightMaxRatio + 0.05) {
      warnings.push(`Face is slightly large (${Math.round(finalFaceRatio * 100)}% vs max ${Math.round(spec.faceHeightMaxRatio * 100)}%).`);
    }

    if (Math.abs(face.headRotationDegrees) > 4.5) {
      warnings.push(`Slight head tilt detected (${face.headRotationDegrees > 0 ? '+' : ''}${face.headRotationDegrees}°).`);
    }

    const eyeLineY = cropY + desiredCropH * spec.eyeLinePositionRatio;
    const chinLineY = cropY + desiredCropH * (spec.eyeLinePositionRatio + targetFaceHeightRatio * 0.55);

    const cropRect: BoundingBox = {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: Math.round(desiredCropW),
      height: Math.round(desiredCropH),
    };

    return {
      cropRect,
      spec,
      eyeLineY: Math.round(eyeLineY),
      chinLineY: Math.round(chinLineY),
      warnings,
      isValid: warnings.length === 0,
    };
  }
}

export const passportPositioningEngine = new PassportPositioningEngine();
