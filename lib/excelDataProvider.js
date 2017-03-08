const EventEmitter = require('events');
var XLSX = require('xlsx');

const mapper = require('./map').map;
const NullLogger = require('./nullLogger').logger;

const columnNames = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
class ExcelDataProvider extends EventEmitter {
  constructor(options) {
    // Calls the stream.Writable() constructor
    super(options);

    this.filename = options.filename;
    this.map = options.map;
    this.startAt = typeof options.startAt === 'undefined' ? 1 : options.startAt;
    this.endAt = typeof options.endAt === 'undefined' ? 0 : options.endAt;

    this.logger = options.logger == undefined ? new NullLogger() : options.logger;

    this.logger.info("Reading Excel file: " + this.filename + " ...");
    this.workbook = XLSX.readFile(this.filename);

    this.sheetName = options.sheet == undefined ? Object.keys(this.workbook.Sheets)[0] : options.sheet;

    this.logger.info("Using sheet: " + this.sheetName);
    this.sheet = this.workbook.Sheets[this.sheetName];

    if (this.sheet == undefined) throw "Workbook sheet '" + this.sheetName + "' does not exist";

    this.logger.info("Starting at: " + this.startAt);
    this.logger.info("Ending at: " + (this.endAt == 0 ? "end of sheet" : this.endAt));

    this.logger.info("Sheet size: " + this.sheet['!ref']);

    this.currentRow = this.startAt;

    this.status = "running";

    this.sendData();
  }

  sendData() {
    while(this.status == "running") {
      var values = {}

      for (var columnName of columnNames) {
        if (this.sheet[columnName + this.currentRow] == undefined) {
          break;
        } else {
          values[columnName] = this.sheet[columnName + this.currentRow].w;
        }
      }

      if (Object.keys(values).length == 0) {
        this.emit('data', undefined);
        this.status = "stopped";
      } else {
        var result = mapper(this.map, values);
        this.emit('data', result);
        this.currentRow++;
      }
    }
  }

  pause() {
    this.status = "paused";
  }

  resume() {
    this.status = "running";
    sendData();
  }
}

exports.provider = ExcelDataProvider;




