import { Issue } from '../issues/issue.model';
import { IssueMedia } from '../issues/issueMedia.model';
import { ISSUE_STATUS } from '../../config/constants';
import { evaluateIssueTrust } from './verifier.service';
import { findPotentialDuplicate } from './duplicate.service';
import { transitionStatus } from '../../utils/issueStateMachine';
import { createTimelineEvent } from '../issues/timeline.service';
import { createAuditLog } from '../audit/audit.service';
import { ManualReview } from '../admin/manualReview.model';
import { logger } from '../../utils/logger';
import { GoogleGenAI } from '@google/genai';

/**
 * Execute visual and text analysis via Gemini API
 */
const runGeminiAnalysis = async (issue: any, imageUrls: string[]): Promise<any> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined');
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
You are the CivicPulse AI Analysis Engine. Analyze this civic issue report:
Title: "${issue.title}"
Description: "${issue.description}"
Reported Category: "${issue.reportedCategory || 'Other'}"
Image URLs: ${JSON.stringify(imageUrls)}

Return a JSON object containing the following keys (do not add any markdown formatting or prefix, output raw JSON ONLY):
- category (one of: 'Road & Transport', 'Water & Sanitation', 'Waste Management', 'Electrical & Lighting', 'Other')
- subCategory (string, e.g. 'Pothole', 'Water Leakage', 'Spilled Garbage', 'Broken Streetlight')
- confidence (number between 0 and 100)
- trustScore (number between 0 and 100)
- severity (one of: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- priorityLevel (one of: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- department (one of: 'Road Maintenance', 'Water Supply', 'Electricity', 'Garbage Management', 'Drainage', 'Public Health', 'Traffic', 'Parks', 'Street Lighting')
- duplicateScore (number between 0 and 100)
- manualReviewFlag (boolean)
- detectedObjects (array of strings)
- riskSummary (string)
- recommendedOfficerDepartment (same as department)
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text || '';
  const cleanedText = text.replace(/```json/i, '').replace(/```/g, '').trim();
  return JSON.parse(cleanedText);
};

/**
 * Local fallback rule-based analysis in case Gemini is unavailable
 */
const runLocalAiAnalysis = (issue: any, imageUrls: string[]) => {
  const text = `${issue.title} ${issue.description}`.toLowerCase();
  
  let category = issue.reportedCategory || 'Other';
  let subCategory = 'General Civic Issue';
  let department = 'Public Health';
  let detectedObjects: string[] = [];
  let riskSummary = 'General civic issue reported.';
  let confidence = 85;
  let severity = 'LOW';
  let priorityLevel = 'LOW';
  let manualReviewFlag = false;

  if (text.includes('pothole') || text.includes('cracked road') || text.includes('asphalt') || text.includes('road damage') || text.includes('road')) {
    category = 'Road & Transport';
    subCategory = 'Road Damage';
    department = 'Road Maintenance';
    detectedObjects = ['pothole', 'road damage'];
    riskSummary = 'Road damage detected, creating potential vehicle hazards.';
    confidence = 97;
    severity = 'HIGH';
    priorityLevel = 'CRITICAL';
  } else if (text.includes('water leak') || text.includes('pipe burst') || text.includes('water supply') || text.includes('sewage') || text.includes('drain')) {
    category = 'Water & Sanitation';
    subCategory = 'Water Leakage';
    department = 'Water Supply';
    detectedObjects = ['water leak', 'wet pavement'];
    riskSummary = 'Water leakage reported. Risk of flooding or resource wastage.';
    confidence = 91;
    severity = 'MEDIUM';
    priorityLevel = 'MEDIUM';
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('litter') || text.includes('dump')) {
    category = 'Waste Management';
    subCategory = 'Garbage Accumulation';
    department = 'Garbage Management';
    detectedObjects = ['trash pile', 'garbage bag'];
    riskSummary = 'Garbage accumulation detected. Health and sanitation hazard.';
    confidence = 94;
    severity = 'MEDIUM';
    priorityLevel = 'MEDIUM';
  } else if (text.includes('street light') || text.includes('streetlight') || text.includes('blackout') || text.includes('power') || text.includes('electric')) {
    category = 'Electrical & Lighting';
    subCategory = 'Broken Streetlight';
    department = 'Electricity';
    detectedObjects = ['broken streetlight'];
    riskSummary = 'Dark street area due to broken lighting. High safety risk at night.';
    confidence = 95;
    severity = 'MEDIUM';
    priorityLevel = 'HIGH';
  }

  if (text.includes('accident') || text.includes('danger') || text.includes('life threatening') || text.includes('collapsed') || text.includes('hospital')) {
    severity = 'CRITICAL';
    priorityLevel = 'CRITICAL';
  }

  return {
    category,
    subCategory,
    confidence,
    trustScore: imageUrls.length > 0 ? 91 : 70,
    severity,
    priorityLevel,
    department,
    duplicateScore: 10,
    manualReviewFlag,
    detectedObjects,
    riskSummary,
    recommendedOfficerDepartment: department
  };
};

/**
 * DECISION ENGINE - Runs after media is uploaded.
 * Evaluates everything and transitions issue status.
 */
export const processIssuePostAnalysis = async (issueId: string) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw new Error('Issue not found');

  logger.info('AIService', 'AI Analysis Started', { issueId });

  const previousStatus = issue.status;
  transitionStatus(issue, ISSUE_STATUS.AI_ANALYSIS_RUNNING);
  await issue.save();

  await createAuditLog(
    null,
    'system',
    'AI_ANALYSIS_RUNNING',
    'Issue',
    issue._id,
    previousStatus,
    ISSUE_STATUS.AI_ANALYSIS_RUNNING
  );

  try {
    const media = await IssueMedia.find({ issueId: issue._id });
    const imageUrls = media
      .filter(m => m.mediaType === 'image' && m.url)
      .map(m => m.url);

    logger.info('AIService', 'Processing issue analysis with media info', {
      issueId,
      mediaCount: media.length,
      imageUrls
    });

    // Run AI Analysis (Gemini with local fallback)
    let aiResult;
    try {
      if (process.env.GEMINI_API_KEY) {
        logger.info('AIService', 'Attempting Gemini API analysis...');
        aiResult = await runGeminiAnalysis(issue, imageUrls);
      } else {
        logger.info('AIService', 'No GEMINI_API_KEY configured. Using local rule analyzer.');
        aiResult = runLocalAiAnalysis(issue, imageUrls);
      }
    } catch (geminiErr: any) {
      logger.error('AIService', 'Gemini API call failed. Falling back to local rule analyzer.', { error: geminiErr?.message });
      aiResult = runLocalAiAnalysis(issue, imageUrls);
    }

    logger.info('AIService', 'AI analysis engine result', { aiResult });

    // Populate issue attributes
    issue.predictedCategory = aiResult.category;
    issue.predictedSubCategory = aiResult.subCategory;
    issue.aiConfidence = aiResult.confidence;
    issue.severity = aiResult.severity;
    issue.priorityLevel = aiResult.priorityLevel;
    issue.duplicateScore = aiResult.duplicateScore;
    issue.manualReviewFlag = aiResult.manualReviewFlag;
    issue.detectedObjects = aiResult.detectedObjects;
    issue.riskSummary = aiResult.riskSummary;
    issue.recommendedOfficerDepartment = aiResult.recommendedOfficerDepartment;

    // Validate Trust
    const trustEval = await evaluateIssueTrust(issue, media, issue.reportedBy.toString(), imageUrls);
    issue.trustScore = trustEval.finalTrustScore;
    issue.trustBreakdown = {
      authenticityScore: trustEval.authenticityScore,
      geoScore: trustEval.geoScore,
      userTrustWeight: trustEval.userTrustWeight,
      suspicionFlags: trustEval.suspicionFlags
    };

    // Run Location Intelligence (OSM scan) to populate landmarks and nearby context score
    const { runLocationIntelligence } = await import('./gis.service');
    await runLocationIntelligence(issue);

    // Find duplicates in vicinity
    const duplicateEval = await findPotentialDuplicate(issue);

    logger.info('AIService', 'AI sub-services completed', {
      issueId,
      category: issue.predictedCategory,
      trustScore: issue.trustScore,
      severity: issue.severity
    });

    // Decision gating logic
    if (trustEval.suspicionFlags.includes('NO_MEDIA_ATTACHED')) {
      transitionStatus(issue, ISSUE_STATUS.NEEDS_MANUAL_REVIEW);
      await ManualReview.create({
        issueId: issue._id,
        reason: 'No media attached — cannot verify issue authenticity',
        reviewStatus: 'PENDING'
      });
    } else if (trustEval.finalTrustScore < 60 || issue.manualReviewFlag) {
      transitionStatus(issue, ISSUE_STATUS.NEEDS_MANUAL_REVIEW);
      await ManualReview.create({
        issueId: issue._id,
        reason: `AI Trust below threshold (${trustEval.finalTrustScore}/100) or Flagged. Flags: ${trustEval.suspicionFlags.join(', ') || 'none'}`,
        reviewStatus: 'PENDING'
      });
    } else if (duplicateEval.isDuplicate && duplicateEval.duplicateIssueId) {
      transitionStatus(issue, ISSUE_STATUS.MERGED_WITH_EXISTING_ISSUE);
      issue.duplicateOf = duplicateEval.duplicateIssueId;

      // Update parent issue affected count
      await Issue.findByIdAndUpdate(duplicateEval.duplicateIssueId, {
        $inc: { supporterCount: 1, citizensAffected: 1 },
        $push: { mergedIssueIds: issue._id }
      });

      await createTimelineEvent(
        issue._id,
        'DUPLICATE_MERGED',
        'Merged as Duplicate',
        `AI detected this is a duplicate of issue #${duplicateEval.duplicateIssueId}.`
      );
    } else {
      transitionStatus(issue, ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION);
    }

    await issue.save();

    await createTimelineEvent(
      issue._id,
      'AI_ANALYZED',
      'AI Analysis Completed',
      `Category: ${issue.predictedCategory} (${issue.predictedSubCategory}), Trust: ${issue.trustScore}, Severity: ${issue.severity}`
    );

    await createAuditLog(
      null,
      'system',
      'AI_ANALYSIS_COMPLETE',
      'Issue',
      issue._id,
      ISSUE_STATUS.AI_ANALYSIS_RUNNING,
      issue.status,
      { trustScore: issue.trustScore, severity: issue.severity }
    );

    // Run priority evaluation and auto-routing engine
    const { runPriorityEngineAndRoute } = await import('../issues/priorityEngine.service');
    await runPriorityEngineAndRoute(issue._id.toString());

    return issue;

  } catch (error: any) {
    logger.error('AIService', 'AI Analysis Pipeline Failed', {
      issueId,
      error: error?.message || 'Unknown error'
    });

    const failPrevStatus = issue.status;
    issue.status = ISSUE_STATUS.NEEDS_MANUAL_REVIEW;
    await issue.save();
    await ManualReview.create({
      issueId: issue._id,
      reason: `AI Pipeline failure: ${error?.message || 'Unknown error'}`,
      reviewStatus: 'PENDING'
    }).catch(console.error);

    throw error;
  }
};
