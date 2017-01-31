# excel2tsi.js

**excel2tsi** loads the content of an excel file maps it to TrueSight
Intelligence event attributes and sends it to TrueSight Intelligence.

## Installation

**excel2tsi** is based on nodejs, so you need to have nodejs installed in
order to run **excel2tsi**. Visit the nodejs website http://www.nodejs.org to
find out how to install nodejs on your plattform.

After installing nodejs **excel2tsi** can be installed using the following
command:

    npm install -g tsguru/excel2tsi

After you have installed **excel2tsi** successfully you should try the command

    excel2tsi --help

This will print a usage for the **excel2tsi** utility.

## Mapping

**excel2tsi** reads an excel file and maps the columns to TrueSight Intelligence
attribute. Therefor it needs to have a map file. The map file is a json
structure. The keys of the json map files correspond to the attributes in
TrueSight Intelligence. Excel columns are mapped to the attributes by
specifying the columnname ('A', 'B' etc.) as a value for a key. Here is an
example for a map file.

    {
      "source": {
      "ref": "CoolCompany",
      "type": "CoolCompany",
      "name": "CoolCompany"
      },
      "sender": {
        "ref": "CoolCompany",
        "type": "CoolCompany",
        "name": "CoolCompany"
      },
      "fingerprintFields": ["incident_id"],
      "message": "N",
      "title": "N",
      "eventClass": "Incident",
      "status": "D",
      "severity": "E",
      "createdAt": "A",
      "properties": {
        "app_id": "CoolCompany",
        "incident_id": "C",
      },
      "tags": ["app_id:CoolCompany"]
    }

In this example we map the message and the title to column 'N' of our excel
sheet. The status is mapped to column 'D' etc. We are also using contants like
"CoolCompany" which will be send to TrueSight Intelligence without any
modification.

## Performance   

**excel2tsi** is designed to load as much data into TrueSight Intelligence as
possible. Therefor it processes the data asychronously. Data is send to the
TrueSight server without halting to wait for the response. **excel2tsi** will
selftune itself to ensure that the number of outstanding requests will not get
to high. By default it tries to keep the number of outstanding requests in
a range between 50 and 150 requests.  
