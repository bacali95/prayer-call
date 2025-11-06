import { useOutletContext } from "react-router-dom";
import PrayerTimesDisplay from "../components/prayer-times-display";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
  apiBase: string;
};

const SchedulePage = () => {
  const { config, updateConfig, apiBase } = useOutletContext<AppContext>();
  return (
    <PrayerTimesDisplay
      config={config}
      updateConfig={updateConfig}
      apiBase={apiBase}
    />
  );
};

export default SchedulePage;
