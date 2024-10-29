/*
KlippyDash
https://github.com/nixkor/KlippyDash 
*/
var _ajaxTimeout = 10 * 1000;
var _printers;
var _printerState = new Array();

const PrintStatsState = {
	Printing: "printing",
	Paused: "paused",
	Complete: "complete",
	Cancelled: "cancelled",
	Error: "error",
	Standby: "standby"
};

const PrintInfoState = {
	Ready: "ready",
	Error: "error",
	Shutdown: "shutdown"
};

const HtmlCode = {
	Celsius:"&#8451;", 
	Octagon:"<i class='fa fa-exclamation-triangle icon' />",
	Play:"<i class='fa fa-play icon' />",
	Stop:"<i class='fa fa-stop icon' />",
	Pause:"<i class='fa fa-pause icon' />",
	Refresh:"<i class='fa fa-refresh icon' />"
};

const SvgIcon = {
	Flow:"M7,2H17V7H19V13H16.5L13,17H11L7.5,13H5V7H7V2M10,22H2V20H10A1,1 0 0,0 11,19V18H13V19A3,3 0 0,1 10,22M7,9V11H8.5L12,15L15.5,11H17V9H15V4H9V9H7Z",
	Speed:"M12,16A3,3 0 0,1 9,13C9,11.88 9.61,10.9 10.5,10.39L20.21,4.77L14.68,14.35C14.18,15.33 13.17,16 12,16M12,3C13.81,3 15.5,3.5 16.97,4.32L14.87,5.53C14,5.19 13,5 12,5A8,8 0 0,0 4,13C4,15.21 4.89,17.21 6.34,18.65H6.35C6.74,19.04 6.74,19.67 6.35,20.06C5.96,20.45 5.32,20.45 4.93,20.07V20.07C3.12,18.26 2,15.76 2,13A10,10 0 0,1 12,3M22,13C22,15.76 20.88,18.26 19.07,20.07V20.07C18.68,20.45 18.05,20.45 17.66,20.06C17.27,19.67 17.27,19.04 17.66,18.65V18.65C19.11,17.2 20,15.21 20,13C20,12 19.81,11 19.46,10.1L20.67,8C21.5,9.5 22,11.18 22,13Z",
	Offset:"M12,18.54L19.37,12.8L21,14.07L12,21.07L3,14.07L4.62,12.81L12,18.54M12,16L3,9L12,2L21,9L12,16M12,4.53L6.26,9L12,13.47L17.74,9L12,4.53Z",
}

const Sounds = {
	Success:"audio/success.mp3",
}

function updatePrinterObjects(index, data) { 
	var currentState = _printerState[index];
	if(typeof(currentState) !== "undefined" && typeof(currentState.objects) !== "undefined") {
		if(currentState.objects.status.print_stats.state != PrintStatsState.Complete && data.status.print_stats.state == PrintStatsState.Complete) {
			party.On();
			soundTest();
		}
	}
	
	if(typeof(currentState) == "undefined")
		_printerState[index] = {};

	_printerState[index].objects = data;
	processState(index);
}

function updatePrinterInfo(index, data) {
	var currentState = _printerState[index];
	if(typeof(currentState) !== "undefined"  && typeof(currentState.printer) !== "undefined") {

	}

	if(typeof(currentState) == "undefined")
		_printerState[index] = {};

	_printerState[index].printer = data;
	processState(index);
}

function updateServerInfo(index, data) {
	var currentState = _printerState[index];
	if(typeof(currentState) !== "undefined"  && typeof(currentState.server !== "undefined")) {

	}

	if(typeof(currentState) == "undefined")
		_printerState[index] = {};

	_printerState[index].server = data;
	processState(index);
}

function getPrinterObjects(printer, index) {
	var endpoint = "/printer/objects/query?gcode_move&toolhead&extruder=temperature,target,power&heater_bed&print_stats&display_status&bed_mesh=mesh_min,mesh_max,probed_matrix";

	$.ajax({
		url: printer.host + endpoint,
		type: 'GET',
		contentType: 'application/json',
		timeout: _ajaxTimeout,
		success:function(data) 
		{
			updatePrinterObjects(index, data.result);
		},
		error:function(err)
		{
			showError(index, `Error connecting to ${printer.name}`, false);
			setProgressBar(index, 1, PrintStatsState.Error)
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
			updatePrinterInfo(index, data.result);
		},
		error:function(err)
		{
			showError(index, `Error connecting to ${printer.name}`, false);
			setProgressBar(index, 1, PrintStatsState.Error)
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
			updateServerInfo(index, data.result);
		},
		error: function(err) { 
			showError(index, `Error connecting to ${printer.name}`,false);
			setProgressBar(index, 1, PrintStatsState.Error)
		}
	});
}

function processState(index) {
	//sanity check all data is populated
	if(typeof(_printerState[index]) === "undefined" 
		|| typeof(_printerState[index].objects) === "undefined"
		|| typeof(_printerState[index].printer) === "undefined"
		|| typeof(_printerState[index].server) === "undefined")
			return;

	var server = _printerState[index].server;
	var printer = _printerState[index].printer;
	var objects = _printerState[index].objects.status;

		
	//process data
	$(`#tile${index}>.section-time`).text(Date().toString());

	clearErrors(index);
	setControls(index,"idle");
	
	//check connections and show warnings / errors
	if(!server.klippy_connected) {
		showError(index, "Klippy not connected!");
		setProgressBar(index, 1, PrintStatsState.Error);
		return;
	}
	
	if(printer.state == 'error' || printer.state == 'shutdown') {   //!= "ready"
		showError(index, printer.state_message);
		setProgressBar(index, 1, PrintStatsState.Error);
		return;
	}
	
	if(server.klippy_state != 'ready') {
		showError(index, "Klippy State:" + server.klippy_state);
	}

	setProgressBar(index, objects.display_status.progress, objects.print_stats.state);
	
	//extruder temps
	var divExtruder =  $(`#tile${index}>.section-extruder`);
	if(objects.extruder.target > 0 || objects.extruder.temperature > 30 || objects.gcode_move.extrude_factor != 1.0 || objects.gcode_move.speed_factor != 1.0) {
		divExtruder.find(".extruder-temp").text(objects.extruder.temperature.toFixed(1));
		divExtruder.find(".extruder-target").text(objects.extruder.target);
		divExtruder.removeClass("hidden");

		//extruder flow
		var divExtruderFlow = divExtruder.find(".section-extruder-flow");
		if(objects.gcode_move.extrude_factor != 1.0) {
			divExtruderFlow.find(".extruder-flow").text(objects.gcode_move.extrude_factor * 100);
			divExtruderFlow.removeClass("hidden");
		}
		else {
			divExtruderFlow.addClass("hidden");
		}

		//speed factor
		var divSpeedFactor = divExtruder.find(".section-speed-factor");
		if(objects.gcode_move.speed_factor != 1.0) {
			divSpeedFactor.find(".speed-factor").text(objects.gcode_move.speed_factor * 100);
			divSpeedFactor.removeClass("hidden");
		}
		else {
			divSpeedFactor.addClass("hidden");
		}

		//zoffset
		var divZOffset = divExtruder.find(".section-z-offset");
		if(objects.gcode_move.homing_origin[2] != 0.0) {
			divZOffset.find(".z-offset").text(objects.gcode_move.homing_origin[2].toFixed(3));
			divZOffset.removeClass("hidden");
		}
		else {
			divZOffset.addClass("hidden");
		}
	}
	else {
		divExtruder.addClass("hidden");
	}
	
	//bed temps
	var divHeaterBed = $(`#tile${index}>.section-bed`);
	if(objects.heater_bed.target > 0 || objects.heater_bed.temperature > 30) {
		divHeaterBed.find(".bed-temp").text(objects.heater_bed.temperature.toFixed(1));
		divHeaterBed.find(".bed-target").text(objects.heater_bed.target);
		divHeaterBed.removeClass("hidden");
	}
	else {
		divHeaterBed.addClass("hidden");
	}
	
	//filename
	var divFile = $(`#tile${index}>.section-file`);
	if(objects.print_stats.state == "printing" || objects.print_stats.state == "paused" || objects.print_stats.state =="complete" || objects.print_stats.state == "cancelled") {
		divFile.find(".filename").text(objects.print_stats.filename);
		divFile.removeClass("hidden");
	}
	else {
		divFile.addClass("hidden");
	}
	
	//print stats
	var divPrintStats =$(`#tile${index}>.section-printstats`);
	if(objects.print_stats.state == "printing" || objects.print_stats.state == "paused" || objects.print_stats.state == "complete") {
			divPrintStats.find(".total-time").html(formatTime(objects.print_stats.total_duration));
			divPrintStats.find(".print-time").html(formatTime(objects.print_stats.print_duration));
			divPrintStats.find(".filament-used").text((objects.print_stats.filament_used/1000).toFixed(2));	
			
			if(objects.display_status.progress > 0 && objects.print_stats.state != "complete") { //printing or paused
				var estimatedTotalTime = (objects.print_stats.print_duration / objects.display_status.progress);
				var remainingTime = estimatedTotalTime - objects.print_stats.print_duration;
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
				setControls(index, objects.print_stats.state);			
			}
			else if(objects.display_status.progress > 0) { //complete
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
	else if(objects.print_stats.state == "cancelled") { //cancelled
		setControls(index, "cancelled");
	}
	else { //idle
		divPrintStats.addClass("hidden");
		setControls(index, "idle");
	}
		
	//errors
	if(objects.print_stats.state == "error") {
		showError(index,`Error: ${objects.print_stats.message}`);
		setProgressBar(index, 1, PrintStatsState.Error);
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
	var ctrl = getTileControl(index,name);
	if(typeof(ctrl) != "undefined" && ctrl.length>0) {
		if(visible){
			ctrl.removeClass("hidden");
		}
		else {
			ctrl.addClass("hidden");
		}
	}
}

function getTileControl(index, name) {
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

function updatePrinterData(printer,index) {
	getPrinterInfo(printer,index);
	getPrinterObjects(printer, index);
	getServerInfo(printer,index);
}

function updatePrinter(printer, index) {
	updatePrinterData(printer, index);
	updateCamera(printer,index);
}

function updateCamera(printer, index) {
	var cam = $(`#tile${index}>div.cam>img.cam`);
	//only update if in snapshot mode?
	if(cam.attr("src").includes("snapshot")) {
		cam.attr("src", printer.host + "/webcam/?action=snapshot&cache=" + Math.random());
	}
}

function calculateRemainingTime(duration, progress) {
	if(progress > 0)  //dont divide by 0
	{
		var estTotalTime = (duration / progress);
		return estTotalTime - duration;
	}
	return undefined; 
}

function calculateEta(remainingTime) {
	if(typeof(remainingTime) === "undefined") return "Calculating..."

	var endTime = new Date();
	endTime = new Date(endTime.getTime() + (remainingTime * 1000));
	if(endTime.day == (new Date()).day) { //if same day only show time
		return endTime.toLocaleTimeString();
	}
	else {
		return endTime.toLocaleString();
	}
}

function refreshTitle() {
	var title = "";
	if($("body").hasClass("alert"))
		title = "!!!ALERT!!!"
	else {
		if(_printerState.filter(ps => ps.objects.status.print_stats.state == PrintStatsState.Printing).length > 0) {
			if(title.length > 0) title += " ";
			var p = _printerState.filter(ps => ps.objects.status.print_stats.state == PrintStatsState.Printing).sort((a,b) =>  calculateRemainingTime(a.objects.status.print_stats.print_duration, a.objects.status.display_status.progress) - calculateRemainingTime(b.objects.status.print_stats.print_duration, b.objects.status.display_status.progress))[0];

			title += `Printing: ${_printerState.filter(ps => ps.objects.status.print_stats.state == PrintStatsState.Printing).length}; ETA: ${calculateEta(calculateRemainingTime(p.objects.status.print_stats.print_duration, p.objects.status.display_status.progress))}`;			
		}
	}
	if(title.length > 0) title += " - ";
	title = title += "KlippyDash";
	document.title = title;
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
		case PrintStatsState.Printing:
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
	}
	
	//animate bar if printing
	if(state == PrintStatsState.Printing) 
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
							.html(HtmlCode.Play)
						)
						.append($("<span>")
							.attr("class","control-pause hidden")
							.attr("title","Pause")
							.attr("data",JSON.stringify(data))
							.html(HtmlCode.Pause)
						)						
						.append($("<span>")
							.attr("class","control-cancel hidden")
							.attr("title","Cancel")
							.attr("data",JSON.stringify(data))
							.html(HtmlCode.Stop)
						)
						.append($("<span>")
							.attr("class","control-clear hidden")
							.attr("title","Clear")
							.attr("data",JSON.stringify(data))
							.html(HtmlCode.Refresh)
						)																		
						.append($("<span>")
							.attr("class","control-e-stop hidden")
							.attr("title","E-Stop")
							.attr("data",JSON.stringify(data))
							.html(HtmlCode.Octagon)
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
					.append($("<sup>").html(HtmlCode.Celsius))
					.append($("<span>")
						.attr("class","section-extruder-flow")
						.attr("title","Flow")
						.append($("<span>").attr("class","label").append(showSvgIcon(SvgIcon.Flow)))
						.append($("<span>")
							.attr("class","extruder-flow dynamic-value")
						)
						.append("%")
					)
					.append($("<span>")
						.attr("class","section-speed-factor")
						.attr("title","Speed Factor")
						.append($("<span>").attr("class","label").append(showSvgIcon(SvgIcon.Speed)))
						.append($("<span>")
							.attr("class","speed-factor dynamic-value")
						)
						.append("%")
					)
					.append($("<span>")
						.attr("class","section-z-offset")
						.attr("title","Z-Offset")
						.append($("<span>").attr("class","label").append(showSvgIcon(SvgIcon.Offset)))
						.append($("<span>")
							.attr("class","z-offset dynamic-value")
						)
						.append("mm")
					)					
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
					.append($("<sup>").html(HtmlCode.Celsius))
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

function showSvgIcon(icon) {
	htmlCode = "";
	if(icon.length > 0) {
		htmlCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="icon-svg" style=""><path d="${icon}"></path></svg>`;
	}
	return htmlCode;
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
//	soundTest();
});

function soundTest() {
	var audio = new Audio(Sounds.Success);
	var promise = audio.play();
	if (promise !== undefined) {
        promise.then(_ => {
            // Autoplay started!
        }).catch(error => {
            // Autoplay was prevented. Show a "Play" button so that user can start playback.
        });
    }

}

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

