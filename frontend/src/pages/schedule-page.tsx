import { useOutletContext } from "react-router-dom";
import PrayerTimesDisplay from "../components/prayer-times-display";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
};

const SchedulePage = () => {
  const { config, updateConfig } = useOutletContext<AppContext>();
  return <PrayerTimesDisplay config={config} updateConfig={updateConfig} />;
};

export default SchedulePage;
