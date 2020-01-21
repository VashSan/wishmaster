import { IFeatureResponse, ResponseCallback } from "../MessageProcessor";
import { Configuration } from "../shared";

export abstract class FeatureBase {  
    private sendResponseCallback: ResponseCallback | null = null;

    protected config: Configuration;

    constructor(config: Configuration){
        this.config = config;
    }

    public setup(callback: ResponseCallback): void {
        this.sendResponseCallback = callback;
    }

    protected createResponse(text: string): IFeatureResponse {
        let m = { channel: this.config.channel, text: text, from: this.config.nickname };
        let response = { message: m };
        return response;
    }

    protected sendResponse(response: IFeatureResponse){
        if (this.sendResponseCallback != null) {
            this.sendResponseCallback(null, response);
        }
    }
}