import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom does not implement object URLs, which the image editor uses for
// previewing and exporting locally generated blobs.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:editflow-test";
}

if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => undefined;
}
