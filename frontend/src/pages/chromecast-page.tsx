import { useOutletContext } from "react-router-dom";
import ChromecastSelector from "../components/chromecast-selector";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
};

const ChromecastPage = () => {
  const { config, updateConfig } = useOutletContext<AppContext>();
  return <ChromecastSelector config={config} updateConfig={updateConfig} />;
};

export default ChromecastPage;
