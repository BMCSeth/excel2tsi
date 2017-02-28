#!/usr/bin/env node

const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage')

var log4js = require('log4js');
var fs = require('fs');
var logger = log4js.getLogger();

var TsiAPI = require('./lib/tsiapi').TsiAPI;
var ExcelDataProvider = require('./lib/ExcelDataProvider').provider;
var OdbcDataProvider = require('./lib/OdbcDataProvider').provider;

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
    "The map file to be used to map excel columns to TrueSight Intelligence " +
    "attributes. Basically you specify a json structure with keys and values. " +
    "The keys are mapped to the TrueSight Intelligence attributes. The " +
    "values specified can either be columnnames like 'A' or they are constant " +
    "values like 'myApplication'. Be aware that the tool assumes that you " +
    "are refering to an excel column if the value consists of on or two " +
    "capital letters. You can find examples in the example diretory of the "+
    "source code stored at github (https://github.com/tsguru/excel2tsi)"},
  { name: 'start', type: Number, defaultValue: 2, description:
    "start processing the excel file at the row specified. If no value is " +
    "specified the processing starts in the second row. The rows are counted "+
    "starting from 1."},
  { name: 'end', type: Number, description:
    "end the processing of the excel file at the row specifed. If no value is " +
    "specified all rows are processed. The rows are counted starting form 1."},
  { name: 'sheet', type: String, description:
    "name of the excel sheet you want to load the data from. If no sheet is " +
    "specified the first sheet in the workbook will be used."},
  { name: 'fake', type: Boolean, description:
    "Do not send the data to the TSI server. Process the data and display the json "+
    "that would be sent to the TSI server."}
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
      '[(--map|-m) <filename>] [--start <startAtLine>] [--end <endAtLine>] ' +
      '[--sheet <sheetname>][--fake]'
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

    var db = new OdbcDataProvider({

  });



  process.exit(0);
}

if (options.file == undefined) {
  console.log("Please specify an excel file containing the data to be send to the TrueSight server.");
  console.log(usage);
  process.exit(1);
}

if (options.email == undefined) {
  console.log("Please specify an email address used to connect to the TrueSight server.");
  console.log(usage);
  process.exit(1);
}

if (options.token == undefined) {
  console.log("Please specify a api token used to connect to the TrueSight server.");
  console.log(usage);
  process.exit(1);
}

if (options.token == undefined) {
  console.log("Please specify a map file.");
  console.log(usage);
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

try {
  // create the excel data provider used to collect the data
  var dataProvider = new ExcelDataProvider ({
    filename: options.file,
    map: map,
    startAt : options.start,
    endAt: options.end,
    sheet: options.sheet,
    logger: logger
  });

  // create the events using the specified dataprovider
  tsi.createEvents(dataProvider, {
    fake:options.fake}
  );
} catch (error) {
  logger.error(error);
}
