/*
KlippyDash
https://github.com/nixkor/KlippyDash 
*/
var _serverInfo = new Array();
var _printerInfo = new Array();
var _printerObjects = new Array();
var _ajaxTimeout = 10 * 1000;
var _printers;


const _htmlCode = {  //trying to implement some form of typing status to remove unwanted classes - may be a better way
	"celsius":"&#8451;", 
	"octagon":"<i class='fa fa-exclamation-triangle icon' />",
	"play":"<i class='fa fa-play icon' />",
	"stop":"<i class='fa fa-stop icon' />",
	"pause":"<i class='fa fa-pause icon' />",
	"refresh":"<i class='fa fa-refresh icon' />"
};

function getPrinterObjects(printer, index) {
	var endpoint = "/printer/objects/query?gcode_move&toolhead&extruder=temperature,target,power&heater_bed&print_stats&display_status&bed_mesh=mesh_min,mesh_max,probed_matrix";

	$.ajax({
		url: printer.host + endpoint,
		type: 'GET',
		contentType: 'application/json',
		timeout: _ajaxTimeout,
		success:function(data) 
		{ 
			_printerObjects[index] = data.result.status;
			processStatus(printer, index);
		},
		error:function(err)
		{
			showError(index, `Error connecting to ${printer.name}`, false);
			setProgressBar(index,1,"error")
		}
	});
}

function getPrinterInfo(printer, index) {
	var endpoint = "/printer/info";

	$.ajax({
		url: printer.host + endpoint,
		type: 'GET',
		contentType: 'application/json',
		timeout: _ajaxTimeout,
		success:function(data) 
		{ 
			_printerInfo[index] = data.result;
			processStatus(printer, index);
		},
		error:function(err)
		{
			showError(index, `Error connecting to ${printer.name}`, false);
			setProgressBar(index,1,"error")
		}
	});
}

function getServerInfo(printer, index) { 
	var endpoint = "/server/info";
	
	$.ajax({
		url: printer.host + endpoint,
		type: 'GET',
		contentType: 'application/json',
		timeout: _ajaxTimeout,
		success: function(data) { 
			_serverInfo[index] = data.result;
			processStatus(printer, index);
		},
		error: function(err) { 
			showError(index, `Error connecting to ${printer.name}`,false);
			setProgressBar(index,1,"error")
		}
	});
}

function processStatus(printer, index) {
	//do sanity checks
	if (typeof(_serverInfo[index]) == "undefined") 
		return;

	if (typeof(_printerObjects[index]) == "undefined") 
		return;		
		
	if (typeof(_printerInfo[index]) == "undefined") 
		return;				
		
	var si = _serverInfo[index];
	var pi = _printerInfo[index];
	var po = _printerObjects[index];
	
	//process data
	$(`#tile${index}>.section-time`).text(Date().toString());

	clearErrors(index);
	setControls(index,"idle");
	
	//check connections and show warnings / errors
	if(!si.klippy_connected) {
		showError(index, "Klippy not connected!");
		setProgressBar(index,1,"error")
		return;
	}
	
	if(pi.state == 'error' || pi.state == 'shutdown') {   //!= "ready"
		showError(index, pi.state_message);
		setProgressBar(index,1,"error")
		return;
	}
	
	if(si.klippy_state != 'ready') {
		showError(index, "Klippy State:" + si.klippy_state);
	}

	setProgressBar(index, po.display_status.progress, po.print_stats.state);
	
	//extruder temps
	var divExtruder =  $(`#tile${index}>.section-extruder`);
	if(po.extruder.target > 0 || po.extruder.temperature > 30) {
		divExtruder.find(".extruder-temp").text(po.extruder.temperature.toFixed(1));
		divExtruder.find(".extruder-target").text(po.extruder.target);
		divExtruder.removeClass("hidden");
	}
	else {
		divExtruder.addClass("hidden");
	}
	
	//bed temps
	var divHeaterBed = $(`#tile${index}>.section-bed`);
	if(po.heater_bed.target > 0 || po.heater_bed.temperature > 30) {
		divHeaterBed.find(".bed-temp").text(po.heater_bed.temperature.toFixed(1));
		divHeaterBed.find(".bed-target").text(po.heater_bed.target);
		divHeaterBed.removeClass("hidden");
	}
	else {
		divHeaterBed.addClass("hidden");
	}
	
	//filename
	var divFile = $(`#tile${index}>.section-file`);
	if(po.print_stats.state == "printing" || po.print_stats.state == "paused" || po.print_stats.state =="complete" || po.print_stats.state == "cancelled") {
		divFile.find(".filename").text(po.print_stats.filename);
		divFile.removeClass("hidden");
	}
	else {
		divFile.addClass("hidden");
	}
	
	//print stats
	var divPrintStats =$(`#tile${index}>.section-printstats`);
	if(po.print_stats.state == "printing" || po.print_stats.state == "paused" || po.print_stats.state == "complete") {
			divPrintStats.find(".total-time").html(formatTime(po.print_stats.total_duration));
			divPrintStats.find(".print-time").html(formatTime(po.print_stats.print_duration));
			divPrintStats.find(".filament-used").text((po.print_stats.filament_used/1000).toFixed(2));	
			
			if(po.display_status.progress > 0 && po.print_stats.state != "complete") { //printing or paused
				var estimatedTotalTime = (po.print_stats.print_duration / po.display_status.progress);
				var remainingTime = estimatedTotalTime - po.print_stats.print_duration;
				divPrintStats.find(".remaining-time").html(formatTime(remainingTime));
				
				var endTime = new Date();
				endTime = new Date(endTime.getTime() + (remainingTime * 1000));
				if(endTime.day == (new Date()).day) {
					divPrintStats.find(".eta-time").text(endTime.toLocaleTimeString());
				}
				else {
					divPrintStats.find(".eta-time").text(endTime.toLocaleString());
				}
				divPrintStats.find(".printing-container").removeClass("hidden");
				setControls(index, po.print_stats.state);			
			}
			else if(po.display_status.progress > 0) { //complete
				divPrintStats.find(".printing-container").addClass("hidden");

				setControls(index,"complete");
			}
			else{ //starting up
				divPrintStats.find(".remaining-time").html("<span class='dynamic-value'>Calculating...</span>");
				divPrintStats.find(".eta-time").text("Calculating...");

				divPrintStats.find(".printing-container").removeClass("hidden");
				setControls(index, "printing");
			}
			
			divPrintStats.removeClass("hidden");
	}
	else if(po.print_stats.state == "cancelled") { //cancelled
		setControls(index, "cancelled");
	}
	else { //idle
		divPrintStats.addClass("hidden");
		setControls(index, "idle");
	}
		
	//errors
	if(po.print_stats.state == "error") {
		showError(index,`Error: ${po.print_stats.message}`);
		setProgressBar(index,1,"error")
	}
}

function setControls(index, state) {
	switch(state) {
		case "printing":
			setControlVisibility(index,"resume", false);
			setControlVisibility(index,"pause", true);
			setControlVisibility(index,"cancel",false);
			setControlVisibility(index,"e-stop",true);
			setControlVisibility(index,"clear",false);
			break;
		case "paused":
			setControlVisibility(index,"resume",true);
			setControlVisibility(index,"pause",false);
			setControlVisibility(index,"cancel",true);
			setControlVisibility(index,"e-stop",true);
			setControlVisibility(index,"clear",false);
			break;
		case "cancelled":
			setControlVisibility(index,"resume",false);
			setControlVisibility(index,"pause",false);
			setControlVisibility(index,"cancel",false);
			setControlVisibility(index,"e-stop",true);
			setControlVisibility(index,"clear",true);
			break;
		case "complete":			
			setControlVisibility(index,"resume",false);
			setControlVisibility(index,"pause",false);
			setControlVisibility(index,"cancel",false);
			setControlVisibility(index,"e-stop",true);
			setControlVisibility(index,"clear",true);		
			break;
		case "error":
		case "idle":
		default:
			setControlVisibility(index,"resume",false);
			setControlVisibility(index,"pause",false);
			setControlVisibility(index,"cancel",false);
			setControlVisibility(index,"e-stop",true);
			setControlVisibility(index,"clear",false);
	}
}

function setControlVisibility(index, name, visible) {
	var ctrl = getControl(index,name);
	if(typeof(ctrl) != "undefined" && ctrl.length>0) {
		if(visible){
			ctrl.removeClass("hidden");
		}
		else {
			ctrl.addClass("hidden");
		}
	}
}

function getControl(index, name) {
	return $(`#tile${index}>.title-container>.control-wrap>.control-${name}`);
}

function formatTime(seconds, mode = "compact-html") {	
	const minute = 60;
	const hour = minute * 60;
	const day = hour * 24; 
	
	var d = Math.floor((seconds / day));
	seconds -= d * day;
	var h = Math.floor((seconds / hour));
	seconds -= h * hour;
	var m =  Math.floor((seconds / minute));
	seconds -= m * minute;
	var s = Math.floor(seconds);
	
	var response = "";
	
	switch(mode) {
		case "compact-html":
			if (d > 0) {
				response += `<span class="dynamic-value">${d}</span>d`;
			}
			if (h > 0) {
				response += `<span class="dynamic-value">${h}</span>h`;
			}
			if (m > 0) {		
				response += `<span class="dynamic-value">${m}</span>m`;
			}
			if (s > 0 || response == "") 
				response += `<span class="dynamic-value">${s}</span>s`;			
			break;
		case "basic":
			if (d > 0) {
				response += `${d}:`;
			}
			if (h > 0) {
				if(h <= 9) response += "0";
				response += `${h}:`;
			}
			if (m > 0) {		
				if(m <= 9) response += "0";
				response += `${m}:`;
			}
			if(s <= 9) response += "0";
			response += `${s}`;
			
			if(response.substring(0,1) == "0") { //remove leading zeros
				response = response.substring(1);
			}
			break;			
		case "compact":
			if (d > 0) {
				response += `${d}d`;
				//if(h+m+s > 0) response += " ";
			}
			if (h > 0) {
				response += `${h}h`;
				//if(m+s > 0) response += " ";
			}
			if (m > 0) {		
				response += `${m}m`;
				//if(s > 0) response += " ";
			}
			if (s > 0 || response == "") response += `${s}s`;
			break;			
		case "verbose":
		default:
			if (d > 0) {
				response += `${d} days`;
				if(h+m+s > 0) response += ", ";
			}
			if (h > 0) {
				response += `${h} hours`;
				if(m+s > 0) response += ", ";
			}
			if (m > 0) {		
				response += `${m} minutes`;
				if(s > 0) response += ", ";
			}
			if (s > 0 || response == "") response += `${s} seconds`;
			break;
	}
	
	return response;
}

function showExtruder(index, enabled) {
	var div = $(`#tile${index}>.section-extruder`);
	if(enabled)
		div.removeClass("hidden");
	else
	{
		div.addClass("hidden");	
	}
}

function clearErrors(index) {
	var div = $(`#tile${index}>.section-error`);
	div.addClass("hidden");

	//only remove body alert if all errors are silenced.
	if($(".tile>.section-error").not(".hidden").length == 0 ) {
		$("body").removeClass("alert");
	}
}

function showError(index, message, alert = true) {
	var div = $(`#tile${index}>.section-error`);

	div.html(message);
	div.removeClass("hidden");

	if(alert) {
		$("body").addClass("alert");
	}
}

function updatePrinterInfo(printer,index) {
	getPrinterInfo(printer,index);
	getPrinterObjects(printer, index);
	getServerInfo(printer,index);
}

function updatePrinter(printer, index) {
	updatePrinterInfo(printer, index);
	updateCamera(printer,index);
}

function updateCamera(printer, index) {
	var cam = $(`#tile${index}>div.cam>img.cam`);
	//only update if in snapshot mode?
	if(cam.attr("src").includes("snapshot")) {
		cam.attr("src", printer.host + "/webcam/?action=snapshot&cache=" + Math.random());
	}
}

function refreshTitle() {
	if($("body").hasClass("alert"))
		document.title = "!!! ALERT !!! KlippyDash";
	else 
		document.title = "KlippyDash";
}

function updateAll() {
	_printers.forEach(function(val, index, arr) {
		updatePrinter(val, index);
	});

	refreshTitle();
}

function setProgressBar(index, percent, state, message = undefined) {
	var statusDict = {  //trying to implement some form of typing status to remove unwanted classes - may be a better way
		"success":{"status":"success"}, 
		"warning": {"status":"warning"}, 
		"error": {"status":"error"}, 
		"party-time": {"status":"party-time"}, 
		"standby": {"status":"standby"},
		"printing":{"status":"printing"}
	};
	var bonusClass = undefined;
	
	switch(state) {
		case "printing":
			if (typeof(message) == "undefined") message = `Printing - ${percent.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:0, maximumFractionDigits:0})}`;	
			bonusClass = statusDict["printing"].status;
			break;
		case "complete":
			if (typeof(message) == "undefined") message = "Complete";
			bonusClass = statusDict["success"].status;
			percent = 1;
			break;
		case "paused":
			if (typeof(message) == "undefined") message = `Paused - ${percent.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:0, maximumFractionDigits:0})}`;	
			bonusClass = statusDict["warning"].status;
			break;
		case "error":
			if (typeof(message) == "undefined") message = "Error";
			bonusClass = statusDict["error"].status;
			percent = 1;
			break;
		case "standby":
			message = "Standby";
			bonusClass = statusDict["standby"].status;
			percent = 1;
			break;
		case "cancelled":
			message = "Cancelled";
			bonusClass = statusDict["error"].status;
			percent = 1;  
			break;
		default:
			if (typeof(message) == "undefined") message = `Unhandled State: ${state}`;
			bonusClass = statusDict["warning"].status;
			percent = 1;
			break;
	}
	var bar = $(`#tile${index}>.progress-bar`);
	if(message != undefined) bar.find(".progress-bar-text").text(message);
	
	
	//remove previous bonus class if it changed.
	for(const key in statusDict) {
		if(statusDict[key].status != bonusClass) 
			bar.find(".progress-bar-progress").removeClass(statusDict[key].status);
	}
	
	if(bonusClass != undefined) bar.find(".progress-bar-progress").addClass(bonusClass);

	if(percent > 0) {
		bar.find(".progress-bar-progress").attr("style",`width:${percent.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:0, maximumFractionDigits:0})}`).removeClass("hidden");
	}
	else {
		bar.find(".progress-bar-progress").attr("style",`width:${percent.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:0, maximumFractionDigits:0})}`).removeClass("hidden");  //if showing bar make sure to set appropriately!
		//bar.find(".progress-bar-progress").addClass("hidden");
	}
	
	//animate bar if printing
	if(state=="printing") 
		bar.addClass("animated");
	else
		bar.removeClass("animated");
}

function createTiles() {
	var canvas = $("#klippydash");

	_printers.forEach(function(val, index, arr) {
		var data = {"index": index}; 
	
		//build the tiles
		canvas
			.append($("<div>")//tile
				.attr("class","tile")
				.attr("id","tile" + index)
				.attr("data",JSON.stringify(data))
				.append($("<div>") 
					.attr("class","title-container")
					.append($("<div>") //title
						.attr("class", "title")
						.append($("<a>")
						.attr("href",`${val.host}/`)
							.attr("target","_blank")
							.html(`${val.name}`)
						)
					)
					.append($("<div>")
						.attr("class","control-wrap") 
						.append($("<span>")
							.attr("class","control-resume hidden")
							.attr("title","Resume")
							.attr("data",JSON.stringify(data))
							.html(_htmlCode["play"])
						)
						.append($("<span>")
							.attr("class","control-pause hidden")
							.attr("title","Pause")
							.attr("data",JSON.stringify(data))
							.html(_htmlCode["pause"])
						)						
						.append($("<span>")
							.attr("class","control-cancel hidden")
							.attr("title","Cancel")
							.attr("data",JSON.stringify(data))
							.html(_htmlCode["stop"])
						)
						.append($("<span>")
							.attr("class","control-clear hidden")
							.attr("title","Clear")
							.attr("data",JSON.stringify(data))
							.html(_htmlCode["refresh"])
						)																		
						.append($("<span>")
							.attr("class","control-e-stop hidden")
							.attr("title","E-Stop")
							.attr("data",JSON.stringify(data))
							.html(_htmlCode["octagon"])
						)
					)
				)
				.append($("<div>") //camera 
					.attr("class","cam")
						.append($("<img>")
							.attr("class","cam")
							.attr("data",JSON.stringify(data))
						)
				)
				.append($("<div>")
					.attr("class","progress-bar")
					.append($("<div>")
						.attr("class","progress-bar-progress")
						.attr("style","width:0%")
						.append($("<span>")
							.attr("id","progressbar-text").attr("class","progress-bar-text")						
						)						
					)
				)
				.append($("<div>")
					.attr("class","section-file tile-line hidden")
					.append($("<span>").attr("class","label").append("File Name: "))
					.append($("<span>")
						.attr("class","filename dynamic-value")
					)
				)
				.append($("<div>")
					.attr("class","section-printstats hidden")
					.append($("<div>")
						.attr("style","display:block;")
						.append($("<span>")
							.attr("class","tile-line")
							.attr("style","display:inline-block;text-align:left;width:50%")
							.append($("<span>").attr("class","label").append("Total Time: "))
							.append($("<span>")
								.attr("class", "total-time")
							)
						)
						.append($("<span>")
							.attr("class","printing-container tile-line")
							.attr("style","display:inline-block;text-align:left;width:50%")
							.append($("<span>").attr("class","label").append("Remaining Time: "))
							.append($("<span>")
								.attr("class", "remaining-time")
							)
						)	
					)
					.append($("<div>")
						.attr("style","display:block;")					
						.append($("<span>")
							.attr("class","tile-line")
							.attr("style","display:inline-block;text-align:left;width:50%")
							.append($("<span>").attr("class","label").append("Print Time: "))
							.append($("<span>")
								.attr("class", "print-time")
							)
						)						
						.append($("<span>")
							.attr("class","printing-container tile-line")
							.attr("style","display:inline-block;text-align:left;width:50%")
							.append($("<span>").attr("class","label").append("ETA: "))
							.append($("<span>")
								.attr("class", "eta-time dynamic-value")
							)
						)							
					)					
					.append($("<div>")
						.attr("class","tile-line")					
						.attr("style","display:block;")
						.append($("<span>").attr("class","label").append("Filament Used: "))
						.append($("<span>")
							.attr("class", "filament-used dynamic-value")
						)
						.append("m")
					)					
				)
				.append($("<div>")
					.attr("class","section-extruder tile-line hidden")
					.append($("<span>").attr("class","label").append("Extruder: "))
					.append($("<span>")
						.attr("class","extruder-temp dynamic-value")
					)
					.append(" / ")
					.append($("<span>")
						.attr("class","extruder-target dynamic-value")
					)
					.append($("<sup>").html(_htmlCode["celsius"]))
				)
				.append($("<div>")
					.attr("class","section-bed tile-line hidden")
					.append($("<span>").attr("class","label").append("Bed: "))
					.append($("<span>")
						.attr("class","bed-temp dynamic-value")
					)
					.append(" / ")
					.append($("<span>")
						.attr("class","bed-target dynamic-value")
					)
					.append($("<sup>").html(_htmlCode["celsius"]))
				)		
				.append($("<div>") //error
						.attr("class","section-error hidden")
				)				
				.append($("<div>")
					.attr("class","section-time tiny" )
				)
			)
	});


	//add error popups
	canvas.append($("<div>")
		.attr("id","confirmation-dialog")
		.attr("title","Are you sure?")
		.append($("<span>")
			.attr("class","message")
		)
	);

	//add footer
	canvas.append($("<div>").attr("class","footer").html("<a href='https://github.com/nixkor/KlippyDash'>KlippyDash</a> - a lightweight Klipper dashboard."));
}

//filter printers based on querystring
function filterPrinters(dictQueryString) {
	var allPrinters = settings.printers;

	if("printer" in dictQueryString || "printerFilter" in dictQueryString) {
		var queryStringArray;
		if("printer" in dictQueryString) {
			queryStringArray = dictQueryString["printer"].split(',');  //querystring is expected to be comma separated list of ints - substring removes the leading ?
		}
		else if("printerFilter" in dictQueryString)  {  //DEPRECATED - use printer
			queryStringArray = dictQueryString["printerFilter"].split(',');  //querystring is expected to be comma separated list of ints - substring removes the leading ?
		}
		else { //this should never happen but just in case...
			return allPrinters;
		}

		var filteredPrinters = new Array();
		queryStringArray.forEach(function (val, index, arr) {  
			if (Number.parseInt(val) >= 0
				&& Number.parseInt(val) < allPrinters.length) { //do some sanity checking on string value
				filteredPrinters.push(allPrinters[Number.parseInt(val)]);
			}
		});			
		return filteredPrinters;
	}
	else {
		return allPrinters;
	}
}

function parseQueryString() {
	var dict = {};
	if(location.search.length > 1) {
			var queryString = location.search.substring(1); //remove the ? 
			var pairs = queryString.split("&"); // split querystring on ampersand into kv pairs
			pairs.forEach(function(pair, index, arr) {
				var kvp = pair.split("=");  //split pair on equals into parts
				var key = kvp[0];
				var value = kvp[1];

				value = decodeURIComponent(value);
				value = value.replace(/\+/g, ' ');

				dict[key] = value;
			});
	}
	
	return dict;
}

function showConfirmation(title, htmlMessage, endpoint) {
	$("#confirmation-dialog").attr("title",title);
	$("#confirmation-dialog>.message").html(htmlMessage);
	$("#confirmation-dialog").dialog({
		modal: true,
		autoOpen: true,
		width: 500,
		resizable: false,
		draggable:false,
		buttons: {
			"Yes" : function() { 
				$.ajax({
					url: endpoint,
					type: 'POST',
					contentType: 'application/json',
					timeout: _ajaxTimeout,
					error: function(err) { 
						alert(`failure! ${err}`);
					}
				});
				$(this).dialog("close"); 
			},
			"No" : function() { 
				$(this).dialog("close"); 
			} 
		},
	});
}

function setup() {	
	dictQueryString = parseQueryString();
	
	_printers = filterPrinters(dictQueryString);

	if(settings.ajaxTimeout > 0) _ajaxTimeout = Number.parseInt(settings.ajaxTimeout);

	createTiles();

	//bind jquery handlers
	bindHandlers();

	//set full screen if passed
	if("fullscreen" in dictQueryString && JSON.parse(dictQueryString["fullscreen"])) {
		$("body").addClass("full-screen");
	}

	//set theme if passed in querystring
	var theme = settings.theme;
	if("theme" in dictQueryString) 
		theme = dictQueryString["theme"];
	document.documentElement.setAttribute("data-theme",theme);

	var interval = 1000;
	if(settings.refreshInterval > 0) interval = Number.parseInt(settings.refreshInterval);
			
	var timer = setInterval(function() { updateAll(); }, interval);	//This is the timer that refreshes the screen. 
}

var party = {
	_timer: undefined,
	On: function(seconds = 30) {
		if(this._timer !== undefined) {
			party.Off(); //turn off the previous party!
		}	
		$("body").addClass("party-time");		
		this._timer = setTimeout(() => { party.Off(); }, seconds * 1000);
	},
	Off: function() {
		clearInterval(this._timer);
		$("body").removeClass("party-time");
		this._timer = undefined;
	},
	AreWePartying: function() { return (this._timer !== undefined); }
} 

$().ready(() => {	
	setup();
	updateAll();
});

function bindHandlers() {
	$(".control-e-stop").click(function(e) {
		var data = JSON.parse($(this).closest(".tile").attr("data"));
		var printer = _printers[data.index];

		showConfirmation("Emergency Stop?",
			`Are you sure you want to emergency stop?<br/><br />Printer: ${printer.name}`,
			`${printer.host}/printer/emergency_stop`
		);
	});

	$(".control-pause").click(function(e) {
		var data = JSON.parse($(this).closest(".tile").attr("data"));
		var printer = _printers[data.index];

		showConfirmation("Pause Print?",
			`Are you sure you want to pause?<br/><br />Printer: ${printer.name}`,
			`${printer.host}/printer/print/pause`
		);
	});

	$(".control-resume").click(function(e) {
		var data = JSON.parse($(this).closest(".tile").attr("data"));
		var printer = _printers[data.index];

		showConfirmation("Resume?",
			`Are you sure you want to resume?<br/><br />Printer: ${printer.name}`,
			`${printer.host}/printer/print/resume`
		);
	});

	$(".control-cancel").click(function(e) {
		var data = JSON.parse($(this).closest(".tile").attr("data"));
		var printer = _printers[data.index];

		showConfirmation("Cancel?",
			`Are you sure you want to cancel?<br/><br />Printer: ${printer.name}`,
			`${printer.host}/printer/print/cancel`
		);
	});

	$(".control-clear").click(function(e) {
		var data = JSON.parse($(this).closest(".tile").attr("data"));
		var printer = _printers[data.index];

		var endpoint = "/printer/gcode/script?script=SDCARD_RESET_FILE";
		$.ajax({
			url: printer.host + endpoint,
			type: 'POST',
			contentType: 'application/json',
			timeout: _ajaxTimeout,

			error: function(err) {
				alert(`failure! ${err}`);
			}
		});
	});

	//set inital to snapshot
	$("img.cam").each(function () {
		var data = JSON.parse($(this).attr("data"));
		$(this).attr("src", _printers[data.index].host + "/webcam/?action=snapshot&cache=" + Math.random());
	});

	//set hover to stream
	$("img.cam").hover(function(e) {
		var data = JSON.parse($(this).attr("data"));
		$(this).attr("src", _printers[data.index].host + "/webcam/?action=stream");
	},
	function(e) {
			var data = JSON.parse($(this).attr("data"));
			$(this).attr("src", _printers[data.index].host + "/webcam/?action=snapshot&cache=" + Math.random());
	});

	//toggle full screen view if image is clicked
	$("div.cam").click(function(e) {
		var data = JSON.parse($(this).closest(".tile").attr("data"));

		baseUrl = window.location.href.split('?')[0] 

		if("theme" in dictQueryString) 
			theme = dictQueryString["theme"];

		//if full screen toggle back to full view
		if("fullscreen" in dictQueryString && JSON.parse(dictQueryString["fullscreen"])) {
			if(typeof(theme) !== "undefined") {
				window.location.href = `${baseUrl}?theme=${theme}`;	
			}
			else {
				window.location.href = baseUrl;
			}
		}
		else{
			if(typeof(theme) !== "undefined") {
				window.location.href = `${baseUrl}?theme=${theme}&printer=${data.index}&fullscreen=1`;
			}
			else {
				window.location.href = `${baseUrl}?printer=${data.index}&fullscreen=1`;
			}
		}
	});
}

