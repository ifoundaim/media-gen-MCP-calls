import { type XmcpConfig } from "xmcp";

const config: XmcpConfig = {
  http: {
    host: "0.0.0.0",
    port: 3001,
  },
  paths: {
    tools: "./src/tools",
    prompts: "./src/prompts",
    resources: "./src/resources",
  },
};

export default config;
