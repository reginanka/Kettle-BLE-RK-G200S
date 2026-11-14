import React, { useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { KettleState, ScheduleJob } from '../types/kettle';
import { bleController } from '../services/bleController';
import { MODE } from '../services/kettleProtocol';
import { useLanguage } from '../i18n/LanguageContext';

interface ScheduleTabProps {
  kettleState: KettleState;
  jobs: ScheduleJob[];
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ kettleState, jobs }) => {
  const { t } = useLanguage();
  const [hhmm, setHhmm] = useState('07:30');
  const [repeat, setRepeat] = useState<'daily' | 'once'>('daily');
  const [mode, setMode] = useState<number>(kettleState.selectedMode);
  const [temp, setTemp] = useState<number>(kettleState.targetTemp);

  const isDecorative = mode === MODE.LAMP || mode === MODE.LIGHT;
  const isBoilOnly = mode === MODE.BOIL;

  const scheduleModes = [
    { id: MODE.BOIL, label: `${t.modes[MODE.BOIL]} (100°C)` },
    { id: MODE.HEAT, label: t.modes[MODE.HEAT] },
    { id: MODE.BOIL_HEAT, label: t.modes[MODE.BOIL_HEAT] },
    { id: MODE.LAMP, label: t.modes[MODE.LAMP] },
    { id: MODE.LIGHT, label: t.modes[MODE.LIGHT] },
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hhmm) return;
    bleController.addScheduleJob({
      hhmm,
      mode,
      temp: isBoilOnly ? 100 : temp,
      repeat,
      enabled: true,
    });
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleAdd}
        className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4"
      >
        <div>
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {t.schedule.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.schedule.sub}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1">
            <span>{t.schedule.time}</span>
            <input
              type="time"
              value={hhmm}
              onChange={(e) => setHhmm(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
            />
          </label>

          <label className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1">
            <span>{t.schedule.repeat}</span>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as 'daily' | 'once')}
              className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-white"
            >
              <option value="daily">{t.schedule.daily}</option>
              <option value="once">{t.schedule.once}</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1">
            <span>{t.schedule.mode}</span>
            <select
              value={mode}
              onChange={(e) => setMode(Number(e.target.value))}
              className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-white"
            >
              {scheduleModes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1">
            <span>
              {t.schedule.targetTemp}: {isDecorative ? '—' : `${isBoilOnly ? 100 : temp}°C`}
            </span>
            <input
              type="range"
              min={40}
              max={100}
              step={1}
              disabled={isDecorative || isBoilOnly}
              value={isBoilOnly ? 100 : temp}
              onChange={(e) => setTemp(Number(e.target.value))}
              className="my-auto h-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 disabled:opacity-40"
            />
          </label>
        </div>

        <button
          type="submit"
          className="w-full min-h-[44px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{t.schedule.addBtn}</span>
        </button>
      </form>

      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{t.schedule.activeList}</span>
          </h3>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {jobs.length}
          </span>
        </div>

        {jobs.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
            {t.schedule.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                    {job.hhmm}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                    {t.modes[job.mode] ?? t.modes.standby}
                    {job.mode === MODE.HEAT || job.mode === MODE.BOIL_HEAT ? ` · ${job.temp}°C` : ''}
                    {' · '}
                    {job.repeat === 'daily' ? t.schedule.daily : t.schedule.once}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => bleController.toggleScheduleJob(job.id)}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      job.enabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {job.enabled ? t.schedule.active : t.schedule.paused}
                  </button>

                  <button
                    type="button"
                    aria-label={t.schedule.deleteAria}
                    onClick={() => bleController.removeScheduleJob(job.id)}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
