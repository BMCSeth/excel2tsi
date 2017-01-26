var XLSX = require('xlsx');
var https = require('https');


function getExcelColumnNumber(name) {
  var sum = 0;

  for (var i = 0; i < name.length; i++) {
    sum = sum * 26;
    sum = sum + (name.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }

  sum = sum - 1;

  return sum
}

function getExcelColumnName(columnNumber) {
  var dividend = columnNumber + 1;
  var columnName = '';
  var modulo;

  while (dividend > 0)
  {
    modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.trunc((dividend - modulo) / 26);
  } 

  return columnName;
}

function TSPulseAPI(properties) {
  this.email = properties.email;
  this.apiToken = properties.apiToken;
  this.hostname = typeof properties.hostname !== 'undefined' ? properties.hostname : 'api.truesight.bmc.com';
  this.port = typeof properties.port !== 'undefined' ? properties.port : 443;

  this.options = {
    protocol: 'https:',
    hostname: this.hostname,
    port: this.port,
    auth: this.email + ':' + this.apiToken,
    headers: {
        'Content-Type': 'application/json',
    }
  };
}

TSPulseAPI.prototype.createEvent = function(data) {
  this.options.path = '/v1/events';
  this.options.method = 'POST';

  this._request(data);
}

var numberOfResults = 0;
TSPulseAPI.prototype._request = function(data) {

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

function insertRequests() {
  var workbook = XLSX.readFile('/vagrant/requests.xlsx');
  var sheet = workbook.Sheets[Object.keys(workbook.Sheets)[0]];
  
  var str = sheet['!ref'].match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);

  fromX = Number(str[1]);
  fromY = Number(str[2]);
  toX = Number(str[3]);
  toY = Number(str[4]);
    
  for (var i = fromY + 1; i < toY; i++) {
    if (i % 1000 == 0) console.log(new Date() + " processed " + i + " rows ...");
    var data = {
      "source": {
        "ref": "Computacenter",
        "type": "Computacenter",
        "name": "Computacenter"
      },
      "sender": {
        "ref": "Computacenter",
        "type": "Computacenter",
        "name": "Computacenter"
      },
      "fingerprintFields": ["request_id"],
      "message": sheet['G' + i].w,
      "title": sheet['E' + i].w,
      "eventClass": "Request",
      "status": "Unknown",
      "severity": "Unknown",
      "createdAt": sheet['A' + i].w,
      "properties": {
         "app_id": "Computacenter",
         "request_id": sheet['B' + i].w,
         "city": sheet['C' + i].w,
         "assignement_group": sheet['D' + i].w,
         "short_description": sheet['E' + i].w,
         "cmdb_ci": sheet['F' + i].w,
         "close_notes": sheet['G' + i].w,
         "opened_at": sheet['H' + i].w,
         "closed_at": sheet['I' + i].w
       },
       "tags": ["app_id:Computacenter"]
    };
  
  pulseAPI.createEvent(data);
  
  //  for (var j = getExcelColumnNumber(fromX); j < getExcelColumnNumber(toX); j++) {
  //    console.log(JSON.stringify(worksheet[getExcelColumnName(j) + i].w));
  //  }
  }
}


function insertIncidents() {
  var workbook = XLSX.readFile('/vagrant/incident.xlsx');
  var sheet = workbook.Sheets[Object.keys(workbook.Sheets)[0]];
  
  var str = sheet['!ref'].match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  fromX = Number(str[1]);
  fromY = Number(str[2]);
  toX = Number(str[3]);
  toY = Number(str[4]);
    
  sendIncident(sheet, fromY + 1, toY, fromY + 1, 80, 1000);
}

function sendIncident(sheet, fromY, toY, start, interval, timer) {
  for (var i = start; i < Math.min(start + interval, toY); i++) {
    if (typeof sheet['A' + i] === 'undefined') break;
    if (i % 100 == 0) console.log(new Date() + " processed " + i + " rows. Results received " + numberOfResults + " diff " + (i - numberOfResults));
    var data = {
      "source": {
        "ref": "Computacenter",
        "type": "Computacenter",
        "name": "Computacenter"
      },
      "sender": {
        "ref": "Computacenter",
        "type": "Computacenter",
        "name": "Computacenter"
      },
      "fingerprintFields": ["incident_id"],
      "message": sheet['N' + i].w,
      "title": sheet['N' + i].w,
      "eventClass": "Incident",
      "status": sheet['D' + i].w,
      "severity": sheet['E' + i].w,
      "createdAt": sheet['A' + i].w,
      "properties": {
        "app_id": "Computacenter",
        "incident_id": sheet['C' + i].w,
        "u_ge_hr_industry_group": sheet['B' + i].w,
        "state": sheet['D' + i].w,
        "priority": sheet['E' + i].w,
        "contact_type": sheet['F' + i].w,
        "city": sheet['G' + i].w,
        "country": sheet['H' + i].w,
        "opened_at": sheet['I' + i].w,
        "sys_created_on": sheet['J' + i].w,
        "u_resolved_time": sheet['K' + i].w,
        "assignment_group": sheet['L' + i].w,
        "reassignment_count": sheet['M' + i].w,
        "short_description": sheet['N' + i].w,
        "close_notes": sheet['O' + i].w,
        "open_ci": sheet['P' + i].w,
        "cmdb_ci": sheet['Q' + i].w,
        "category": sheet['R' + i].w,
        "u_category": sheet['S' + i].w,
        "subcategory": sheet['T' + i].w,
        "u_subcategory": sheet['U' + i].w,
        "made_sla": sheet['V' + i].w
      },
     "tags": ["app_id:Computacenter"]
    };

    pulseAPI.createEvent(data);
  }

  if (i < toY && typeof sheet['A' + i] !== 'undefined') {
    setTimeout(sendIncident, timer, sheet, fromY, toY, i, interval, timer);
  }
}


pulseAPI = new TSPulseAPI({
  email: 'martin_tauber@bmc.com',
  apiToken: '7cae610a-cf1d-4d20-87f0-61aadea7d8e5'
});

insertIncidents();

