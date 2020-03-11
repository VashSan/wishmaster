import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger, LogManager } from "psst-log";
import { IApiWrapper, IPlaybackDevice } from "../SongRequest";
import { ISongInfo, MediaLibrary } from "./Playlist";
import { IMessage, Seconds, ICurrentSongConfig } from "../../shared";

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
            if (firstImage) {
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
    private device: IPlaybackDevice | undefined;

    constructor(api?: SpotifyWebApi, logger?: ILogger) {
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
                        const song = new SongInfo(track, msg.from, this.logger);
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
                        const song = new SongInfo(track.body, msg.from, this.logger);
                        resolve(song);
                    }
                })
                .catch((err) => reject(err));
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

    public getPlaylist(id: string): Promise<ISongInfo[]> {
        return new Promise<ISongInfo[]>(async (resolve, reject) => {
            try {
                const result: ISongInfo[] = [];

                const response = await this.api.getPlaylistTracks(id);
                response.body.items.forEach((trackItem: SpotifyApi.PlaylistTrackObject)=>{
                    const song = new SongInfo(trackItem.track, "", this.logger);
                    result.push(song);
                });
                
                resolve(result);
            }
            catch (err) {
                reject(err)
            }
        });

    }
}

export default SpotifyApiWrapper;