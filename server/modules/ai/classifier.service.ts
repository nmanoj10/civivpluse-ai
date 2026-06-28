import { IIssue } from '../issues/issue.model';
import { logger } from '../../utils/logger';

/**
 * Classify an issue based on text and available ImageKit image URLs.
 * imageUrls are logged and ready for Gemini Vision integration.
 */
export const classifyIssue = async (issue: IIssue, media: any[], imageUrls: string[] = []) => {
  if (imageUrls.length > 0) {
    logger.info('Classifier', `Received ${imageUrls.length} ImageKit image URL(s) for visual analysis`, { imageUrls });
  }

  // Text-based classification (mock — replace with Gemini Vision call)
  const keywords = issue.title.toLowerCase() + ' ' + issue.description.toLowerCase();

  let predictedCategory = 'Other';
  let confidence = 0.5;

  if (keywords.includes('pothole') || keywords.includes('road')) {
    predictedCategory = 'Road & Transport';
    confidence = 0.95;
  } else if (keywords.includes('water') || keywords.includes('leak') || keywords.includes('drain')) {
    predictedCategory = 'Water & Sanitation';
    confidence = 0.88;
  } else if (keywords.includes('garbage') || keywords.includes('trash')) {
    predictedCategory = 'Waste Management';
    confidence = 0.92;
  } else if (keywords.includes('light') || keywords.includes('electric')) {
    predictedCategory = 'Electrical & Lighting';
    confidence = 0.90;
  }

  logger.info('Classifier', 'Classification complete', { predictedCategory, confidence, mediaCount: media.length });

  return {
    predictedCategory,
    confidence,
    tags: ['AI_CLASSIFIED'],
    imageUrls
  };
};
