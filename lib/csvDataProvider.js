const EventEmitter = require('events');
const Map = require('./map').map;
const log4js = require('log4js');
const NullLogger = require('./nullLogger').logger;

class CsvDataProvider extends EventEmitter {
  constructor(options) {
    // Calls the stream.Writable() constructor
    super(options);

    this.filename = options.filename;
    this.delimiter = options.delimiter == undefined ? ',' : options.delimiter;
    this.map = new Map(options.map, log4js.getLogger("Map"));

    this.startAt = typeof options.startAt === 'undefined' ? 1 : options.startAt;
    this.endAt = typeof options.endAt === 'undefined' ? 0 : options.endAt;

    this.logger = options.logger == undefined ? new NullLogger() : options.logger;

    var self = this;

    this.logger.info("Using CSV provider with the following options:");    
    this.logger.info("Filename: " + this.filename);
    this.logger.info("Delimiter: '" + this.delimiter + "'");
    this.logger.info("Starting at: " + this.startAt);
    this.logger.info("Ending at: " + (this.endAt == 0 ? "end of file" : this.endAt));

    this.lineno = 0;

    this.processLine = CsvDataProvider.prototype.processLine.bind(this);
  }

  processLine(line) {
    this.lineno++;

    var data = line.split(this.delimiter);
    var values = {};

    for (var i=0; i<data.length; i++) {
      values[i + 1] = data[i];  
    }

    var result = this.map.resolve(values);

    if (this.lineno >= this.startAt) {
      this.emit('data', result);
    }

    if (this.endAt != 0 && this.lineno >= this.endAt) {
      this.stop();
    }
  }

  stop() {
      this.logger.info("Stopping CSV data provider ...");
      this.reader.removeAllListeners('line');
      this.emit('eod');
  }

  start() {
    this.logger.info("Starting CSV data provider ...");
    // read the csvfile line by line
    this.reader = require('readline').createInterface({
      input: require('fs').createReadStream(this.filename)
    });

    this.reader.on('line', this.processLine);
  }

  pause() {
    this.reader.pause();
  }

  resume() {
    this.reader.resume();
  }
}

exports.provider = CsvDataProvider;
