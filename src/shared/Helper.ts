/** Use to convert seconds to other unit */

class TimeBase {
    protected milliseconds: number;
    constructor(ms: number) {
        this.milliseconds = ms;
    }
    public inMilliseconds() {
        return this.milliseconds;
    }
    public toSeconds(): Seconds {
        return new Seconds(this.milliseconds / 1000);
    }
    public toMinutes(): Seconds {
        return new Minutes(this.milliseconds / (1000 * 60));
    }
    public toHours(): Seconds {
        return new Hours(this.milliseconds / 1000 * 60 * 60);
    }
}

export class Seconds extends TimeBase {
    constructor(n: number) {
        super(n * 1000);
    }
}

export class Minutes extends TimeBase {
    constructor(n: number) {
        super(n * 60 * 1000);
    }
}

export class Hours extends TimeBase {
    constructor(n: number) {
        super(n * 60 * 60 * 1000);
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

    handle(overrideTimeout?: boolean): void {
        if (overrideTimeout || this.hasTimeoutExpired()) {
            this.lastCall = new Date();
            this.handler(this.argument);
        }
    }

    private hasTimeoutExpired(): boolean {
        if (this.lastCall == null) {
            return true;
        }

        const threshold = this.lastCall.getTime() + this.timeout.inMilliseconds();
        const now = Date.now();
        return now >= threshold;
    }
}

export class Generate {
    /**
     * Generates a random string containing numbers and letters
     * @param  {number} length The length of the string
     * @return {string} The generated string
     */
    public static RandomString(length: number): string {
        var text = '';
        var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    };

    public static Base64(source: string): string {
        const buffer = Buffer.from(source);
        return buffer.toString('base64');
    }
}

export class ArrayManip {
    /**
     * Randomize array in-place using Durstenfeld shuffle.
     */
    public static Shuffle<T>(theArray: T[]) {
        for (var i = theArray.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = theArray[i];
            theArray[i] = theArray[j];
            theArray[j] = temp;
        }
    }
}