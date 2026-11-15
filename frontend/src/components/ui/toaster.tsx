import { CircleCheckIcon, OctagonXIcon, XIcon } from "lucide-react";
import { Toast, ToastClose, ToastDescription, ToastRegion, ToastTitle } from "@ui-sdk/react/toast";

export function Toaster() {
  return (
    <ToastRegion data-agent-hidden="">
      {() => (
        <Toast>
          <CircleCheckIcon data-show="success" aria-hidden="true" />
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
