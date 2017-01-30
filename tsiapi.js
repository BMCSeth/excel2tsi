var https = require('https');

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

  if (options.logger == undefined) {
    this.logger = new TsiAPINullLogger();
  } else {
    this.logger = options.logger;
  }

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
//    firstRequestAt
//    lastRequestAt
//    firstResponceAt
//    lastResponceAt
  }

  var self=this;

  this.options = {
    protocol: 'https:',
    hostname: this.hostname,
    port: this.port,
    auth: this.email + ':' + this.apiToken,
    headers: {
        'Content-Type': 'application/json',
    }
  };

  /**
   * @author Martin Tauber <martin_tauber@bmc.com>
   */
  this._request = function(options, data) {
    if (self.statistics.firstRequestAt == undefined)
      self.statistics.firstRequestAt = new Date();

    self.statistics.lastRequestAt = new Date();

    var retries = 0;
    var request = https.request(options, function(result) {
      self.statistics.numberOfResponces++;
      if (self.statistics.firstResponceAt == undefined)
        self.statistics.firstResponceAt = new Date();

      self.statistics.lastResponceAt = new Date();

      if (result.statusCode >= 400) {
        self.statistics.numberOfErrors++;
      }

      self.handler.handleResponce(self, result);
    });

    request.on('error', function(e) {
      retries++;
      if (retries < self.maxRetries) {
        self.logger.info("Resending request. (retry=" + retries + ")" );
        self._request(options, data);
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
}

TsiAPI.prototype.createEvent = function(event) {
  var options = {
    path: '/v1/events',
    method: 'POST'
  }

  this._request(options, event);
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TsiAPI.prototype.createEvents = function(dataProvider, options) {
  this.logger.info("Creating events ...");
  if (options == undefined) options = {};

  var min = options.min == undefined ? 50 : options.min;
  var max = options.max == undefined ? 150 : options.max;
  var ratio = options.ratio == undefined ? (min + (max - min) / 2) : options.ratio;

  this.logger.info("Minimal backlog: " + min);
  this.logger.info("Maximal backlog: " + max);
  this.logger.info("Initial ratio: " + ratio);

  var self = this;

  var worker = function(dataProvider, ratio) {
    var i = 0;
    while (i < ratio) {
      data = dataProvider.next();
      if (typeof data === 'undefined') break;
        self.createEvent(data);
      i++;
    }

    // selftune the ratio
    var backlog = self.statistics.numberOfRequests - self.statistics.numberOfResponces;
    if ( backlog > max ) {
      ratio = Math.max(0, ratio - (backlog - max));
    } else if ( backlog + 10 < min + (max - min) / 2) {
      ratio = ratio + 10;
    } else if ( backlog - 10 > min + (max - min) / 2) {
      ratio = ratio - 10;
    }
    // this.logger.debug(min + ":" + max + " " + backlog + " " + ratio);
    self.ratio = ratio;

    if (typeof data !== 'undefined') setTimeout(worker, 1000, dataProvider, ratio);
  }

  worker(dataProvider, ratio);
}


/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function TsiAPIDefaultHandler() {
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TsiAPIDefaultHandler.prototype.handleRequest = function(handle) {
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
TsiAPIDefaultHandler.prototype.handleResponce = function(handle, result) {

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
TsiAPIDefaultHandler.prototype.handleError = function(handle, error) {
  handle.logger.error('problem with request: ' + error.message);
}

function TsiAPINullLogger() {
  this.info = function() {};
  this.error = function() {};
  this.debug = function() {};
}

exports.tsi = TsiAPI;
