var XLSX = require('xlsx');
var https = require('https');
var log4js = require('log4js');
var logger = log4js.getLogger();

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
 *
 * @class
 * @constructor
 * @param {object} options
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function TSPulseAPI(options) {
  this.email = options.email;
  this.apiToken = options.apiToken;
  this.hostname = options.hostname != undefined ? options.hostname : 'api.truesight.bmc.com';
  this.port = options.port != undefined ? options.port : 443;
  this.handler = options.handler != undefined ? options.handler : new TSPulseAPIDefaultHandler();

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

  this._request = function(data) {
    if (self.statistics.firstRequestAt == undefined)
      self.statistics.firstRequestAt = new Date();

    self.statistics.lastRequestAt = new Date();

    var request = https.request(self.options, function(result) {
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
      self.statistics.numberOfFatalErrors++;
      self.handler.handleError(e);
    });

    request.write(JSON.stringify(data));
    request.end();

    self.statistics.numberOfRequests++;
    self.handler.handleRequest(self);
  }
}

TSPulseAPI.prototype.createEvent = function(data) {
  this.options.path = '/v1/events';
  this.options.method = 'POST';

  this._request(data);
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TSPulseAPI.prototype.createEvents = function(dataProvider, options) {
  logger.info("Creating events ...");
  if (options == undefined) options = {};

  var ratio = options.ratio == undefined ? 80 : options.ratio;
  var min = options.min == undefined ? 50 : options.min;
  var max = options.max == undefined ? 150 : options.max;

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
    // logger.debug(min + ":" + max + " " + backlog + " " + ratio);
    self.ratio = ratio;

    if (typeof data !== 'undefined') setTimeout(worker, 1000, dataProvider, ratio);
  }

  worker(dataProvider, ratio);
}


/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function TSPulseAPIDefaultHandler() {
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TSPulseAPIDefaultHandler.prototype.handleRequest = function(handle) {
  if (handle.statistics.numberOfRequests % 1000 == 0) {
    logger.info("Requests: " + handle.statistics.numberOfRequests +
       " Responces: " + handle.statistics.numberOfResponces +
       " Backlog: " + (handle.statistics.numberOfRequests - handle.statistics.numberOfResponces) +
       " Ratio: " + handle.ratio
     );
  }
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TSPulseAPIDefaultHandler.prototype.handleResponce = function(handle, result) {

  if (result.statusCode >= 400) {
    logger.error('Status: ' + result.statusCode);
    logger.error('Headers: ' + JSON.stringify(result.headers));
    result.setEncoding('utf8');
    result.on('data', function (body) {
      logger.error('Body: ' + body);
    });
  }
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TSPulseAPIDefaultHandler.prototype.handleError = function(error) {
  logger.error('problem with request: ' + error.message);
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function ExcelDataProvider(options) {
  this.filename = options.filename;
  this.map = options.map;
  this.startAt = typeof options.startAt === 'undefined' ? 1 : options.startAt;
  this.endAt = typeof options.endAt === 'undefined' ? 0 : options.endAt;

  logger.info("Reading Excel file: " + this.filename + " ...");
  this.workbook = XLSX.readFile(this.filename);
  this.sheet = this.workbook.Sheets[Object.keys(this.workbook.Sheets)[0]];
  this.currentRow = this.startAt;

  this.mapper = function(map, sheet, row) {
    var result = {};

    // loop throw all the entries in the map
    for(var key in map) {
      // the content of the map entry is an array
      if( Object.prototype.toString.call( map[key] ) === '[object Array]' ) {
        result[key] = [];
        for (var content in map[key]) {
          if ( Object.prototype.toString.call( map[key][content] ) === '[object Array]' ) {
            result[key].push(this.mapper(map[key][content], sheet, row));

          } else if ( typeof map[key][content] === 'object') {
            result[key].push(this.mapper(map[key][content], sheet, row));

          } else
            result[key].push(map[key][content]);
        }

      // the content of this map entry is an object
      } else if (typeof map[key] === 'object') {
        result[key] = this.mapper(map[key], sheet, row);

      // the content is neither an object or an array so we will just copy it
      } else {
        // TODO needs to be more waterproove
        if ( /^[A-Z][A-Z]?$/.test(map[key]) ) {
          result[key] = sheet[map[key] + row].w;
        } else {
          result[key] = map[key];
        }
      }
    }

    return result;
  }
}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
ExcelDataProvider.prototype.next = function() {

  // TODO needs to be more waterproove
  if (this.sheet['A' + this.currentRow] === undefined
    || this.sheet['A' + this.currentRow] == ''
    || (this.endAt != 0 && this.currentRow > this.endAt)) return;

  return this.mapper(this.map, this.sheet, this.currentRow++);
}

var map = {
  source: {
    ref: 'Computacenter',
    type: 'Computacenter',
    name: 'Computacenter'
  },
  sender: {
    ref: 'Computacenter',
    type: 'Computacenter',
    name: 'Computacenter'
  },
  fingerprintFields: ['incident_id'],
  message: 'N',
  title: 'N',
  eventClass: 'Incident',
  status: 'D',
  severity: 'E',
  createdAt: 'A',
  properties: {
    app_id: 'Computacenter',
    incident_id: 'C',
    u_ge_hr_industry_group: 'B',
    state: 'D',
    priority: 'E',
    contact_type: 'F',
    city: 'G',
    country: 'H',
    opened_at: 'I',
    sys_created_on: 'J',
    u_resolved_time: 'K',
    assignment_group: 'L',
    reassignment_count: 'M',
    short_description: 'N',
    close_notes: 'O',
    open_ci: 'P',
    cmdb_ci: 'Q',
    category: 'R',
    u_category: 'S',
    subcategory: 'T',
    u_subcategory: 'U',
    made_sla: 'V'
  },
 tags: ['app_id:Computacenter']
};


pulseAPI = new TSPulseAPI({
  email: 'martin_tauber@bmc.com',
  apiToken: '7cae610a-cf1d-4d20-87f0-61aadea7d8e5'
});

process.on('exit', function(){
  logger.info("First request at: " + pulseAPI.statistics.firstRequestAt);
  logger.info("Last responce at: " + pulseAPI.statistics.lastResponceAt);
  logger.info("Number of Requests: " + pulseAPI.statistics.numberOfRequests);
  logger.info("Number of Responces: " + pulseAPI.statistics.numberOfResponces);
  logger.info("Number of Errors: " + pulseAPI.statistics.numberOfErrors);
  logger.info("Number of Fatal Errors: " + pulseAPI.statistics.numberOfFatalErrors);
  logger.info("Avg Responces / sec: " + 1000 / (pulseAPI.statistics.lastResponceAt - pulseAPI.statistics.firstRequestAt) * pulseAPI.statistics.numberOfResponces);
})

var dataProvider = new ExcelDataProvider({
  filename: "d:\\mtauber\\data\\bmc\\vmtemplates\\incident.xlsx",
  map: map,
  startAt : 2,
});

pulseAPI.createEvents(dataProvider);
