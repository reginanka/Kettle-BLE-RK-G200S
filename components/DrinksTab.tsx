import React from 'react';
import { Play } from 'lucide-react';
import { DRINKS_LIBRARY } from '../data/drinks';
import { DrinkPreset, KettleState } from '../types/kettle';
import { bleController } from '../services/bleController';
import { useLanguage } from '../i18n/LanguageContext';

interface DrinksTabProps {
  kettleState: KettleState;
  onSelectDrinkTabSwitch: () => void;
}

export const DrinksTab: React.FC<DrinksTabProps> = ({
  kettleState,
  onSelectDrinkTabSwitch,
}) => {
  const { t } = useLanguage();

  const handleSelect = (drink: DrinkPreset) => {
    bleController.setSelectedMode(drink.mode);
    bleController.setTargetTemp(drink.temp);
    onSelectDrinkTabSwitch();
  };

  const handleStartNow = async (drink: DrinkPreset) => {
    await bleController.programAndStart(drink.mode, drink.temp);
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
          {t.drinks.title}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t.drinks.sub}
        </p>
      </div>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {DRINKS_LIBRARY.map((drink) => {
          const localized = t.drinksData[drink.id];
          const name = localized ? localized.name : drink.name;
          const category = localized ? localized.category : drink.category;
          const note = localized ? localized.note : drink.note;

          return (
            <li
              key={drink.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {name}
                  </h3>
                  <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 tabular-nums shrink-0">
                    {drink.temp}°C
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {category} · {t.modes[drink.mode] ?? t.modes.standby}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {note}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelect(drink)}
                  className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold whitespace-nowrap transition-colors"
                >
                  {t.drinks.choose}
                </button>

                <button
                  type="button"
                  disabled={!kettleState.isConnected || kettleState.parentalLock}
                  onClick={() => void handleStartNow(drink)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{t.drinks.startNow}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
