import { loadSettings, saveSettings } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    // Ensure chrome API isn't present unless explicitly set in a test
    delete window.chrome;
    jest.restoreAllMocks();
  });

  test("saveSettings and loadSettings use localStorage fallback", async () => {
    await saveSettings({ brandName: "Acme" });

    const loaded = await loadSettings();
    expect(loaded).toEqual({ brandName: "Acme" });
  });

  test("loadSettings prefers chrome.storage.local when available", async () => {
    window.chrome = {
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            brandprompt_settings_v1: { brandName: "FromChrome" },
          }),
          set: jest.fn(),
        },
      },
    };

    const loaded = await loadSettings();
    expect(window.chrome.storage.local.get).toHaveBeenCalledWith([
      "brandprompt_settings_v1",
    ]);
    expect(loaded).toEqual({ brandName: "FromChrome" });
  });

  test("saveSettings prefers chrome.storage.local when available", async () => {
    window.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn().mockResolvedValue(undefined),
        },
      },
    };

    await saveSettings({ brandName: "ToChrome" });
    expect(window.chrome.storage.local.set).toHaveBeenCalledWith({
      brandprompt_settings_v1: { brandName: "ToChrome" },
    });
  });
});
