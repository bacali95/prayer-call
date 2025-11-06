import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import axios from "axios";
import { Alert } from "./components/ui/alert";
import { Config } from "./types";
import "./App.css";

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
      <div className="app-container">
        <div className="loading text-center p-10 text-lg text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Prayer Call App</h1>
        <p>Schedule and play adhan on your Chromecast</p>
      </header>

      {error && (
        <Alert type="error" className="app-alert mb-4">
          {error}
        </Alert>
      )}

      <nav className="app-nav mb-4">
        <NavLink
          to="/schedule"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          Schedule
        </NavLink>
        <NavLink
          to="/mosque"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          Mosque
        </NavLink>
        <NavLink
          to="/chromecast"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          Chromecast
        </NavLink>
        <NavLink
          to="/adhan"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          Adhan Files
        </NavLink>
      </nav>

      <main className="app-main">
        <Outlet context={{ config, updateConfig, apiBase: API_BASE }} />
      </main>
    </div>
  );
}

export default App;
