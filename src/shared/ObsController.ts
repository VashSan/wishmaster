import * as OBSWebSocket from "obs-websocket-js";
import { ILogger } from "psst-log";

import { IObsConfig } from "./Configuration";

export class ObsController {
    config: IObsConfig | null;
    obs: OBSWebSocket = new OBSWebSocket();
    isConnected: boolean = false;
    log: ILogger;
    availableScenes: Map<string, OBSWebSocket.Scene> = new Map<string, OBSWebSocket.Scene>();

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
            return this.obs.send('GetSceneList', undefined);
        }).then((data: any) => {
            this.log.info(`Scanning ${data.scenes.length} available scenes!`);

            data.scenes.forEach((scene: OBSWebSocket.Scene) => {
                this.availableScenes.set(scene.name, scene);
            });
        }).catch(err => {
            this.log.error("Error connecting and retreiving Scens from OBS: " + err);
        });
    }

    public switchToScene(sceneName: string) {
        if (this.isConnected && this.availableScenes.has(sceneName)) {
            this.obs.send('SetCurrentScene', {
                'scene-name': sceneName
            }).catch(err => {
                this.log.error(`Could not switch to scene ${sceneName}. ${err}`);
            });
        } else {
            this.log.error(`Could not switch to scene ${sceneName}. It must exist on bot startup.`);
        }
    }

    public toggleSource(sourceName: string, durationInSeconds: number = 0) {
        if (!this.isConnected) {
            return;
        }

        this.obs.send('GetSceneItemProperties', { item: sourceName })
            .then(props => {
                let x = ObsController.Get_SetSceneItemProperties(sourceName, !props.visible);
                return this.obs.send('SetSceneItemProperties', x);
            }).then(() => {
                if (durationInSeconds != 0) {
                    let timeout = 1000 * durationInSeconds;
                    let that = this;
                    setTimeout(function () {
                        that.toggleSource(sourceName);
                    }, timeout);
                }
            }).catch(err => {
                this.log.error("Error toggling source: " + err);
            });
    }

    public setText(textSourceName: string, text: string) {
        let textProps = ObsController.Get_SetTextGDIPlusProperties(textSourceName, text);
        this.obs.send('SetTextGDIPlusProperties', textProps)
            .catch(err => {
                this.log.error("Error toggling source: " + err);
            });
    }

    private static Get_SetTextGDIPlusProperties(sourceName: string, text: string) {
        return {
            "source": sourceName,
            text: text
        };
    }

    private static Get_SetSceneItemProperties(sceneItemName: string, visible: boolean) {
        return {
            "scene-name": undefined,
            rotation: undefined,
            item: sceneItemName,
            visible: visible,
            locked: undefined,
            bounds: { y: undefined, type: undefined, alignment: undefined, x: undefined },
            scale: { x: undefined, y: undefined },
            crop: { top: undefined, left: undefined, right: undefined, bottom: undefined },
            position: { x: undefined, y: undefined, alignment: undefined }
        };
    }

}