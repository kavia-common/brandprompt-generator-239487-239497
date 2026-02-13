import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// Mock storage so we can validate persistence
jest.mock("./storage", () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

// Mock api client calls made by App
jest.mock("./apiClient", () => ({
  resolveBaseUrl: jest.fn(() => "http://api.test"),
  healthCheck: jest.fn(),
  getPublicConfig: jest.fn(),
  getDefaultSettings: jest.fn(),
  generatePrompt: jest.fn(),
}));

const storage = require("./storage");
const api = require("./apiClient");

describe("App UI flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Best-effort config/default loads should succeed in most tests
    api.getPublicConfig.mockResolvedValue({ version: "0.2.0" });
    api.getDefaultSettings.mockResolvedValue({ brand: { brand_name: "Your Brand" }, style: {} });
  });

  test("loads settings from storage and shows them in fields", async () => {
    storage.loadSettings.mockResolvedValue({
      brandName: "Stored Brand",
      topic: "Stored Topic",
    });

    render(<App />);

    // Wait for useEffect loadSettings merge to apply
    await waitFor(() => {
      expect(screen.getByDisplayValue("Stored Brand")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Stored Topic")).toBeInTheDocument();
  });

  test("edits a field, shows Unsaved badge, and persists on Save", async () => {
    const user = userEvent.setup();
    storage.loadSettings.mockResolvedValue({ brandName: "Stored Brand" });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Stored Brand")).toBeInTheDocument();
    });

    // Unsaved badge not shown initially
    expect(screen.queryByText(/Unsaved/i)).toBeNull();

    const brandInput = screen.getByDisplayValue("Stored Brand");
    await user.clear(brandInput);
    await user.type(brandInput, "New Brand");

    // Unsaved badge should appear
    expect(await screen.findByText(/Unsaved/i)).toBeInTheDocument();

    // Save should persist and disable unsaved badge
    await user.click(screen.getAllByRole("button", { name: /^Save$/i })[0]);

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    });

    const savedArg = storage.saveSettings.mock.calls[0][0];
    expect(savedArg.brandName).toBe("New Brand");

    await waitFor(() => {
      expect(screen.queryByText(/Unsaved/i)).toBeNull();
    });
  });

  test("generate prompt flow: calls generatePrompt and switches to Results with prompt displayed", async () => {
    const user = userEvent.setup();
    storage.loadSettings.mockResolvedValue({
      brandName: "Acme",
      topic: "Announce our launch",
    });

    api.generatePrompt.mockResolvedValue({
      prompt: "GENERATED PROMPT TEXT",
      metadata: { platform: "linkedin" },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme")).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: /Generate prompt/i })[0]);

    await waitFor(() => {
      expect(api.generatePrompt).toHaveBeenCalledTimes(1);
    });

    // Should switch to Results tab and show prompt
    expect(await screen.findByText("GENERATED PROMPT TEXT")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Generated prompt/i })).toHaveTextContent(
      "GENERATED PROMPT TEXT"
    );
  });
});
