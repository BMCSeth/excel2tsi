const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage')

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

const optionDefinitions = [
  { name: 'help', alias: 'h', type: Boolean, descritpion:
    "Print this usage guide."},
  { name: 'file', alias: 'f', type: String, description:
    "Use the excel file specified as an input."},
  { name: 'email', alias: 'e', type: String, description:
    "The email address used to connect to the TrueSight Intelligence server."},
  { name: 'token', alias: 't', type: String, description:
    "The api token used to connect to the TrueSight Intelligence server."},
  { name: 'map', alias: 'm', type: String, description:
    "The map file to be used to map excel columns to TrueSight Intelligence attributes."},
  { name: 'start', type: Number, defaultValue: 2, description:
    "start processing the excel file at the row specified. If no value is specified the processing starts in the second row. The rows are counted starting from 1."},
  { name: 'end', type: Number, description:
    "end the processing of the excel file at the row specifed. If no value is specified all rows are processed. The rows are counted starting form 1."},
  { name: 'fake', type: Boolean, description:
    "Do not send the data to the TSI server. Only process the first row and display the content."}
];

const sections = [
  {
    header: 'Excel to TSI',
    content: 'Reads and excel file and sends the data to TrueSight Intelligence.'
  },
  {
    header: 'Synopsis',
    content: [
      'excel2tsi --help',
      'excel2tsi (--file|-f) <filename> (--email|-e) <email> (--token|-t) <apiToken> ' +
      '[(--map|-m) <filename>] [--start <startAtLine>] [--end <endAtLine>] [--fake]'
    ]
  },
  {
    header: 'Options',
    optionList: optionDefinitions
  },
  {
    header: 'Examples',
    content: [
      'excel2tsi --file myevents.xlsx --email me@company.com --token theApiToken ' +
      '--map mymap.json'
    ]
  },
  {
    header: 'Author',
    content: 'Martin Tauber <martin_tauber@bmc.com>'
  }
]

const usage = getUsage(sections)

var options;
try {
  options  = commandLineArgs(optionDefinitions);
} catch (error) {
  console.log(error.name);
  console.log("");
  console.log(usage);
  process.exit(0);
}

if (options.help) {
  console.log(usage);
  process.exit(0);
}

if (options.file == undefined) {
  console.log("Please specify an excel file containing the data to be send to the TrueSight server.");
  console.log(usage);
  process.exit(0);
}

if (options.email == undefined) {
  console.log("please specify an email address used to connect to the TrueSight server.");
  process.exit(0);
}

if (options.token == undefined) {
  console.log("Please specify a api token used to connect to the TrueSight server.");
  process.exit(0);
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
  filename: options.file,
  map: map,
  startAt : options.start,
});

tsi.createEvents(dataProvider);
