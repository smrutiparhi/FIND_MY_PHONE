import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';

describe('IncidentAssessmentRepository', () => {
  it('keeps every assessment as an append-only history, newest first', async () => {
    const { recoveryCase } = await createUserWithCase();

    const first = await repos.incidentAssessments.create({
      caseId: recoveryCase.id,
      riskLevel: 'MEDIUM',
      riskReasons: ['Initial assessment'],
    });
    const second = await repos.incidentAssessments.create({
      caseId: recoveryCase.id,
      riskLevel: 'HIGH',
      riskReasons: ['Risk increased after SIM access was lost'],
    });

    const history = await repos.incidentAssessments.listByCase(recoveryCase.id);
    expect(history.map((a) => a.id)).toEqual([second.id, first.id]);
    expect(history).toHaveLength(2);

    const latest = await repos.incidentAssessments.findLatestByCase(recoveryCase.id);
    expect(latest?.id).toBe(second.id);
    expect(latest?.riskLevel).toBe('HIGH');
  });

  it('stores the sensitive-apps checklist as an array', async () => {
    const { recoveryCase } = await createUserWithCase();
    const assessment = await repos.incidentAssessments.create({
      caseId: recoveryCase.id,
      sensitiveApps: ['BANKING', 'UPI', 'AUTHENTICATOR'],
      riskLevel: 'CRITICAL',
      riskReasons: ['Financial apps present on an unlocked device'],
    });

    expect(assessment.sensitiveApps).toEqual(['BANKING', 'UPI', 'AUTHENTICATOR']);
  });

  it('defaults sensitive apps and reasons to an empty array when omitted', async () => {
    const { recoveryCase } = await createUserWithCase();
    const assessment = await repos.incidentAssessments.create({
      caseId: recoveryCase.id,
      riskLevel: 'LOW',
      riskReasons: [],
    });

    expect(assessment.sensitiveApps).toEqual([]);
    expect(assessment.riskReasons).toEqual([]);
  });
});
