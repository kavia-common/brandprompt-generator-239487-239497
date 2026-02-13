import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadSettings, saveSettings } from "./storage";
import {
  generatePrompt,
  getDefaultSettings,
  getPublicConfig,
  healthCheck,
  resolveBaseUrl,
} from "./apiClient";

const TABS = [
  { id: "prompt", label: "Prompt" },
  { id: "brand", label: "Brand" },
  { id: "results", label: "Results" },
];

const DEFAULT_SETTINGS = {
  // Users can override this; resolveBaseUrl() also has heuristics.
  backendBaseUrl: "http://localhost:3001",

  // Prompt settings (UI)
  orientation: "Post",
  platform: "LinkedIn",
  objective: "Awareness",
  audience: "",
  topic: "",
  context: "",

  // Brand settings (UI)
  brandName: "",
  brandVoice: "Clear, confident, helpful",
  brandDo: "Use concise sentences. Be specific. Keep it practical.",
  brandDont: "Avoid hype and jargon. Avoid emojis.",
  keywords: "",
};

/**
 * PUBLIC_INTERFACE
 * Main extension popup UI.
 * Provides:
 * - Left sidebar for global settings + brand essentials
 * - Main area with tabs: Prompt, Brand details, Results
 * - Local persistence to chrome.storage.local (or localStorage in dev)
 * - Backend connectivity check and end-to-end prompt generation
 */
function App() {
  const [activeTab, setActiveTab] = useState("prompt");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  const [apiStatus, setApiStatus] = useState({
    state: "idle", // idle | checking | ok | err
    message: "",
  });

  const [generation, setGeneration] = useState({
    state: "idle", // idle | generating | ok | err
    prompt: "",
    metadata: null,
    error: "",
  });

  const [publicConfig, setPublicConfig] = useState(null);

  const baseUrl = useMemo(() => resolveBaseUrl(settings), [settings]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const stored = await loadSettings();
      if (!mounted) return;

      // Merge defaults so future fields appear automatically
      const merged = { ...DEFAULT_SETTINGS, ...stored };
      setSettings(merged);
      setDirty(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Attempt to pull config/defaults whenever baseUrl changes.
  // This is best-effort; failures should not break the UI.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const cfg = await getPublicConfig(baseUrl);
        if (!mounted) return;
        setPublicConfig(cfg);
      } catch (e) {
        if (!mounted) return;
        setPublicConfig(null);
      }

      try {
        const defaults = await getDefaultSettings(baseUrl);
        if (!mounted) return;

        // Only prefill brand name if empty; don't clobber user-entered values.
        // Defaults provide backend's reasonable baseline, but UI is source of truth.
        const defaultBrandName = defaults?.brand?.brand_name;
        if (defaultBrandName) {
          setSettings((s) => ({
            ...s,
            brandName: s.brandName?.trim() ? s.brandName : defaultBrandName,
          }));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [baseUrl]);

  async function onSave() {
    await saveSettings(settings);
    setDirty(false);
  }

  async function onCheckBackend() {
    setApiStatus({ state: "checking", message: `Checking ${baseUrl}...` });
    try {
      const res = await healthCheck(baseUrl);
      if (res.ok) {
        setApiStatus({
          state: "ok",
          message: `Backend OK (${res.status})`,
        });
      } else {
        setApiStatus({
          state: "err",
          message: `Backend error (${res.status})`,
        });
      }
    } catch (e) {
      setApiStatus({
        state: "err",
        message: `Failed to reach backend: ${e?.message ?? String(e)}`,
      });
    }
  }

  async function onGenerate() {
    setGeneration({ state: "generating", prompt: "", metadata: null, error: "" });

    try {
      const res = await generatePrompt(baseUrl, settings);
      setGeneration({
        state: "ok",
        prompt: res.prompt,
        metadata: res.metadata ?? null,
        error: "",
      });
      setActiveTab("results");
    } catch (e) {
      setGeneration({
        state: "err",
        prompt: "",
        metadata: null,
        error:
          e?.bodyText
            ? `${e.message}\n\n${e.bodyText}`
            : e?.message ?? String(e),
      });
      setActiveTab("results");
    }
  }

  async function onCopyPrompt() {
    if (!generation.prompt) return;

    try {
      await navigator.clipboard.writeText(generation.prompt);
      setApiStatus({ state: "ok", message: "Copied prompt to clipboard." });
    } catch (e) {
      setApiStatus({
        state: "err",
        message: `Copy failed: ${e?.message ?? String(e)}`,
      });
    }
  }

  function patchSettings(patch) {
    setSettings((s) => ({ ...s, ...patch }));
    setDirty(true);
  }

  const statusBadge =
    apiStatus.state === "ok" ? (
      <span className="badge ok">Connected</span>
    ) : apiStatus.state === "err" ? (
      <span className="badge err">Disconnected</span>
    ) : (
      <span className="badge">Not checked</span>
    );

  const backendVersion = publicConfig?.version ? `v${publicConfig.version}` : null;

  return (
    <div className="App">
      <div className="bp-header">
        <div className="bp-brand">
          <div className="bp-title">BrandPrompt Generator</div>
          <div className="bp-subtitle">
            On-brand prompt builder {backendVersion ? `• Backend ${backendVersion}` : ""}
          </div>
        </div>

        <div className="bp-status">
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {statusBadge}
            {dirty ? <span className="badge">Unsaved</span> : null}
          </div>
          <div style={{ marginTop: 6 }}>{apiStatus.message}</div>
        </div>
      </div>

      <div className="bp-layout">
        {/* Sidebar */}
        <aside className="bp-sidebar">
          <div className="section-title">Quick settings</div>

          <div className="field">
            <div className="label">Backend URL</div>
            <input
              className="input"
              value={settings.backendBaseUrl}
              onChange={(e) => patchSettings({ backendBaseUrl: e.target.value })}
              placeholder="http://localhost:3001"
            />
            <div className="hint">
              Used for API calls. Tip: if running in Kavia preview, you may want the same host
              on port <strong>3001</strong>.
            </div>
          </div>

          <div className="row">
            <button className="btn" onClick={onCheckBackend} type="button">
              Check backend
            </button>
            <button
              className="btn btn-primary"
              onClick={onSave}
              type="button"
              disabled={!dirty}
            >
              Save
            </button>
          </div>

          <div style={{ height: 12 }} />

          <div className="section-title">Brand essentials</div>

          <div className="field">
            <div className="label">Brand name</div>
            <input
              className="input"
              value={settings.brandName}
              onChange={(e) => patchSettings({ brandName: e.target.value })}
              placeholder="e.g., Acme Analytics"
            />
          </div>

          <div className="field">
            <div className="label">Voice</div>
            <input
              className="input"
              value={settings.brandVoice}
              onChange={(e) => patchSettings({ brandVoice: e.target.value })}
              placeholder="e.g., Clear, confident, helpful"
            />
            <div className="hint">
              Used as a human note; backend tone/keywords are derived from other fields.
            </div>
          </div>

          <div className="field">
            <div className="label">Keywords</div>
            <input
              className="input"
              value={settings.keywords}
              onChange={(e) => patchSettings({ keywords: e.target.value })}
              placeholder="comma-separated"
            />
          </div>

          <div className="small-note">
            Tip: Use the “Brand” tab for more detailed do/don’t guidance.
          </div>
        </aside>

        {/* Main */}
        <main className="bp-main">
          <nav className="bp-tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                className="bp-tab"
                type="button"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <section className="bp-content">
            {activeTab === "prompt" ? (
              <>
                <div className="section-title">Prompt configuration</div>

                <div className="row">
                  <div className="field">
                    <div className="label">Orientation</div>
                    <select
                      className="select"
                      value={settings.orientation}
                      onChange={(e) =>
                        patchSettings({ orientation: e.target.value })
                      }
                    >
                      {/* Keep current UI labels; apiClient maps to backend enums */}
                      <option>Post</option>
                      <option>Ad</option>
                      <option>Email</option>
                      <option>Landing Page</option>
                    </select>
                  </div>

                  <div className="field">
                    <div className="label">Platform</div>
                    <select
                      className="select"
                      value={settings.platform}
                      onChange={(e) =>
                        patchSettings({ platform: e.target.value })
                      }
                    >
                      <option>LinkedIn</option>
                      <option>X (Twitter)</option>
                      <option>Instagram</option>
                      <option>Facebook</option>
                      <option>TikTok</option>
                      <option>Google Ads</option>
                    </select>
                  </div>
                </div>

                <div className="row">
                  <div className="field">
                    <div className="label">Objective</div>
                    <select
                      className="select"
                      value={settings.objective}
                      onChange={(e) =>
                        patchSettings({ objective: e.target.value })
                      }
                    >
                      <option>Awareness</option>
                      <option>Consideration</option>
                      <option>Conversion</option>
                      <option>Retention</option>
                    </select>
                    <div className="hint">
                      Currently informational (not sent to backend yet).
                    </div>
                  </div>

                  <div className="field">
                    <div className="label">Audience</div>
                    <input
                      className="input"
                      value={settings.audience}
                      onChange={(e) => patchSettings({ audience: e.target.value })}
                      placeholder="Who is this for?"
                    />
                  </div>
                </div>

                <div className="field">
                  <div className="label">Topic (brief)</div>
                  <input
                    className="input"
                    value={settings.topic}
                    onChange={(e) => patchSettings({ topic: e.target.value })}
                    placeholder="What should the content be about?"
                  />
                  <div className="hint">
                    Sent to backend as the required <code>brief</code>.
                  </div>
                </div>

                <div className="field">
                  <div className="label">Context / Notes</div>
                  <textarea
                    className="textarea"
                    value={settings.context}
                    onChange={(e) => patchSettings({ context: e.target.value })}
                    placeholder="Include product details, offer, constraints, examples, etc."
                  />
                </div>

                <div className="row">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setActiveTab("results")}
                  >
                    View results
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={onGenerate}
                    disabled={generation.state === "generating"}
                  >
                    {generation.state === "generating" ? "Generating..." : "Generate prompt"}
                  </button>
                </div>

                <div className="small-note" style={{ marginTop: 10 }}>
                  This calls <code>POST /prompts/generate</code> and displays the returned prompt in Results.
                </div>
              </>
            ) : null}

            {activeTab === "brand" ? (
              <>
                <div className="section-title">Brand details</div>

                <div className="field">
                  <div className="label">Do (style guidance)</div>
                  <textarea
                    className="textarea"
                    value={settings.brandDo}
                    onChange={(e) => patchSettings({ brandDo: e.target.value })}
                    placeholder="Preferred style guidelines..."
                  />
                  <div className="hint">
                    Sent to backend as formatting notes.
                  </div>
                </div>

                <div className="field">
                  <div className="label">Don’t (things to avoid)</div>
                  <textarea
                    className="textarea"
                    value={settings.brandDont}
                    onChange={(e) => patchSettings({ brandDont: e.target.value })}
                    placeholder="Things to avoid..."
                  />
                  <div className="hint">
                    Used to populate backend “avoid” guidance.
                  </div>
                </div>

                <div className="row">
                  <button className="btn" type="button" onClick={onSave} disabled={!dirty}>
                    Save settings
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onGenerate} disabled={generation.state === "generating"}>
                    {generation.state === "generating" ? "Generating..." : "Generate prompt"}
                  </button>
                </div>

                <div className="small-note" style={{ marginTop: 10 }}>
                  These values are stored locally and also sent to the backend during generation.
                </div>
              </>
            ) : null}

            {activeTab === "results" ? (
              <>
                <div className="section-title">Results</div>

                {generation.state === "idle" ? (
                  <>
                    <div className="results" role="region" aria-label="Generated prompt">
                      {`No generated prompt yet.

Fill out Brand name + Topic, then click "Generate prompt".`}
                    </div>

                    <div className="small-note" style={{ marginTop: 10 }}>
                      The backend returns a ready-to-use prompt you can paste into an LLM.
                    </div>
                  </>
                ) : null}

                {generation.state === "generating" ? (
                  <>
                    <div className="results" role="region" aria-label="Generated prompt">
                      Generating prompt...
                    </div>
                    <div className="small-note" style={{ marginTop: 10 }}>
                      Calling <code>POST /prompts/generate</code> on {baseUrl}
                    </div>
                  </>
                ) : null}

                {generation.state === "err" ? (
                  <>
                    <div className="results" role="region" aria-label="Generated prompt">
                      {`Generation failed.

${generation.error}`}
                    </div>
                    <div className="small-note" style={{ marginTop: 10 }}>
                      Tip: click “Check backend” and verify the Backend URL.
                    </div>
                  </>
                ) : null}

                {generation.state === "ok" ? (
                  <>
                    <div className="results" role="region" aria-label="Generated prompt">
                      {generation.prompt}
                    </div>

                    <div className="bp-actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
                      <button className="btn" type="button" onClick={onCopyPrompt} disabled={!generation.prompt}>
                        Copy prompt
                      </button>
                      <button className="btn btn-primary" type="button" onClick={onGenerate} disabled={generation.state === "generating"}>
                        Regenerate
                      </button>
                    </div>

                    <div className="small-note" style={{ marginTop: 10 }}>
                      {generation.metadata ? "Metadata returned (for debugging):" : null}
                    </div>
                    {generation.metadata ? (
                      <pre className="small-note" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                        {JSON.stringify(generation.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </section>

          <div className="bp-actions">
            <button className="btn" type="button" onClick={() => setActiveTab("results")}>
              View results
            </button>
            <button className="btn" type="button" onClick={onGenerate} disabled={generation.state === "generating"}>
              {generation.state === "generating" ? "Generating..." : "Generate"}
            </button>
            <button className="btn btn-primary" type="button" onClick={onSave} disabled={!dirty}>
              Save settings
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
