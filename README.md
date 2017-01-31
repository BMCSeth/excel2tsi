# excel2tsi.js

**excel2tsi** loads an excel file maps it to TrueSight Intelligence attributes
and sends it to TrueSight Intelligence. Currently only events are supported.

## Installation

**excel2tsi** is based on nodejs, so you need to have nodejs installed in
order to run **excel2tsi**. Visit the nodejs website http://www.nodejs.org to
find out how to install nodejs on your plattform.

After installing nodejs **excel2tsi** can be installed using the following
command:

    npm install -g tsguru/excel2tsi

After you have installed **excel2tsi** successfully you should try the command

    excel2tsi --help

This will print a usage for the **excel2tsi**

## Mapping

**excel2tsi** reads an excel file and maps the columns to TrueSight Intelligence
attribute. Therefor it needs to have a map file. The map file is a json
structure. The keys of the json map files correspond to the attributes in
TrueSight Intelligence. Excel columns are mapped to the attributes by
specifying the columnname ('A', 'B' etc.) as a value for a key. Here is an
example for a map file.

    {
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
      "message": "N",
      "title": "N",
      "eventClass": "Incident",
      "status": "D",
      "severity": "E",
      "createdAt": "A",
      "properties": {
        "app_id": "Computacenter",
        "incident_id": "C",
      },
      "tags": ["app_id:Computacenter"]
    }
