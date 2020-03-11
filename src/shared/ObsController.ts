import * as OBSWebSocket from "obs-websocket-js";
import { ILogger, LogManager } from "psst-log";

import { IObsConfig } from "./Configuration";
import { Seconds } from "./Helper";

export interface IObsController {
    /** establish connection to OBS */
    connect(): Promise<void>;

    /** Changes to the desired scene */
    switchToScene(sceneName: string): void;

    /** toggles the visibility state of an OBS source for a distinct timespan. 
     * @param sourceName the OBS Source
     * @param durationInSeconds 0 for a one time toggle, otherwise after the timespan the toggle is reverted
     */
    toggleSource(sourceName: string, durationInSeconds?: number): void;

    /** sets visibility state of the given source.
     * @param sourceName the OBS source to modify.
     * @param setVisible if true sets the source visible, otherwise it will be hidden.
     */
    setSourceVisible(sourceName: string, isVisible: boolean): void;

    /** gets visibility state of the given source.
     * @param sourceName the OBS source to query.
     */
    isSourceVisible(sourceName: string, ): Promise<boolean>;

    /** sets the text property of a OBS text source */
    setText(textSourceName: string, text: string): void;
}

export class ObsController implements IObsController {
    private readonly config: IObsConfig | null;
    private readonly obs: OBSWebSocket;
    private readonly reconnectIn: Seconds;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private log: ILogger;
    private availableScenes: Map<string, OBSWebSocket.Scene> = new Map<string, OBSWebSocket.Scene>();

    constructor(obsConfig: IObsConfig | null, obsApi?: OBSWebSocket, logger?: ILogger, reconnectIn?: Seconds) {
        this.log = logger ? logger : LogManager.getLogger();
        this.obs = obsApi ? obsApi : new OBSWebSocket();
        this.config = obsConfig;
        this.reconnectIn = reconnectIn ? reconnectIn : new Seconds(10);
    }

    public getIsConnected() {
        return this.isConnected;
    }

    public connect(): Promise<void> {
        if (this.isConnecting) {
            return Promise.reject("Currently connecting");
        }
        if (this.isConnected) {
            return Promise.resolve();
        }
        this.isConnecting = true;
        return new Promise((resolve, reject) => {
            if (this.config == null) {
                this.log.warn("OBS connection skipped due to missing config.");
                reject("Could not connect due to missing conifg");
                return;
            }

            this.obs.connect({
                address: `${this.config.address}:${this.config.port}`,
                password: this.config.password
            }).then(() => {
                this.log.info("Connected to OBS.");
                this.isConnected = true;
                this.isConnecting = false;
                return this.obs.send('GetSceneList', undefined);
            }).then((data: any) => {
                this.log.info(`Scanning ${data.scenes.length} available scenes!`);

                data.scenes.forEach((scene: OBSWebSocket.Scene) => {
                    this.availableScenes.set(scene.name, scene);
                });

                resolve();
            }).catch(err => {
                this.log.warn("Could not connect to OBS: " + err);
                reject("Could not connect to OBS: " + err);
                this.isConnecting = false;

                const reconnectInMs = this.reconnectIn.inMilliseconds();
                if (reconnectInMs != 0) {
                    setTimeout(() => {
                        this.connect();
                    }, reconnectInMs);
                }
            });
        });
    }

    public switchToScene(sceneName: string) {
        if (this.isConnected && this.availableScenes.has(sceneName)) {
            this.obs.send('SetCurrentScene', {
                'scene-name': sceneName
            }).catch(err => {
                this.log.warn(`Could not switch to scene ${sceneName}. ${err}`);
            });
        } else {
            this.log.warn(`Could not switch to scene ${sceneName}. It must exist on bot startup.`);
        }
    }

    public toggleSource(sourceName: string, durationInSeconds: number = 0): void {
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
                    setTimeout(() => this.toggleSource(sourceName), timeout);
                }
            }).catch(err => {
                this.log.warn("Error toggling source: " + err);
            });
    }

    public setSourceVisible(sourceName: string, isVisible: boolean): void {
        const props = ObsController.Get_SetSceneItemProperties(sourceName, isVisible);
        this.obs.send('SetSceneItemProperties', props)
            .catch(err => {
                this.log.warn("OBS.setSourceVisible error: " + err);
            });
    }

    public async isSourceVisible(sourceName: string): Promise<boolean> {
        const result = await this.obs.send('GetSceneItemProperties', { item: sourceName });
        return result.visible;
    }

    public setText(textSourceName: string, text: string) {
        let textProps = ObsController.Get_SetTextGDIPlusProperties(textSourceName, text);
        this.obs.send('SetTextGDIPlusProperties', textProps)
            .catch(err => {
                this.log.warn("Error toggling source: " + err);
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