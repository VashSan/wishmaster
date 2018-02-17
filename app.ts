///<reference path="./src/sub/irc-types/irc.d.ts" />

import * as MP from "./src/MessageProcessor";
import * as IRC from "irc";
import { Loopback } from "./src/Features/Loopback";
import { Configuration } from "./src/Configuration";
import { Harvest } from "./src/Features/Harvest";

class Startup {
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
            new Loopback(""),
            new Loopback("test"),
            new Harvest(config)
        ]);
        
        let proc = new MP.MessageProcessor(client);
        for (const f of featureList) {
            proc.registerFeature(f);
        }

        client.addListener("raw", message => {
            console.log("raw: ", message);
        });

        client.addListener("error", message => {
            console.log("error: ", message);
        });

        client.addListener("message", (from, to, message) => {
            let m = new MP.Message({from: from, channel: to, text: message});
            proc.process(m);
        });

        client.connect(0, () => {
            client.join(config.channel);
        });

        return 0;
    }
}

Startup.main();