import { useState, type FormEvent } from "react";
import { Check, ExternalLink, Eye, EyeOff, MapPin, Trash2 } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { WeatherIcon } from "@/components/weather-icon";
import { formatTemperature } from "@/lib/weather";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGeocode, useUpdateConfig, useWeather, useWeatherProviders } from "@/hooks/use-api";
import type { Config, Place, WeatherProviderId, WeatherSettings as Settings, WeatherUnits } from "@/lib/types";
import { pending } from "@/lib/utils";

const DEFAULTS: Settings = { enabled: false, provider: "open-meteo", units: "metric", location: null };

export function WeatherSettings({ config }: { config: Config }) {
  const settings = { ...DEFAULTS, ...config.weather };
  const update = useUpdateConfig();
  const providers = useWeatherProviders().data ?? [];
  const provider = providers.find((p) => p.id === settings.provider);
  const keyConfigured = !!config.weather_keys_configured?.includes(settings.provider);
  const live = settings.enabled && !!settings.location && !!provider && (!provider.needs_key || keyConfigured);
  const weather = useWeather(live);

  const set = (patch: Partial<Settings>) => update.mutate({ weather: patch });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Screensaver weather</CardTitle>
          {settings.enabled ? (
            <Badge tone="success">
              <Check aria-hidden /> On
            </Badge>
          ) : (
            <Badge>Off</Badge>
          )}
        </div>
        <CardDescription>
          Shows the current weather as an icon and the live temperature in the screensaver corner. It refreshes every 10
          minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <FieldLabel>Show weather</FieldLabel>
              <FieldDescription>Display the weather on the screensaver.</FieldDescription>
            </div>
            <Switch
              checked={settings.enabled}
              disabled={update.isPending}
              onCheckedChange={(next) => set({ enabled: next })}
            >
              <SwitchThumb />
            </Switch>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <Field>
            <FieldLabel>Provider</FieldLabel>
            <Select
              items={providers.map((p) => ({ value: p.id, label: p.needs_key ? p.name : `${p.name} (no key needed)` }))}
              value={settings.provider}
              disabled={update.isPending || providers.length === 0}
              onValueChange={(v) => {
                if (typeof v === "string" && v !== settings.provider) set({ provider: v as WeatherProviderId });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.needs_key ? p.name : `${p.name} (no key needed)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" id="weather-units-label">
              Units
            </span>
            <SegmentedControl
              aria-labelledby="weather-units-label"
              value={settings.units}
              disabled={update.isPending}
              onValueChange={(v) => v && v !== settings.units && set({ units: v as WeatherUnits })}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="metric">Celsius (°C)</SegmentedControlItem>
              <SegmentedControlItem value="imperial">Fahrenheit (°F)</SegmentedControlItem>
            </SegmentedControl>
          </div>
        </div>

        {provider?.needs_key && (
          <ApiKeyForm providerId={provider.id} providerName={provider.name} url={provider.url} configured={keyConfigured} />
        )}

        <LocationPicker
          location={settings.location}
          onPick={(p) =>
            pending(
              update.mutateAsync({
                weather: {
                  location: { name: p.name, latitude: p.latitude, longitude: p.longitude },
                },
              }),
            )
          }
        />

        {live && (
          <div aria-live="polite" className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            {weather.isPending ? (
              <span className="text-muted-foreground">Checking the weather…</span>
            ) : weather.isError ? (
              <span className="text-destructive">{weather.error.message}</span>
            ) : weather.data ? (
              <span className="flex items-center gap-2">
                <WeatherIcon condition={weather.data.condition} isDay={weather.data.is_day} className="size-5 text-primary" />
                <span className="num font-medium">{formatTemperature(weather.data)}</span>
                <span className="text-muted-foreground">
                  {weather.data.description}
                  {weather.data.location ? ` in ${weather.data.location}` : ""}
                </span>
              </span>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApiKeyForm({
  providerId,
  providerName,
  url,
  configured,
}: {
  providerId: WeatherProviderId;
  providerName: string;
  url: string;
  configured: boolean;
}) {
  const save = useUpdateConfig(`${providerName} key saved`);
  const clear = useUpdateConfig(`${providerName} key removed`);
  const [key, setKey] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = key.trim();
    if (!value) return;
    return pending(save.mutateAsync({ weather_api_keys: { [providerId]: value } }).then(() => setKey("")));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>{configured ? `Replace ${providerName} API key` : `${providerName} API key`}</FieldLabel>
          {configured ? (
            <Badge tone="success">
              <Check aria-hidden /> Key configured
            </Badge>
          ) : (
            <Badge tone="brass">Key needed</Badge>
          )}
        </div>
        <PasswordInput value={key} onValueChange={(v) => setKey(v)} data-agent-secret="">
          <PasswordInputControl
            spellCheck={false}
            placeholder={configured ? "Enter a new key to replace the current one" : "Paste your API key"}
          />
          <PasswordInputToggle aria-label="Show key">
            {(state) => (state.visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />)}
          </PasswordInputToggle>
        </PasswordInput>
        <FieldDescription>
          Stored on the server and never shown again.{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            Get a key <ExternalLink aria-hidden className="size-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </FieldDescription>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" data-variant="solid" disabled={!key.trim()}>
          {configured ? "Replace key" : "Save key"}
        </Button>
        {configured && (
          <Button
            data-variant="destructive-ghost"
            data-agent-confirm={`Removes the saved ${providerName} key, so the screensaver loses its weather`}
            onClick={() => pending(clear.mutateAsync({ weather_api_keys: { [providerId]: "" } }))}
          >
            <Trash2 aria-hidden /> Clear key
          </Button>
        )}
      </div>
    </form>
  );
}

function LocationPicker({
  location,
  onPick,
}: {
  location: Settings["location"];
  onPick: (place: Place) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const places = useGeocode(query);
  const searching = query.trim().length >= 2;

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel>Location</FieldLabel>
        <Input type="search" placeholder="Search a city" value={query} onValueChange={(v) => setQuery(v)} />
        <FieldDescription>
          {location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              Current: {location.name ?? "Custom location"}{" "}
              <span className="num">
                ({location.latitude.toFixed(2)}, {location.longitude.toFixed(2)})
              </span>
            </span>
          ) : (
            "No location yet. Search for your city."
          )}
        </FieldDescription>
      </Field>
      {searching && (
        <div aria-live="polite">
          {places.isPending ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : places.isError ? (
            <p className="text-sm text-destructive">{places.error.message}</p>
          ) : places.data?.length ? (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" aria-label="Places">
              {places.data.map((p) => (
                <li key={`${p.latitude},${p.longitude}`} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    {p.region && <span className="text-sm text-muted-foreground"> · {p.region}</span>}
                  </span>
                  <Button
                    data-size="sm"
                    aria-label={`Use ${p.name}${p.region ? `, ${p.region}` : ""}`}
                    onClick={() => {
                      setQuery("");
                      return onPick(p);
                    }}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No places found.</p>
          )}
        </div>
      )}
    </div>
  );
}
