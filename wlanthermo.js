/**
 * wlanthermo adapter
 * used iobroker template to start: https://github.com/ioBroker/ioBroker.template
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

var pathChannels = "channels";
var pathPits     = "pits";
var pathButtons  = "buttons";
var pathSettings = "settings";
var pathStatus   = "device";

var timer_monitoring = null;
var timer_timeouts = null;
var timer_temps = null;
var timer_postwlt = null;
var initAnswer = "So long and thanks for all the fish!";

var checkwlt_active = false;
var pollwlt_active = false;
var newLogfile_active = false;
var getwltcfg_active = false;
var postwltcfg_active = false;
var cond_update = "ne";
var cond_update_temp = "any";

var bootstrapped = false;
var initialized = false;

// default empty object to store WLT related data
var WLT = {"wlt": {}, "cfg": {}};

var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = new utils.Adapter('wlanthermo');
var mySysID = "";


// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
		stopTimers;
        callback();
    } catch (e) {
        callback();
    }
});


//----------------------------
// Some message was sent to adapter instance over message box.
// Used by email, pushover, text2speech, ...
//
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});


//---------------------------- 
// Adapter got ready
//
adapter.on('ready', function () {	
	initBasics();
	initSettings();
	initButtons();
	wait4bootstrap(function(){
		installUpdateHandlers();
		reset();
	});
});


/*****************************
 * stores val in obj at position oid
 */
function oid2obj(obj, oid, val, callback) {
	var a = String(oid).split(".");
	var o = obj;
	var p, k;

	while (a.length > 1) {
		k = a.shift();
		if (typeof(o[k]) == 'undefined') o[k] = {};
		o = o[k];
	}
	o[a[0]] = val;
	
	if (typeof(callback) === 'function') callback(null, obj);	
}


/*****************************
 * copiels object src to obj dst
 */
function cpObj(dst={}, obj, callback) {
	var d=dst;
	var o=obj;
	var k;
	
	if (typeof(o) === 'object')
		for (k in o) {
			if (typeof(o[k]) === 'object') {
				d[k] = {};
				cpObj(d[k], o[k])
			} else d[k] = o[k];
		}
	
	if (typeof(callback) === 'function') callback(null, dst);
}


/*****************************
 * wait for bootstrap-inits to be finished
 */
function wait4bootstrap(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.info("...checking bootstrap: " + bootstrapped);
	if (bootstrapped) {
		callback(null, bootstrapped);
		return true;
	}
	
	var t = true;
	if (typeof(WLT[pathButtons]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathButtons].reset) === "undefined") t=false;
	if (t) if (typeof(WLT[pathButtons].check_wlt) === "undefined") t=false;
	if (t) if (typeof(WLT[pathButtons].poll_temps) === "undefined") t=false;
	if (t) if (typeof(WLT[pathButtons].active) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings].interval_monitoring) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings].interval_temps) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings].interval_timeouts) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings].timeout_device_off) === "undefined") t=false;
	
	bootstrapped = t;
	setTimeout(wait4bootstrap, 250, callback);
}


/*****************************
 * wait for initialization to be finished
 * not a complete check yet, but...
 */
function wait4init(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.info("...checking init: " + initialized);
	if (initialized) {
		callback(null, initialized);
		return true;
	}
	
	var t = true;	
	if (typeof(WLT[pathPits]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathPits][adapter.config.maxPits]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels][adapter.config.maxChannels]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels][adapter.config.maxChannels].temp) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels][adapter.config.maxChannels].state) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels][adapter.config.maxChannels]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels][adapter.config.maxChannels].alarm) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels][adapter.config.maxChannels].notification) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels].global) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels].global.alarm) === "undefined") t=false;
	if (t) if (typeof(WLT[pathChannels].global.notification) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings].interval_temps) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings].interval_timeouts) === "undefined") t=false;
	if (t) if (typeof(WLT[pathSettings].interval_monitoring) === "undefined") t=false;
	if (t) if (typeof(WLT[pathStatus]) === "undefined") t=false;
	if (t) if (typeof(WLT[pathStatus].active) === "undefined") t=false;
	if (t) if (typeof(WLT[pathStatus].answer) === "undefined") t=false;
	if (t) if (typeof(WLT[pathStatus].rc) === "undefined") t=false;
	if (t) if (typeof(WLT[pathStatus].reachable) === "undefined") t=false;
	if (t) if (typeof(WLT[pathStatus].alarm_timeout) === "undefined") t=false;
	
	initialized = t;
	setTimeout(wait4init, 250, callback)
}


/*****************************
 * install state and object update handlers
 */
function installUpdateHandlers(callback) {
	adapter.log.info("installUpdateHandlers");
	adapter.subscribeStates('*');	
	adapter.on('stateChange', function(id, state) { stateUpdateHandler(id, state); });

	/** not used yet
	adapter.on('objectChange', function (id, obj) { objectUpdateHandler(id, obj); });
	**/

	if (typeof(callback) === 'function') callback(null);
}


/*****************************
 * object update hanlder
 */
/** no used yet
function objectUpdateHandler(id, obj, callback) {}	
	// Warning, obj can be null if it was deleted
	adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
	if (typeof(callback) === 'function') callback(null);
}
**/

	
/*****************************
 * state update hanlder
 */
function stateUpdateHandler(id, state, callback) {
	adapter.log.debug('stateUpdate, initialized='+initialized+': ' + id + ': ' + JSON.stringify(state));
	
	// id holds the oid changed as string
	// state.from holds the name of what changed the state.
	// eg: system.adapter.admin.o or system.adapter.wlanthemo.0.

	if (initialized && state && id) {
		var a = id.split(".");
		adapter.log.debug('state change: ' + id + ': ' + JSON.stringify(state));
		
		// think of updating WLT like this because we might face changes
		// in data structure. But do it in sections below to differenciate
		// there between updates and changes
		//oid2obj(WLT, id, state.val);
		
		if (a[2] === pathButtons) {
			switch (a[3]) {
				case "reset":
					adapter.log.info('Button: reset=' + state.val);
					setTimeout(storeState, 1000, id, {val: false, ack: true}, "ne");
					if (state.val) reset();
					WLT[pathButtons].reset = state.val;
					break;
				case "active":
					adapter.log.info('Switch: active=' + state.val);
					storeState(pathStatus + ".active", {val:state.val, ack:true}, "ne");
					WLT[pathButtons].active = state.val;
					break;
				case "poll_temps":
					adapter.log.info('Button: poll_temps=' + state.val);
					if (state.val) pollWLT(function(){handleWLT("wlt");});
					setTimeout(storeState, 1000, id, {val: false, ack: true}, "ne");
					WLT[pathButtons].poll_temps = state.val;
					break;
				case "check_wlt":
					adapter.log.info('Button: check_wlt=' + state.val);
					if (state.val) checkWLT(function(){handleWLT(pathStatus);});
					setTimeout(storeState, 1000, id, {val: false, ack: true}, "ne");
					WLT[pathButtons].check_wlt = state.val;
					break;
				case "new_logfile":
					adapter.log.info('Button: new_logfile=' + state.val);
					if (state.val) newLogfile(function(){handleWLT(pathStatus);});
					setTimeout(storeState, 1000, id, {val: false, ack: true}, "ne");
					WLT[pathButtons].new_logfile = state.val;
					break;
				case "wlt_beeper":
					if (state.val !== ov) {
						if (state.from !== mySysID) {
							adapter.log.info("foreign update on switch " + a[3] + ": " + a[4] + "=" + state.val + " origin="+state.from);
							getWLTcfg(function() {
								//wlt2cfg();
								if (state.val)
									WLT.cfg["beeper_enabled"] = "True";
								else
									delete WLT.cfg["beeper_enabled"];
								prepWLTpost();
							});
						}
					}
					break;
				default:
					oid2obj(WLT, id, state.val);
					break;
			}
		} else if (a[2] === pathStatus) {
			switch (a[3]) {
				case "active":
					adapter.log.info('Change: active=' + state.val);
					WLT[pathStatus].active = state.val;
					reset();
					break;
				default:
					oid2obj(WLT, id, state.val);
					break;
			}
		} else if (a[2] === pathChannels) {
			var ov = WLT[pathChannels][a[3]][a[4]];
			WLT[pathChannels][a[3]][a[4]] = state.val;
			// here we know the structure; oid2obj(WLT, id, state.val);
		
			switch (a[4]) {
				case 'temp':
					if (state.val !== ov) {
						WLT.last_seen = state.lc;
						handleChannelUpdate(a[3], state);
					}
					break;
				case 'temp_min':
				case 'temp_max':
					if (state.val !== ov) {
						handleChannelUpdate(a[3], state);
						if (state.from !== mySysID) {
							adapter.log.info("foreign update on channel " + a[3] + ": " + a[4] + "=" + state.val + " origin="+state.from);
							getWLTcfg(function() {
								//wlt2cfg();
								WLT.cfg[a[4] + a[3]] = state.val;
								prepWLTpost();
							});
						}
					}
					break;
				case 'alarm':
					// handleChannelUpdate controls already via 'cond_update' if
					// alarms are stored always or only on update.
					// idea behind: possibility to change behavior: alarm-triggers
					// in ioBroker vs. system load for each update
					// needs rethinking.
					if (a[3] !== 'global')
						handleGlobalAlarms("alarm");
					break;
				case 'alarm_min':
					if (a[3] !== 'global')
						handleGlobalAlarms("alarm_min");
					break;
				case 'alarm_max':
					if (a[3] !== 'global')
						handleGlobalAlarms("alarm_max");
					break;
				case 'active':
					if (a[3] !== 'global')
						handleGlobalAlarms("active");
					break;
				case 'ack':
					if (a[3] === 'global')
						handleGlobalAck(state.val);
					else
						handleChannelUpdate(a[3], state);
				case 'name':
					if (state.val !== ov) {
						if (state.from !== mySysID) {
							adapter.log.info("foreign update on channel " + a[3] + ": " + a[4] + "=" + state.val + " origin="+state.from);
							getWLTcfg(function() {
								//wlt2cfg();
								WLT.cfg["tch" + a[3]] = state.val;
								prepWLTpost();
							});
						}
					}
					break;
				default:
					break;
			}
		} else if (a[2] === pathPits) {
			// since I do not have a pitmaster available, I do not 
			// understand required semantics, but let's be accurate
			// on the data...
			oid2obj(WLT, id, state.val);
		} else if (a[2] === pathSettings) {
			var ov = WLT[a[2]][a[3]];
			WLT[a[2]][a[3]] = state.val;
			switch (a[3]) {
				case "interval_monitoring":
				case "interval_temps":
				case "interval_timeouts":
					if (ov !== state.val) initTimers();
					break;
				case "timeout_device_off":
					// future code
					break;
				default:
					// future code
					break;
			}
		} else {
			// shall not happen, but user might add things via admin interface...
			oid2obj(WLT, id, state.val);
		}

	}
	
	if (typeof(callback) === 'function') callback(null);
}


/******************************
 * creates an empty dummy object to be used with a sate object
 */
function createEmptyObject(n, t, callback) {
	if (typeof(callback) === "function")
		callback({type: 'state', common: {name: n, role: "state", type: t, read: true, write: true}, native: {}});
}


/******************************
 * storeState - creates object if needed and stores status as needed
 * cond: any=always, ne=not equal, nc=no change, only if not exist
 * obj: object to be defined if it does not already exist
 */
function storeState(oid, state={"val": null, "ack": true}, cond="ne", obj, callback) {
	//adapter.log.debug("storeState(" + oid + ", " + JSON.stringify(state) + ", " + cond + ", " + JSON.stringify(obj) + ")");
	callback = (typeof(callback) === 'function') ? callback : function() {};
	
	// self-protection
	if (state && typeof(state) !== 'object' && typeof(state) !== 'undefined') {
		var v = state;
		state = {val: v, ack: true};
		adapter.log.warn('storeState: converted value to state object: ' + v);
	}
	
	adapter.getObject(oid, function (e, o) {
		if (o) {
			adapter.getState(oid, function (e, s) {
				if (s) {
					if (cond === "any" ) {
						adapter.setState(oid, state, function() {
							adapter.getState(oid, function(e, s) { callback(e, s); });	
						});
					} else if (cond === "ne" && s.val !== state.val) {
						adapter.setState(oid, state, function() {
							adapter.getState(oid, function(e, s) { callback(e, s); });	
						});
					} else if (cond === "nc") {
						adapter.getState(oid, function(e, s) { callback(e, s); });	
					} else { // future use
						adapter.getState(oid, function(e, s) { callback(e, s); });	
					}
				} else {
					adapter.log.debug('storeState: creating new state ' + oid + ': ' + JSON.stringify(state));
					adapter.setState(oid, state, function() {
						adapter.getState(oid, function(e, s) {
							callback(e, s);
						});	
					});
				}
			});
		} else if (typeof(obj) === "object" && obj !== null) {    // need to double-check null!!
			adapter.log.debug('storeState: Object to be created: ' + oid + ': ' + JSON.stringify(obj));
			adapter.setObject(oid, obj, function(e, o) { 
				adapter.log.debug('calling storeState() again after object creation: '+ oid + ", " + JSON.stringify(state) + ", " + cond + ", " + JSON.stringify(null) + ")");
				storeState(oid, state, cond, null, callback);
			});
		} else {
			e = 'storeState: ' + oid + ': ' + e;
			adapter.log.error(e);
			callback(e, state);
		}
	});
}


/*****************************
 * init pit
 */
function initPit(i, callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.debug('initPit: ' + i);
	if (typeof(WLT[pathPits][i]) === 'undefined') WLT[pathPits][i] = {};
	callback(null);
}


/*****************************
 * init pits
 */
function initPits(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.debug('initPits');
	
	if (typeof(WLT[pathPits]) === 'undefined') WLT[pathPits] = {};
	for (var i=1; i<=adapter.config.maxPits; i++) initPit(i, callback)
	
	callback(null);
}


/*****************************
 * initialize WLT temperature channel
 */
function initChannel(channel, callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};

	adapter.log.debug("initChannel: " + channel);

	if (typeof(channel) === 'undefined') {
		adapter.log.warn("initChannel: channel is not defined");
		callback("initChannel: channel is not defined");
		return;
	}	

	if (typeof(WLT[pathChannels][channel]) === 'undefined') WLT[pathChannels][channel] = {};
	
	storeState(pathChannels + "." + channel + ".temp", {val: 0, ack: true}, "nc",
		{
			type: 'state',
			common: {
					name: "Sensor temperature",
					role: "state",
					type: "number",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].temp = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".temp_min", {val: -20, ack:true}, "nc",
		{
				type: 'state',
			common: {
					name: "Minimum temperature",
					role: "state",
					type: "number",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].temp_min = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".temp_max", {val: 200, ack:true}, "nc",
		{
				type: 'state',
			common: {
					name: "Maximum temperature",
					role: "state",
					type: "number",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].temp_max = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".name", {val: "Kanal " + channel, ack:true}, "nc", 
		{
				type: 'state',
			common: {
					name: "WLT channel name",
					role: "state",
					type: "string",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].name = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".alert", {val: false, ack:true}, "nc", 
		{
				type: 'state',
			common: {
					name: "WLANThermo Web Alert",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].alert = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".color", {val: "black", ack:true}, "nc", 
		{
				type: 'state',
			common: {
					name: "Color for temperature chart on WLT web interface",
					role: "state",
					type: "string",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].color = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".show", {val: true, ack:true}, "nc", 
		{
				type: 'state',
			common: {
					name: "Show this channel in WLT web interface",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].show = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".state", {val: "er", ack:true}, "nc", 
		{
				type: 'state',
			common: {
					name: "Status of connected sensor (wire)",
					role: "state",
					type: "string",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].state = s.val;
		}
	);
	
	callback(null)
}


/*****************************
 * init channels
 */
function initChannels(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	
	adapter.log.debug('initChannels');
	if (typeof(WLT[pathChannels]) === 'undefined') WLT[pathChannels] = {};
	for (var i=0; i<=adapter.config.maxChannels; i++) initChannel(i, callback)

	callback(null);
}


/*****************************
 * initialize WLT Alarms channel
 */
function initAlarm(channel, callback) {
	callback = (typeof(callback) === 'function') ? callback : function(){};
	adapter.log.debug('initAlarm: channel ' + channel);
	
	if (typeof(channel) === 'undefined') {
		adapter.log.warn("initAlarm: channel is not defined");
		callback("initAlarm: channel is not defined");
		return;
	}
	
	if (typeof(WLT[pathChannels][channel]) === 'undefined') WLT[pathChannels][channel] = {};
	
	storeState(pathChannels + "." + channel + ".ack", {val: false, ack: true}, "ne",
		{
				type: 'state',
			common: {
					name: "Alarm acknowledgement",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].ack = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".active", {val: false, ack:true}, "ne",
		{
				type: 'state',
			common: {
					name: "true if alarming is active - temp rose above temp_min",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].active = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".alarm", {val: false, ack: true}, "ne",
		{
				type: 'state',
			common: {
					name: "General temperature alarm indicator",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].alarm = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".alarm_min", {val:false, ack:true}, "ne",
		{
				type: 'state',
			common: {
					name: "Temperature is below temp_min and was above before",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].alarm_min = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".alarm_max", {val:false, ack:true}, "ne",
		{
				type: 'state',
			common: {
					name: "Temperature is above temp_max",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].alarm_max = s.val;
		}
	);

	storeState(pathChannels + "." + channel + ".notification", {val:false, ack:true}, "ne",
		{
				type: 'state',
			common: {
					name: "true if channel has alarm and ack is false",
					role: "state",
					type: "boolean",
					read: true,
					write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathChannels][channel].notification = s.val;
		}
	);
	
	callback(null)
}


/*****************************
 * init alarms
 */
function initAlarms(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.debug('initAlarms');
	
	if (typeof(WLT[pathChannels]) === 'undefined') WLT[pathChannels] = {};
	for (var i=0; i<=adapter.config.maxChannels; i++) initAlarm(i, callback);
	
	callback(null);
}


/*****************************
 * initialize global alarms
 */
function initGlobalAlarms(callback=null) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.debug('initGlobalAlarms');
	initAlarm('global', callback);
	callback(null);
}


/*****************************
 * initialize states, buttons, configuration, etc
 */
function initBasics(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.debug('initBasics');

	mySysID = "system.adapter." + adapter.name + "." + adapter.instance;

	// WLANThermo mini hardware configuration. Think first before changing this.
	if (typeof(adapter.config.maxChannels) === "undefined") adapter.config.maxChannels = 11;  // 0-n
	if (typeof(adapter.config.maxPits) === "undefined") adapter.config.maxPits = 2;  // 1-n
	
	// account to log on to WLANThermo API
	if (typeof(adapter.config.hostname) === "undefined") adapter.config.hostname = "wlanthermo:80";
	if (typeof(adapter.config.username) === "undefined") adapter.config.username = "wlanthermo";
	if (typeof(adapter.config.password) === "undefined") adapter.config.password = "raspberry";
	
	// true: authentication required also for reading information from WLT
	if (typeof(adapter.config.auth_GET) === "undefined") adapter.config.auth_GET = false;
	
	// timeout in miliseconds for HTTP requests towards WLT device
	if (typeof(adapter.config.timeout_GET) === "undefined") adapter.config.timeout_GET = (2.5 * 1000);  // 2.5 seconds

	// monitoring timer (seconds): interval for checking device availability
	if (typeof(adapter.config.interval_monitoring) === "undefined") adapter.config.interval_monitoring = 60;
	if (typeof(adapter.config.interval_monitoring_min) === "undefined") adapter.config.interval_monitoring_min = 30; // minium acceptable

	// temp pollint timer (seconds): interval to read temperatures from device
	if (typeof(adapter.config.interval_temps) === "undefined") adapter.config.interval_temps = 5; 
	if (typeof(adapter.config.interval_temps_min) === "undefined") adapter.config.interval_temps_min = 4; // minimum acceptable

	
	// device timeout timer (seconds): interval to check for temp/device timeouts
	if (typeof(adapter.config.interval_timeouts) === "undefined") adapter.config.interval_timeouts = 10;
	if (typeof(adapter.config.interval_timeouts_min) === "undefined") adapter.config.interval_timeouts_min = 5; // minimum acceptaple

	// device timeout timer (seconds): alarm_timeout is set if no temp updates came for this period of time
	if (typeof(adapter.config.timeout_temps) === "undefined") adapter.config.timeout_temps = 30;
	if (typeof(adapter.config.timeout_temps_min) === "undefined") adapter.config.timeout_temps_min = 10; // minium acceptable

	// device timeout timer (seconds): device is considered to be off if no temp updates came for this period of time
	if (typeof(adapter.config.timeout_device_off) === "undefined") adapter.config.timeout_device_off = 300; 
	if (typeof(adapter.config.timeout_device_off_min) === "undefined") adapter.config.timeout_device_off_min = 30; // minimum acceptable
	
	// delay before sending POSTs to WLT device in seconds.
	if (typeof(adapter.config.delayPOST) === "undefined") adapter.config.delayPOST=4;
	if (adapter.config.delayPOST < 2) adapter.config.delayPOST = 2;
	if (adapter.config.delayPOST > 10) adapter.config.delayPOST = 10;

	
	callback(null);
}


/*****************************
 * init Buttons
 */
function initButtons(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.debug('initButtons');
	
	if (typeof(WLT[pathButtons]) === 'undefined') WLT[pathButtons] = {};
	storeState(pathButtons + ".active", {val: false, ack: true}, "nc",
		{
        		type: 'state',
			common: {
	    			name: "Turn device usage on or off - starts or stops temperature updates and such",
	    			role: "state",
	    			type: "boolean",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathButtons].active = s.val;
		}
	);


	storeState(pathButtons + ".check_wlt", {val: false, ack: true}, "ne",
		{
        		type: 'state',
			common: {
	    			name: "Manually check device availabilty one time",
	    			role: "button",
	    			type: "boolean",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathButtons].check_wlt = s.val;
		}

	);

	storeState(pathButtons + ".poll_temps", {val: false, ack: true}, "ne",
		{
        		type: 'state',
			common: {
	    			name: "Manually get temperatures one time",
	    			role: "button",
	    			type: "boolean",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathButtons].poll_temps = s.val;
		}

	);

	storeState(pathButtons + ".reset", {val: false, ack:true}, "ne",
		{
        		type: 'state',
			common: {
	    			name: "Reset temperatures, alarms, status and schedules of this adapter instance",
	    			role: "button",
	    			type: "boolean",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathButtons].reset = s.val;
		}
	);
	
	storeState(pathButtons + ".new_logfile", {val: false, ack:true}, "ne",
		{
        		type: 'state',
			common: {
	    			name: "Create new temp logfile on WLANThermo",
	    			role: "button",
	    			type: "boolean",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathButtons].reset = s.val;
		}
	);

	storeState(pathButtons + ".wlt_beeper", {val: false, ack: true}, "nc",
		{
        		type: 'state',
			common: {
	    			name: "Turn device beeper for temp alarms on/off",
	    			role: "state",
	    			type: "boolean",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathButtons].wlt_beeper = s.val;
		}
	);

	callback(null);
}


/*****************************
 * init settings
 */
function initSettings() {
	if (typeof(WLT[pathSettings]) === 'undefined') WLT[pathSettings] = {};
	adapter.log.debug('initSettings');

	storeState(pathSettings + ".interval_monitoring", {val: adapter.config.interval_monitoring, ack: true}, "nc", 
		{
        		type: 'state',
			common: {
	    			name: "Device monitoring interval in seconds",
	    			role: "state",
	    			type: "number",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathSettings].interval_monitoring = s.val;
		}
	);
		
	storeState(pathSettings + ".interval_temps", {val: adapter.config.interval_temps, ack:true}, "nc",
		{
        		type: 'state',
			common: {
	    			name: "Temperature read interval in seconds",
	    			role: "state",
	    			type: "number",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathSettings].interval_temps = s.val;
		}
	);

	storeState(pathSettings + ".interval_timeouts", {val: adapter.config.interval_timeouts, ack: true}, "nc",
		{
        		type: 'state',
			common: {
	    			name: "Interval to check for missing temp updates",
	    			role: "state",
	    			type: "number",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathSettings].interval_timeouts = s.val;
		}
	);	
 
	storeState(pathSettings + ".timeout_temps", {val: adapter.config.timeout_temps, ack: true}, "nc",
		{
        		type: 'state',
			common: {
	    			name: "device.alarm_timeout is raised if no temp updates are missing since this number of seconds",
	    			role: "state",
	    			type: "number",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathSettings].timeout_temps = s.val;
		}
	);

    storeState(pathSettings + ".timeout_device_off", {val: adapter.config.timeout_device_off, ack: true}, "nc",
		{
        		type: 'state',
			common: {
	    			name: "Device is considered to be turned off if temp updates are missing since this number of seconds",
	    			role: "state",
	    			type: "number",
	    			read: true,
	    			write: true
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathSettings].timeout_device_off = s.val;
		}
	);
}


/*****************************
 * initialize status information
 */
function initStatus(callback=null) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.debug('initStatus');
	
	if (typeof(WLT[pathStatus]) === 'undefined') WLT[pathStatus] = {};
	
	storeState(pathStatus + ".active", {val: false, ack:true}, "nc",
		{ 
			type: "state",
			common: {
				name: "True if device is currently used",
				role: "state",
				type: "boolean",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].active = s.val;
		}
	);

	storeState(pathStatus + ".alarm_timeout", {val: false, ack: true}, "ne",
		{
			type: "state",
			common: {
				name: "Device Timeout Alarm if true - no answer or updates from device since for too long",
				role: "state",
				type: "boolean",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].alarm_timeout = s.val;
		}
	);

	storeState(pathStatus + ".answer", {val: initAnswer, ack: true}, "ne",
		{
			type: "state",
			common: {
				name: "Device software version if ok or error message",
		                role: "state",
		                type: "string",
		                read: true,
		                write: false
	                    },
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].answer = s.val;
		}
	);

	storeState(pathStatus + ".cpu_load", {val: 0, ack:true}, "nc",
		{
			type: "state",
			common: {
				name: "Device CPU load",
				role: "state",
				type: "number",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].cpu_load = s.val;
		}
	);

	storeState(pathStatus + ".cpu_temp", {val: 0, ack:true}, "nc",
		{
			type: "state",
			common: {
				name: "Device CPU temperature",
				role: "state",
				type: "number",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].cpu_temp = s.val;
		}
	);

	storeState(pathStatus + ".rc", {val: 0, ack:true}, "ne",
		{
			type: "state",
			common: {
				name: "Last HTTP error code 200=ok",
				role: "state",
				type: "number",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].rc = s.val;
		}
	);

	storeState(pathStatus + ".reachable", {val: false, ack:true}, "ne",
		{
			type: "state",
			common: {
				name: "Device is reachable - monitoring result",
				role: "state",
				type: "boolean",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].reachable = s.val;
		}
	);

	storeState(pathStatus + ".temp_unit", {val: "celsius", ack:true}, "nc",
		{
			type: "state",
			common: {
				name: "Celsius or Farenheit, as configured on the device",
				role: "state",
				type: "string",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].temp_unit = s.val;
		}
	);

	storeState(pathStatus + ".timestamp", {val: "unknown", ack:true}, "nc",
		{
			type: "state",
			common: {
				name: "Timestamp of WLT_s last temp measurement",
				role: "state",
				type: "string",
				read: true,
				write: false
			},
			native: {}
		},
		function(e, s) {
			if (!e && s) WLT[pathStatus].timestamp = s.val;
		}
	);

	callback(null);
}


/******************************
 * stop timers
 */
function stopTimers(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.info("stopTimers");
	
    if (timer_monitoring || timer_monitoring !== null) {
		clearInterval(timer_monitoring);
		timer_monitoring = null;
	}
	
	if (timer_timeouts || timer_timeouts !== null) {
		clearInterval(timer_timeouts);
	}
	
    if (timer_temps || timer_temps !== null) {
		clearInterval(timer_temps);
	}
	
	callback(null);
}


/******************************
 * start timers
 */
function startTimers(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.info('startTimers');

    // montoring timer
    if (WLT[pathSettings].interval_monitoring) {
        if (WLT[pathSettings].interval_monitoring < adapter.config.interval_monitoring_min) {
			WLT[pathSettings].interval_monitoring = adapter.config.interval_monitoring_min;
			storeState(pathSettings + ".interval_monitoring", {val: WLT[pathSettings].interval_monitoring, ack: true}, "ne");
		}
        timer_monitoring = setInterval(function(){checkWLT(function(){handleWLT(pathStatus);});}, WLT[pathSettings].interval_monitoring * 1000);
		adapter.log.info('startTimers: check_wlt every ' + WLT[pathSettings].interval_monitoring + ' seconds');
    } else {
		adapter.log.info('startTimers: check_wlt timer disabled by configuration');
	}

    // device lost timer / timeouts on temperature updates
	if (WLT[pathStatus].active) {
    	if (WLT[pathSettings].interval_timeouts) {
			if (WLT[pathSettings].interval_timeouts < adapter.config.interval_timeouts_min) {
				WLT[pathSettings].interval_timeouts = adapter.config.interval_timeouts_min;
				storeState(pathSettings + ".interval_timeouts", {val:WLT[pathSettings].interval_timeouts, ack: true}, "ne");
			}
    	    timer_timeouts = setInterval(function(){checkTimeout();}, WLT[pathSettings].interval_timeouts * 1000);
			adapter.log.info('startTimers: check temperature timeouts every ' + WLT[pathSettings].interval_timeouts + ' seconds');
    	} else {
			adapter.log.info('startTimers: check temperature timeouts timer disabled by configuration');
		}
	} else {
		adapter.log.info("startTimers: check temperature timeouts disabled - active=false");
	}
	
	// timer for temperature polling
	if (WLT[pathStatus].active) {
        if (WLT[pathSettings].interval_temps) {
			if (WLT[pathSettings].interval_temps < adapter.config.interval_temps_min) {
				WLT[pathSettings].interval_temps = adapter.config.interval_temps_min;
				storeState(pathSettings + ".interval_temps", {val:WLT[pathSettings].interval_temps, ack: true}, "ne");
			}
            timer_temps = setInterval(function(){pollWLT(function(){handleWLT("wlt");});}, WLT[pathSettings].interval_temps * 1000);
			adapter.log.info('startTimers: interval_temps, read temps every ' + WLT[pathSettings].interval_temps + ' seconds');
        } else {
			adapter.log.info("startTimers: interval_temps timer disabled by configuration")
		}
    } else {
		adapter.log.info("startTimers: interval_temps timer disabled - active=false");
	}
	callback();
}


/******************************
 * init timers, if active start them, stop them otherwise
 */
function initTimers(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.info('initTimers');	
	stopTimers(function(){startTimers();});
	callback(null);
}


/******************************
 * reset everything
 */
function reset(callback=null) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.info('reset');

	initialized = false;

	stopTimers();
	
	adapter.log.info("channels usable: 0-" + adapter.config.maxChannels);
	adapter.log.info("pits usable: 1-" + adapter.config.maxPits);

	initStatus();
	initPits();
	initChannels();
	initAlarms();
	initGlobalAlarms();
	
	wait4init(function(){
		startTimers();
		if (WLT[pathStatus].active)
			checkWLT(function(){handleWLT("pathStatus");});
		adapter.log.info("RESET DONE - active=" + WLT[pathStatus].active);
	})

	callback(null);
}


/*****************************
 * Ask WLANThermo to create a new log file
 */
function newLogfile(callback=null) {
	var url = "http://" + adapter.config.username + ":" + adapter.config.password + "@" + adapter.config.hostname + "/control/new_log_file.php";
    
	callback = (typeof(callback) === 'function') ? callback : function() {};

	adapter.log.info("newLogfile");
	if (newLogfile_active) {
		callback("newLogfile already running");
		return;
	}
	newLogfile_active = true;
	try {
		var request = require("request");
		var mydata = {yes: "submit"};
		var myheaders = {  
			"content-type": "application/json",
		};
		var options = {
			method: 'post',
			url: url,
			form: mydata,
			headers: myheaders,
			json: true,
			timeout: adapter.config.timeout_GET,
		};
            
		request(options, function (error, response, body) {
			WLT[pathStatus].rc = Number(response && response.statusCode);
			if (!error && WLT[pathStatus].rc === 200) {
				WLT[pathStatus].answer = "New logfile requested";
				WLT[pathStatus].reachable = true;
				adapter.log.info("newLogfile: " + WLT[pathStatus].answer + ".");
				newLogfile_active = false;
				callback(null);
			} else {
				WLT[pathStatus].reachable = false;
				if (error) 
					WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] " + String(error);
				else
					WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] HTTP error";
				adapter.log.warn("newLogfile: " + WLT[pathStatus].answer + ".");
				newLogfile_active = false;
				callback(WLT[pathStatus].answer);
			}
		});
	} catch (e) { 
		WLT[pathStatus].answer = "newLogfile: " + e.toString();
		WLT[pathStatus].reachable = false;
		newLogfile_active = false;
		adapter.log.error("newLogfile: " + WLT[pathStatus].answer + ".");
		callback(e);
	}
}


/*****************************
 * Check WLT device to see if it is available and answering in general
 */
function checkWLT(callback=null) {
    var url = "http://" + adapter.config.hostname + "/";

	callback = (typeof(callback) === 'function') ? callback : function() {};

    adapter.log.info("checkWLT");
    if (!checkwlt_active) { // for the case some misconfiguration happened or someone plays the button game
        checkwlt_active = true;
        WLT[pathStatus].rc = Number(-1); // why typecasting? But got warnings...
        WLT[pathStatus].reachable = false;

        try {
            var request = require("request");
            var options = {
                url: url,
                timeout: adapter.config.timeout_GET
            };
            
            request(options, function (error, response, body) {
                var result = String(body).match(/<title>\s*WLANThermo ?\(.*\)\s*<\/title>/mi); // ugly nesting
                var found = 0;

                if (result !== null)
                    found = result.length;
            
                WLT[pathStatus].rc = Number(response && response.statusCode);
                if (found) {
                    WLT[pathStatus].answer = result[0].replace(/<\/?[^>]+(>|$)/g, "");
                    WLT[pathStatus].reachable = true;
                    adapter.log.debug("checkWLT: " + WLT[pathStatus].answer + ".");
                } else {
                    WLT[pathStatus].reachable = false;
                    if (error)
                        WLT[pathStatus].answer = error.toString();
                    else
                        WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] - no WLANThermo identified";
                    adapter.log.warn("checkWLT: " + WLT[pathStatus].answer + ".");
                }
                checkwlt_active = false;
				getWLTcfg(function() {cfg2wlt()});
				callback(null);
            });
        } catch (e) { 
                WLT[pathStatus].answer = "checkWLT: " + e.toString();
                checkwlt_active = false;
                adapter.log.error("checkWLT: " + WLT[pathStatus].answer + ".");
                callback(e);
        }
    } else {
		adapter.log.warn("checkWLT already running");
		callback(null);
	}
}


/*****************************
 * get temperatures from device
 */
function pollWLT(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};

    if (adapter.config.auth_GET) {
        var url = "http://" + adapter.config.username + ":" + adapter.config.password + "@" + adapter.config.hostname + "/app.php";
    } else
        var url = "http://" + adapter.config.hostname + "/app.php";

    adapter.log.debug("pollWLT");

    // for the case some misconfiguration happened or someone plays the button game
    if (!pollwlt_active) {
        pollwlt_active=true;
		WLT.wlt = {};
		WLT[pathStatus].rc = -1;
		
		try {
			var request = require("request");
			var options = {
				url: url,
				timeout: adapter.config.timeout_GET
			};
			
			request( options, function (error, response, result) {
				WLT[pathStatus].rc = Number(response && response.statusCode);
				if (!error && WLT[pathStatus].rc == 200) { 
					WLT.wlt = JSON.parse(String(result));
					adapter.log.debug("pollWLT() wlt=" + JSON.stringify(WLT.wlt));
					WLT[pathStatus].reachable = true;
				}
					
				if (error) {
					WLT[pathStatus].answer = String(error);
					WLT[pathStatus].reachable = false;
					adapter.log.warn("pollWLT: " + WLT[pathStatus].answer + ".");
				}
				pollwlt_active=false;
				callback(error, WLT[pathStatus].answer);
			})/******.on("error", //is that double to if (error) inside request()?
				function (e) {
					WLT[pathStatus].answer = e.toString();
					WLT[pathStatus].reachable = false;
					polwlt_active=false;
					adapter.log.warn("pollWLT: " + WLT[pathStatus].answer + ".");
					callback(e, WLT[pathStatus].answer);
				}
			)******/;
		} catch (e) {
				WLT[pathStatus].answer = "GET Req: " + e.toString();
				WLT[pathStatus].rc = -1;
				WLT[pathStatus].reachable = false;
				pollwlt_active=false;
				adapter.log.error("pollWLT: " + WLT[pathStatus].answer + ".");
				callback(e, WLT[pathStatus].answer);
		}
    } else {
		adapter.log.warn("pollWLT already running");
		callback(null, WLT[pathStatus].answer);
	}
}


/*****************************
 * Handle updates in WLT.wlt and copy values to WLT.cfg
 */
function wlt2cfg(callback) {
	var i;
	callback = (typeof(callback) === 'function') ? callback : function() {};
	
	for (i=0; i<=adapter.config.maxChannels; i++) {
		WLT.cfg["temp_min" + i] = WLT.channels[i].temp_min
		WLT.cfg["temp_max" + i] = WLT.channels[i].temp_max
		WLT.cfg["tch" + i] = WLT.channels[i].name
	}
	
	if (WLT[pathButtons].wlt_beeper)
		WLT.cfg["beeper_enabled"] = "True";
	else
		delete WLT.cfg["beeper_enabled"];

	callback();
}


/*****************************
 * store relevant config info as ioBroker states
 */
function cfg2wlt(callback) {
	if (WLT.cfg.beeper_enabled)
		storeState(pathButtons + ".wlt_beeper", {val: true, ack: true}, "ne");
	else
		storeState(pathButtons + ".wlt_beeper", {val: false, ack: true}, "ne");
}


/*****************************
 * Handle updates that went into global WLT object
 * literally write WLT to states
 */
function handleWLT(what="all", callback=null) {
    var key;
    var objpath;

	callback = (typeof(callback) === 'function') ? callback : function() {};

    adapter.log.debug("handleWLT(" + what + ")");
	//adapter.log.debug("handleWLT(" + what + ") WLT=" + JSON.stringify(WLT));

	for (key in WLT) {
		if (typeof(WLT[key]) !== 'object') continue;
		if (key !== what && what !== 'all') continue;
		
		if (key === 'wlt') {
			// prevent writing these twice into states
			if (what !== "all") { 
				// one can assume these two got properly defined as ioBroker object already
				storeState(pathStatus + ".rc", {val:WLT[pathStatus].rc, ack:true}, "ne"); 
				storeState(pathStatus + ".answer", {val:WLT[pathStatus].answer, ack:true}, "ne");
			}

			// In this for-loop: do not assign wlt object to WLT.wlt, because objects are 
			// handled as references. wlt object gets destroyed each updated -> WLT looses data
			// Do also _not_ copy values. User might have a use case where temperatures get updated
			// from somewhere else, so create an (empty) object stucture under WLT out of wlt. And
			// write values as states to ioBroker. The event handler will pick them up und copy them
			// into the WLT object there. Might sound wired, but event handler needs to run anyway
			// and user might have this special use-case.
			for (key in WLT.wlt) {
				objpath = pathStatus;
				if (typeof(WLT.wlt[key]) === "object") {
					switch (key) {
						case "channel":
							objpath = pathChannels;
							//cpObj(WLT[pathChannels], WLT.wlt[key]);
							break;
						case "pit":
							objpath = pathPits + ".1";
							//cpObj([pathPits][1], WLT.wlt[key]);
							break;
						case "pit2":
							objpath = pathPits + ".2";
							//cpObj(WLT[pathPits][2], WLT.wlt[key]);
							break;
						default:
							break;
					}
					loopWLT(WLT.wlt[key], objpath);
				} else {
					// WLT[objpath][key] = WLT.wlt[key];
					var cu = cond_update;
					if (key === "temp") cu=cond_update_temp;
					createEmptyObject(key, typeof(WLT.wlt[key]), function(o) {
						storeState(objpath + "." + key, {val:WLT.wlt[key], ack:true}, cu, o);
					});
				}
			}
		} else {
			loopWLT(WLT[key], key);
		}
		
	}
	callback(null);
}


/*****************************
 * recursively loop throuth wlt object and call storeState()
 */
function loopWLT(wlt, p, callback=null) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
    adapter.log.debug("loopWLT(" + wlt + ", " + p + ", " + ").");

    for (var key in wlt) {
        //adapter.log.debug("loopWLT() key=" + key + " typeof=" + typeof(wlt[key]));
        if (typeof(wlt[key]) === "object") {
            //adapter.log.debug("loopWLT: p=" + p + " key=" + key);
  			if (p === pathChannels && Number(key) > adapter.config.maxChannels) {
				adapter.log.error("loopWLT: max channels allowed: " + adapter.config.maxChannels + ", but found channel " + key);
   			} else {
			    loopWLT(wlt[key], p + "." + key);
   			}
		} else {
		    //adapter.log.debug("loopWLT(): p=" + p + " key=" + key + " val=" + wlt[key] + ".");
			var cu = cond_update;
			if (key === "temp") cu=cond_update_temp;
			createEmptyObject(key, typeof(wlt[key]), function(o) {
				storeState(p + "." + key, {val:wlt[key], ack:true}, cu, o);
			});
        }
    }
	callback();
}


/*****************************
 * handle WLT channel updates
 */
function handleChannelUpdate(channel, state, callback) {
	var ch=WLT[pathChannels][channel];
	var al=WLT[pathChannels][channel];
	var ack = al.ack;
	var alarm = al.alarm;
	var active= al.active;
	
	callback = (typeof(callback) === 'function') ? callback : function() {};

    adapter.log.debug("handleChannelUpdate(" + channel + ", " + JSON.stringify(state) + ")");
  
	if (!ch || !al) {
		callback("handleChannelUpdate: WLT[" + pathChannels + "][" + channel + "] or WLT[" + pathChannels + "][" + channel + "] undefined");
		adapter.log.debug('handleChannelUpdate: either ch or al undefined - callback');
		return;
	}
	
	if (ch.temp >= ch.temp_min) {
		al.active = true;
		al.alarm_min = false;
	}

	if (al.active) {
		if (ch.temp < ch.temp_min) al.alarm_min = true;
		if (ch.temp <= ch.temp_max) al.alarm_max = false;
		if (ch.temp > ch.temp_max) al.alarm_max = true;
    
		al.alarm = al.alarm_min || al.alarm_max;
		if (!al.alarm) {
			al.ack = false;
			al.notification = false;
		}
	} else {
		al.alarm = false;
		al.alarm_min = false;
		al.alarm_max = false;
		al.ack = false;
		al.notification = false;
	}

	if (!al.ack) al.notification = al.alarm;
  
	storeState(pathChannels + "." + channel + ".ack", {val: al.ack, ack: true}, cond_update, null, callback);
	storeState(pathChannels + "." + channel + ".active", {val: al.active, ack: true}, cond_update, null, callback);  
	storeState(pathChannels + "." + channel + ".alarm", {val: al.alarm, ack: true}, cond_update, null, callback);
	storeState(pathChannels + "." + channel + ".alarm_min", {val: al.alarm_min, ack: true}, cond_update, null, callback);
	storeState(pathChannels + "." + channel + ".alarm_max", {val: al.alarm_max, ack: true}, cond_update, null, callback);
	storeState(pathChannels + "." + channel + ".notification", {val: al.notification, ack: true}, cond_update, null, callback);
  
	callback(null);
}


/*****************************
 * recalculate global Alarm status
 */
function handleGlobalAlarms(which) {
	adapter.log.debug("handleGlobalAlarms(" + which + ")");

	WLT[pathChannels].global[which] = false;
	for (var c = 0; c <= adapter.config.maxChannels; c++) {
		WLT[pathChannels].global[which] = WLT[pathChannels].global[which] || WLT[pathChannels][c][which];
	}    

	storeState(pathChannels + ".global." + which, {val: WLT[pathChannels].global[which], ack:true}, cond_update);
}


/*****************************
 * global ack has changed
 */
function handleGlobalAck(ga) {
	adapter.log.info("handleGlobalAck: " + ga);
	for (var i = 0; i <= adapter.config.maxChannels ; i++) {
		if (WLT[pathChannels][i].alarm && WLT[pathChannels][i].active) {
			WLT[pathChannels][i].ack = ga;
			storeState(oid + ".ack", {val: ga, ack: true}, cond_update);
		}
		if (!WLT[pathChannels][i].alarm || !ga) {
			WLT[pathChannels][i].ack = false;
			storeState(oid + ".ack", {val: false, ack: true}, cond_update);
		}
	}
}


/*****************************
 * check if WLANThermo is alive using timestamp of last updates
 */
function checkTimeout() {
	WLT[pathStatus].alarm_timeout = false;
	if (WLT[pathStatus].active) {
		var timeout = WLT[pathSettings].timeout_temps;
		var turnOff = WLT[pathSettings].timeout_device_off;
		var d = new Date();
		var diff = d.getTime() - WLT.last_seen;

		adapter.log.debug("checkTimeout()");
		
		if (timeout > 0) {
			if (typeof(WLT.last_seen) !== "number") WLT.last_seen = 0;

			if (timeout < adapter.config.timeout_temps_min) {
				timeout=adapter.config.timeout_temps_min;
				WLT[pathSettings].timeout_temps = timeout;
				storeState(pathSettings + "." + timeout_temps, {val:timeout, ack:true}, "ne");
			}
			timeout *= 1000; // s to ms
			if (diff > timeout) {
				WLT[pathStatus].alarm_timeout = true;
				adapter.log.debug("checkTimeout: alarm_timeout = true");
			}
		}

		if (turnOff > 0) {
			if (turnOff < adapter.config.timeout_device_off_min) {
				turnOff = adapter.config.timeout_device_off_min;
				WLT[pathSettings].timeout_temps = turnOff;
				storeState(pathSettings + "." + timeout_device_off, {val:turnOff, ack:true}, "ne");
			}
			turnOff *= 1000; // s to ms
			if (diff > turnOff) {
				adapter.log.debug("checkTimeout: device turned off - removing device timeout alarm");
				WLT[pathStatus].alarm_timeout = false;
			}
		}
	} else {
		if (WLT[pathStatus].alarm_timeout) {
			adapter.log.debug("checkTimeout - active=false - removing device timeout alarm");
			WLT[pathStatus].alarm_timeout = false;
		}
	}
	
	storeState(pathStatus + ".alarm_timeout", {val: WLT[pathStatus].alarm_timeout, ack: true}, cond_update);
}


/*****************************
 * get device configuration to prepare sending changes
 */
function getWLTcfg(callback) {
    var url = "http://" + adapter.config.username + ":" + adapter.config.password + "@" + adapter.config.hostname + "/conf/WLANThermo.conf";
	callback = (typeof(callback) === 'function') ? callback : function() {};

    adapter.log.debug("getWLTcfg");

    try {
        require("request")(url, function (error, response, result) {
            var lines = String(result).split("\n");
            var nLines = lines.length;
            var section = "";
            var _section = "";
            var token = "";
            var value = "";
            var channel = "";
            var reSectionName = new RegExp("^\s{0,}\\[.*\\]\s{0,}$", "i");
			
            for (var l = 0; l < nLines; l++) {
                var line = lines[l].trim();
                if (!line || 0 === line.length) continue;
                if (line.startsWith("#")) continue;
                if (line.startsWith(";")) continue;
                if (_section=line.match(reSectionName)) {    // yes, assignment AND evaluation!
                    section=String(_section[0]).replace(/[\[\]']+/g, "").trim();
                    continue;
                }
                token = String(line.split("=", 1));
                value = line.replace(token + "=", "");
                token = token.trim();
                value = value.trim();
                
				switch (section) {
					case "Sensoren":
						WLT.cfg[token.replace("ch", "fuehler")] = value;
						break;
					case "Sound":
						if (value === "true" || value === "True")
							WLT.cfg[token] = value;
						else
							delete WLT.cfg[token];
						break;
					case "Messen":
						WLT.cfg[token.replace("messwiderstand", "measuring_resistance")] = value;
						break;
					case "Logging":
						if (token == "write_new_log_on_restart")
							if (value === "true" || value === "True")
								WLT.cfg["new_logfile_restart"] = value;
							else
								delete WLT.cfg["new_logfile_restart"];
						break;
					case "web_alert":
						if (value === "true" || value === "True")
							WLT.cfg[token.replace("ch", "alert")] = value;
						else
							delete WLT.cfg[token.replace("ch", "alert")];
						break;
					case "ch_name":
						WLT.cfg[token.replace("ch_name", "tch")] = value;
						break;
					case "ch_show":
						WLT.cfg[token.replace("ch", "ch_show")] = value;
						break;
					case "plotter":
						switch (token) {
							case "plot_pit":
							case "plot_pit2":
							case "keyboxframe":
								if (value === "true" || value === "True")
									WLT.cfg[token] = value;
								else
									delete WLT.cfg[token];
								break;
							case "color_pit":
							case "color_pitsoll":
							case "color_pit2":
							case "color_pit2soll":
							case "plotbereich_min":
							case "plotbereich_max":
							case "plotsize":
							case "plotname":
							case "keybox":
								WLT.cfg[token] = value;
								break;
							default:
								WLT.cfg[token.replace("color_ch", "plot_color")] = value;
								break;
						}
						break;
					case "webcam":
						switch (token) {
							case "webcam_start" :
							case "raspicam_start" :
								if (value === "true" || value === "True")
									WLT.cfg[token] = value;
								else
									delete WLT.cfg[token];
								break;
							default:
								WLT.cfg[token] = value;
								break;
						}
						break;
					case "ToDo":
						switch (token) {
							case "plot_start":
							case "maverick_enabled":
							case "pit_on":
							case "pit2_on":
								if (value == "true" || value === "True")
									WLT.cfg[token] = value;
								else
									delete WLT.cfg[token];
								break;
							default:
								break;
						}			
						break;
					case "temp_min":
					case "temp_max":
						WLT.cfg[token] = value;
						break;
					case "Alert":
						// not needed: WLT.cfg[token] = value;
						break;
					case "Email":
						switch (token) {
							case "email_alert":
								if (value === "true" || value === "True")
									WLT.cfg["email"] = value;
								else
									delete WLT.cfg["email"];
								break;
							case "starttls":
								if (value === "true" || value === "True")
									WLT.cfg[token] = value;
								else
									delete WLT.cfg[token];
								break;
							case "auth":
								if (value === "true" || value === "True")
									WLT.cfg["auth_check"] = value;
								else
									delete WLT.cfg["auth_check"];
								break;
							default:
								// not needed: WLT.cfg[token] = value;
								break;
						}
						break;
					case "Push":
						switch (token) {
							case "push_on":
								if (value === "true" || value === "True")
									WLT.cfg[token] = value;
								else
									delete WLT.cfg[token];
								break;
							default:
								// not needed: WLT.cfg[token] = value;
								break;							
						}
						break;
					case "Telegram":
						switch (token) {
							case "telegram_alert":
								if (value === "true" || value === "True")
									WLT.cfg[token] = value;
								else
									delete WLT.cfg[token];
								break;
							default:
								// not needed: WLT.cfg[token] = value;
								break;							
						}
						break;
					case "Display":
						switch (token) {
							case "lcd_present":
								if (value === "true" || value === "True")
									WLT.cfg["lcd_show"] = value;								
								else
									delete WLT.cfg["lcd_show"];
								break;
							case "nextion_update_enabled":
								if (value === "true" || value === "True")
									WLT.cfg[token] = value;
								else
									delete WLT.cfg[token];
								break;
							default:
								// not needed: WLT.cfg[token] = value;
								break;							
						}
						break;
					case "Pitmaster":
						switch (token) {
							case "pit_shutdown":
							case "pit_controller_type":
							case "pit_open_lid_detection":
							case "pit_inverted":
							case "pit_servo_inverted":
								WLT.cfg[token] = value;
							break;
						default:
							// not needed: WLT.cfg[token] = value;
							break;
						}
						break;
					case "Pitmaster2":
						switch (token) {
							case "pit_shutdown":
							case "pit_controller_type":
							case "pit_open_lid_detection":
							case "pit_inverted":
							case "pit_servo_inverted":
								WLT.cfg[token + "2"] = value;
							break;
						default:
							// not needed: WLT.cfg[token] = value;
							break;
						}
						break;
					case "Hardware":
						switch (token) {
							case "version":
								WLT.cfg["hardware_version"] = value;
								break
							case "max31855":
							case "showcpulast":
								if (value === "true" || value === "True")
									WLT.cfg[token] = value;								
								else
									delete WLT.cfg[token];
								break;
							default:
								WLT.cfg[token] = value;
								break;
						}
						break;
					case "update":
						switch (token) {
							case "checkupdate":
								if (value === "true" || value === "True")
									WLT.cfg["checkUpdate"] = value;
								else
									delete WLT.cfg["checkUpdate"];
								break;
							default:
								break;
						}
						break;
					case "locale":
						switch (token) {
							case "locale":
								WLT.cfg["language"] = value;
								break;
							default:
								WLT.cfg[token] = value;
								break;							
						}
						break;
					default:
						break;
				}
            }
			callback(null);
        }).on("error", function (e) {
					adapter.log.warn("Error reading device config: " + e);
					callback(e);
				}
			);
    } catch (e) { 
		adapter.log.warn("Error reading device config: " + e);
		callback(e);
	}
}


/*****************************
 * send configuration data to WLT device
 */
function postWLTcfg(callback) {
	var url = "http://" + adapter.config.username + ":" + adapter.config.password + "@" + adapter.config.hostname + "/control/config.php";
	callback = (typeof(callback) === 'function') ? callback : function() {};

	adapter.log.info("postWLTcfg");

	if (timer_postwlt)
		clearInterval(timer_postwlt);
   
	if (postwltcfg_active) {
		callback("postCFGwlt already running");
		return;
	}
	
	WLT.cfg["save"] = "submit";
	postwltcfg_active = true;
	
	
	try {
		var request = require("request");
		var myheaders = { "content-type": "application/json", };
		var options = {
			method: 'post',
			url: url,
			form: WLT.cfg,
			headers: myheaders,
			json: true,
			timeout: adapter.config.timeout_GET,
		};
            
		request(options, function (error, response, body) {
			WLT[pathStatus].rc = Number(response && response.statusCode);
			if (!error && WLT[pathStatus].rc === 200) {
				WLT[pathStatus].answer = "Einstellungen übertragen";
				WLT[pathStatus].reachable = true;
				adapter.log.info("postWLTcfg: " + WLT[pathStatus].answer + ".");
				postwltcfg_active = false;
				callback(null);
			} else {
				WLT[pathStatus].reachable = false;
				if (error) 
					WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] " + String(error);
				else
					WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] HTTP error";
				adapter.log.warn("postWLTcfg: " + WLT[pathStatus].answer + ".");
				postwltcfg_active = false;
				callback(WLT[pathStatus].answer);
			}
		});
	} catch (e) { 
		WLT[pathStatus].answer = "postWLTcfg: " + e.toString();
		WLT[pathStatus].reachable = false;
		postwltcfg_active = false;
		adapter.log.error("postWLTcfg: " + WLT[pathStatus].answer + ".");
		callback(e);
	}
}


/*****************************
 * set timer to upate WLT device.
 * if timer exists already, remove it and set a new one.
 * idea: do not send updates to WLT device more often than every 3 seconds or so.
 */
function prepWLTpost(callback) {
	if (timer_postwlt)
		clearInterval(timer_postwlt);
	timer_postwlt = setInterval(function(){ postWLTcfg(callback) }, adapter.config.delayPOST * 1000);
	adapter.log.info("prepWLTpost: will POST in " + adapter.config.delayPOST + " seconds.");
}

//-EOF-
