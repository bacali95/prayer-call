import { Outlet, NavLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "./components/ui/alert";
import { Config } from "./types";
import { api } from "./lib/api";
import { ThemeToggle } from "./components/theme-toggle";

function App() {
  const queryClient = useQueryClient();

  const {
    data: config,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  const updateConfigMutation = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(["config"], data);
    },
  });

  const updateConfig = async (updates: Partial<Config>): Promise<boolean> => {
    try {
      await updateConfigMutation.mutateAsync(updates);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const error = queryError
    ? "Failed to load configuration"
    : updateConfigMutation.isError
    ? "Failed to update configuration"
    : null;

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto p-5">
        <div className="text-center p-10 text-lg text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-5">
      <header className="text-center mb-5 p-5 bg-card rounded-lg shadow-sm border border-border relative">
        <div className="absolute top-1/2 left-5 w-14 h-14 -translate-y-1/2">
          <img className="rounded-md" src="/logo.jpg" alt="Prayer Call App" />
        </div>
        <h1 className="text-foreground mb-2.5">Prayer Call App</h1>
        <p className="text-muted-foreground">
          Schedule and play adhan on your Chromecast
        </p>
        <div className="absolute top-5 right-5">
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <Alert type="error" className="mb-5">
          {error}
        </Alert>
      )}

      <nav className="flex gap-2.5 mb-5 flex-wrap bg-card p-2.5 rounded-lg shadow-sm border border-border">
        <NavLink
          to="/schedule"
          className={({ isActive }) =>
            `px-5 py-2.5 no-underline rounded transition-all font-medium border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "text-foreground border-transparent hover:bg-accent"
            }`
          }
        >
          Schedule
        </NavLink>
        <NavLink
          to="/mosque"
          className={({ isActive }) =>
            `px-5 py-2.5 no-underline rounded transition-all font-medium border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "text-foreground border-transparent hover:bg-accent"
            }`
          }
        >
          Mosque
        </NavLink>
        <NavLink
          to="/chromecast"
          className={({ isActive }) =>
            `px-5 py-2.5 no-underline rounded transition-all font-medium border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "text-foreground border-transparent hover:bg-accent"
            }`
          }
        >
          Chromecast
        </NavLink>
        <NavLink
          to="/adhan"
          className={({ isActive }) =>
            `px-5 py-2.5 no-underline rounded transition-all font-medium border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "text-foreground border-transparent hover:bg-accent"
            }`
          }
        >
          Adhan Files
        </NavLink>
      </nav>

      <main className="bg-card rounded-lg p-8 shadow-sm border border-border">
        <Outlet context={{ config, updateConfig }} />
      </main>
    </div>
  );
}

export default App;
