
import { Startup } from "./src/Startup"

process.on('unhandledRejection', error => {
    console.error('unhandledRejection: ');
    console.log(error);
});

const startup = new Startup();
startup.main();