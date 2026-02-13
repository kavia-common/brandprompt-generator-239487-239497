import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./storage", () => ({
  loadSettings: jest.fn().mockResolvedValue({}),
  saveSettings: jest.fn(),
}));

jest.mock("./apiClient", () => ({
  resolveBaseUrl: jest.fn(() => "http://api.test"),
  healthCheck: jest.fn(),
  getPublicConfig: jest.fn().mockResolvedValue({ version: "0.2.0" }),
  getDefaultSettings: jest.fn().mockResolvedValue({ brand: { brand_name: "Your Brand" }, style: {} }),
  generatePrompt: jest.fn(),
}));

test("renders extension title", async () => {
  render(<App />);
  const title = screen.getByText(/BrandPrompt Generator/i);
  expect(title).toBeInTheDocument();

  // And the UI shows backend version when config fetch resolves
  expect(await screen.findByText(/Backend v0\.2\.0/i)).toBeInTheDocument();
});
