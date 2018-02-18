import Nedb = require("nedb");

export interface Database {
    users: Nedb;
    log: Nedb;
}