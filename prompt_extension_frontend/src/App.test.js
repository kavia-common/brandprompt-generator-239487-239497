import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders extension title", () => {
  render(<App />);
  const title = screen.getByText(/BrandPrompt Generator/i);
  expect(title).toBeInTheDocument();
});
