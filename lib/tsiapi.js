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
class TsiAPI {
  constructor(options) {
    this.email = options.email;
    this.apiToken = options.apiToken;
    this.hostname = options.hostname != undefined ? options.hostname : 'api.truesight.bmc.com';
    this.port = options.port != undefined ? options.port : 443;

    this.maxRetries = options.maxRetries != undefined ? options.maxRetries : 5;

    this.logger = options.logger == undefined ? new NullLogger() : options.logger;

    this.logger.info("Initialized api with the following values:")
    this.logger.info("email: " + this.email);
    this.logger.info("apiToken: " + this.apiToken);
    this.logger.info("hostname: " + this.hostname);
    this.logger.info("port: " + this.port);
    this.logger.info("Max retries: " + this.maxRetries);

  }

  /**
   * Internal method so send a request to tsi.
   * @param {opject} options
   * @param {number} retry number of retries in case of an error
   * @param {object} data payload to send to the server
   * @author Martin Tauber <martin_tauber@bmc.com>
   */
  _request(options, retry, data, handler) {
    var request = https.request(options, function (result) {
      if (handler != undefined) handler.handleResponce(result);
    });

    request.on('error', function (e) {
      retry++;
      if (retry <= self.maxRetries) {
        self.logger.info("Resending request. (retry=" + retry + ")");
        self._request(options, retry, data);
      } else {
        if (handler != undefined) handler.handleError(e);
      }
    });

    request.write(JSON.stringify(data));
    request.end();

    if (handler != undefined) handler.handleRequest(options, data);
  }

  createBatch(dataProvider, options) {
    options.logger = options.logger == undefined ? this.logger : options.logger;

    return new TsiAPIBatch(this, dataProvider, options);
  }

  createEvent(event) {
    if (options == undefined) options = {};

    var requestOptions = {
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

    this._request(requestOptions, 0, event, options.handler);
  }
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

    // initialize the statistics
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

    this.paused = false;
    this.sendPerInterval = 0;
    this.buffer = new Array();

    this.stopHandler = this.stop.bind(this);
    this.processDataHandler = this.processData.bind(this);
    this.tickHandler = this.tick.bind(this);

    this.ticks = 0;
  }

  start() {
    this.logger.info("Starting TsiAPIBatch with the following options:");
    this.logger.info("Minimal backlog: " + this.min);
    this.logger.info("Maximal backlog: " + this.max);
    this.logger.info("Initial ratio: " + this.ratio);
    this.logger.info("fake: " + this.fake);

    this.dataProvider.on('eod', this.stopHandler);
    this.dataProvider.on('data', this.processDataHandler);
    this.interval = setInterval(this.tickHandler, 1000);
  }

  stop() {
    this.dataProvider.removeListener('eod', this.stopHandler);
    this.dataProvider.removeListener('data', this.processDataHandler);
    clearInterval(this.interval);

    this.logger.info("First request at: " + this.statistics.firstRequestAt);
    this.logger.info("Last responce at: " + this.statistics.lastResponceAt);
    this.logger.info("Number of Requests: " + this.statistics.numberOfRequests);
    this.logger.info("Number of Responces: " + this.statistics.numberOfResponces);
    this.logger.info("Number of Errors: " + this.statistics.numberOfErrors);
    this.logger.info("Number of Fatal Errors: " + this.statistics.numberOfFatalErrors);
    this.logger.info("Avg Responces / sec: " + 1000 / (this.statistics.lastResponceAt - this.statistics.firstRequestAt) * this.statistics.numberOfResponces);

  }

  pause() {
    this.paused = true;

    if (!this.dataProviderPaused) {
      this.dataProvider.pause();
      this.dataProviderPaused = true;
    }
  }

  resume() {
    this.paused = false;

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
    this.paused = false;

    var data;
    // Loop through the buffer and process the data 
    while (this.buffer.length > 0 && !this.paused) {
      data = this.buffer.pop();
      this.processData(data);
    }

    // if we didn't pause again we are going to resume
    // this will cause the data provider to resume as well
    if (!this.paused) this.resume();

    this.ticks++;

    // print some statistical data every 10 seconds
    if (this.ticks % 10 == 0) {
      this.logger.info("requests: " + this.statistics.numberOfRequests +
        " responces: " + this.statistics.numberOfResponces +
        " backlog: " + backlog +
        " ratio: " + this.ratio +
        " buffered: " + this.buffer.length);
    }
  }

  processData(data) {
    if (this.paused) {
      this.buffer.push(data);
    } else {
      if (!this.fake) {
        this.api.createEvent(data, {
          fake: this.fake,
          handler: this
        });
      }

      this.sendPerInterval++;

      if (this.sendPerInterval >= this.ratio) {
        this.pause();
      }
    }
  }

  /**
   * @author Martin Tauber <martin_tauber@bmc.com>
   */
  handleResponce(result) {
    var now = Date();

    this.statistics.numberOfResponces++;
    this.statistics.lastResponceAt = now;
    if (this.statistics.firstResponceAt == undefined) this.statistics.firstResponceAt = now;

    if (result.statusCode >= 400) {
      this.statistics.numberOfErrors++;

      var self = this;

      this.logger.error('Status: ' + result.statusCode);
      this.logger.error('Headers: ' + JSON.stringify(result.headers));

      result.setEncoding('utf8');
      result.on('data', function (body) {
        self.logger.error('Body: ' + body);
      });
    }
  }

  /**
   * @author Martin Tauber <martin_tauber@bmc.com>
   */
  handleError(error) {
    this.numberOfFatalErrors++;

    this.logger.error('problem with request: ' + error.message);
  }

  handleRequest(options, data) {
    var now = Date();

    this.statistics.numberOfRequests++;
    this.statistics.lastRequestAt = now;
    if (this.statistics.firstRequestAt == undefined) this.statistics.firstRequestAt = now;
  }

}

exports.TsiAPI = TsiAPI;
