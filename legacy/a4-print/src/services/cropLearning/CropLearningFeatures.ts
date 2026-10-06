import { CornersTuple, GeometricFeatureSummary, PointCoord } from './CropLearningTypes';

/**
 * Fast, lightweight geometric feature extractor.
 * Computes dimension-independent shape indicators from normalized coordinates.
 * Runs in microseconds with zero pixel reads.
 */
export function extractGeometricFeatures(
  corners: CornersTuple,
  imageWidth: number,
  imageHeight: number,
  edgeStrength?: number
): GeometricFeatureSummary {
  const tl = corners.topLeft;
  const tr = corners.topRight;
  const br = corners.bottomRight;
  const bl = corners.bottomLeft;

  // Normalized Euclidean distance helper
  const dist = (p1: PointCoord, p2: PointCoord): number => {
    return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  };

  // Edge lengths in normalized units
  const topEdge = dist(tl, tr);
  const bottomEdge = dist(bl, br);
  const leftEdge = dist(tl, bl);
  const rightEdge = dist(tr, br);

  // Scaled dimensions in pixels
  const pixelW = ((topEdge + bottomEdge) / 2) * Math.max(1, imageWidth);
  const pixelH = ((leftEdge + rightEdge) / 2) * Math.max(1, imageHeight);
  const aspectRatio = pixelH > 0 ? Number((pixelW / pixelH).toFixed(4)) : 1.0;

  // Quad area using Shoelace formula on normalized coordinates (0..1 space)
  const areaShoelace =
    0.5 *
    Math.abs(
      tl[0] * tr[1] -
        tr[0] * tl[1] +
        tr[0] * br[1] -
        br[0] * tr[1] +
        br[0] * bl[1] -
        bl[0] * br[1] +
        bl[0] * tl[1] -
        tl[0] * bl[1]
    );
  const documentAreaRatio = Number(Math.max(0, Math.min(1, areaShoelace)).toFixed(4));

  // Perspective deformation score: difference in opposing edge lengths
  const maxW = Math.max(topEdge, bottomEdge, 0.001);
  const maxH = Math.max(leftEdge, rightEdge, 0.001);
  const widthPerspective = Math.abs(topEdge - bottomEdge) / maxW;
  const heightPerspective = Math.abs(leftEdge - rightEdge) / maxH;
  const perspectiveScore = Number(
    Math.max(0, Math.min(1, (widthPerspective + heightPerspective) / 2)).toFixed(4)
  );

  // Rectangularity: compare quad area to axis-aligned bounding box area
  const minX = Math.min(tl[0], tr[0], br[0], bl[0]);
  const maxX = Math.max(tl[0], tr[0], br[0], bl[0]);
  const minY = Math.min(tl[1], tr[1], br[1], bl[1]);
  const maxY = Math.max(tl[1], tr[1], br[1], bl[1]);
  const aabbArea = Math.max(0.0001, (maxX - minX) * (maxY - minY));
  const rectangularity = Number(Math.max(0, Math.min(1, areaShoelace / aabbArea)).toFixed(4));

  // Boundary proximity: minimum distance from any of the 4 points to the image border (0..1)
  const allPoints = [tl, tr, br, bl];
  let minBorderDist = 1.0;
  for (const pt of allPoints) {
    const dEdge = Math.min(pt[0], 1 - pt[0], pt[1], 1 - pt[1]);
    if (dEdge < minBorderDist) {
      minBorderDist = dEdge;
    }
  }
  const boundaryProximity = Number(Math.max(0, minBorderDist).toFixed(4));

  return {
    aspectRatio,
    documentAreaRatio,
    rectangularity,
    perspectiveScore,
    boundaryProximity,
    ...(edgeStrength !== undefined ? { edgeStrength: Number(edgeStrength.toFixed(3)) } : {}),
  };
}
