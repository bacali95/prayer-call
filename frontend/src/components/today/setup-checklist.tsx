import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import type { Config } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SetupChecklist({ config }: { config: Config }) {
  const items = [
    { done: !!config.mosque, label: "Choose your mosque", hint: config.mosque?.name, to: "/mosque" },
    { done: !!config.chromecast, label: "Pick a speaker", hint: config.chromecast?.name, to: "/speaker" },
    {
      done: Object.values(config.adhan_files ?? {}).some(Boolean),
      label: "Assign an adhan",
      hint: undefined,
      to: "/adhan",
    },
  ];
  if (items.every((i) => i.done)) return null;
  return (
    <Card aria-labelledby="setup-title">
      <CardHeader>
        <CardTitle id="setup-title">Finish setting up</CardTitle>
        <CardDescription>Three steps and the adhan plays on its own.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 md:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex h-full items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted",
                  item.done && "opacity-70",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    item.done ? "bg-success-soft text-success" : "bg-primary text-primary-foreground",
                  )}
                >
                  {item.done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {item.label}
                  <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                  {item.hint && <span className="block truncate font-normal text-muted-foreground">{item.hint}</span>}
                </span>
                {!item.done && <ArrowRight className="size-4 text-muted-foreground" aria-hidden />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
