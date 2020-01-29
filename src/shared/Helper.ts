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