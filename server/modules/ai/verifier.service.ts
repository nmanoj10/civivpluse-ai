import { IIssue } from '../issues/issue.model';
import { CitizenScore } from '../users/citizenScore.model';
import { logger } from '../../utils/logger';

/**
 * Evaluate the trust score of an issue.
 * ImageKit URLs are considered authentic proof of cloud-uploaded media.
 */
export const evaluateIssueTrust = async (
  issue: IIssue,
  media: any[],
  userId: string,
  imageUrls: string[] = []
) => {
  // Base values
  let authenticityScore = 80;
  let suspicionFlags: string[] = [];

  // 1. Media validation checks
  if (media.length === 0) {
    authenticityScore -= 30;
    suspicionFlags.push('NO_MEDIA_ATTACHED');
  }

  // 2. ImageKit CDN URLs are proof of authentic cloud upload — give a trust boost
  const imagekitUrls = imageUrls.filter(url => url.includes('ik.imagekit.io'));
  if (imagekitUrls.length > 0) {
    authenticityScore += 10;
    logger.info('Verifier', `Trust boost: ${imagekitUrls.length} verified ImageKit URL(s)`, { imagekitUrls });
  }

  // 3. User trust weight
  const citizenScore = await CitizenScore.findOne({ userId });
  const userTrustWeight = citizenScore ? citizenScore.trustScore : 50;

  // Modulate authenticity by user trust
  if (userTrustWeight < 30) {
    authenticityScore -= 20;
    suspicionFlags.push('LOW_TRUST_REPORTER');
  } else if (userTrustWeight > 80) {
    authenticityScore += 10;
  }

  // 4. Metadata check (IssueMedia has imageKitFileId = authentic cloud upload)
  const hasCloudMetadata = media.some(m => m.imageKitFileId);
  if (!hasCloudMetadata && media.length > 0) {
    authenticityScore -= 5;
    suspicionFlags.push('NO_CLOUD_METADATA');
  }

  // Final clamp 0–100
  const finalTrustScore = Math.min(Math.max(authenticityScore, 0), 100);

  logger.info('Verifier', 'Trust evaluation complete', {
    finalTrustScore,
    authenticityScore,
    userTrustWeight,
    suspicionFlags,
    mediaCount: media.length,
    imageKitUrlCount: imagekitUrls.length
  });

  return {
    authenticityScore,
    geoScore: 100, // Mock geo verification
    userTrustWeight,
    suspicionFlags,
    finalTrustScore
  };
};
