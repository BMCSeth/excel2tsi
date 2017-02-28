/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function CsvDataProvider(options) {
  this.filename = options.filename;
  this.map = options.map;
  this.startAt = typeof options.startAt === 'undefined' ? 1 : options.startAt;
  this.endAt = typeof options.endAt === 'undefined' ? 0 : options.endAt;

  if (options.logger == undefined) {
    this.logger = new NullLogger();
  } else {
    this.logger = options.logger;
  }

}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
CsvDataProvider.prototype.next = function() {
}

function NullLogger() {
  this.info = function() {};
  this.error = function() {};
  this.debug = function() {};
}

exports.provider = CsvDataProvider;
