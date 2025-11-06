import { useOutletContext } from "react-router-dom";
import AdhanFileManager from "../components/adhan-file-manager";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
  apiBase: string;
};

const AdhanPage = () => {
  const { config, updateConfig, apiBase } = useOutletContext<AppContext>();
  return (
    <AdhanFileManager
      config={config}
      updateConfig={updateConfig}
      apiBase={apiBase}
    />
  );
};

export default AdhanPage;
