import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger, LogManager } from "psst-log";
import { IApiWrapper, ICanReply, IPlaybackDevice } from "../SongRequest";
import { ISongInfo, MediaLibrary } from "./Playlist";
import { IMessage, Seconds } from "../../shared";

/**
 * partial SpotifyWebApi.PlayOptions
 */
interface MyPlayOptions {
    uris: string[];
    device_id?: string;
}

export class SongInfo implements ISongInfo {
    constructor(track: SpotifyApi.TrackObjectFull, requestBy: string, logger?: ILogger) {
        try {
            this.uri = track.uri;
            this.source = MediaLibrary.Spotify;
            this.title = track.name;
            this.artist = track.artists[0].name;
            this.requestedBy = requestBy;

            const firstImage = track.album.images[0];
            if(firstImage) {
                this.imageUrl = firstImage.url;
            }

        } catch (err) {
            const log = logger ? logger : LogManager.getLogger();
            log.error(err);
        }
    }

    uri: string = "";
    source: MediaLibrary = MediaLibrary.Unknown;
    title: string = "";
    artist: string = "";
    requestedBy: string = "";
    imageUrl: string = "";
}

export class SpotifyApiWrapper implements IApiWrapper {
    private readonly api: SpotifyWebApi;
    private readonly logger: ILogger;
    private readonly chat: ICanReply;
    private device: IPlaybackDevice | undefined;

    constructor(chat: ICanReply, api?: SpotifyWebApi, logger?: ILogger) {
        this.chat = chat;
        this.api = api ? api : new SpotifyWebApi();
        this.logger = logger ? logger : LogManager.getLogger();
    }

    public updateApiToken(token: string): void {
        this.api.setAccessToken(token);
    }

    public getSong(request: string, msg: IMessage): Promise<ISongInfo> {
        const spotifyRegex = /spotify:track:([A-Za-z0-9]+)|https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]+)/;
        const result = spotifyRegex.exec(request);
        if (result != null && result.length > 1) {
            let songId = result[1] ? result[1] : result[2];
            return this.requestSongById(songId, msg);
        } else {
            return this.requestSongByName(request, msg);
        }
    }

    public getVolume(): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            const state = await this.api.getMyCurrentPlaybackState();
            if (state.statusCode == 200) {
                const volumePercent = state.body.device.volume_percent || null;
                if (volumePercent) {
                    resolve(volumePercent);
                    return;
                }
            }
            
            reject("Can not get volume right now");            
        });
    }

    private updateVolume(device: SpotifyApi.UserDevice) {
        
    }

    public setVolume(volumePercent: number): void {
        this.api.setVolume(volumePercent)
            .then(() => {
                this.logger.log("Volume set to " + volumePercent);
            })
            .catch((err) => {
                this.logger.warn("Volume could not be set: ", JSON.stringify(err));
            });
    }

    private requestSongByName(request: string, msg: IMessage): Promise<ISongInfo> {
        return new Promise((resolve, reject) => {
            this.api.searchTracks(request)
                .then((result) => {
                    const track = result?.body.tracks?.items[0];
                    if (track != undefined) {
                        const song = new SongInfo(track, msg.from);
                        resolve(song);

                    }
                    return Promise.resolve(undefined);
                })
                .catch((err) => reject(err));
        });
    }

    private requestSongById(songId: string, msg: IMessage): Promise<ISongInfo> {
        return new Promise((resolve, reject) => {
            this.api.getTrack(songId)
                .then((track) => {
                    if (track && track.body) {
                        const song = new SongInfo(track.body, msg.from);
                        resolve(song);
                    }
                })
                .catch((err) => reject(err));
        });
    }

    public requestCurrentSongInfo(msg: IMessage) {
        this.api.getMyCurrentPlaybackState().then((state) => {
            if (state.body.is_playing) {
                return this.api.getMyCurrentPlayingTrack();
            }
        }).then((result) => {
            if (result) {
                const trackNameOpt = result.body.item?.name.toString();
                const trackName = trackNameOpt || "";
                const artistOpt = result.body.item?.artists[0].name.toString();
                const artist = artistOpt || "";

                if (trackName != "") {
                    this.chat.reply(`Current song: '${trackName}' from ${artist}`);
                }
            }
        }).catch((err) => {
            // What could possibly go wrong?
            this.logger.error("[!song] Could not retrieve song info.", JSON.stringify(err), JSON.stringify(msg));
        });
    }

    public async isPausedOrStopped(): Promise<boolean> {
        const state = await this.api.getMyCurrentPlaybackState();

        if (state.body.is_playing == undefined) {
            return Promise.reject("Unknown playback state");
        }
        else {
            return Promise.resolve(!state.body.is_playing);
        }
    }

    public async getRemainingTrackTime(): Promise<Seconds> {
        const state = await this.api.getMyCurrentPlaybackState();

        if (this.device && state.statusCode == 204) {
            // ASSUMPTION: if the device is set, nothing is done on the client
            return Promise.resolve(new Seconds(0));
        }

        if (state.body.is_playing == undefined) {
            return Promise.reject("Unknown playback state");
        } else {
            const duration = state.body.item?.duration_ms || -1;
            const progress = state.body.progress_ms || - 1;
            if (duration < 0 || progress < 0) {
                return Promise.resolve(new Seconds(0));
            }

            let remainingSeconds = (duration - progress) / 1000;
            if (state.body.is_playing) {
                const seconds = new Seconds(remainingSeconds);
                return Promise.resolve(seconds);
            }

            return Promise.resolve(new Seconds(0));
        }
    }

    public playNow(uri: string): void {

        let playOptions: MyPlayOptions = { uris: [uri] };
        if (this.device) {
            playOptions.device_id = this.device.id;
        }

        this.api.play(playOptions)
            .then()
            .catch((err) => {
                this.logger.warn("Could not start playback: ", err);
            });
    }

    public getPlaybackDevices(): Promise<IPlaybackDevice[]> {
        return new Promise<IPlaybackDevice[]>((resolve, reject) => {
            this.api.getMyDevices()
                .then((deviceObj) => {
                    const result: IPlaybackDevice[] = [];
                    deviceObj.body.devices.forEach((deviceItem) => {
                        if (deviceItem.id) {
                            const newItem = {
                                id: deviceItem.id,
                                name: deviceItem.name
                            };
                            result.push(newItem);
                        } else {
                            this.logger.log("Skipped device item with no id");
                        }
                    });
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    public setPlaybackDevice(device: IPlaybackDevice): void {
        this.device = device;
    }
}

export default SpotifyApiWrapper;