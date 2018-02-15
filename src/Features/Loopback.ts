import * as mp from "../MessageProcessor";

export class Loopback implements mp.IFeature {
    trigger: string;

    constructor(trigger:string){
        this.trigger = trigger;
    }

    act(msg: mp.Message) : mp.IFeatureResponse {
        let str : string = msg.toString();
        console.log(str);

        return null;
    }
} 

export default Loopback;