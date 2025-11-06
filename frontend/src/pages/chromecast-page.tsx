import { useOutletContext } from "react-router-dom";
import ChromecastSelector from "../components/chromecast-selector";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
  apiBase: string;
};

const ChromecastPage = () => {
  const { config, updateConfig, apiBase } = useOutletContext<AppContext>();
  return (
    <ChromecastSelector
      config={config}
      updateConfig={updateConfig}
      apiBase={apiBase}
    />
  );
};

export default ChromecastPage;
