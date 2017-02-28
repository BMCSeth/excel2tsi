var odbc = require('odbc');

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
function OdbcDataProvider(options) {
    console.log("abc");
    cn = "Driver={PostgreSQL};Server=192.168.66.2;Port=5432;Database=postgres;Uid=postgres;Pwd=postgres;";
    try {
        var result = odbc.openSync(cn);
    }
    catch (e) {
        console.log(e.message);
    }
    console.log("done");

}

/**
 * @author Martin Tauber <martin_tauber@bmc.com>
 */
OdbcDataProvider.prototype.next = function () {


}

function NullLogger() {
    this.info = function () { };
    this.error = function () { };
    this.debug = function () { };
}

exports.provider = OdbcDataProvider;
