import { AuditLog } from './auditLog.model';

export const createAuditLog = async (
  actorId: string | null,
  actorRole: string | null,
  actionType: string,
  entityType: string,
  entityId: any,
  previousState?: string,
  nextState?: string,
  metadata?: any
) => {
  return await AuditLog.create({
    actorId,
    actorRole,
    actionType,
    entityType,
    entityId,
    previousState,
    nextState,
    metadata
  });
};
