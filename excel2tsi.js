const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage')

var log4js = require('log4js');
var fs = require('fs');
var logger = log4js.getLogger();

var TsiAPI = require('./lib/tsiapi').TsiAPI;
var ExcelDataProvider = require('./lib/ExcelDataProvider').provider;

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
  console.log("Please specify an email address used to connect to the TrueSight server.");
  process.exit(0);
}

if (options.token == undefined) {
  console.log("Please specify a api token used to connect to the TrueSight server.");
  process.exit(0);
}

if (options.token == undefined) {
  console.log("Please specify a map file.");
  process.exit(1)
}


// Read the map file
var map;
try {
  map = JSON.parse(fs.readFileSync(options.map, 'utf8'));
} catch (error) {
  logger.error("An error occured reading map file ()");
  logger.error(error);
  process.exit(1);
}


// create a handle for the TSI server
tsi = new TsiAPI({
  email: options.email,
  apiToken: options.token,
  logger: logger
});

// when we exit we want to display some statistics
process.on('exit', function(){
  logger.info("First request at: " + tsi.statistics.firstRequestAt);
  logger.info("Last responce at: " + tsi.statistics.lastResponceAt);
  logger.info("Number of Requests: " + tsi.statistics.numberOfRequests);
  logger.info("Number of Responces: " + tsi.statistics.numberOfResponces);
  logger.info("Number of Errors: " + tsi.statistics.numberOfErrors);
  logger.info("Number of Fatal Errors: " + tsi.statistics.numberOfFatalErrors);
  logger.info("Avg Responces / sec: " + 1000 / (tsi.statistics.lastResponceAt - tsi.statistics.firstRequestAt) * tsi.statistics.numberOfResponces);
})

// create the excel data provider used to collect the data
var dataProvider = new ExcelDataProvider ({
  filename: options.file,
  map: map,
  startAt : options.start,
  logger: logger
});

// create the events using the specified dataprovider
tsi.createEvents(dataProvider);
