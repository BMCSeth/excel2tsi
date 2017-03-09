const fs = require('fs');
const moment = require('moment');
const NullLogger = require('./nullLogger').logger;

class Map {
    constructor(map, logger) {
        this.map = JSON.parse(fs.readFileSync(map, 'utf8'));
        this.logger = logger == undefined ? new NullLogger() : logger;
    }

    resolve(values, map) {
        map = map == undefined ? this.map : map;

        var result;

        // the content of the map entry is an array
        if (Object.prototype.toString.call(map) === '[object Array]') {
            result = [];
            for (var key in map) {
                result.push(this.resolve(values, map[key]));
            }

            // the content of this map entry is an object
        } else if (typeof map === 'object') {
            result = {};
            for (var index in map) {
                result[index] = this.resolve(values, map[index]);
            }

            // the content is neither an object or an array so we will just copy it
        } else {
            result = map;

            // the map field can have the format '/<regex>/:...' in this case
            // the regex is used to validate
            var regex; 
            var match = result.match(/^\/(.*)\/:(.*)/);
            if (match) {
                result = match[2];
                regex = match[1];
            }


            // replace the placeholders 
            match = result.match(/[$][{]([^}]*)[}]/);
            if (match != undefined) {
                result = result.split(match[0]).join(values[match[1]] == undefined ? '' : values[match[1]]);
            }


            // match function toEpoche()
            match = result.match(/toEpoche\(\'([^']*)\',\s*\'([^']*)\'\)/);
            if (match != undefined) {
                var date = this.toEpoche(match[1], match[2]);
                result = result.replace(match[0], date);
            }

            // match function toIsoDate()
            match = result.match(/toIsoDate\(\'([^']*)\',\s*\'([^']*)\'\)/);
            if (match != undefined) {
                var date = this.toIsoDate(match[1], match[2]);
                result = result.replace(match[0], date);
            }

            if (regex && result.match(new RegExp(regex)) == null) throw "Validation failed for map '"+map+"' value '"+result+"'";
        }

        return result;
    }

    toEpoche(date, format) {
        if (date ==='') return date;
        return moment(date, format).unix();
    }

    toIsoDate(date, format) {
        if (date === '') return date;
        return moment(date, format).toISOString();
    }
}

exports.map = Map;