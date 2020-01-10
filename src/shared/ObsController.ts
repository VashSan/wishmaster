import * as OBSWebSocket from "obs-websocket-js";
import { Context } from ".";
import { Configuration, IObsConfig } from "./Configuration";
import { ILogger } from "psst-log";

export class ObsController {
    config: IObsConfig | null;
    obs: OBSWebSocket = new OBSWebSocket();
    isConnected: boolean = false;
    log: ILogger;

    constructor(obsConfig: IObsConfig | null, logger: ILogger) {
        this.config = obsConfig;
        this.log = logger;
        if (this.config == null) {
            this.log.warn("OBS connection skipped due to missing config.");
            return;
        }

        this.obs.connect({
            address: `${this.config.address}:${this.config.port}`,
            password: this.config.password
        }).then(() => {
            this.log.info("Connected to OBS.");
            this.isConnected = true;
        });
    }
}