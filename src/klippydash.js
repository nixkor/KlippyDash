/*
KlippyDash
https://github.com/nixkor/KlippyDash 
*/
var _serverInfo = new Array();
var _printerInfo = new Array();
var _printerObjects = new Array();
var _ajaxTimeout = 10 * 1000;
var printers;

String.prototype.format = String.prototype.f = function() {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
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
			showError(index, `Error connecting to ${printer.name}`);
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
			showError(index, `Error connecting to ${printer.name}`);
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
			showError(index, `Error connecting to ${printer.name}`);
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
	if(po.print_stats.state == "printing" || po.print_stats.state == "paused" || po.print_stats.state =="complete") {
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
			
			if(po.display_status.progress > 0 && po.print_stats.state != "complete") { //printing
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
			}
			else if(po.display_status.progress > 0) { //complete
				divPrintStats.find(".printing-container").addClass("hidden");
			}
			else {
				divPrintStats.find(".remaining-time").html("<span class='dynamic-value'>Calculating...</span>");
				divPrintStats.find(".eta-time").text("Calculating...");
				divPrintStats.find(".printing-container").removeClass("hidden");
			}
			
			divPrintStats.removeClass("hidden");
	}
	else {
		divPrintStats.addClass("hidden");
	}
		
	//errors
	if(po.print_stats.state == "error") {
		showError(index,`Error: ${po.print_stats.message}`);
		setProgressBar(index,1,"error")
	}
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
}

function showError(index, message) {
	var div = $(`#tile${index}>.section-error`);

		div.html(message);
		div.removeClass("hidden");

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
	var cam = $(`#tile${index}>div.cam>a>img.cam`);
	//only update if in snapshot mode?
	if(cam.attr("src").includes("snapshot")) {
		cam.attr("src", printer.host + "/webcam/?action=snapshot&cache=" + Math.random());
	}
}

function updateAll() {
	printers.forEach(function(val, index, arr) {
		updatePrinter(val, index);
	});
}

function setProgressBar(index, percent, state, message = undefined) {
	var statusDict = {"success":{"status":"success"}, "warning": {"status":"warning"}, "error": {"status":"error"}, "party-time": {"status":"party-time"}}; //trying to implement some form of typing status to remove unwanted classes - may be a better way
	var bonusClass = undefined;
	
	switch(state) {
		case "printing":
			if (typeof(message) == "undefined") message = `Printing - ${percent.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:0, maximumFractionDigits:0})}`;	
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

	printers.forEach(function(val, index, arr) {
		var data = {"host": val.host}; 
	
		//build the tiles
		canvas
			.append($("<div>")//tile
				.attr("class","tile")
				.attr("id","tile" + index)
				.append($("<div>") 
					.attr("class","title-container")
					.append($("<div>") //title
						.attr("class", "title")
						.append(`${val.name}`)
					)
					.append($("<div>")
						.attr("class","stop-sign-wrap hidden")
						.append($("<div>")
							.attr("class","stop-sign")
							.append($("<span>")
								.attr("class","stop-sign-text")
								.text("!")	
							)
						)
					)	
				)
				.append($("<div>") //camera 
					.attr("class","cam")
					.append($("<a>")
						.attr("href",val.host + "/")
						.append($("<img>")
							.attr("class","cam")
							.attr("id","cam" + index)
							.attr("data",JSON.stringify(data))
						)
					)
				)
				.append($("<div>")
					.attr("id","progressbar" + index)
					.attr("class","progress-bar")
					.append($("<div>")
						.attr("id","progressbar-progress")
						.attr("class","progress-bar-progress")
						.attr("style","width:0%")
						.append($("<span>")
							.attr("id","progressbar-text").attr("class","progress-bar-text")						
						)						
					)
				)
				.append($("<div>")
					.attr("id","file" + index)
					.attr("class","section-file tile-line hidden")
					.append($("<span>").attr("class","label").append("File Name: "))
					.append($("<span>")
						.attr("id","filename")
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
					.attr("id","extruder" + index)
					.attr("class","section-extruder tile-line hidden")
					.append($("<span>").attr("class","label").append("Extruder: "))
					.append($("<span>")
						.attr("id","extruder-temp")
						.attr("class","extruder-temp dynamic-value")
					)
					.append(" / ")
					.append($("<span>")
						.attr("id","extruder-target")
						.attr("class","extruder-target dynamic-value")
					)
					.append($("<sup>").append("&#8451;"))
				)
				.append($("<div>")
					.attr("id","bed" + index)
					.attr("class","section-bed tile-line hidden")
					.append($("<span>").attr("class","label").append("Bed: "))
					.append($("<span>")
						.attr("id","bed-temp")
						.attr("class","bed-temp dynamic-value")
					)
					.append(" / ")
					.append($("<span>")
						.attr("id","bed-target")
						.attr("class","bed-target dynamic-value")
					)
					.append($("<sup>").append("&#8451;"))
				)		
				.append($("<div>") //error
						.attr("id","error" + index)
						.attr("class","section-error error hidden")
				)				
				.append($("<div>").attr("id","time" + index)
					.attr("class","section-time tiny" )
				)
			)
	});

	canvas.append($("<div>").attr("class","footer").text("KlippyDash - a lightweight Klipper dashboard."));
}

function setup() {
	printers = settings.printers;

	createTiles();
	
	//set inital to snapshot
	$("img.cam").each(function() {
		var data = JSON.parse($(this).attr("data"));
		$(this).attr("src", data.host + "/webcam/?action=snapshot&cache=" + Math.random());
	});
	
	//set hover to stream
	$("img.cam").hover(function(e) {
		var data = JSON.parse($(this).attr("data"));
		$(this).attr("src", data.host + "/webcam/?action=stream");
	},
	function(e) {
		var data = JSON.parse($(this).attr("data"));
		$(this).attr("src", data.host + "/webcam/?action=snapshot&cache=" + Math.random());
	});
	
	var timer = setInterval(function() { updateAll(); }, 1000);	
}

$().ready(function(){	
	setup();	
	updateAll();	

	$(".e-stop").click(function() {
		alert("EMERGENCY STOP!"); //TODO: code this
	})
});