import { useOutletContext } from "react-router-dom";
import MosqueSelector from "../components/mosque-selector";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
  apiBase: string;
};

const MosquePage = () => {
  const { config, updateConfig, apiBase } = useOutletContext<AppContext>();
  return (
    <MosqueSelector
      config={config}
      updateConfig={updateConfig}
      apiBase={apiBase}
    />
  );
};

export default MosquePage;
