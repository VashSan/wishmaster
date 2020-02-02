/** Use to convert seconds to other unit */
export class Seconds {
    private seconds: number;
    constructor(n: number) {
        this.seconds = n;
    }
    inMilliseconds() {
        return this.seconds * 1000;
    }
}

/** calls a handler only if the timeout expired */
export class IgnoreDuringTimeout<T> {
    private readonly timeout: Seconds;
    private readonly argument: T;
    private readonly handler: (arg: T) => void;
    private lastCall: Date | null = null;

    constructor(timeout: Seconds, argument: T, handler: (arg: T) => void) {
        this.timeout = timeout;
        this.argument = argument;
        this.handler = handler;
    }

    handle(): void {
        if (this.hasTimeoutExpired()) {
            this.lastCall = new Date();
            this.handler(this.argument);
        }
    }

    private hasTimeoutExpired(): boolean {
        if (this.lastCall == null) {
            return true;
        }

        const threshold = this.lastCall.getTime() + this.timeout.inMilliseconds();
        return Date.now() > threshold;
    }
}