const fs = require('fs');
const moment = require('moment');
const vm = require('vm');

const NullLogger = require('./nullLogger').logger;

class Map {
    constructor(map, logger) {
        this.map = JSON.parse(fs.readFileSync(map, 'utf8'));
        this.logger = logger == undefined ? new NullLogger() : logger;

        this.cache = {};
    }

    resolve(values, map, id, context) {
        var d = new Date();
        var e,f;
        if (context == undefined) {
            values.toIsoDate = toIsoDate;
            values.toEpoche = toEpoche;

            context = vm.createContext(values);
        }

        map = map == undefined ? this.map : map;

        var result;

        // the content of the map entry is an array
        if (Object.prototype.toString.call(map) === '[object Array]') {
            result = [];
            for (var index in map) {
                result.push(this.resolve(values, map[index], (id == undefined ? index : id + "." + index), context));
            }

            // the content of this map entry is an object
        } else if (typeof map === 'object') {
            result = {};
            for (var key in map) {
                result[key] = this.resolve(values, map[key], (id == undefined ? key : id + "." + key), context);
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

            if (this.cache[id] == undefined) {
                match = result.match(/^\'([^']*)\'$/);
                if (match) {
                    this.cache[id] = {
                        type: 'const',
                        value: match[1]
                    }
                } else {

                    match = result.match(/^[_a-zA-Z][_\-a-zA-Z0-9]*$/);
                    if (match) {
                        this.cache[id] = {
                            type: 'variable',
                            value: result
                        }
                    } else {
                        this.cache[id] = {
                            type: 'script',
                            value: new vm.Script(result)
                        }
                    }
                }
            }

            if (this.cache[id].type == 'const') {
                result = this.cache[id].value;
            } else if (this.cache[id].type == 'variable') {
                result = values[this.cache[id].value];
            } else {
                try {
                    e = new Date();
                    result = this.cache[id].value.runInContext(context);
                    f = new Date() - e;
                } catch (error) {
                    this.logger.error(error);
                }
            }

            if (regex && result.match(new RegExp(regex)) == null) throw "Validation failed for map '" + map + "' value '" + result + "'";

        }
        var c = new Date() -d;
if (c > 100) console.log(id+"="+c+":"+f+">>>"+y);
        return result;
    }
}
var x,y;

function toEpoche(date, format) {
    if (date === '') return date;
    return moment(date, format).unix();
}

function toIsoDate(date, format) {
    x= new Date();
    var r = moment(date, format).toISOString();
    y = new Date() - x;
    return r;
}

function doEval(parameter, values) {
    // first we are going to convert the array of values
    // to local variables
    var cmd = ''
    for (key in values) {
        cmd = cmd + "var " + key + "='" + values[key].replace(/'/, '\\\'') + "';";
    }

    return eval("{" + cmd + "String(" + parameter + ")}");
}


exports.map = Map;