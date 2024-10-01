const serialport = require('@serialport/bindings-cpp')
const usb = require('usb')
const {ipcRenderer} = require("electron")
const { shell } = require('electron')

var basetuneList = [];
var useLocalTune = false;
var localTuneFile = "";

function getTeensyVersion(id)
{
  var idString = ""
  switch(id) {
    case 0x273:
      idString = "LC"
      break;
    case 0x274:
      idString = "3.0"
      break;
    case 0x275:
      idString = "3.2"
      break;
    case 0x276:
      idString = "3.5"
      break;
    case 0x277:
      idString = "3.6"
      break;
    case 0x279:
      idString = "4.0"
      break;
    case 0x280:
      idString = "4.1"
      break;
  }

  return idString;
}

function refreshSerialPorts()
{
  serialport.autoDetect().list().then(ports => {
    console.log('Serial ports found: ', ports);
  
    if (ports.length === 0) {
      document.getElementById('serialDetectError').textContent = 'No ports discovered'
    }
  
    const select = document.getElementById('portsSelect');

    //Clear the current options
    while (select.options.length)
    {
        select.remove(0); //Always 0 index (As each time an item is removed, everything shuffles up 1 place)
    }

    //Load the current serial values
    for(var i = 0; i < ports.length; i++)
    {
        var newOption = document.createElement('option');
        newOption.value = ports[i].path;
        newOption.innerHTML = ports[i].path;
        if(ports[i].vendorId == "2341")
        {
          //Arduino device
          if(ports[i].productId == "0010" || ports[i].productId == "0042") 
          { 
            //Mega2560 with 16u2
            newOption.innerHTML = newOption.innerHTML + " (Arduino Mega)"; 
            newOption.setAttribute("board", "ATMEGA2560");
          }
          else if(ports[i].productId == "0070")
          {
            newOption.innerHTML = newOption.innerHTML + " (Arduino nano ESP32)"; 
          }
          else
          {
            newOption.innerHTML = newOption.innerHTML + " (Arduino " + ports[i].vendorId + ":"+ ports[i].productId + ")";
          }
        }
        else if(ports[i].vendorId == "16c0" || ports[i].vendorId == "16C0")
        {
          //Teensy
          var teensyDevices = usb.getDeviceList().filter( function(d) { return d.deviceDescriptor.idVendor===0x16C0; });
          var teensyVersion = getTeensyVersion(teensyDevices[0].deviceDescriptor.bcdDevice);
          newOption.innerHTML = newOption.innerHTML + " (Teensy " + teensyVersion + ")";

          //Get the short copy of the teensy version
          teensyVersion = teensyVersion.replace(".", "");
          newOption.setAttribute("board", "TEENSY"+teensyVersion);
        }
        else if((ports[i].vendorId == "1a86" || ports[i].vendorId == "1A86") && ports[i].productId == "7523")
        {
          newOption.innerHTML = newOption.innerHTML + " (Arduino nano)"; 
        }
        else if((ports[i].vendorId == "10c4" || ports[i].vendorId == "10C4") && (ports[i].productId == "ea60" || ports[i].productId == "EA60"))
        {
          newOption.innerHTML = newOption.innerHTML + " (Espressif ESP32-S3)"; 
        }
        else if((ports[i].vendorId == "303a" || ports[i].vendorId == "303A") && ports[i].productId == "1001")
        {
          newOption.innerHTML = newOption.innerHTML + " (Seeed Xaio ESP32-S3)"; 
        }
        else if(ports[i].vendorId == "303a" || ports[i].vendorId == "303A")
        {
          newOption.innerHTML = newOption.innerHTML + " (Espressif:" + ports[i].productId + ")"; 
        }
        else if(ports[i].vendorId == "239a" || ports[i].vendorId == "239A")
        {
          if(ports[i].productId == "8147")
          {
            newOption.innerHTML = newOption.innerHTML + " (Adafruit Qualia RGB666 ESP32-S3)"; 
          }
          else if(ports[i].productId == "8119")
          {
          newOption.innerHTML = newOption.innerHTML + " (Adafruit QT Py ESP32-S3 No PSRAM)"; 
          }
          else
          {
          newOption.innerHTML = newOption.innerHTML + " (Adafruit:" + ports[i].productId + ")"; 
          }
        }
        else if(ports[i].vendorId == "2e8a" || ports[i].vendorId == "2E8A")
        {
          if(ports[i].productId == "1018")
          {
            newOption.innerHTML = newOption.innerHTML + " (Pimironi PGA2350)"; 
          }
          else if(ports[i].productId == "000A")
          {
          newOption.innerHTML = newOption.innerHTML + " (Raspberry Pi Pico)"; 
          }
          else if(ports[i].productId == "000F")
          {
          newOption.innerHTML = newOption.innerHTML + " (Raspberry Pi Pico 2)"; 
          }
          else
          {
            newOption.innerHTML = newOption.innerHTML + " (Raspberry Pi:" + ports[i].productId + ")"; 
          }
        }
        else if(ports[i].vendorId == "1a86" || ports[i].vendorId == "1A86")
        {
          //CH340
          newOption.innerHTML = newOption.innerHTML + " (Arduino Mega CH340)"; 
          newOption.setAttribute("board", "ATMEGA2560");
        }
        else if(ports[i].vendorId == "0483" && ports[i].productId == "5740")
        {
          //STM32F407
          newOption.innerHTML = newOption.innerHTML + " (STM32F407 - Serial Mode)"; 
          newOption.setAttribute("board", "STM32F407_serial");
          console.log(ports[i].productId)
        }
        else
        {
          newOption.innerHTML = newOption.innerHTML + " (" + ports[i].vendorId + ":" + ports[i].productId + ")"; 
          //Unknown device, assume it's a mega2560
          newOption.setAttribute("board", "ATMEGA2560");
          console.log(ports[i].vendorId)
        }
        select.add(newOption);
    }

    //Look for any unintialised Teensy boards (ie boards in HID rather than serial mode)
    var uninitialisedTeensyDevices = usb.getDeviceList().filter( function(d) {
      return d.deviceDescriptor.idVendor===0x16C0 && d.configDescriptor.interfaces[0][0].bInterfaceClass == 3; //Interface class 3 is HID
    });
    uninitialisedTeensyDevices.forEach((device, index) => {
      console.log("Uninit Teensy found: ", getTeensyVersion(device.deviceDescriptor.bcdDevice))
      var newOption = document.createElement('option');
      newOption.value = "TeensyHID";
      var teensyVersion = getTeensyVersion(device.deviceDescriptor.bcdDevice);
      newOption.innerHTML = "Uninitialised Teensy " + teensyVersion;
      teensyVersion = teensyVersion.replace(".", "");
      newOption.setAttribute("board", "TEENSY"+teensyVersion);
      select.add(newOption);
    })

    //Look for any STM32 devices in DFU mode
    var stmDFUDevices = usb.getDeviceList().filter( function(d) {
      return d.deviceDescriptor.idVendor===0x0483 && d.deviceDescriptor.bcdDevice===0x2200; //Interface class 3 is HID
    });
    stmDFUDevices.forEach((device, index) => {
      console.log("STM32 in DFU mode found: ", device.deviceDescriptor.bcdDevice)
      console.log("STM32 PID: ", device.deviceDescriptor.idProduct.toString(16).toUpperCase())
      var newOption = document.createElement('option');
      newOption.value = "STM32F407_DFU";
      newOption.innerHTML = "STM32F407 in DFU mode";
      newOption.setAttribute("board", "STM32F407_DFU");
      newOption.setAttribute("vid", device.deviceDescriptor.idVendor.toString(16).toUpperCase());
      newOption.setAttribute("pid", device.deviceDescriptor.idProduct.toString(16).toUpperCase());
      select.add(newOption);
    })
    /*
    for(x=0; x<usb.getDeviceList().length; x++)
    {
      console.log("Vendor: " + usb.getDeviceList()[x].deviceDescriptor.idVendor + " Device Descriptor: " + usb.getDeviceList()[x].deviceDescriptor.bcdDevice);
    }
    */
    
    
    var button = document.getElementById("btnInstall")
    if(select.length > 0) 
    {
        select.selectedIndex = 0;
        button.disabled = false;
    }
    else { button.disabled = true; }
  
  })
}

//Checks whether the port currently selected is a known invalid one or not
function checkForValidPort()
{
  var validPort = true;
  var errorText = ""
  var option = document.getElementById('portsSelect').options[document.getElementById('portsSelect').selectedIndex];

  if(option.getAttribute('board') == "STM32F407_serial")
  {
    validPort = false;
    errorText = "Serial mode is not supported on STM32F407 boards. Please place the board into DFU mode instead.";
  }

  if(validPort)
  {
    document.getElementById('port_warning').style.display = "none";
    document.getElementById('port_warningText').innerHTML = "";
    document.getElementById('btnInstall').disabled = false;
  }
  else
  {
    document.getElementById('port_warning').style.display = "block";
    document.getElementById('port_warningText').innerHTML = errorText;
    document.getElementById('btnInstall').disabled = true;
  }
}

function refreshDetails()
{
    var selectElement = document.getElementById('versionsSelect');
    var version = selectElement.options[selectElement.selectedIndex].value;
    var url = "https://api.github.com/repos/noisymime/speeduino/releases/tags/" + version;

    document.getElementById('detailsText').innerHTML = "";
    document.getElementById('detailsHeading').innerHTML = version;
    
    fetch(url)
    .then((response) => {
        if (response.ok) {
            return response.json();
        }
        return Promise.reject(response);
    })
    .then((result) => {
        console.log(result);

        //Need to convert the Markdown that comes from Github to HTML
        var myMarked = require('marked');
        document.getElementById('detailsText').innerHTML = myMarked.parse(result.body);
        document.getElementById('detailsHeading').innerHTML = version + " - " + result.name;
    })
    .catch((error) => {
        console.log('Could not download details.', error);
    });

}

function refreshAvailableFirmwares()
{
    //Disable the buttons. These are only re-enabled if the retrieve is successful
    var DetailsButton = document.getElementById("btnDetails");
    var ChoosePortButton = document.getElementById("btnChoosePort");
    var basetuneButton = document.getElementById("btnBasetune");
    DetailsButton.disabled = true;
    ChoosePortButton.disabled = true;
    basetuneButton.disabled = true;

    const select = document.getElementById('versionsSelect');

    fetch('https://speeduino.com/fw/versions', { signal: AbortSignal.timeout(5000) } )
    .then((response) => {
        if (response.ok) {
            return response.text();
        }
        return Promise.reject(response);
    })
    .then((result) => {
        var lines = result.split('\n');
        // Continue with your processing here.
        
        for(var i = 0;i < lines.length;i++)
        {
            var newOption = document.createElement('option');
            newOption.value = lines[i];
            newOption.innerHTML = lines[i];
            select.appendChild(newOption);
        }
        select.selectedIndex = 0;

        //Remove the loading spinner
        loadingSpinner = document.getElementById("fwVersionsSpinner");
        loadingSpinner.style.display = "none";

        refreshBasetunes();

        //Re-enable the buttons
        DetailsButton.disabled = false;
        ChoosePortButton.disabled = false;
        basetuneButton.disabled = false;

    })
    .catch((error) => {
        console.log("Error retrieving available firmwares. ", error);

        var newOption = document.createElement('option');
        if(error.code === 'ETIMEDOUT')
        {
            newOption.value = "Connection timed out";
            newOption.innerHTML = "Connection timed out";
        }
        else
        {
            newOption.value = "Cannot retrieve firmware list";
            newOption.innerHTML = "Cannot retrieve firmware list. Check internet connection and restart";
        }
        select.appendChild(newOption);

        //Remove the loading spinner
        loadingSpinner = document.getElementById("fwVersionsSpinner");
        loadingSpinner.style.display = "none";
    });

}

function refreshBasetunes()
{
    //Check whether the base tunes list has been populated yet
    if(basetuneList === undefined || basetuneList.length == 0)
    {
        console.log("No tunes loaded. Retrieving from server");
        //Load the json
        //var url = "https://speeduino.com/fw/basetunes.json";
        var url = "https://github.com/speeduino/Tunes/raw/main/index.json";
        
        fetch(url)
        .then((response) => {
            if (response.ok) {
                return response.json();
            }
            return Promise.reject(response);
        })
        .then((result) => {

            basetuneList = result;

            //Remove the loading spinner
            loadingSpinner = document.getElementById("baseTuneSpinner");
            loadingSpinner.style.display = "none";

            refreshBasetunes();
        })
        .catch((error) => {
            console.log('Could not download base tune list.', error);
        });

    }
    else
    {
        //JSON list of base tunes has been downloaded
        console.log("Tune list downloaded. Populating filters");

        //Grab the select elements
        authorSelect = document.getElementById('basetunesAuthor');
        makeSelect = document.getElementById('basetunesMake');
        typeSelect = document.getElementById('basetunesType');

        //Clear the current values (There shouldn't be any, but safety first)
        while(authorSelect.options.length) { authorSelect.remove(0); }
        while(makeSelect.options.length) { makeSelect.remove(0); }
        while(typeSelect.options.length) { typeSelect.remove(0); }

        //Manually add the 'All' entries
        var newOption1 = document.createElement('option');
        newOption1.innerHTML = "All";
        var newOption2 = document.createElement('option');
        newOption2.innerHTML = "All";
        var newOption3 = document.createElement('option');
        newOption3.innerHTML = "All";
        authorSelect.appendChild(newOption1);
        makeSelect.appendChild(newOption2);
        typeSelect.appendChild(newOption3);

        //The Types list only has 2 valid values "Stock" or "Modified", so these can be added manually
        var stockOption = document.createElement('option');
        var modifiedOption = document.createElement('option');
        stockOption.innerHTML = "Stock";
        modifiedOption.innerHTML = "Modified";
        typeSelect.appendChild(stockOption);
        typeSelect.appendChild(modifiedOption);

        //Create unique sets with all the options
        var authorsSet = new Set();
        var makesSet = new Set();
        for (var tune in basetuneList)
        {
          authorsSet.add(basetuneList[tune].provider);
          makesSet.add(basetuneList[tune].make);
        }
        //Add the options for authors
        for(let item of authorsSet.values())
        {
          var tempOption = document.createElement('option');
          tempOption.innerHTML = item;
          authorSelect.appendChild(tempOption);
        }
        //Add the options for makes
        for(let item of makesSet.values())
        {
          var tempOption = document.createElement('option');
          tempOption.innerHTML = item;
          makeSelect.appendChild(tempOption);
        }

        authorSelect.selectedIndex = 0;
        makeSelect.selectedIndex = 0;
        typeSelect.selectedIndex = 0;
        
        //Apply the filters to the main list
        refreshBasetunesFilters()
    }
}

function refreshBasetunesFilters()
{
  //Get the display list object
  const select = document.getElementById('basetunesSelect');

  //Get the currently selected Author
  selectElement = document.getElementById('basetunesAuthor');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  var selectedAuthor = selectElement.options[selectElement.selectedIndex].value;

  //Get the currently selected Make
  selectElement = document.getElementById('basetunesMake');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  var selectedMake = selectElement.options[selectElement.selectedIndex].value;

  //Get the currently selected Type
  selectElement = document.getElementById('basetunesType');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  var selectedType = selectElement.options[selectElement.selectedIndex].value;

  //Clear the current options from the list
  while(select.options.length)
  {
      select.remove(0);
  }

  var validTunes = 0;
  for (var tune in basetuneList) 
  {
      //Check whether the current tune meets filters
      var AuthorBool = selectedAuthor == "All" || basetuneList[tune].provider == selectedAuthor;
      var MakeBool = selectedMake == "All" || basetuneList[tune].make == selectedMake;
      var TypeBool = selectedType == "All" || basetuneList[tune].type == selectedType;
      if(AuthorBool && MakeBool && TypeBool)
      {
          //var url = basetuneList[tune].baseURL.replace("$VERSION", selectedFW) + basetuneList[tune].filename;
          //console.log("Tune url: " + url);
          //console.log("Found a valid tune: " + basetuneList[tune].displayName);
          var newOption = document.createElement('option');
          newOption.dataset.filename = basetuneList[tune].filename;
          newOption.dataset.make = basetuneList[tune].make;
          newOption.dataset.description = basetuneList[tune].description;
          newOption.dataset.board = basetuneList[tune].board;
          newOption.innerHTML = basetuneList[tune].displayName + " - " + basetuneList[tune].type;
          select.appendChild(newOption);

          validTunes++;
      }
      
  }
  select.selectedIndex = 0;
  refreshBasetunesDescription()
  console.log("Tunes that met filters: " + validTunes);
}

function refreshBasetunesDescription()
{
  descriptionElement = document.getElementById('tuneDetailsText');
  //Get the currently selected Tune
  selectElement = document.getElementById('basetunesSelect');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  descriptionElement.innerHTML = selectElement.options[selectElement.selectedIndex].dataset.description;
}

ipcRenderer.on("add local hex", (event, filename, state) => 
{
  //Check if Local option already exists
  /*
  var lastOption = document.getElementById('versionsSelect').lastElementChild
  if(lastOption.innerHTML == "Local")
  {
    console.log("Local option already exists, updating");
    lastOption.value = filename;
  }
  else
  {
    var newOption = document.createElement('option');
    newOption.dataset.filename = filename;
    newOption.innerHTML = "Local";
    var select = document.getElementById('versionsSelect');
    select.appendChild(newOption);
  }
  */
 useLocalTune = true;
 localTuneFile = filename;
 document.getElementById('versionsSelect').disabled = true;
 //console.log("Local hex file selected: " + filename);

  //Jump to the port selection screen
  $("[href='#port']").trigger('click');
})

function downloadHex(board, localFile="")
{

    var e = document.getElementById('versionsSelect');

    var DLurl;
    switch(board) {
      case "TEENSY35":
        DLurl = "http://speeduino.com/fw/teensy35/" + e.options[e.selectedIndex].value + "-teensy35.hex";
        console.log("Downloading Teensy 35 firmware: " + DLurl);
        break;
      case "TEENSY36":
        DLurl = "http://speeduino.com/fw/teensy36/" + e.options[e.selectedIndex].value + "-teensy36.hex";
        console.log("Downloading Teensy 36 firmware: " + DLurl);
        break;
      case "TEENSY41":
        DLurl = "http://speeduino.com/fw/teensy41/" + e.options[e.selectedIndex].value + "-teensy41.hex";
        console.log("Downloading Teensy 41 firmware: " + DLurl);
        break;
      case "ATMEGA2560":
        DLurl = "http://speeduino.com/fw/bin/" + e.options[e.selectedIndex].value + ".hex";
        console.log("Downloading AVR firmware: " + DLurl);
        break;
      case "STM32F407_DFU":
        DLurl = "http://speeduino.com/fw/stm32f407/" + e.options[e.selectedIndex].value + "-stm32f407.bin";
        console.log("Downloading STM32F407 firmware: " + DLurl);
        break;
      default:
        DLurl = "http://speeduino.com/fw/bin/" + e.options[e.selectedIndex].value + ".hex";
        console.log("Downloading AVR firmware: " + DLurl);
        break;
    }
    
    //Download the Hex file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });

}

function downloadIni()
{
    var e = document.getElementById('versionsSelect');
    if(useLocalTune) 
    {
      console.log("Local version selected, not downloading ini");
      return;
    }

    var DLurl = "https://speeduino.com/fw/" + e.options[e.selectedIndex].value + ".ini";
    console.log("Downloading: " + DLurl);

    //Download the ini file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });

}

function downloadBasetune()
{
  console.log("downloading");
  
  var basetuneSelect = document.getElementById('basetunesSelect');
  var basetuneOption = basetuneSelect.options[basetuneSelect.selectedIndex];
  //var version = document.getElementById('versionsSelect');
  //var DLurl = "https://github.com/noisymime/speeduino/raw/" + version + "/reference/Base%20Tunes/" + e.options[e.selectedIndex].value;
  var DLurl = "https://github.com/speeduino/Tunes/raw/main/" + basetuneOption.dataset.make + "/" + basetuneOption.dataset.filename;
  console.log("Downloading: " + DLurl);

  //Download the ini file
  ipcRenderer.send("download", {
      url: DLurl,
      properties: {directory: "downloads"}
  });

  const baseTuneLink = document.querySelectorAll('a[href="#basetunes"]');
  baseTuneLink[0].click();
}

//Installing the Windows drivers
function installDrivers()
{
    ipcRenderer.send("installWinDrivers", {
    });

}

function downloadComplete(file)
{
  //Lookup what platform we're using
  var portSelect = document.getElementById('portsSelect');
  var uploadBoard = portSelect.options[portSelect.selectedIndex].getAttribute("board");
  var extension = file.substr(file.length - 3);
  if(extension == "ini")
  {
      statusText.innerHTML = "Downloading firmware"
      document.getElementById('iniFileText').style.display = "block"
      document.getElementById('iniFileLocation').innerHTML = file
      downloadHex(uploadBoard);
  }
  else if(extension == "hex" || extension == "bin")
  {
    console.log("Uploading da file!!");
    statusText.innerHTML = "Beginning upload..."

    //Retrieve the select serial port
    var e = document.getElementById('portsSelect');
    uploadPort = e.options[e.selectedIndex].value;
    
    console.log("Using port: " + uploadPort);

    //Show the sponsor banner
    document.getElementById('sponsorbox').style.display = "block"

    //Begin the upload
    if(uploadBoard.includes("TEENSY"))
    {
      console.log("Uploading using Teensy_loader")
      ipcRenderer.send("uploadFW_teensy", {
        port: uploadPort,
        firmwareFile: file,
        board: uploadBoard
      });
    }
    else if(uploadBoard.includes("STM32F407"))
    {
      console.log("Uploading using DFU Util")
      ipcRenderer.send("uploadFW_stm32", {
        port: uploadPort,
        firmwareFile: file,
        board: uploadBoard,
        vid: portSelect.options[portSelect.selectedIndex].getAttribute("vid"),
        pid: portSelect.options[portSelect.selectedIndex].getAttribute("pid")
      });
    }
    else
    {
      ipcRenderer.send("uploadFW", {
          port: uploadPort,
          firmwareFile: file
      });
    }
  }
}

function uploadFW()
{

    //Start the spinner
    var spinner = document.getElementById('progressSpinner');
    //Disable the Re-burn/re-install button
    var reinstallButton = document.getElementById("btnReinstall")
    reinstallButton.disabled = true;
    //Remove any old icons
    spinner.classList.remove('fa-pause');
    spinner.classList.remove('fa-check');
    spinner.classList.remove('fa-times');
    spinner.classList.add('fa-spinner');

    //Hide the terminal section incase it was there from a previous burn attempt
    document.getElementById('terminalSection').style.display = "none";
    //Same for the ini location link
    document.getElementById('iniFileText').style.display = "none";

    var statusText = document.getElementById('statusText');
    var burnPercentText = document.getElementById('burnPercent');
    

    if(useLocalTune)
    {
      //ipcRenderer.send("download complete", { file: localTuneFile, state: "complete" });
      downloadComplete(localTuneFile);
    }
    else
    {
      statusText.innerHTML = "Downloading INI file"
      downloadIni();
    }

    ipcRenderer.on("download complete", (event, file, state) => {
        console.log("Saved file: " + file); // Full file path
        downloadComplete(file);
        
    });

    ipcRenderer.on("upload completed", (event, code) => {
        statusText.innerHTML = "Upload to arduino completed successfully!";
        burnPercentText.innerHTML = "";

        //Turn the spinner off
        spinner.classList.remove('fa-spinner');
        spinner.classList.add('fa-check');

        //Re-enable the re-burn button
        reinstallButton.disabled = false;

    });

    ipcRenderer.on("upload percent", (event, percent) => {
        statusText.innerHTML = "Uploading firmware to board"
        burnPercentText.innerHTML = " (" + percent + "%)";
    });

    ipcRenderer.on("upload error", (event, code) => {
        statusText.innerHTML = "Upload to Speeduino failed";

        //Hide the donation bar as it makes the terminal go offscreen
        document.getElementById('sponsorbox').style.display = "none"

        //Mke the terminal/error section visible
        document.getElementById('terminalSection').style.display = "block";
        document.getElementById('terminalText').innerHTML = code;
        spinner.classList.remove('fa-spinner');
        spinner.classList.add('fa-times');



        reinstallButton.disabled = false;
    });


}

async function checkForUpdates()
{
    //Adds the current version number to the Titlebar
    let current_version = await ipcRenderer.invoke("getAppVersion");
    document.getElementById('title').innerHTML = "Speeduino Universal Firmware Loader (v" + current_version + ")"

    var url = "https://api.github.com/repos/speeduino/SpeedyLoader/releases/latest";

    //document.getElementById('detailsHeading').innerHTML = version;

    fetch(url)
    .then((response) => {
        if (response.ok) {
            return response.json();
        }
        return Promise.reject(response);
    })
    .then((result) => {

        latest_version = result.tag_name.substring(1);
        console.log("Latest version: " + latest_version);

        var semver = require('semver');
        if(semver.gt(latest_version, current_version))
        {
            //New version has been found
            document.getElementById('update_url').setAttribute("href", result.html_url);
            document.getElementById('update_text').style.display = "block";
        }
    })
    .catch((error) => {
        console.log('Could not get latest version.', error);
    });

}

window.onload = function () {
    refreshAvailableFirmwares();
    refreshBasetunes();
    refreshSerialPorts();
    checkForUpdates();
};

$(function(){

	// Button handlers
	$(document).on('click', '#btnChoosePort', function(event) {
		$("[href='#port']").trigger('click');
	});

  $(document).on('click', '#btnSelectLocal', function(event) {
    ipcRenderer.send('selectLocalFirmware');
  });

	$(document).on('click', '#btnBasetune', function(event) {
		$("[href='#basetunes']").trigger('click');
	});

	$(document).on('click', '#btnLoader', function(event) {
		$("[href='#loader']").trigger('click');
	});

	$(document).on('click', '#btnDetails', function(event) {
		refreshDetails();
		$("[href='#details']").trigger('click');
	});

	$(document).on('click', '#btnInstall', function(event) {
		$("[href='#progress']").trigger('click');
		uploadFW();
	});

	$(document).on('click', '#btnReinstall', function(event) {
		$("[href='#progress']").trigger('click');
		uploadFW();
	});

	$(document).on('click', '#btnDownloadBasetune', function(event) {
		const select = document.getElementById('basetunesSelect');
		const selectedTune = select.options[select.selectedIndex];
		document.getElementById("tuneBoard").innerHTML = selectedTune.dataset.board;

		$("[href='#basetunewarning']").trigger('click');
	});

	$(document).on('click', '#btnDownloadCancel', function(event) {
		$("[href='#basetunes']").trigger('click');
	});

	$(document).on('click', '#btnExit', function(event) {
		ipcRenderer.invoke('quit-app');
	});

	$(document).on('click', '#iniFileLink', function(event) {
    var location = document.getElementById('iniFileLocation').innerHTML
    if (location != "")
    {
      ipcRenderer.invoke('show-ini', location);
    }
	});

  //Detect devices hotplug
  usb.usb.on('attach', refreshSerialPorts);
  usb.usb.on('detach', refreshSerialPorts);

}); 