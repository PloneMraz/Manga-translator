/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Cpu, ExternalLink, KeyRound, X } from 'lucide-react';
import { AI_PROVIDERS } from '../engine';
import { COMMON_LANGUAGES, type AppSettings } from '../settings';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, theme }) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  useEffect(() => setDraft(settings), [settings]);

  const dark = theme === 'dark';
  const isAi = draft.engine.kind === 'ai';
  const providerId = isAi && draft.engine.kind === 'ai' ? draft.engine.providerId : AI_PROVIDERS[0]?.id;
  const provider = AI_PROVIDERS.find((entry) => entry.id === providerId);
  const apiKey = draft.engine.kind === 'ai' ? draft.engine.apiKey : '';
  const model = draft.engine.kind === 'ai' ? (draft.engine.model ?? '') : '';

  const panel = dark ? 'bg-stone-900 border-stone-700 text-stone-200' : 'bg-white border-gray-200 text-gray-800';
  const field = dark
    ? 'bg-stone-950 border-stone-700 text-stone-100 placeholder-stone-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400';
  const muted = dark ? 'text-stone-400' : 'text-gray-500';
  const label = `block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${dark ? 'text-stone-300' : 'text-gray-600'}`;

  const chooseOffline = () => setDraft({ ...draft, engine: { kind: 'offline' } });
  const chooseAi = (id: string) =>
    setDraft({ ...draft, engine: { kind: 'ai', providerId: id, apiKey, model: model || undefined } });

  return (
    <div className="absolute inset-0 z-[95] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
      <div className={`flex max-h-[90%] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl ${panel}`}>
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${dark ? 'border-stone-800 bg-stone-950' : 'border-gray-100 bg-gray-50'}`}>
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider">Translation settings</h2>
          <button onClick={onClose} aria-label="Close settings" className={muted}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <div>
            <span className={label}>Engine</span>

            <button
              type="button"
              onClick={chooseOffline}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                !isAi
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : dark ? 'border-stone-700 hover:border-stone-600' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Cpu size={18} className={!isAi ? 'text-blue-500' : muted} />
              <span>
                <span className="block text-xs font-bold">On this device</span>
                <span className={`block text-[11px] leading-relaxed ${muted}`}>
                  No account, no key, no network after the first download. Reads Japanese, writes English.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => chooseAi(providerId ?? '')}
              className={`mt-2 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isAi
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : dark ? 'border-stone-700 hover:border-stone-600' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <KeyRound size={18} className={isAi ? 'text-blue-500' : muted} />
              <span>
                <span className="block text-xs font-bold">A hosted AI model</span>
                <span className={`block text-[11px] leading-relaxed ${muted}`}>
                  Any language pair, better quality. Needs an API key you supply.
                </span>
              </span>
            </button>
          </div>

          {isAi && (
            <div className="space-y-3">
              <div>
                <label className={label} htmlFor="ai-platform">Platform</label>
                <select
                  id="ai-platform"
                  value={providerId}
                  onChange={(event) => chooseAi(event.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs ${field}`}
                >
                  {AI_PROVIDERS.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label} htmlFor="ai-key">API key</label>
                <input
                  id="ai-key"
                  type="password"
                  value={apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste your key"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      engine: { kind: 'ai', providerId: providerId ?? '', apiKey: event.target.value, model: model || undefined },
                    })
                  }
                  className={`w-full rounded-lg border px-3 py-2 font-mono text-xs ${field}`}
                />
                <p className={`mt-1.5 text-[11px] leading-relaxed ${muted}`}>
                  Kept in this browser on this device and sent only to {provider?.label ?? 'the provider'}.
                  {provider && (
                    <>
                      {' '}
                      <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                        Get a key <ExternalLink size={10} />
                      </a>
                    </>
                  )}
                </p>
              </div>

              <div>
                <label className={label} htmlFor="ai-model">Model (optional)</label>
                <input
                  id="ai-model"
                  type="text"
                  value={model}
                  spellCheck={false}
                  placeholder={provider?.defaultModel ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      engine: { kind: 'ai', providerId: providerId ?? '', apiKey, model: event.target.value || undefined },
                    })
                  }
                  className={`w-full rounded-lg border px-3 py-2 font-mono text-xs ${field}`}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="lang-from">Translate from</label>
              <input
                id="lang-from"
                list="lang-options"
                value={draft.sourceLang}
                onChange={(event) => setDraft({ ...draft, sourceLang: event.target.value })}
                className={`w-full rounded-lg border px-3 py-2 text-xs ${field}`}
              />
              <p className={`mt-1 text-[11px] ${muted}`}>“auto” lets the engine detect it.</p>
            </div>
            <div>
              <label className={label} htmlFor="lang-to">Translate into</label>
              <input
                id="lang-to"
                list="lang-options"
                value={draft.targetLang}
                onChange={(event) => setDraft({ ...draft, targetLang: event.target.value })}
                className={`w-full rounded-lg border px-3 py-2 text-xs ${field}`}
              />
            </div>
            <datalist id="lang-options">
              {COMMON_LANGUAGES.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>

          {!isAi && (
            <p className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
              dark ? 'border-amber-900/50 bg-amber-950/30 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              The on-device engine reads Japanese and writes English only. Choose a hosted model for any other pair.
            </p>
          )}

          <label className="flex items-center gap-2.5 text-xs">
            <input
              type="checkbox"
              checked={draft.uppercase}
              onChange={(event) => setDraft({ ...draft, uppercase: event.target.checked })}
              className="h-3.5 w-3.5 accent-blue-600"
            />
            <span>Set exported text in capitals, as comics usually are</span>
          </label>
        </div>

        <div className={`flex justify-end gap-2 border-t px-5 py-3.5 ${dark ? 'border-stone-800 bg-stone-950' : 'border-gray-100 bg-gray-50'}`}>
          <button onClick={onClose} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${dark ? 'border-stone-700 text-stone-300 hover:bg-stone-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Cancel
          </button>
          <button onClick={() => onSave(draft)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
