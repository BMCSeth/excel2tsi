var XLSX = require('xlsx');
var https = require('https');

function TSPulseAPI(options) {
  this.email = options.email;
  this.apiToken = options.apiToken;
  this.hostname = typeof options.hostname !== 'undefined' ? options.hostname : 'api.truesight.bmc.com';
  this.port = typeof options.port !== 'undefined' ? options.port : 443;

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

    var request = https.request(this.options, function(result) {
      numberOfResults++;

  //    if (numberOfResults % 10 == 0) console.log(new Date() + " processed " + numberOfResults + " results ...");

      if (result.statusCode >= 400) {
        console.log('Status: ' + result.statusCode);
        console.log('Headers: ' + JSON.stringify(result.headers));
        result.setEncoding('utf8');
        result.on('data', function (body) {
          console.log('Body: ' + body);
        });
      }
    });

    request.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    request.write(JSON.stringify(data));
    request.end();
  }
}

TSPulseAPI.prototype.createEvent = function(data) {
  this.options.path = '/v1/events';
  this.options.method = 'POST';

  this._request(data);
}

var numberOfResults = 0;

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
TSPulseAPI.prototype.createEvents = function(dataProvider, options) {
  var ratio = options.ratio == undefined ? 80 : options.ratio;
  var min = options.min == undefined ? 50 : options.min;
  var max = options.max == undefined ? 150 : options.max;

  var worker = function(dataProvider, ratio) {
    var i = 0;
    while (i < ratio) {
      data = dataProvider.next();
      if (typeof data === 'undefined') break;
        console.log(data.message);
//      this.createEvent(data);
      i++;
    }

    if (typeof data !== 'undefined') setTimeout(worker, 1000, dataProvider, ratio);
  }

  worker(dataProvider, ratio);
}

function TSPulseAPIDefaultHandler() {
  this.totalNumberOfRequests = 0;
  this.totalNumberOfResponces = 0;
}

TSPulseAPIDefaultHandler.prototype.handleRequest = function(result) {

}

TSPulseAPIDefaultHandler.prototype.handleResponce = function(result) {

}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function ExcelDataProvider(options) {
  this.filename = options.filename;
  this.map = options.map;
  this.startAt = typeof options.startAt === 'undefined' ? 1 : options.startAt;
  this.endAt = typeof options.endAt === 'undefined' ? 0 : options.endAt;

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

var dataProvider = new ExcelDataProvider({
  filename: "d:\\data\\bmc\\tmp\\incident1.xlsx",
  map: map,
  startAt : 2,
});

pulseAPI.createEvents(dataProvider, {
  ratio: 2
});
