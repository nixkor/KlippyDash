//setup printers here

var settings = {
	"printers" : [
		{
			"name":"My Printer", //Display name
			"host":"http://localhost" //Base uri for printer - should have /webcam + various api endpoints
		}
	],
	//"ajaxTimeout":10*1000, //ajaxTimeout in ms - default is 10,000 *(10s) - If you are using older hardware and see lots alternating in and out of error strates, it is likely due to performance of your system and this should be increased.
	//"refreshInterval":1*1000, //refresh interval in ms - default is 1000 (1s) - see above.
	//"theme":"miami", //theme - override default if specified (can also override via querystring)
};
