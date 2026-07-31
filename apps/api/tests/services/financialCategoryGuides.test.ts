import { describe, expect, it } from 'vitest';
import { FINANCIAL_ITEM_CATEGORIES } from '@recoverai/shared';
import { getFinancialCategoryGuide, listFinancialCategoryGuides } from '../../src/services/financialSecurity/financialCategoryGuides';

describe('financialCategoryGuides', () => {
  it('has a guide for every category the master spec lists, no more no fewer', () => {
    const guides = listFinancialCategoryGuides();
    expect(guides.map((g) => g.category).sort()).toEqual([...FINANCIAL_ITEM_CATEGORIES].sort());
  });

  it('getFinancialCategoryGuide matches listFinancialCategoryGuides for every category', () => {
    for (const category of FINANCIAL_ITEM_CATEGORIES) {
      expect(getFinancialCategoryGuide(category).category).toBe(category);
    }
  });

  it('never asks the user to send a PIN, password, CVV, card number, or OTP to RecoverAI', () => {
    for (const guide of listFinancialCategoryGuides()) {
      expect(guide.instructions.toLowerCase()).not.toMatch(/enter your pin|send us your|share your (password|cvv|otp)|full card number/);
    }
  });
});
