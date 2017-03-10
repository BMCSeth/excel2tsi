const log4js = require('log4js');

log4js.loadAppender('file');

class Log4jsWrapper {
    constructor() {
        this.logger = {};
    }

    getLogger(name) {
        if (this.logger[name] == undefined) {
            if (this.filename) {
                log4js.addAppender(log4js.appenders.file(this.filename), name);
            }

            this.logger[name] = log4js.getLogger(name);

            this.logger[name].setLevel(this.level);
        }

        return this.logger[name];
    }

    setLevel(level) {
        this.level = level;
    }

    setFilename(name) {
        this.filename = name;
    }
}

const log4jsWrapper = new Log4jsWrapper();

exports.wrapper = log4jsWrapper;