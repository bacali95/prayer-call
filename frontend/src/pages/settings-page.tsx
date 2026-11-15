import { useState, type FormEvent } from "react";
import { Check, ExternalLink, Eye, EyeOff, ImageIcon, Trash2 } from "lucide-react";
import { useConfig, useUpdateConfig } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import { pending } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

export default function SettingsPage() {
  const config = useConfig();
  const save = useUpdateConfig("Unsplash key saved");
  const clear = useUpdateConfig("Unsplash key removed");
  const [key, setKey] = useState("");
  const configured = !!config.data?.unsplash_configured;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = key.trim();
    if (!value) return;
    return pending(save.mutateAsync({ unsplash_access_key: value }).then(() => setKey("")));
  };

  return (
    <>
      <PageHeader title="Settings" description="Appearance of the wall-tablet screensaver." />
      <div className="flex max-w-2xl flex-col gap-6">
        {config.isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : config.isError ? (
          <ErrorState error={config.error} onRetry={() => void config.refetch()} />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Screensaver photos</CardTitle>
                {configured ? (
                  <Badge tone="success">
                    <Check aria-hidden /> Key configured
                  </Badge>
                ) : (
                  <Badge>Not configured</Badge>
                )}
              </div>
              <CardDescription>
                The screensaver shows nature photography from Unsplash behind the clock. Without a key it falls back to a
                calm gradient. The key is stored on the server and is never shown again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <Field>
                  <FieldLabel>{configured ? "Replace Unsplash access key" : "Unsplash access key"}</FieldLabel>
                  <PasswordInput value={key} onValueChange={(v) => setKey(v)} data-agent-secret="">
                    <PasswordInputControl
                      spellCheck={false}
                      placeholder={configured ? "Enter a new key to replace the current one" : "Paste your access key"}
                    />
                    <PasswordInputToggle aria-label="Show key">
                      {(state) => (state.visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />)}
                    </PasswordInputToggle>
                  </PasswordInput>
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" data-variant="solid" disabled={!key.trim()}>
                    {configured ? "Replace key" : "Save key"}
                  </Button>
                  {configured && (
                    <Button
                      data-variant="destructive-ghost"
                      data-agent-confirm="Removes the saved Unsplash key, so the screensaver loses its photos"
                      onClick={() => pending(clear.mutateAsync({ unsplash_access_key: "" }))}
                    >
                      <Trash2 aria-hidden /> Clear key
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Screensaver</CardTitle>
            <CardDescription>
              A full-screen clock with the next prayer, built for a wall tablet. Open it on the tablet and leave it running.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<a href="/screensaver" target="_blank" rel="noopener noreferrer" />}>
              <ImageIcon aria-hidden /> Open screensaver <ExternalLink aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
