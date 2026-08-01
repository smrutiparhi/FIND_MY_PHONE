import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { agentMessageRateLimiter, evidenceUploadRateLimiter } from '../middleware/rateLimiter';
import { evidenceUploadMiddleware } from '../middleware/evidenceUpload';
import { asyncHandler } from '../lib/asyncHandler';
import {
  createCase,
  getCase,
  getRecoveryPlan,
  listMyCases,
  sendAgentMessage,
  updateActionStatus,
} from '../controllers/recoveryCase.controller';
import { createLocationObservation, listLocationObservations } from '../controllers/location.controller';
import { getAccountRecovery, patchAccountRecovery } from '../controllers/accountRecovery.controller';
import { getEmergencyMode } from '../controllers/emergencyMode.controller';
import { getSimProtection, patchSimProtection } from '../controllers/simProtection.controller';
import {
  deleteFinancialProtectionItemHandler,
  getFinancialSecurity,
  patchFinancialProtectionItem,
  postFinancialProtectionItem,
} from '../controllers/financialSecurity.controller';
import {
  getPoliceReport,
  listPoliceReports,
  patchPoliceReportDraft,
  postApprovePoliceReport,
  postMarkPoliceReportSubmitted,
  postPoliceReport,
  postRegeneratePoliceReportDraft,
} from '../controllers/policeReport.controller';
import { getCeir, patchCeir } from '../controllers/ceir.controller';
import {
  deleteEvidenceHandler,
  getEvidenceAccessHandler,
  listEvidence,
  postEvidence,
} from '../controllers/evidence.controller';
import {
  caseActionParamsSchema,
  caseIdParamsSchema,
  createRecoveryCaseWizardSchema,
  sendAgentMessageSchema,
  updateActionStatusSchema,
} from '../validation/schemas/recoveryCase.schemas';
import { recordLocationObservationSchema } from '../validation/schemas/location.schemas';
import { updateAccountRecoveryAttemptSchema } from '../validation/schemas/accountRecovery.schemas';
import { updateSimProtectionRecordSchema } from '../validation/schemas/simProtection.schemas';
import {
  createFinancialProtectionItemSchema,
  financialItemParamsSchema,
  updateFinancialProtectionItemSchema,
} from '../validation/schemas/financialSecurity.schemas';
import {
  createPoliceReportSchema,
  markPoliceReportSubmittedSchema,
  policeReportParamsSchema,
  regeneratePoliceReportDraftSchema,
  updatePoliceReportDraftSchema,
} from '../validation/schemas/policeReport.schemas';
import { updateCeirRecordSchema } from '../validation/schemas/ceir.schemas';
import {
  evidenceCaseParamsSchema,
  evidenceItemParamsSchema,
  uploadEvidenceBodySchema,
} from '../validation/schemas/evidence.schemas';

export const recoveryCaseRouter = Router();

recoveryCaseRouter.get('/', requireAuth, asyncHandler(listMyCases));
recoveryCaseRouter.post('/', requireAuth, validate(createRecoveryCaseWizardSchema), asyncHandler(createCase));
recoveryCaseRouter.get('/:caseId', requireAuth, validate(caseIdParamsSchema, 'params'), asyncHandler(getCase));
recoveryCaseRouter.get(
  '/:caseId/recovery-plan',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(getRecoveryPlan),
);
recoveryCaseRouter.patch(
  '/:caseId/actions/:actionId',
  requireAuth,
  validate(caseActionParamsSchema, 'params'),
  validate(updateActionStatusSchema),
  asyncHandler(updateActionStatus),
);
recoveryCaseRouter.post(
  '/:caseId/agent/messages',
  requireAuth,
  agentMessageRateLimiter,
  validate(caseIdParamsSchema, 'params'),
  validate(sendAgentMessageSchema),
  asyncHandler(sendAgentMessage),
);
recoveryCaseRouter.get(
  '/:caseId/locations',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(listLocationObservations),
);
recoveryCaseRouter.post(
  '/:caseId/locations',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  validate(recordLocationObservationSchema),
  asyncHandler(createLocationObservation),
);
recoveryCaseRouter.get(
  '/:caseId/account-recovery',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(getAccountRecovery),
);
recoveryCaseRouter.patch(
  '/:caseId/account-recovery',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  validate(updateAccountRecoveryAttemptSchema),
  asyncHandler(patchAccountRecovery),
);
recoveryCaseRouter.get(
  '/:caseId/emergency',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(getEmergencyMode),
);
recoveryCaseRouter.get(
  '/:caseId/sim-protection',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(getSimProtection),
);
recoveryCaseRouter.patch(
  '/:caseId/sim-protection',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  validate(updateSimProtectionRecordSchema),
  asyncHandler(patchSimProtection),
);
recoveryCaseRouter.get(
  '/:caseId/financial-security',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(getFinancialSecurity),
);
recoveryCaseRouter.post(
  '/:caseId/financial-security/items',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  validate(createFinancialProtectionItemSchema),
  asyncHandler(postFinancialProtectionItem),
);
recoveryCaseRouter.patch(
  '/:caseId/financial-security/items/:itemId',
  requireAuth,
  validate(financialItemParamsSchema, 'params'),
  validate(updateFinancialProtectionItemSchema),
  asyncHandler(patchFinancialProtectionItem),
);
recoveryCaseRouter.delete(
  '/:caseId/financial-security/items/:itemId',
  requireAuth,
  validate(financialItemParamsSchema, 'params'),
  asyncHandler(deleteFinancialProtectionItemHandler),
);
recoveryCaseRouter.get(
  '/:caseId/police-reports',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(listPoliceReports),
);
recoveryCaseRouter.post(
  '/:caseId/police-reports',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  validate(createPoliceReportSchema),
  asyncHandler(postPoliceReport),
);
recoveryCaseRouter.get(
  '/:caseId/police-reports/:reportId',
  requireAuth,
  validate(policeReportParamsSchema, 'params'),
  asyncHandler(getPoliceReport),
);
recoveryCaseRouter.post(
  '/:caseId/police-reports/:reportId/regenerate',
  requireAuth,
  validate(policeReportParamsSchema, 'params'),
  validate(regeneratePoliceReportDraftSchema),
  asyncHandler(postRegeneratePoliceReportDraft),
);
recoveryCaseRouter.patch(
  '/:caseId/police-reports/:reportId/draft',
  requireAuth,
  validate(policeReportParamsSchema, 'params'),
  validate(updatePoliceReportDraftSchema),
  asyncHandler(patchPoliceReportDraft),
);
recoveryCaseRouter.post(
  '/:caseId/police-reports/:reportId/approve',
  requireAuth,
  validate(policeReportParamsSchema, 'params'),
  asyncHandler(postApprovePoliceReport),
);
recoveryCaseRouter.post(
  '/:caseId/police-reports/:reportId/mark-submitted',
  requireAuth,
  validate(policeReportParamsSchema, 'params'),
  validate(markPoliceReportSubmittedSchema),
  asyncHandler(postMarkPoliceReportSubmitted),
);
recoveryCaseRouter.get('/:caseId/ceir', requireAuth, validate(caseIdParamsSchema, 'params'), asyncHandler(getCeir));
recoveryCaseRouter.patch(
  '/:caseId/ceir',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  validate(updateCeirRecordSchema),
  asyncHandler(patchCeir),
);
recoveryCaseRouter.get(
  '/:caseId/evidence',
  requireAuth,
  validate(evidenceCaseParamsSchema, 'params'),
  asyncHandler(listEvidence),
);
recoveryCaseRouter.post(
  '/:caseId/evidence',
  requireAuth,
  evidenceUploadRateLimiter,
  validate(evidenceCaseParamsSchema, 'params'),
  evidenceUploadMiddleware,
  validate(uploadEvidenceBodySchema),
  asyncHandler(postEvidence),
);
recoveryCaseRouter.get(
  '/:caseId/evidence/:evidenceId/access',
  requireAuth,
  validate(evidenceItemParamsSchema, 'params'),
  asyncHandler(getEvidenceAccessHandler),
);
recoveryCaseRouter.delete(
  '/:caseId/evidence/:evidenceId',
  requireAuth,
  validate(evidenceItemParamsSchema, 'params'),
  asyncHandler(deleteEvidenceHandler),
);
