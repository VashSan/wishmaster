import { IFeatureResponse, ResponseCallback, IFeature } from "../shared/MessageProcessor";
import { IConfiguration } from "../shared";
import { IMessage } from "../shared/ChatClient";

export abstract class FeatureBase implements IFeature {
    private sendResponseCallback: ResponseCallback | null = null;

    protected config: IConfiguration;

    constructor(config: IConfiguration) {
        this.config = config;
    }

    public getTrigger(): string {
        return "";
    }

    public abstract act(message: IMessage): void;

    public setup(callback: ResponseCallback): void {
        this.sendResponseCallback = callback;
    }

    protected createResponse(text: string): IFeatureResponse {
        let message = { 
            channel: this.config.getChannel(), 
            text: text, 
            from: this.config.getNickname() 
        };
        let response = { message: message };
        return response;
    }

    protected sendResponse(response: IFeatureResponse) {
        if (this.sendResponseCallback != null) {
            this.sendResponseCallback(null, response);
        }
    }
}