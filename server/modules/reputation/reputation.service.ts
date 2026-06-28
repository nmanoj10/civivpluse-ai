import { CitizenScore } from '../users/citizenScore.model';

export const rewardResolutionConfirmation = async (userId: string) => {
  await CitizenScore.findOneAndUpdate(
    { userId },
    { 
      $inc: { 
        successfulConfirmations: 1, 
        trustScore: 2,
        contributionPoints: 10
      } 
    }
  );
  await recalculateTrustScore(userId);
};

export const penalizeFalseReport = async (userId: string) => {
  await CitizenScore.findOneAndUpdate(
    { userId },
    { 
      $inc: { 
        falseReports: 1, 
        trustScore: -10 
      } 
    }
  );
  await recalculateTrustScore(userId);
};

export const rewardVerifiedReport = async (userId: string) => {
  await CitizenScore.findOneAndUpdate(
    { userId },
    { 
      $inc: { 
        verifiedReports: 1, 
        trustScore: 5,
        contributionPoints: 20
      } 
    }
  );
  await recalculateTrustScore(userId);
};

export const recalculateTrustScore = async (userId: string) => {
  const score = await CitizenScore.findOne({ userId });
  if (!score) return;

  // Clamp trust score between 0 and 100
  if (score.trustScore > 100) score.trustScore = 100;
  if (score.trustScore < 0) score.trustScore = 0;

  // Determine Level and Badges based on contribution points and trust score
  let level = 1;
  if (score.contributionPoints > 100) level = 2;
  if (score.contributionPoints > 500) level = 3;
  if (score.contributionPoints > 1000) level = 4;
  
  score.level = level;
  await score.save();
};
