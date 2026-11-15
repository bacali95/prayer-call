import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "@ui-sdk/react/toast";
import { afterEach } from "vitest";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

// jsdom gaps that ui-sdk popups and sliders rely on.
HTMLElement.prototype.showPopover = function () {};
HTMLElement.prototype.hidePopover = function () {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.checkVisibility = () => true;
Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.head.append(
  Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" }),
);

afterEach(() => {
  cleanup();
  toast.dismiss();
});
