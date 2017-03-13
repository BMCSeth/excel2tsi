const EventEmitter = require('events');
const XLSX = require('xlsx');
const log4js = require('log4js');
const NullLogger = require('./nullLogger').logger;

const Map = require('./map').map;

const columnNames = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ',
  'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ',
  'CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP', 'CQ', 'CR', 'CS', 'CT', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ'
];

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
class ExcelDataProvider extends EventEmitter {
  constructor(options) {
    // Calls the stream.Writable() constructor
    super(options);

    this.filename = options.filename;
    this.startAt = typeof options.startAt == undefined ? 1 : options.startAt;
    this.endAt = typeof options.endAt == undefined ? 0 : options.endAt;
    this.queue = options.queue;

    this.map = new Map(options.map, log4js.getLogger("Map"));

    this.sheetName = options.sheet;

    this.logger = options.logger == undefined ? new NullLogger() : options.logger;
    this.paused = false;

    this.sendDataHandler = this.sendData.bind(this);

  }

  sendData() {
    while (this.queue.length < 200) {
      var values = {}

      if (this.sheet['A' + this.currentRow] == undefined &&
        this.sheet['B' + this.currentRow] == undefined &&
        this.sheet['C' + this.currentRow] == undefined &&
        this.sheet['D' + this.currentRow] == undefined &&
        this.sheet['E' + this.currentRow] == undefined &&
        this.sheet['F' + this.currentRow] == undefined) {

        this.stop();
        return;
      }

      if (this.currentRow >= this.startAt) {
        for (var columnName of columnNames) {
          if (this.sheet[columnName + this.currentRow] == undefined) {
            break;
          } else {
            values[columnName] = this.sheet[columnName + this.currentRow].w;
          }
        }

        var result = this.map.resolve(values);
        this.logger.debug("ExcelDataProvider is sending data ...");
        this.queue.push(result);
//        this.emit('data', result);

        this.currentRow++;

        if (this.endAt != 0 && this.currentRow > this.endAt) {
          this.stop();
          return;
        }
      }

    }

    if (!this.paused) setTimeout(this.sendDataHandler, 1000);
  }

  start() {
    this.logger.info("Starting excel data provider ...");
    this.logger.info("Reading excel file '" + this.filename + "' ...");
    this.workbook = XLSX.readFile(this.filename);
    this.logger.info("Finished reading excel file.")

    this.sheetName = this.sheetName == undefined ? Object.keys(this.workbook.Sheets)[0] : this.sheetName;

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

  stop() {
    this.logger.info("Stopping Excel data provider ...");
    this.emit('eod');
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.sendData();
  }
}

exports.provider = ExcelDataProvider;




