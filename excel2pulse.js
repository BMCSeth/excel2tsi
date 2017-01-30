var XLSX = require('xlsx');
var log4js = require('log4js');
var logger = log4js.getLogger();

var tsiapi = require('./tsiapi');


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

console.log(process.argv);

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

tsi = new tsiapi.tsi({
  email: 'martin_tauber@bmc.com',
  apiToken: '7cae610a-cf1d-4d20-87f0-61aadea7d8e5',
  logger: logger
});

process.on('exit', function(){
  logger.info("First request at: " + tsi.statistics.firstRequestAt);
  logger.info("Last responce at: " + tsi.statistics.lastResponceAt);
  logger.info("Number of Requests: " + tsi.statistics.numberOfRequests);
  logger.info("Number of Responces: " + tsi.statistics.numberOfResponces);
  logger.info("Number of Errors: " + tsi.statistics.numberOfErrors);
  logger.info("Number of Fatal Errors: " + tsi.statistics.numberOfFatalErrors);
  logger.info("Avg Responces / sec: " + 1000 / (tsi.statistics.lastResponceAt - tsi.statistics.firstRequestAt) * tsi.statistics.numberOfResponces);
})

var dataProvider = new ExcelDataProvider({
  filename: "d:\\mtauber\\data\\bmc\\vmtemplates\\incident1.xlsx",
  map: map,
  startAt : 2,
});

tsi.createEvents(dataProvider);
