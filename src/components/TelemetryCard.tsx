import React, { useEffect, useState } from 'react';
import { Cpu, CheckCircle, Loader2 } from 'lucide-react';

const STEPS = [
  '[MILO AGENT]: Ingesting messy natural language request...',
  '[MILO AGENT]: Parsing spatial and proximity vectors...',
  '[MILO AGENT]: Running deterministic matching matrix...',
  '[MILO AGENT]: Delegating request to top-tier matching candidates...',
];

type Props = {
  onComplete?: () => void;
};

export function TelemetryCard({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const timings = [600, 1200, 900, 800];

    let step = 0;
    function advance() {
      if (step >= STEPS.length) {
        onComplete?.();
        return;
      }
      setCurrentStep(step);

      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, step]);
        step++;
        advance();
      }, timings[step] ?? 800);
    }

    advance();
  }, [onComplete]);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-4 font-mono text-xs">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-cyan-400 font-semibold">MILO AGENT PIPELINE</span>
        <div className="ml-auto flex gap-1">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
      </div>

      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const isComplete = completedSteps.includes(idx);
          const isActive = idx === currentStep && !isComplete;
          const isPending = idx > currentStep;

          return (
            <div
              key={idx}
              className={`flex items-start gap-2 transition-all duration-300 ${
                isPending ? 'opacity-30' : 'opacity-100'
              }`}
            >
              {isComplete ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin mt-0.5 flex-shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-slate-600 mt-0.5 flex-shrink-0" />
              )}
              <span
                className={`${
                  isComplete ? 'text-slate-400' : isActive ? 'text-cyan-300' : 'text-slate-600'
                }`}
              >
                {step}
                {isActive && <span className="animate-pulse">_</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
