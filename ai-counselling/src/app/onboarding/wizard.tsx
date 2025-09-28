// src/app/onboarding/wizard.tsx
'use client';

import { useMemo, useState } from 'react';
// at the very top of src/app/onboarding/wizard.tsx (and any other .tsx with JSX annotations)
import type { JSX } from 'react';


/* ---------- Strong types (no any/unknown) ---------- */

type Scale = 0 | 1 | 2 | 3 | 4;
type AgeRange = '<18' | '18-24' | '25-35' | '40-50' | '>50';
type ModeChoice = 'text' | 'voice' | 'video';
type YesNoPns = 'yes' | 'no' | 'prefer_not_to_say';
type PreferenceKey = 'guided' | 'mindfulness' | 'journaling' | 'short_checkins';

type Substances = {
  caffeine: string;
  alcohol: string;
  nicotine: string;
  cannabis: string;
};

type Props = {
  defaultName: string;
  action: (formData: FormData) => Promise<void>; // server action
};

/* ---------- Constants with literal inference ---------- */

const ageRanges = ['<18', '18-24', '25-35', '40-50', '>50'] as const satisfies Readonly<AgeRange[]>;

const modeChoices = [
  { key: 'text', label: 'Text chat' },
  { key: 'voice', label: 'Voice chat' },
  { key: 'video', label: 'Video chat (camera on)' },
] as const satisfies ReadonlyArray<{ key: ModeChoice; label: string }>;

const concernChips = [
  'Stress',
  'Low mood',
  'Worry/Panic',
  'Anger',
  'Sleep',
  'Focus/Memory',
  'Health concerns',
  'Substance use',
  'Relationships',
  'Work/School',
  'Something else',
] as const satisfies ReadonlyArray<string>;

const scaleLabelsDefault = [
  '0 None',
  '1 Rarely',
  '2 Several days',
  '3 More than half the days',
  '4 Nearly every day',
] as const;

/* ---------- Component ---------- */

export default function OnboardingWizard({ defaultName, action }: Props) {
  const [step, setStep] = useState<number>(0);

  // ---- data model state ----
  const [fullName, setFullName] = useState<string>(defaultName);
  const [ageRange, setAgeRange] = useState<AgeRange>('18-24');

  // Safety
  const [immediateDanger, setImmediateDanger] = useState<YesNoPns>('no');
  const [selfHarmThoughts, setSelfHarmThoughts] = useState<Scale>(0);

  // Mode
  const [mode, setMode] = useState<ModeChoice>('voice');

  // Presenting concerns & goals
  const [concerns, setConcerns] = useState<string[]>([]);
  const [concernsText, setConcernsText] = useState<string>('');
  const [goalsText, setGoalsText] = useState<string>('');

  // Cross-cutting
  type CrossKey =
    | 'pleasure' | 'lowMood' | 'irritability' | 'activation' | 'anxiety' | 'avoidance'
    | 'somatic' | 'psychosisLike' | 'sleepProblems' | 'cognition' | 'ocdLike' | 'dissociation' | 'substance';
  type CrossCutting = Record<CrossKey, Scale>;

  const [cross, setCross] = useState<CrossCutting>({
    pleasure: 0, lowMood: 0, irritability: 0, activation: 0,
    anxiety: 0, avoidance: 0, somatic: 0, psychosisLike: 0,
    sleepProblems: 0, cognition: 0, ocdLike: 0, dissociation: 0,
    substance: 0,
  });

  // Functioning
  type FuncKey = 'understanding' | 'mobility' | 'selfCare' | 'gettingAlong' | 'lifeActivities' | 'participation';
  type Functioning = Record<FuncKey, Scale>;

  const [func, setFunc] = useState<Functioning>({
    understanding: 0, mobility: 0, selfCare: 0, gettingAlong: 0, lifeActivities: 0, participation: 0,
  });

  // Cultural & context
  const [identityContext, setIdentityContext] = useState<string>('');
  const [meaningMaking, setMeaningMaking] = useState<string>('');
  const [stressesSupports, setStressesSupports] = useState<string>('');

  // Medical & lifestyle
  const [medicalDx, setMedicalDx] = useState<string>('');
  const [meds, setMeds] = useState<string>('');
  const [sleep, setSleep] = useState<string>('');
  const [substances, setSubstances] = useState<Substances>({
    caffeine: '', alcohol: '', nicotine: '', cannabis: '',
  });
  const [movement, setMovement] = useState<string>('');

  // Strengths & preferences
  const [strengths, setStrengths] = useState<string>('');
  const [preferences, setPreferences] = useState<PreferenceKey[]>([]);
  const [nudges, setNudges] = useState<'daily' | '2-3x/week' | 'weekly'>('2-3x/week');

  const totalSteps = 9; // 0..8
  const pct = useMemo<number>(() => Math.round(((step + 1) / totalSteps) * 100), [step, totalSteps]);

  /* ---------- Helpers (typed, no any) ---------- */

  const toggleConcern = (value: string): void => {
    setConcerns((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const togglePref = (p: PreferenceKey): void => {
    setPreferences((prev) => (prev.includes(p) ? prev.filter((v) => v !== p) : [...prev, p]));
  };

  const setCrossVal = (k: CrossKey, v: Scale): void => setCross((prev) => ({ ...prev, [k]: v }));
  const setFuncVal = (k: FuncKey, v: Scale): void => setFunc((prev) => ({ ...prev, [k]: v }));

  const onContinue = (): void => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const onBack = (): void => setStep((s) => Math.max(0, s - 1));

  const onSubmit = async (): Promise<void> => {
    const payload = {
      fullName,
      ageRange,
      immediateDanger,
      selfHarmThoughts,
      mode,
      concernsText: concernsText || undefined,
      concerns,
      goalsText: goalsText || undefined,
      crossCutting: cross,
      functioning: func,
      identityContext: identityContext || undefined,
      meaningMaking: meaningMaking || undefined,
      stressesSupports: stressesSupports || undefined,
      medicalDx: medicalDx || undefined,
      meds: meds || undefined,
      sleep: sleep || undefined,
      substances,
      movement: movement || undefined,
      strengths: strengths || undefined,
      preferences,
      nudges,
    };

    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    await action(form);
  };

  /* ---------- UI ---------- */

  const CrisisCard = (): JSX.Element => (
    <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
      <p className="font-semibold">If you are in immediate danger, please seek urgent help now.</p>
      <ul className="mt-2 list-disc pl-5 text-sm">
        <li>Call your local emergency number.</li>
        <li>Or contact a crisis hotline in your region.</li>
      </ul>
    </div>
  );

  return (
    <div className="px-4 pb-28">
      {/* Top bar */}
      <div className="w-full pl-0 pr-4 flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex items-center justify-center rounded-lg w-[40px] h-[40px] text-zinc-900 hover:text-zinc-600"
          disabled={step === 0}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="relative h-[6px] w-full bg-gray-200 rounded-full">
          <div
            className="absolute top-0 left-0 h-full bg-emerald-600 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="mt-6 space-y-6">
        {/* 1 — Name & Age */}
        {step === 0 && (
          <section className="space-y-6">
            <div>
              <label className="block text-sm font-medium">What is your name?</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 w-full rounded border px-3 py-2"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Your age</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ageRanges.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAgeRange(a)}
                    className={`rounded-lg px-3 py-2 border text-sm ${
                      ageRange === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 2 — Safety */}
        {step === 1 && (
          <section className="space-y-6">
            <div>
              <p className="font-medium">Are you in immediate danger or planning to hurt yourself or someone else right now?</p>
              <div className="mt-2 flex gap-2">
                {(['yes', 'no', 'prefer_not_to_say'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setImmediateDanger(v)}
                    className={`rounded-lg px-3 py-2 border text-sm capitalize ${
                      immediateDanger === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {v.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
              {immediateDanger === 'yes' && <CrisisCard />}
            </div>

            <div>
              <p className="font-medium">In the past two weeks, have you had thoughts of harming yourself?</p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelfHarmThoughts(s as Scale)}
                    className={`rounded-lg px-3 py-2 border text-sm ${
                      selfHarmThoughts === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {scaleLabelsDefault[s]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 3 — Mode */}
        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">How do you want to check in today?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {modeChoices.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`rounded-lg px-3 py-3 border text-sm ${
                    mode === m.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Tip: You can switch anytime.</p>
          </section>
        )}

        {/* 4 — Presenting concerns & goals */}
        {step === 3 && (
          <section className="space-y-6">
            <div>
              <label className="block text-sm font-medium">In your own words, what’s most on your mind today?</label>
              <textarea
                value={concernsText}
                onChange={(e) => setConcernsText(e.target.value)}
                className="mt-2 w-full rounded border px-3 py-2"
                rows={3}
                placeholder="(Optional) A sentence or two…"
              />
            </div>

            <div>
              <p className="block text-sm font-medium">Pick a couple of areas you want help with</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {concernChips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleConcern(c)}
                    className={`rounded-full px-3 py-1.5 text-sm border ${
                      concerns.includes(c) ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">If we made progress in 4–6 weeks, what 1–2 changes would you notice?</label>
              <textarea
                value={goalsText}
                onChange={(e) => setGoalsText(e.target.value)}
                className="mt-2 w-full rounded border px-3 py-2"
                rows={3}
                placeholder="(Optional) One or two changes…"
              />
            </div>
          </section>
        )}

        {/* 5 — Cross-cutting */}
        {step === 4 && (
          <ScaleGroup<CrossCutting, CrossKey>
            title="How often in the last 2 weeks…"
            items={[
              ['pleasure', 'Had little interest or enjoyment in things?'],
              ['lowMood', 'Felt down, discouraged, or hopeless?'],
              ['irritability', 'Felt unusually irritable or easily angered?'],
              ['activation', 'Needed less sleep but had extra energy or felt ‘amped up’?'],
              ['anxiety', 'Felt nervous, on edge, or had sudden waves of panic?'],
              ['avoidance', 'Avoided places or situations due to fear or anxiety?'],
              ['somatic', 'Bothersome aches/pains or physical symptoms without a clear cause?'],
              ['psychosisLike', 'Heard/saw things others don’t, or thought interference?'],
              ['sleepProblems', 'Problems falling/staying asleep, or feeling rested?'],
              ['cognition', 'Struggled with memory or staying organized?'],
              ['ocdLike', 'Repeating thoughts or actions to feel okay?'],
              ['dissociation', 'Felt detached/not yourself or as if things weren’t real?'],
              ['substance', 'Used alcohol/drugs more than intended?'],
            ]}
            value={cross}
            setValue={setCrossVal}
          />
        )}

        {/* 6 — Functioning */}
        {step === 5 && (
          <ScaleGroup<Functioning, FuncKey>
            title="Day-to-day functioning (last 30 days)"
            scaleLabels={['0 None', '1 Mild', '2 Moderate', '3 Severe', '4 Extreme']}
            items={[
              ['understanding', 'Understanding & communicating'],
              ['mobility', 'Getting around'],
              ['selfCare', 'Self-care'],
              ['gettingAlong', 'Getting along with people'],
              ['lifeActivities', 'Life activities (home / school / work)'],
              ['participation', 'Participation (community / social / leisure)'],
            ]}
            value={func}
            setValue={setFuncVal}
          />
        )}

        {/* 7 — Cultural & context */}
        {step === 6 && (
          <section className="space-y-4">
            <Area label="What parts of your background or identity matter for your care?" value={identityContext} setValue={setIdentityContext} />
            <Area label="How do you make sense of what you’re feeling—what does it mean in your words?" value={meaningMaking} setValue={setMeaningMaking} />
            <Area label="What stresses and supports are around you?" value={stressesSupports} setValue={setStressesSupports} />
          </section>
        )}

        {/* 8 — Medical & lifestyle */}
        {step === 7 && (
          <section className="space-y-4">
            <Area label="Any medical diagnoses we should consider?" value={medicalDx} setValue={setMedicalDx} />
            <Area label="Current medications or supplements?" value={meds} setValue={setMeds} />
            <Area label="Sleep: average hours and quality?" value={sleep} setValue={setSleep} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['caffeine', 'alcohol', 'nicotine', 'cannabis'] as const).map((k) => (
                <div key={k}>
                  <label className="block text-sm font-medium capitalize">{k} (toggle + amount)</label>
                  <input
                    value={substances[k]}
                    onChange={(e) => setSubstances({ ...substances, [k]: e.target.value })}
                    className="mt-2 w-full rounded border px-3 py-2"
                    placeholder="e.g., 2 cups/day"
                  />
                </div>
              ))}
            </div>
            <Area label="Movement/exercise per week?" value={movement} setValue={setMovement} />
          </section>
        )}

        {/* 9 — Strengths & preferences */}
        {step === 8 && (
          <section className="space-y-6">
            <Area label="What personal strengths have helped you cope before?" value={strengths} setValue={setStrengths} />
            <div>
              <p className="block text-sm font-medium">Which styles do you prefer? (choose any)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  ['guided', 'Guided exercises (CBT/skills)'],
                  ['mindfulness', 'Mindfulness/breathing'],
                  ['journaling', 'Journaling and reflection'],
                  ['short_checkins', 'Short, frequent check-ins'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePref(key)}
                    className={`rounded-full px-3 py-1.5 text-sm border ${
                      preferences.includes(key) ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="block text-sm font-medium">How often should I nudge you?</p>
              <div className="mt-2 flex gap-2">
                {(['daily', '2-3x/week', 'weekly'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNudges(v)}
                    className={`rounded-lg px-3 py-2 border text-sm ${
                      nudges === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-8 py-6 bg-white shadow-[0_-4px_8px_-1px_rgba(0,0,0,0.1)] md:max-w-[640px] md:mx-auto">
        <button
          type="button"
          onClick={step === totalSteps - 1 ? onSubmit : onContinue}
          className="w-full bg-zinc-950 text-white rounded-[10px] py-4 font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={immediateDanger === 'yes' && step === 1}
        >
          {step === totalSteps - 1 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Small helpers (typed) ---------- */

function Area(props: { label: string; value: string; setValue: (v: string) => void }): JSX.Element {
  const { label, value, setValue } = props;
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-2 w-full rounded border px-3 py-2"
        rows={3}
      />
    </div>
  );
}

function ScaleGroup<
  T extends Record<string, Scale>,
  K extends keyof T & string
>(props: {
  title: string;
  items: readonly [K, string][];
  value: T;
  setValue: (k: K, v: Scale) => void;
  scaleLabels?: readonly [string, string, string, string, string] | ReadonlyArray<string>;
}): JSX.Element {
  const { title, items, value, setValue, scaleLabels = scaleLabelsDefault } = props;
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {items.map(([key, label]) => (
        <div key={key}>
          <p className="text-sm">{label}</p>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue(key, s as Scale)}
                className={`rounded-lg px-3 py-2 border text-sm ${
                  value[key] === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-300'
                }`}
              >
                {scaleLabels[s]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
