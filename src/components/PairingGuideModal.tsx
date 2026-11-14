import React from 'react';
import { X, Bluetooth, Wifi } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface PairingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PairingGuideModal: React.FC<PairingGuideModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.modal.closeAria}
          className="absolute top-4 right-4 min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Bluetooth className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base">{t.modal.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.modal.sub}</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="text-slate-900 dark:text-white block mb-1">{t.modal.step1Title}</strong>
            {t.modal.step1Body}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="text-slate-900 dark:text-white block mb-1">{t.modal.step2Title}</strong>
            {t.modal.step2Body}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="text-slate-900 dark:text-white block mb-1">{t.modal.step3Title}</strong>
            {t.modal.step3Body}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-500/30 text-xs text-cyan-800 dark:text-cyan-300 flex items-start gap-2.5">
          <Wifi className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t.modal.browserNote}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 font-semibold text-sm text-white dark:text-slate-950 transition-colors"
        >
          {t.common.understood}
        </button>
      </div>
    </div>
  );
};
