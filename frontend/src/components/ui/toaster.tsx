import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Toast, ToastClose, ToastDescription, ToastRegion, ToastTitle } from "@ui-sdk/react/toast";

// One icon per toast type; index.css hides those whose data-show doesn't match
// the toast's data-type (web.css doesn't, so without that rule all of them show).
export function Toaster() {
  return (
    <ToastRegion data-agent-hidden="">
      {() => (
        <Toast>
          <CircleCheckIcon data-show="success" aria-hidden="true" />
          <InfoIcon data-show="info" aria-hidden="true" />
          <TriangleAlertIcon data-show="warning" aria-hidden="true" />
          <OctagonXIcon data-show="error" aria-hidden="true" />
          <div data-slot="stack">
            <ToastTitle />
            <ToastDescription />
          </div>
          <ToastClose aria-label="Dismiss">
            <XIcon aria-hidden="true" />
          </ToastClose>
        </Toast>
      )}
    </ToastRegion>
  );
}
