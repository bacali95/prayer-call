import { useOutletContext } from "react-router-dom";
import MosqueSelector from "../components/mosque-selector";
import { Config } from "../types";

type AppContext = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
};

const MosquePage = () => {
  const { config, updateConfig } = useOutletContext<AppContext>();
  return <MosqueSelector config={config} updateConfig={updateConfig} />;
};

export default MosquePage;
