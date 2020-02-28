
import { Startup } from "./src/Startup"

process.on('unhandledRejection', error => {
    console.error('unhandledRejection: ');
    console.log(error);
});

const startup = new Startup();

let args = process.argv.slice(2);
startup.main(args);