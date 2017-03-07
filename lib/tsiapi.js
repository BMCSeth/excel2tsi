var https = require('https');
const NullLogger = require('./nullLogger').logger;

/**
 * This class implements the interface to TrueSight Pulse. You need to
 * instanciate this class to be able to communicate with the TrueSight pulse
 * server. During the instanciatetion you need to specify the options
 *   email - the email address used to identify at the truesight server
 *   apiToken - the apiToken used to identify at the truesight server
 *
 * optionally you can specify the following options:
 *   hostname - the hostname of the truesight server
 *   port - the portnumber of the truesight server
 *   handler - the handler to be used to handle requests, responces and errors
 *   maxRetries - maximum number of retries in case a request returns an error
 *
 * @class
 * @constructor
 * @param {object} options
 * @author Martin Tauber <martin_tauber@bmc.com>
 */

function TsiAPI(options) {
  this.email = options.email;
  this.apiToken = options.apiToken;
  this.hostname = options.hostname != undefined ? options.hostname : 'api.truesight.bmc.com';
  this.port = options.port != undefined ? options.port : 443;
  this.handler = options.handler != undefined ? options.handler : new TsiAPIDefaultHandler();

  this.maxRetries = options.maxRetries != undefined ? options.maxRetries : 5;

  this.logger = options.logger == undefined ? new NullLogger() : options.logger;

  this.logger.info("Initialized api with the following values:")
  this.logger.info("email: " + this.email);
  this.logger.info("apiToken: " + this.apiToken);
  this.logger.info("hostname: " + this.hostname);
  this.logger.info("port: " + this.port);
  this.logger.info("Max retries: " + this.maxRetries);

  this.statistics = {
    numberOfRequests: 0,
    numberOfResponces: 0,
    numberOfErrors: 0,
    numberOfFatalErrors: 0
    //  firstRequestAt
    //  lastRequestAt
    //  firstResponceAt
    //  lastResponceAt
  }

  var self = this;

  /**
   * Internal method so send a request to tsi.
   * @param {opject} options
   * @param {number} retry number of retries in case of an error
   * @param {object} data payload to send to the server
   * @author Martin Tauber <martin_tauber@bmc.com>
   */
  this._request = function (options, retry, data) {
    if (self.statistics.firstRequestAt == undefined)
      self.statistics.firstRequestAt = new Date();

    self.statistics.lastRequestAt = new Date();

    var request = https.request(options, function (result) {
      self.statistics.numberOfResponces++;
      if (self.statistics.firstResponceAt == undefined)
        self.statistics.firstResponceAt = new Date();

      self.statistics.lastResponceAt = new Date();

      if (result.statusCode >= 400) {
        self.statistics.numberOfErrors++;
      }

      self.handler.handleResponce(self, result);
    });

    request.on('error', function (e) {
      retry++;
      if (retry <= self.maxRetries) {
        self.logger.info("Resending request. (retry=" + retry + ")");
        self._request(options, retry, data);
      } else {
        self.statistics.numberOfFatalErrors++;
        self.handler.handleError(self, e);
      }
    });

    request.write(JSON.stringify(data));
    request.end();

    self.statistics.numberOfRequests++;
    self.handler.handleRequest(self);
  }

  this.createBatch = function (dataProvider, options) {
    options.logger = options.logger == undefined ? this.logger : options.logger;

    return new TsiAPIBatch(this, dataProvider, options);
  }
}

TsiAPI.prototype.createEvent = function (event, options) {
  if (options == undefined) options = {};
  var fake = options.fake == undefined ? false : options.fake;

  if (fake) {
    this.logger.info("Creating Event: " + JSON.stringify(event))
  } else {
    var options = {
      protocol: 'https:',
      hostname: this.hostname,
      port: this.port,
      auth: this.email + ':' + this.apiToken,
      headers: {
        'Content-Type': 'application/json',
      },
      path: '/v1/events',
      method: 'POST'
    }

    this._request(options, 0, event);
  }
}



/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function TsiAPIDefaultHandler() {
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TsiAPIDefaultHandler.prototype.handleRequest = function (handle) {
  if (handle.statistics.numberOfRequests % 1000 == 0) {
    handle.logger.info("Requests: " + handle.statistics.numberOfRequests +
      " Responces: " + handle.statistics.numberOfResponces +
      " Backlog: " + (handle.statistics.numberOfRequests - handle.statistics.numberOfResponces) +
      " Ratio: " + handle.ratio
    );
  }
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TsiAPIDefaultHandler.prototype.handleResponce = function (handle, result) {

  if (result.statusCode >= 400) {
    handle.logger.error('Status: ' + result.statusCode);
    handle.logger.error('Headers: ' + JSON.stringify(result.headers));
    result.setEncoding('utf8');
    result.on('data', function (body) {
      handle.logger.error('Body: ' + body);
    });
  }
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TsiAPIDefaultHandler.prototype.handleError = function (handle, error) {
  handle.logger.error('problem with request: ' + error.message);
}

class TsiAPIBatch {
  constructor(api, dataProvider, options) {
    if (options == undefined) options = {};

    this.min = options.min == undefined ? 50 : options.min;
    this.max = options.max == undefined ? 150 : options.max;
    this.ratio = options.ratio == undefined ? (this.min + (this.max - this.min) / 2) : options.ratio;
    this.fake = options.fake == undefined ? false : options.fake;

    this.dataProvider = dataProvider;
    this.dataProviderPaused = false;

    this.logger = options.logger == undefined ? new NullLogger() : options.logger;

    this.api = api;

    this.state = "paused";
    this.sendPerInterval = 0;
    this.buffer = new Array();

    this.stopHandler = this.stop.bind(this);
    this.processDataHandler = this.processData.bind(this);

    this.ticks = 0;
  }

  start() {
    this.logger.info("Starting TsiAPIBatch with the following options:");
    this.logger.info("Minimal backlog: " + this.min);
    this.logger.info("Maximal backlog: " + this.max);
    this.logger.info("Initial ratio: " + this.ratio);
    this.logger.info("fake: " + this.fake);

    this.dataProvider.on('eod', this.stopHandler);
    this.dataProvider.on('data', (data) => this.processDataHandler);
    this.interval = setInterval(this.tick, 1000);
  }

  stop() {
    this.dataProvider.removeListener('eod', this.stopHandler);
    this.dataProvider.removeListener('data', this.processDataHandler);
    clearInterval(this.interval);
  }

  pause() {
    this.state = "paused";

    if (!this.dataProviderPaused) {
      this.dataProvider.pause();
      this.dataProviderPaused = true;
    }
  }

  resume() {
    this.state = "running";

    if (this.dataProviderPaused) {
      this.dataProvider.resume();
      this.dataProviderPaused = false;
    }
  }

  tick() {
    // selftune the ratio
    var backlog = this.statistics.numberOfRequests - this.statistics.numberOfResponces;
    if (backlog > this.max) {
      this.ratio = Math.max(0, this.ratio - (backlog - this.max));
    } else if (backlog + 10 < this.min + (this.max - this.min) / 2) {
      this.ratio = this.ratio + 10;
    } else if (backlog - 10 > this.min + (this.max - this.min) / 2) {
      this.ratio = this.ratio - 10;
    }

    this.sendPerInterval = 0;
    this.state = "running";

    while (this.buffer.length > 0 && this.state != "paused") {
      data = this.buffer.pop();
      this.processData(data);
    }

    if (this.state != "paused") this.resume();

    this.ticks++;

    if (this.ticks % 10 == 0) {
      this.logger.info("requests: " + this.statistics.numberOfRequests +
        " responces: " + this.statistics.numberOfResponces +
        " backlog: " + backlog +
        " ratio: " + this.ratio +
        " buffered: " + this.buffer.length);
    }
  }

  processData() {
    if (this.state == "paused") {
      this.buffer.push(data);
    } else {
      this.api.createEvent(data, {
        fake: fake
      });

      this.sendPerInterval++;

      if (this.sendPerInterval >= ratio) {
        this.pause();
      }
    }
  }
}

exports.TsiAPI = TsiAPI;
