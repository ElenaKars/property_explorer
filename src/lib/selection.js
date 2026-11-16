import { ANALYSIS } from '../config.js';
import { formatArea } from './format.js';
import { rectangleArea, rectangleDimensions } from './geometry.js';

/**
 * Describe a drawn rectangle and check it against the analysis limits.
 * @returns {{ bounds, areaM2, widthM, heightM, error: string|null }}
 */
export function createSelection(bounds, { maxAreaM2 = ANALYSIS.maxAreaM2 } = {}) {
  const areaM2 = rectangleArea(bounds);
  const { widthM, heightM } = rectangleDimensions(bounds);

  const error =
    areaM2 > maxAreaM2
      ? `This area is ${formatArea(areaM2)}, larger than the ${formatArea(maxAreaM2)} limit. ` +
        'Zoom in and draw a smaller rectangle.'
      : null;

  return { bounds, areaM2, widthM, heightM, error };
}
