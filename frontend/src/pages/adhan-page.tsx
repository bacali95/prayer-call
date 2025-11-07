import { useOutletContext } from "react-router-dom";
import AdhanFileManager from "../components/adhan-file-manager";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
};

const AdhanPage = () => {
  const { config, updateConfig } = useOutletContext<AppContext>();
  return <AdhanFileManager config={config} updateConfig={updateConfig} />;
};

export default AdhanPage;
