///<reference path="./src/sub/irc-types/irc.d.ts" />

import * as MP from "./src/MessageProcessor";
import * as IRC from "irc";
import { Loopback } from "./src/Features/Loopback";
import { Configuration } from "./src/Configuration";
import { Harvest } from "./src/Features/Harvest";
import { isNullOrUndefined } from "util";

class Startup {
    private static msgProcessor: MP.MessageProcessor;

    public static main(): number {

        let config = new Configuration();


        let client = new IRC.Client(
            config.server,
            config.nickname,
            {
                autoConnect: false,
                password: config.password
            }
        );

        let featureList = new Set<MP.IFeature>([
            // new Loopback(""),
            // new Loopback("test"),
            new Harvest(config)
        ]);

        this.msgProcessor = new MP.MessageProcessor(client);
        for (const f of featureList) {
            this.msgProcessor.registerFeature(f);
        }

        client.addListener("raw", message => {
            let cmd: string = message.command;
            
            if(cmd.startsWith("@")){ // thats a twitch chat tagged message something our lib does not recongnize 
                let payload: string = message.args[0];

                let x: string[] = payload.split(" ", 2); // need to check command
                if(x[1].toUpperCase() == "PRIVMSG"){
                    this.taggedMessageReceived(payload, cmd);
                    return;
                }
            }

            if(cmd.toUpperCase() != "PRIVMSG"){
                console.log("raw: ", message);
            }
            
        });

        client.addListener("error", message => {
            console.error("IRC client error: ", message);
        });

        client.addListener("message", (from, to, message) => {
            this.messageReceived(from, to, message);
        });

        client.connect(0, () => {
            client.send("CAP REQ", "twitch.tv/tags");
            client.join(config.channel);
        });

        return 0;
    }

    private static taggedMessageReceived(payload: string, tags: string){
        let separatorPos = payload.indexOf(":"); // left is meta data, right is message text
        let metaData = payload.substring(0, separatorPos);
        

        let metaDataList = metaData.split(" ");

        let fromRaw = metaDataList.shift();
        let from = fromRaw.substring(0, fromRaw.indexOf("!"));

        let command = metaDataList.shift();
        if(command.toUpperCase() != "PRIVMSG"){
            throw "Wrong handler was called";
        }

        let to = metaDataList.shift();
        let text = payload.substring(separatorPos + 1);
        this.messageReceived(from, to, text, tags);
    }

    private static messageReceived(from: string, to: string, message: string, tagsString?: string){
        let m;
        if(!isNullOrUndefined(tagsString)){
            let t = new MP.Tags(tagsString);
            m = new MP.Message({from: from, channel: to, text: message}, t);
        }
        else {
            m = new MP.Message({from: from, channel: to, text: message});
        } 

        console.log(`${to} ${from}: ${message}`);

        this.msgProcessor.process(m);
    }
}

Startup.main();