import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import axios from "axios";
import { Alert } from "./components/ui/alert";
import { Config } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async (): Promise<void> => {
    try {
      const response = await axios.get<Config>(`${API_BASE}/config`);
      setConfig(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load configuration");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<Config>): Promise<boolean> => {
    try {
      const response = await axios.post<Config>(`${API_BASE}/config`, updates);
      setConfig(response.data);
      setError(null);
      return true;
    } catch (err) {
      setError("Failed to update configuration");
      console.error(err);
      return false;
    }
  };

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
      <header className="text-center mb-5 p-5 bg-card rounded-lg shadow-sm border border-border">
        <h1 className="text-foreground mb-2.5">Prayer Call App</h1>
        <p className="text-muted-foreground">
          Schedule and play adhan on your Chromecast
        </p>
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
        <Outlet context={{ config, updateConfig, apiBase: API_BASE }} />
      </main>
    </div>
  );
}

export default App;
