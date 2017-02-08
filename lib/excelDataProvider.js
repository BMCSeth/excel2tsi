var XLSX = require('xlsx');

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function ExcelDataProvider(options) {
  this.filename = options.filename;
  this.map = options.map;
  this.startAt = typeof options.startAt === 'undefined' ? 1 : options.startAt;
  this.endAt = typeof options.endAt === 'undefined' ? 0 : options.endAt;

  if (options.logger == undefined) {
    this.logger = new NullLogger();
  } else {
    this.logger = options.logger;
  }

  this.logger.info("Reading Excel file: " + this.filename + " ...");
  this.workbook = XLSX.readFile(this.filename);

  this.sheetName = options.sheet == undefined ? Object.keys(this.workbook.Sheets)[0] : options.sheet;

  this.logger.info("Using sheet: " + this.sheetName);
  this.sheet = this.workbook.Sheets[this.sheetName];

  if (this.sheet == undefined) throw "Workbook sheet '"+this.sheetName+ "' does not exist";

  this.logger.info("Starting at: " + this.startAt);
  this.logger.info("Ending at: " + (this.endAt == 0 ? "end of sheet" : this.endAt));

  this.logger.info("Sheet size: " + this.sheet['!ref']);

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
this.logger.info("-" +this.startAt+":"+this.endAt+":"+this.currentRow);
  return this.mapper(this.map, this.sheet, this.currentRow++);
}

function NullLogger() {
  this.info = function() {};
  this.error = function() {};
  this.debug = function() {};
}

exports.provider = ExcelDataProvider;
