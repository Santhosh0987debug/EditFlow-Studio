import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("introduces EditFlow Studio and its four media types", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: /editflow studio/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Prompt-first media editing workspace"),
    ).toBeInTheDocument();

    for (const media of ["Text", "Image", "Audio", "Video"]) {
      expect(
        screen.getByRole("heading", { level: 3, name: media }),
      ).toBeInTheDocument();
    }
  });

  it("points the Get Started call to action at the media section", () => {
    render(<App />);

    const callToAction = screen.getByRole("link", { name: /get started/i });

    expect(callToAction).toHaveAttribute("href", "#media");
    expect(document.querySelector("#media")).not.toBeNull();
  });
});
