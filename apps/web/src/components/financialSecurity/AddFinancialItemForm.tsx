import { useState, type FormEvent, type ReactElement } from 'react';
import type { CreateFinancialProtectionItemInput, FinancialCategoryGuide, FinancialItemCategory } from '@recoverai/shared';

interface AddFinancialItemFormProps {
  categoryGuides: FinancialCategoryGuide[];
  submitting: boolean;
  onSubmit: (input: CreateFinancialProtectionItemInput) => Promise<void>;
}

/** label is free text and optional - "record institutions/apps generically or by name" - never a field for a PIN, password, CVV, card number, or OTP. */
export function AddFinancialItemForm({ categoryGuides, submitting, onSubmit }: AddFinancialItemFormProps): ReactElement {
  const [category, setCategory] = useState<FinancialItemCategory>(categoryGuides[0]?.category ?? 'BANKING_APP');
  const [label, setLabel] = useState('');

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await onSubmit({ category, label: label.trim() === '' ? null : label.trim() });
    setLabel('');
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Track something on the device</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Type
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FinancialItemCategory)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          >
            {categoryGuides.map((guide) => (
              <option key={guide.category} value={guide.category}>
                {guide.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Name (optional)
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. HDFC Bank, Google Pay"
            maxLength={150}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
