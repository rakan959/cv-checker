type Step = {
  label: string;
  description: string;
};

type Props = {
  steps: Step[];
  current: number;
};

export function Stepper({ steps, current }: Props) {
  return (
    <div className="mb-6 grid grid-cols-5 gap-3">
      {steps.map((step, idx) => {
        const isActive = idx === current;
        const isDone = idx < current;
        return (
          <div
            key={step.label}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm shadow-sm ${
              isActive
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : isDone
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : isDone
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-700'
              }`}
            >
              {idx + 1}
            </div>
            <div>
              <div className="font-semibold text-sm">{step.label}</div>
              <div className="text-[11px] text-slate-500">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
