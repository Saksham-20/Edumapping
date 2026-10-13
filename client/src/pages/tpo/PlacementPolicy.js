// client/src/pages/tpo/PlacementPolicy.js
//
// The season's placement policy, as the cell publishes it: company tiers by
// CTC, how many offers a student may hold, and when a placed student may apply
// again. Enforced by the server at apply time and shown to students on every
// job they are no longer eligible for.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Card, CardHeader, Checkbox, Input, PageHeader, PageLoader, PageShell, Select, cx } from '../../components/ui';
import placementService from '../../services/placement';
import { useAuth } from '../../contexts/AuthContext';

const lpa = (rupees) => (rupees ? Math.round((rupees / 100000) * 100) / 100 : 0);

const RULES = [
  {
    value: 'higher_tier',
    title: 'Higher tier only',
    body: 'A placed student may apply only to companies in a higher tier than their best offer. The most common rule (Regular → Dream → Super Dream).'
  },
  {
    value: 'ctc_multiplier',
    title: 'CTC multiple',
    body: 'A placed student may apply only where the CTC is at least a multiple of their best offer — e.g. 1.5× or 2×.'
  },
  { value: 'none', title: 'No upgrade rule', body: 'Only the offer cap below applies.' }
];

const PlacementPolicy = () => {
  const { user } = useAuth();
  const [policy, setPolicy] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    placementService
      .getPolicy()
      .then((res) => setPolicy(res.policy))
      .catch(() => setPolicy(null));
  }, []);

  if (!policy) return <PageLoader label="Loading policy" />;

  const set = (patch) => setPolicy((p) => ({ ...p, ...patch }));
  const setTier = (i, patch) => set({ tiers: policy.tiers.map((t, j) => (i === j ? { ...t, ...patch } : t)) });

  const save = async () => {
    setSaving(true);
    try {
      const res = await placementService.savePolicy({
        enabled: policy.enabled,
        tiers: policy.tiers,
        maxOffers: policy.maxOffers || null,
        placedRule: policy.placedRule,
        ctcMultiplier: policy.placedRule === 'ctc_multiplier' ? Number(policy.ctcMultiplier) || null : null,
        blockAfterAcceptance: policy.blockAfterAcceptance,
        requireVerifiedProfile: policy.requireVerifiedProfile,
        exemptJobIds: policy.exemptJobIds || []
      });
      setPolicy(res.policy);
      toast.success('Placement policy saved');
    } catch {
      // api toasts
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow={user?.organization?.name || 'Placement cell'}
        title="Placement policy"
        lead="The rules your students apply under this season. They are checked every time a student applies, and explained on every job they are closed out of."
        actions={
          <Button onClick={save} loading={saving} icon={ShieldCheckIcon}>
            Save policy
          </Button>
        }
      />

      <Card className={cx('mb-6 flex flex-wrap items-center justify-between gap-4', policy.enabled ? 'border-india-600/40 bg-india-50/40' : '')}>
        <div>
          <p className="font-display text-base font-bold text-ink-950">
            Policy is {policy.enabled ? 'enforced' : 'off'}
          </p>
          <p className="text-sm text-ink-600">
            {policy.enabled
              ? 'Students who break a rule below cannot apply, and see why.'
              : 'Every eligible student can apply to every job, regardless of offers held.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={policy.enabled}
          aria-label="Enforce placement policy"
          onClick={() => set({ enabled: !policy.enabled })}
          className={cx(
            'relative h-8 w-14 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2',
            policy.enabled ? 'border-india-700 bg-india-600' : 'border-ink-950/20 bg-bone-200'
          )}
        >
          <span
            className={cx(
              'absolute left-1 top-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform duration-200',
              policy.enabled ? 'translate-x-6' : 'translate-x-0'
            )}
          />
        </button>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Company tiers"
          description="Bands by annual CTC. A job's tier is set by the top of its CTC range. Internships are never tiered."
          actions={
            <Button
              size="sm"
              variant="secondary"
              icon={PlusIcon}
              disabled={policy.tiers.length >= 6}
              onClick={() => set({ tiers: [...policy.tiers, { name: '', minCtc: (policy.tiers.at(-1)?.minCtc || 0) + 500000 }] })}
            >
              Add tier
            </Button>
          }
        />
        <ol className="mt-5 space-y-3">
          {policy.tiers.map((t, i) => (
            <li key={i} className="grid grid-cols-[auto_1fr_10rem_auto] items-end gap-3">
              <span className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink-950 font-mono text-xs font-bold text-white">
                {i + 1}
              </span>
              <Input label={i === 0 ? 'Tier name' : undefined} aria-label="Tier name" value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} placeholder="e.g. Dream" />
              <Input
                label={i === 0 ? 'From (LPA)' : undefined}
                aria-label="Minimum CTC in lakhs per annum"
                type="number"
                min="0"
                step="0.5"
                value={lpa(t.minCtc)}
                onChange={(e) => setTier(i, { minCtc: Math.round(Number(e.target.value || 0) * 100000) })}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={TrashIcon}
                aria-label={`Remove ${t.name || 'tier'}`}
                className="mb-1"
                disabled={policy.tiers.length <= 1}
                onClick={() => set({ tiers: policy.tiers.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          {[...policy.tiers]
            .sort((a, b) => a.minCtc - b.minCtc)
            .map((t, i, arr) => (
              <Badge key={i} tone={i === arr.length - 1 ? 'warning' : i === 0 ? 'neutral' : 'info'}>
                {t.name || 'Unnamed'}: ₹{lpa(t.minCtc)}
                {arr[i + 1] ? `–${lpa(arr[i + 1].minCtc)}` : '+'} LPA
              </Badge>
            ))}
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Once a student is placed" description="What a student holding a live offer may still apply to." />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {RULES.map((r) => (
            <label
              key={r.value}
              className={cx(
                'cursor-pointer rounded-2xl border p-4 transition-colors',
                policy.placedRule === r.value ? 'border-ink-950 bg-bone-50 shadow-block-sm' : 'border-ink-950/15 hover:border-ink-950/40'
              )}
            >
              <input
                type="radio"
                name="placedRule"
                value={r.value}
                checked={policy.placedRule === r.value}
                onChange={() => set({ placedRule: r.value })}
                className="sr-only"
              />
              <span className="block font-semibold text-ink-950">{r.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-600">{r.body}</span>
            </label>
          ))}
        </div>
        {policy.placedRule === 'ctc_multiplier' && (
          <Input
            className="mt-4 max-w-xs"
            label="Minimum multiple of current best offer"
            type="number"
            min="1"
            step="0.1"
            value={policy.ctcMultiplier || ''}
            onChange={(e) => set({ ctcMultiplier: e.target.value })}
            placeholder="e.g. 1.5"
          />
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Select
            label="Maximum offers a student may hold"
            value={policy.maxOffers || ''}
            onChange={(e) => set({ maxOffers: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">No cap</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} offer{n > 1 ? 's' : ''}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="mb-6 space-y-4">
        <CardHeader title="Other rules" />
        <Checkbox
          label="Close applications once a student accepts an offer"
          description="Accepting means they are done for the season, whatever the tier."
          checked={policy.blockAfterAcceptance}
          onChange={(e) => set({ blockAfterAcceptance: e.target.checked })}
        />
        <Checkbox
          label="Only verified students may apply"
          description="Students must have their academic record verified by the cell (Students → Verify) before applying. Turn on once verification is under way."
          checked={policy.requireVerifiedProfile}
          onChange={(e) => set({ requireVerifiedProfile: e.target.checked })}
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} icon={ShieldCheckIcon}>
          Save policy
        </Button>
      </div>
    </PageShell>
  );
};

export default PlacementPolicy;
