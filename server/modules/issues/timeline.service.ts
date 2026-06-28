import { IssueTimeline } from './issueTimeline.model';

export const createTimelineEvent = async (
  issueId: any,
  type: string,
  title: string,
  description: string,
  actorId?: any,
  actorRole?: string,
  metadata?: any
) => {
  return await IssueTimeline.create({
    issueId,
    type,
    title,
    description,
    actorId,
    actorRole,
    metadata
  });
};
