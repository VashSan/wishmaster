import * as mp from "../MessageProcessor";

export class Loopback implements mp.IPlugin {
    trigger: string;

    constructor(trigger:string){
        this.trigger = trigger;
    }

    act(msg: mp.Message) : mp.IPluginResponse {
        let str : string = msg.toString();
        console.log(str);

        return null;
    }
} 

export default Loopback;