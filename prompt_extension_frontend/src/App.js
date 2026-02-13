import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadSettings, saveSettings } from "./storage";
import { healthCheck, resolveBaseUrl } from "./apiClient";

const TABS = [
  { id: "prompt", label: "Prompt" },
  { id: "brand", label: "Brand" },
  { id: "results", label: "Results" },
];

const DEFAULT_SETTINGS = {
  backendBaseUrl: "http://localhost:3001",

  // Prompt settings
  orientation: "Post",
  platform: "LinkedIn",
  objective: "Awareness",
  audience: "",
  topic: "",
  context: "",

  // Brand settings
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
 * - Backend connectivity check (GET /)
 */
function App() {
  const [activeTab, setActiveTab] = useState("prompt");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  const [apiStatus, setApiStatus] = useState({
    state: "idle", // idle | checking | ok | err
    message: "",
  });

  const baseUrl = useMemo(() => resolveBaseUrl(settings), [settings]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const stored = await loadSettings();
      if (!mounted) return;

      // Merge defaults so future fields appear automatically
      setSettings((prev) => ({ ...prev, ...DEFAULT_SETTINGS, ...stored }));
      setDirty(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

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

  return (
    <div className="App">
      <div className="bp-header">
        <div className="bp-brand">
          <div className="bp-title">BrandPrompt Generator</div>
          <div className="bp-subtitle">On-brand prompt builder</div>
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
              Used for API calls. Default is localhost:3001.
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
                  <div className="label">Topic</div>
                  <input
                    className="input"
                    value={settings.topic}
                    onChange={(e) => patchSettings({ topic: e.target.value })}
                    placeholder="What should the content be about?"
                  />
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

                <div className="small-note">
                  Generation will be enabled once the backend exposes a generate
                  endpoint. For now you can save settings and verify backend
                  connectivity.
                </div>
              </>
            ) : null}

            {activeTab === "brand" ? (
              <>
                <div className="section-title">Brand details</div>

                <div className="field">
                  <div className="label">Do</div>
                  <textarea
                    className="textarea"
                    value={settings.brandDo}
                    onChange={(e) => patchSettings({ brandDo: e.target.value })}
                    placeholder="Preferred style guidelines..."
                  />
                </div>

                <div className="field">
                  <div className="label">Don’t</div>
                  <textarea
                    className="textarea"
                    value={settings.brandDont}
                    onChange={(e) => patchSettings({ brandDont: e.target.value })}
                    placeholder="Things to avoid..."
                  />
                </div>

                <div className="small-note">
                  These values are stored locally in the extension and can be sent
                  to the backend once prompt generation is implemented.
                </div>
              </>
            ) : null}

            {activeTab === "results" ? (
              <>
                <div className="section-title">Results</div>
                <div className="results" role="region" aria-label="Generated prompt">
                  {`No generated prompt yet.

Current configuration snapshot:
- Brand: ${settings.brandName || "(not set)"}
- Voice: ${settings.brandVoice || "(not set)"}
- Orientation: ${settings.orientation}
- Platform: ${settings.platform}
- Objective: ${settings.objective}
- Topic: ${settings.topic || "(not set)"}

Next step: backend needs a generation endpoint; UI wiring is ready.`}
                </div>

                <div className="small-note" style={{ marginTop: 10 }}>
                  Once the backend has a generate endpoint, this tab will show the
                  returned prompt(s) and allow copy-to-clipboard.
                </div>
              </>
            ) : null}
          </section>

          <div className="bp-actions">
            <button className="btn" type="button" onClick={() => setActiveTab("results")}>
              View results
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
