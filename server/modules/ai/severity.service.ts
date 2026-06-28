import { IIssue } from '../issues/issue.model';
import { SEVERITY_LEVELS } from '../../config/constants';

export const calculateSeverity = async (issue: IIssue, category: string) => {
  // Rule-based severity calculation engine mock
  
  const desc = issue.description.toLowerCase();
  let severity: string = SEVERITY_LEVELS.LOW;
  let priorityScore = 10;
  const factors: string[] = [];

  if (desc.includes('urgent') || desc.includes('dangerous') || desc.includes('accident') || desc.includes('huge')) {
    severity = SEVERITY_LEVELS.HIGH;
    priorityScore += 50;
    factors.push('CRITICAL_KEYWORD_DETECTED');
  } else if (category === 'Water & Sanitation' || category === 'Electrical & Lighting') {
    severity = SEVERITY_LEVELS.MEDIUM;
    priorityScore += 30;
    factors.push('INFRASTRUCTURE_CATEGORY');
  }

  // If extremely critical
  if (desc.includes('life threatening') || desc.includes('fire') || desc.includes('massive sinkhole')) {
    severity = SEVERITY_LEVELS.CRITICAL;
    priorityScore = 95;
    factors.push('LIFE_SAFETY_RISK');
  }

  return {
    severity,
    priorityScore,
    factors
  };
};
