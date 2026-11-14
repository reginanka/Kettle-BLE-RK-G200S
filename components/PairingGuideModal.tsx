import React from 'react';
import { AlertTriangle, Bluetooth, CheckCircle2, Power, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface PairingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PairingGuideModal: React.FC<PairingGuideModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const steps = [
    { title: t.modal.step1Title, body: t.modal.step1Body, icon: CheckCircle2 },
    { title: t.modal.step2Title, body: t.modal.step2Body, icon: Power },
    { title: t.modal.step3Title, body: t.modal.step3Body, icon: Bluetooth },
    { title: t.modal.step4Title, body: t.modal.step4Body, icon: RefreshCw },
  ];

  const symptoms = [
    { title: t.modal.symptom1Title, body: t.modal.symptom1Body },
    { title: t.modal.symptom2Title, body: t.modal.symptom2Body },
    { title: t.modal.symptom3Title, body: t.modal.symptom3Body },
    { title: t.modal.symptom4Title, body: t.modal.symptom4Body },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[86vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
        {/* Sticky Modal Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 pr-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base leading-snug">{t.modal.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.modal.sub}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.modal.closeAria}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-3.5 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {/* Golden Rule Callout */}
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="font-semibold leading-snug">{t.modal.orderHighlight}</span>
          </div>

          {/* Numbered Steps */}
          <div className="space-y-2.5">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <strong className="text-slate-900 dark:text-white block mb-1">{step.title}</strong>
                    <span>{step.body}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Troubleshooting Cheat Sheet */}
          <div className="pt-1 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
              <span>{t.modal.symptomsTitle}</span>
            </div>
            <div className="space-y-2">
              {symptoms.map((item) => (
                <div
                  key={item.title}
                  className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80"
                >
                  <strong className="text-slate-800 dark:text-slate-100 block mb-0.5">{item.title}</strong>
                  <span className="text-slate-600 dark:text-slate-400">{item.body}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-500/30 text-xs text-cyan-800 dark:text-cyan-300">
            {t.modal.browserNote}
          </div>
        </div>

        {/* Sticky Modal Footer */}
        <div className="p-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 font-semibold text-sm text-white dark:text-slate-950 transition-colors"
          >
            {t.common.understood}
          </button>
        </div>
      </div>
    </div>
  );
};
