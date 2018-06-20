/****
 * wlanthermo adapter
 * used iobroker template to start: https://github.com/ioBroker/ioBroker.template
 *
 ****/

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

// default empty object to store WLT related data
var WLT = {"wlt": {}, "cfg": {}};

var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = new utils.Adapter('wlanthermo');
var mySysID = "";
var initialized = false;
var aPreps = [];

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
// Adapter got ready
//
adapter.on('ready', function () {
	initialized = false;
	aPreps[aPreps.length] = initBasics;
	prepSettings();
	prepButtons();
	prepStatus();
	prepChannels();
	prepAlarms();
	prepGlobalAlarms();
	aPreps[aPreps.length] = initPits;
	aPreps[aPreps.length] = installUpdateHandlers;
	aPreps[aPreps.length] = function(cb) {
		initialized = true;
		if (typeof(cb) === 'function') cb();
	}
	reset();
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
 * copies object src to obj dst
 */
function cpObj(dst, src, callback) {
	var d=dst;
	var s=src;
	var k;
	
	if (typeof(dst) === 'undefined') {
		dst = {};
		d = dst;
	}
	
	if (typeof(s) === 'object')
		for (k in s) {
			if (typeof(s[k]) === 'object') {
				d[k] = {};
				cpObj(d[k], s[k])
			} else d[k] = s[k];
		}
	
	if (typeof(callback) === 'function') callback(null, dst);
}


/*****************************
 * install state and object update handlers
 */
function installUpdateHandlers(callback) {
	//adapter.log.debug("installUpdateHandlers");
	adapter.subscribeStates('*');	
	adapter.on('stateChange', function(id, state) { stateUpdateHandler(id, state); });
	if (typeof(callback) === 'function') callback();
}

	
/*****************************
 * state update hanlder
 */
function stateUpdateHandler(id, state, callback) {
	//adapter.log.debug('stateUpdateHandler: ' + id + ': ' + JSON.stringify(state));
	
	// id holds the oid changed as string
	// state.from holds the name of what changed the state. Allows eg.: if (state.from !== mySysID)
	// eg: system.adapter.admin.0. or system.adapter.wlanthemo.0.

	if (state && id) {
		var a = id.split(".");
		// think of updating WLT like this because we might face changes
		// in data structure. But do it in sections below to differenciate
		// there between updates and changes. 
		//not here: oid2obj(WLT, id, state.val);
		
		if (a[2] === pathButtons) {
			var ov = WLT[pathButtons][a[3]];
			switch (a[3]) {
				case "reset":
					if (ov !== state.val) {
						adapter.log.info('Button: reset=' + state.val);
						storeState(id, {val: false, ack: true}, "ne");
						if (state.val) reset();
						WLT[pathButtons].reset = state.val;
					}
					break;
				case "active":
					if (ov !== state.val && !state.ack) {
						adapter.log.info('Switch: active=' + state.val);
						storeState(pathStatus + ".active", {val:state.val, ack:false}, "ne");
					} else if (state.ack) {
						WLT[pathButtons].active = state.val;						
					}
					break;
				case "poll_temps":
					if (ov !== state.val) {
						adapter.log.info('Button: poll_temps=' + state.val);
						if (state.val) pollWLT(function(){handleWLT("wlt");});
						storeState(id, {val: false, ack: true}, "ne");
						WLT[pathButtons].poll_temps = state.val;
					}
					break;
				case "check_wlt":
					if (ov !== state.val) {
						adapter.log.info('Button: check_wlt=' + state.val);
						if (state.val) checkWLT(function(){handleWLT(pathStatus);});
						storeState(id, {val: false, ack: true}, "ne");
						WLT[pathButtons].check_wlt = state.val;
					}
					break;
				case "new_logfile":
					if (ov !== state.val) {
						adapter.log.info('Button: new_logfile=' + state.val);
						if (state.val) newLogfile(function(){handleWLT(pathStatus);});
						storeState(id, {val: false, ack: true}, "ne");
						WLT[pathButtons].new_logfile = state.val;
					}
					break;
				case "reboot_wlt":
					if (ov !== state.val) {
						adapter.log.warn('Button: reboot_wlt=' + state.val)
						if (state.val) rebootWLT();
						storeState(id, {val: false, ack: true}, "ne");
						WLT[pathButtons].reboot_wlt = state.val;
					}
					break;
				case "wlt_beeper":
					if (ov !== state.val && !state.ack) {
						adapter.log.info('Switch: wlt_beeper=' + state.val);
						storeState(pathStatus + ".wlt_beeper", {val:state.val, ack:false}, "ne");
					} else if (state.ack) {
						WLT[pathButtons].wlt_beeper = state.val;
					}
					break;
				case "wlt_push_on":
					if (ov !== state.val && !state.ack) {
						adapter.log.info('Switch: wlt_push_on=' + state.val);
						storeState(pathStatus + ".wlt_push_on", {val:state.val, ack:false}, "ne");
					} else if (state.ack) {
						WLT[pathButtons].wlt_push_on = state.val;
					}
					break;
				default:
					oid2obj(WLT, id, state.val);
					break;
			}
		} else if (a[2] === pathStatus) {
			var ov = WLT[pathStatus][a[3]];
			switch (a[3]) {
				case "active":
					if (ov != state.val && !state.ack) {
						adapter.log.info('Change: active=' + state.val);
						storeState(pathButtons + ".active", {val:state.val, ack:true}, "ne");
						storeState(pathStatus + ".active", {val:state.val, ack:true}, "ne");
						reset();
					} else if (state.ack) {
						WLT[pathStatus].active = state.val;
					}
					break;
				case "wlt_beeper":
					if (state.val !== ov && !state.ack) {
						adapter.log.info("Change: wlt_beeper=" + state.val);
						getWLTcfg(function() {
							//wlt2cfg();
							if (state.val)
								WLT.cfg["beeper_enabled"] = "True";
							else
								delete WLT.cfg["beeper_enabled"];
							prepWLTpost();
						});
					} else if (state.ack) {
						WLT[pathStatus].wlt_beeper = state.val;
					}
					break;
				case "wlt_push_on":
					if (state.val !== ov && !state.ack) {
						adapter.log.info("Change: wlt_push_on=" + state.val);
						getWLTcfg(function() {
							//wlt2cfg();
							if (state.val)
								WLT.cfg["push_on"] = "True";
							else
								delete WLT.cfg["push_on"];
							prepWLTpost();
						});
					} else if (state.ack) {
						WLT[pathStatus].wlt_push_on = state.val;
					}
					break;
				default:
					oid2obj(WLT, id, state.val);
					break;
			}
		} else if (a[2] === pathChannels) {
			var ov = WLT[pathChannels][a[3]][a[4]];		
			switch (a[4]) {
				case 'temp':
				    // temp updates are sent from WLT itself, no ack handling necessary
					if (state.val !== ov) {
						WLT.last_seen = state.lc;
						handleChannelUpdate(a[3], state);
					}
					WLT[pathChannels][a[3]][a[4]] = state.val;
					break;
				case 'temp_min':
				case 'temp_max':
					if (state.val !== ov) {
						if (state.from !== mySysID || !state.ack) {
							adapter.log.info("update on channel " + a[3] + ": " + a[4] + "=" + state.val + " origin="+state.from);
							getWLTcfg(function() {
								//wlt2cfg();
								WLT.cfg[a[4] + a[3]] = state.val;
								prepWLTpost();
							});
						} else if (state.ack) {
							handleChannelUpdate(a[3], state);
							WLT[pathChannels][a[3]][a[4]] = state.val;
						}
					}
					break;
				case 'alarm':
					// handleChannelUpdate controls already via 'cond_update' flag for
					// storeState() if alarms are stored only on change or anyways.
					// idea behind: possibility to change behavior: alarm-triggers
					// in ioBroker vs. system load for each update
					// needs rethinking.
					// ack handling not neccessary since this is a self-computed
					// status, not available on WLT device
					if (a[3] !== 'global')
						handleGlobalAlarms("alarm");
					WLT[pathChannels][a[3]][a[4]] = state.val;
					break;
				case 'alarm_min':
					// ack handling not neccessary since this is a self-computed
					// status, not available on WLT device
					if (a[3] !== 'global')
						handleGlobalAlarms("alarm_min");
					WLT[pathChannels][a[3]][a[4]] = state.val;
					break;
				case 'alarm_max':
					// ack handling not neccessary since this is a self-computed
					// status, not available on WLT device
					if (a[3] !== 'global')
						handleGlobalAlarms("alarm_max");
					WLT[pathChannels][a[3]][a[4]] = state.val;
					break;
				case 'active':
					// ack handling not neccessary since this is a self-computed
					// status, not available on WLT device
					if (a[3] !== 'global')
						handleGlobalAlarms("active");
					WLT[pathChannels][a[3]][a[4]] = state.val;
					break;
				case 'ack':
					// ack handling not neccessary since this is a self-computed
					// status, not available on WLT device
					if (a[3] === 'global')
						handleGlobalAck(state.val);
					else
						handleChannelUpdate(a[3], state);
					WLT[pathChannels][a[3]][a[4]] = state.val;
					break;
				case 'name':
					if (state.val !== ov) {
						if (state.from !== mySysID || !state.ack) {
							adapter.log.info("update on channel " + a[3] + ": " + a[4] + "=" + state.val + " origin="+state.from);
							getWLTcfg(function() {
								//wlt2cfg();
								WLT.cfg["tch" + a[3]] = state.val;
								prepWLTpost();
							});
						} else if (state.ack) {
							WLT[pathChannels][a[3]][a[4]] = state.val;
						}
					}
					break;
				default:
					WLT[pathChannels][a[3]][a[4]] = state.val;
					break;
			}
		} else if (a[2] === pathPits) {
			// since I do not have a pitmaster available, I do not 
			// understand required semantics, but let's be accurate
			// on the data...
			
			// ack handling not neccessary since updates come from
			// WLT device itself in this case
			oid2obj(WLT, id, state.val);
		} else if (a[2] === pathSettings) {
			var ov = WLT[a[2]][a[3]];
			switch (a[3]) {
				case "interval_monitoring":
				case "interval_temps":
				case "interval_timeouts":
					if (ov !== state.val && !state.ack)
						resetTimers(function() {storeState(pathSettings + "." + a[3], {val: state.val, ack: true}, "ne");});
					else if (state.ack)
						WLT[a[2]][a[3]] = state.val;
					break;
				case "timeout_device_off":
					// future code
					WLT[a[2]][a[3]] = state.val;
					break;
				default:
					// future code
					WLT[a[2]][a[3]] = state.val;
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
function storeState(oid, state, cond, obj, callback) {
	//adapter.log.debug("storeState(" + oid + ", " + JSON.stringify(state) + ", " + cond + ", " + JSON.stringify(obj) + ")");
	callback = (typeof(callback) === 'function') ? callback : function() {};
	
	if (typeof(cond) !== 'string')
		cond = "ne";
	
	if (typeof(state) === 'undefined')
		state = {"val": null, "ack": true};
	
	// self-protection
	if (state && typeof(state) !== 'object') {
		var v = state;
		state = {val: v, ack: true};
		adapter.log.warn('storeState: converted value ' + v + ' to state object: ' + state.val + ' ack=' + state.ack);
	}
	
	adapter.getObject(oid, function (e, o) {
		if (o) {
			adapter.getState(oid, function (e, s) {
				if (s) {
					if (cond === "any" ) {
						adapter.setState(oid, state, function() {
							adapter.getState(oid, function(e, s) { callback(e, s); });	
						});
					} else if (cond === "ne" && (s.val !== state.val || s.ack != state.ack)) {
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
			adapter.setObjectNotExists(oid, obj, function(e, o) { 
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
	//adapter.log.debug('initPit: ' + i);
	if (typeof(WLT[pathPits][i]) === 'undefined') WLT[pathPits][i] = {};
	callback(null);
}


/*****************************
 * init pits
 */
function initPits(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('initPits');
	
	if (typeof(WLT[pathPits]) === 'undefined') WLT[pathPits] = {};
	for (var i=1; i<=adapter.config.maxPits; i++) initPit(i)
	
	callback(null);
}


/*****************************
 * activate/deactivate history logging of temperatures in a certain channel
 */
function setStateHistory(oid, active) {
	var oHistory = {
        enabled: false,
        changesOnly: false,
        debounce: "",
        maxLength: "480",
        retention: "7948800",
        changesRelogInterval: 30,
        changesMinDelta: ""
      };
	var oInflux = {
        enabled: false,
        changesOnly: false,
        debounce: "",
        retention: "7948800",
        changesRelogInterval: 30,
        changesMinDelta: "",
        storageType: ""
      };
	  
	if (typeof(active) !== "boolean")
		active ="ne";
	
	adapter.log.debug("setStateHistory: " + oid + ": " + active);
	
	if (typeof(oid) === "undefined") return;
	if (!oid) return;
	
	if (adapter.config.influxInst >=0 || adapter.config.historyInst >=0) {
		adapter.getObject(oid, function (e, o) {
			//adapter.log.debug("setStateHistory: " + oid + ": " + active + " e=" + String(e) + " o=" + typeof(o));
			if (o) {
				// safety first
				if (typeof(o.common) !== 'object' || !o.common) o.common = {};
				if (typeof(o.common.custom) !== 'object' || !o.common.custom) o.common.custom = {};
				
				if (adapter.config.influxInst >= 0) {
					var id="influxdb." + adapter.config.influxInst;
					//if (typeof(o.common.custom[id]) !== 'object' || !o.common.custom[id])
					//	o.common.custom[id] = oInflux;
					if (o.common.custom[id])
						o.common.custom[id].enabled = active;
					else
						adapter.log.warn("setStateHistory: managing " + id + " of " + oid + ": object does not exist")
				}
				
				if (adapter.config.historyInst >= 0) {
					var id="history." + adapter.config.historyInst;
					//if (typeof(o.common.custom[id]) !== 'object' || !o.common.custom[id])
					//	o.common.custom[id] = oHistory;
					if (o.common.custom[id])
						o.common.custom[id].enabled = active;
					else
						adapter.log.warn("setStateHistory: managing " + id + " of " + oid + ": object does not exist")
				}
				
				adapter.extendObject(oid, o);
				adapter.log.debug("setStateHistory: " + oid + ": " + active + "(updated)");			
			} else {
				adapter.log.error("setStateHistory: " + oid + ": could not find object");			
			}
		});
	}
}


/*****************************
 * activate/deactivate history logging of temperatures in ALL channels
 */
function setHistory(active) {
	//adapter.log.info("setHistoy: " + active);
	if (typeof(active) !== 'boolean')
		active=false;
	for (var c=0; c<=adapter.config.maxChannels; c++) {
		setStateHistory(pathChannels + "." + c + ".temp", active);
		setStateHistory(pathChannels + "." + c + ".temp_min", active);
		setStateHistory(pathChannels + "." + c + ".temp_max", active);
	}
}


/*****************************
 * initialize WLT temperature channel
 */
function prepChannel(channel, callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};

	//adapter.log.debug("prepChannel: " + channel);

	if (typeof(channel) === 'undefined') {
		adapter.log.warn("prepChannel: channel is not defined");
		callback("prepChannel: channel is not defined");
		return;
	}	

	if (typeof(WLT[pathChannels]) === 'undefined') WLT[pathChannels] = {};
	if (typeof(WLT[pathChannels][channel]) === 'undefined') WLT[pathChannels][channel] = {};
	
	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".temp",
			{val: 0, ack: true},
			"nc",
			{ type: 'state', common: { name: "Sensor temperature", unit: "°C", role: "value.temperature", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".temp", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".temp_min",
			{val: -20, ack:true},
			"nc",
			{ type: 'state', common: { name: "Minimum temperature", role: "level.temperature", type: "number", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".temp_min", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".temp_max",
			{val: 200, ack:true},
			"nc",
			{ type: 'state', common: { name: "Maximum temperature", role: "level.temperature", type: "number", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".temp_max", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".name",
			{val: "Kanal " + channel, ack:true},
			"nc", 
			{ type: 'state', common: { name: "WLT channel name", role: "text", type: "string", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".name", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".alert",
			{val: false, ack:true},
			"nc", 
			{ type: 'state', common: { name: "WLANThermo Web Alert", role: "switch", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".alert", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".color",
			{val: "black", ack:true},
			"nc", 
			{ type: 'state', common: { name: "Color for temperature chart on WLT web interface", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".color", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".show",
			{val: true, ack:true},
			"nc", 
			{ type: 'state', common: { name: "Show this channel in WLT web interface", role: "switch", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".show", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".state",
			{val: "er", ack:true},
			"nc", 
			{ type: 'state', common: { name: "Status of connected sensor (wire)", role: "state", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".state", s.val, cb); else cb(); }
		);
	};

	callback(null)
}


/*****************************
 * prep channels
 */
function prepChannels(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	
	//adapter.log.debug('prepChannels');
	for (var i=0; i<=adapter.config.maxChannels; i++) prepChannel(i)

	callback(null);
}


/*****************************
 * prepare WLT Alarms channel
 */
function prepAlarm(channel, callback) {
	callback = (typeof(callback) === 'function') ? callback : function(){};
	//adapter.log.debug('prepAlarm: channel ' + channel);
	
	if (typeof(channel) === 'undefined') {
		//adapter.log.warn("prepAlarm: channel is not defined");
		callback("prepAlarm: channel is not defined");
		return;
	}

	if (typeof(WLT[pathChannels]) === 'undefined') WLT[pathChannels] = {};
	if (typeof(WLT[pathChannels][channel]) === 'undefined') WLT[pathChannels][channel] = {};
	
	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".ack",
			{val: false, ack: true},
			"ne",
			{ type: 'state', common: { name: "Alarm acknowledgement", role: "state", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".ack", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".active",
			{val: false, ack:true},
			"ne",
			{ type: 'state', common: { name: "true if alarming is active - temp rose above temp_min", role: "sensor.alarm", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".active", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".alarm",
			{val: false, ack: true},
			"ne",
			{ type: 'state', common: { name: "General temperature alarm indicator", role: "sensor.alarm", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".alarm", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".alarm_min",
			{val:false, ack:true},
			"ne",
			{ type: 'state', common: { name: "Temperature is below temp_min and was above before", role: "sensor.alarm", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".alarm_min", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".alarm_max",
			{val:false, ack:true},
			"ne",
			{ type: 'state', common: { name: "Temperature is above temp_max", role: "sensor.alarm", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".alarm_max", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathChannels + "." + channel + ".notification",
			{val:false, ack:true},
			"ne",
			{ type: 'state', common: { name: "true if channel has alarm and ack is false", role: "indicator.alarm", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathChannels + "." + channel + ".notification", s.val, cb); else cb(); }
		);
	};

	callback(null)
}


/*****************************
 * prepare alarms
 */
function prepAlarms(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('prepAlarms');
	
	for (var i=0; i<=adapter.config.maxChannels; i++) prepAlarm(i);
	
	callback(null);
}


/*****************************
 * prepare global alarms
 */
function prepGlobalAlarms(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('prepGlobalAlarms');
	prepAlarm('global');
	callback(null);
}


/*****************************
 * initialize states, buttons, configuration, etc
 */
function initBasics(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('initBasics');

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

	// History instances to use. -1 disables managing history-writing
	if (typeof(adapter.config.historyInst) === 'undefined') adapter.config.historyInst=-1;
	if (typeof(adapter.config.influxInst) === 'undefined') adapter.config.historyInst=-1;

	callback();
}


/*****************************
 * prepare Buttons
 */
function prepButtons(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('prepButtons');

	if (typeof(WLT[pathButtons]) === 'undefined') WLT[pathButtons] = {};
	
	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".active",
			{val: false, ack: true},
			"nc",
			{type: 'state', common: { name: "Turn device usage on or off - starts or stops temperature updates and such", role: "switch", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".active", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".check_wlt",
			{val: false, ack: true},
			"ne",
			{ type: 'state', common: { name: "Manually check device availabilty one time", role: "button", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".check_wlt", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".reboot_wlt",
			{val: false, ack: true},
			"ne",
			{ type: 'state', common: { name: "REBOOT(!) WLANThermo", role: "button", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".reboot_wlt", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".poll_temps",
			{val: false, ack: true},
			"ne",
			{ type: 'state', common: { name: "Manually get temperatures one time", role: "button", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".poll_temps", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".reset",
			{val: false, ack:true},
			"ne",
			{ type: 'state', common: { name: "Reset temperatures, alarms, status and schedules of this adapter instance", role: "button", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".reset", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".new_logfile",
			{val: false, ack:true},
			"ne",
			{ type: 'state', common: { name: "Create new temp logfile on WLANThermo", role: "button", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".new_logfile", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".wlt_beeper",
			{val: false, ack: true},
			"nc",
			{ type: 'state', common: { name: "Turn device beeper for temp alarms on/off", role: "switch", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".wlt_beeper", s.val, cb); else cb(); }
		);
	};
	
	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathButtons + ".wlt_push_on",
			{val: false, ack: true},
			"nc",
			{ type: 'state', common: { name: "Allow WLT device to send push alarms", role: "switch", type: "boolean", read: true, write: true }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathButtons + ".wlt_push_on", s.val, cb); else cb(); }
		);
	};

	callback(null);
}

	
/*****************************
 * prepare settings
 */
function prepSettings(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('prepSettings');

	if (typeof(WLT[pathSettings]) === 'undefined') WLT[pathSettings] = {};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathSettings + ".interval_monitoring",
			{val: adapter.config.interval_monitoring, ack: true},
			"nc",
			{type: 'state', common: {name: "Device monitoring interval in seconds", role: "level", type: "number", read: true, write: true}, native: {} }, 
			function(e, s) { if (!e && s) oid2obj(WLT, pathSettings + ".interval_monitoring", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathSettings + ".interval_temps",
			{val: adapter.config.interval_temps, ack:true},
			"nc",
			{type: 'state', common: {name: "Temperature read interval in seconds", role: "level", type: "number", read: true, write: true}, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathSettings + ".interval_temps", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathSettings + ".interval_timeouts",
			{val: adapter.config.interval_timeouts, ack: true},
			"nc",
			{type: 'state', common: {name: "Interval to check for missing temp updates", role: "level", type: "number", read: true, write: true}, native: {}},
			function(e, s) { if (!e && s) oid2obj(WLT, pathSettings + ".interval_timeouts", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathSettings + ".timeout_temps",
			{val: adapter.config.timeout_temps, ack: true},
			"nc",
			{type: 'state', common: {name: "device.alarm_timeout is raised if no temp updates are missing since this number of seconds", role: "state", type: "number", read: true, write: true}, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathSettings + ".timeout_temps", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathSettings + ".timeout_device_off",
			{val: adapter.config.timeout_device_off, ack: true},
			"nc",
			{type: 'state', common: {name: "Device is considered to be turned off if temp updates are missing since this number of seconds", role: "level", type: "number", read: true, write: true}, native: {}},
			function(e, s) { if (!e && s) oid2obj(WLT, pathSettings + ".timeout_device_off", s.val, cb); else cb(); }
		);
	};

	
	callback(null);
}


/*****************************
 * prepare status information
 */
function prepStatus(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('prepStatus');
	
	if (typeof(WLT[pathStatus]) === 'undefined') WLT[pathStatus] = {};
	
	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".active",
			{val: false, ack:true},
			"nc",
			{ type: "state", common: { name: "True if device is currently used", role: "state", type: "indicator.working", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".active", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".alarm_timeout",
			{val: false, ack: true},
			"ne",
			{ type: "state", common: { name: "Device Timeout Alarm if true - no answer or updates from device since for too long", role: "indicator.alarm", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".alarm_timeout", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".answer",
			{val: initAnswer, ack: true},
			"ne",
			{ type: "state", common: { name: "Device software version if ok or error message", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".answer", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".cpu_load",
			{val: 0, ack:true},
			"nc",
			{ type: "state", common: { name: "Device CPU load", role: "value", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".cpu_load", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".cpu_temp",
			{val: 0, ack:true},
			"nc",
			{ type: "state", common: { name: "Device CPU temperature", role: "value.temperature", unit: "°C", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".cpu_temp", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".rc",
			{val: 0, ack:true},
			"ne",
			{ type: "state", common: { name: "Last HTTP error code 200=ok", role: "text", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".rc", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".reachable",
			{val: false, ack:true},
			"ne",
			{ type: "state", common: { name: "Device is reachable - monitoring result", role: "indicator.reachable", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".reachable", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".temp_unit",
			{val: "celsius", ack:true},
			"nc",
			{ type: "state", common: { name: "Celsius or Farenheit, as configured on the device", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".temp_unit", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".timestamp",
			{val: "unknown", ack:true},
			"nc",
			{ type: "state", common: { name: "Timestamp of WLT_s last temp measurement", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".timestamp", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wlt_beeper",
			{val: false, ack:false},
			"nc",
			{ type: "state", common: { name: "WLT beeper is used on temperature alarms", role: "indicator.working", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wlt_beeper", s.val, cb); else cb(); }
		)
	};
	
	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wlt_push_on",
			{val: false, ack:false},
			"nc",
			{ type: "state", common: { name: "WLT will send alarms as push notifications", role: "indicator.working", type: "boolean", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wlt_push_on", s.val, cb); else cb(); }
		)
	};
	
	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".ip_address",
			{val: "0.0.0.0", ack:true},
			"nc",
			{ type: "state", common: { name: "WLANThermo IP address", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".ip_address", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".ip_subnet",
			{val: "0.0.0.0", ack:true},
			"nc",
			{ type: "state", common: { name: "WLANThermo IP subnet mask", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".ip_subnet", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".macaddr",
			{val: "00:00:00:00:00:00", ack:true},
			"nc",
			{ type: "state", common: { name: "WLANThermo ethernet address", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".macaddr", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wifi_bitrate",
			{val: "0", ack:true},
			"nc",
			{ type: "state", common: { name: "WiFi bandwidth available", role: "value", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wifi_bitrate", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wifi_bssid",
			{val: "00:00:00:00:00:00", ack:true},
			"nc",
			{ type: "state", common: { name: "WiFi access point", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wifi_bssid", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wifi_link",
			{val: "0", ack:true},
			"nc",
			{ type: "state", common: { name: "WiFi link quality 0-100", role: "value", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wifi_link", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wifi_signal",
			{val: "0", ack:true},
			"nc",
			{ type: "state", common: { name: "WiFi signal strength 0-100", role: "value", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wifi_signal", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wifi_ssid",
			{val: "-?-", ack:true},
			"nc",
			{ type: "state", common: { name: "WiFi network name", role: "text", type: "string", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wifi_ssid", s.val, cb); else cb(); }
		);
	};

	aPreps[aPreps.length] = function(cb) {
		storeState(
			pathStatus + ".wifi_tx_power",
			{val: "0", ack:true},
			"nc",
			{ type: "state", common: { name: "WiFi transmit power - not always available", role: "value", type: "number", read: true, write: false }, native: {} },
			function(e, s) { if (!e && s) oid2obj(WLT, pathStatus + ".wifi_tx_power", s.val, cb); else cb(); }
		);
	};
	
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
		timer_timeouts = null;
	}
	
    if (timer_temps || timer_temps !== null) {
		clearInterval(timer_temps);
		timer_temps = null;
	}
	
	callback(null);
}


/******************************
 * start timers
 */
function startTimers(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.debug('startTimers');

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
function resetTimers(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	//adapter.log.info('resetTimers');	
	stopTimers(function(){startTimers();});
	callback(null);
}


/******************************
 * reset everything
 */
function reset(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.warn('RESET');

	
	adapter.log.info("channels usable: 0-" + adapter.config.maxChannels);
	adapter.log.info("pits usable: 1-" + adapter.config.maxPits);

	if (initialized) {
		aPreps[aPreps.length] = stopTimers;
		prepStatus();
		prepChannels();
		prepAlarms();
		prepGlobalAlarms();
		aPreps[aPreps.length] = initPits;
	}
	
	aPreps[aPreps.length] = function(cb) {
		setHistory(WLT[pathStatus].active);
		if (typeof(cb) === 'function') cb();
	}
	
	aPreps[aPreps.length] = function(cb) {
		startTimers();
		if (typeof(cb) === 'function') cb();
	}

	aPreps[aPreps.length] = function(cb) {
		if (WLT[pathStatus].active)
			checkWLT(function(){handleWLT("pathStatus");});
		if (typeof(cb) === 'function') cb();
	}

	aPreps[aPreps.length] = function(cb) {
		adapter.log.info("RESET DONE - active=" + WLT[pathStatus].active);
		if (typeof(cb) === 'function') cb();
	}

	runSeries(aPreps, function(err, aResults) {
		aPreps = [];
		callback();
	});
}


/*****************************
 * Ask WLANThermo to create a new log file
 */
function newLogfile(callback) {
	var url = "http://" + adapter.config.username + ":" + adapter.config.password + "@" + adapter.config.hostname + "/control/new_log_file.php";
    
	callback = (typeof(callback) === 'function') ? callback : function() {};

	adapter.log.info("newLogfile");
	if (newLogfile_active || timer_postwlt) {
		callback("newLogfile already running or updates due");
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
function checkWLT(callback) {
	var url = "http://" + adapter.config.username + ":" + adapter.config.password + "@" + adapter.config.hostname + "/control/wifi.php";

	callback = (typeof(callback) === 'function') ? callback : function() {};

    adapter.log.info("checkWLT");
    if (!checkwlt_active && !timer_postwlt) { // for the case some misconfiguration happened or someone plays the button game
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
					var s;
                    WLT[pathStatus].answer = result[0].replace(/<\/?[^>]+(>|$)/g, "");
                    WLT[pathStatus].reachable = true;
                    //adapter.log.debug("checkWLT: " + WLT[pathStatus].answer + ".");
					
					//do not get asynchronuous here
					s = String(body).match(/IP Address :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/IP Address\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						WLT[pathStatus].ip_address=s[0].trim();
					} else WLT[pathStatus].ip_address="0.0.0.0";
					
					s = String(body).match(/Subnet Mask :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/Subnet Mask\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						WLT[pathStatus].ip_subnet=s[0].trim();
					} else WLT[pathStatus].ip_subnet="0.0.0.0";

					s = String(body).match(/Mac Address :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/Mac Address\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						WLT[pathStatus].macaddr=s[0].trim();
					} else WLT[pathStatus].macaddr="00:00:00:00:00:00";

					s = String(body).match(/Connected To :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/Connected To\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						WLT[pathStatus].wifi_ssid=s[0].trim();
					} else WLT[pathStatus].wifi_ssid="-";

					s = String(body).match(/AP Mac Address :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/AP Mac Address\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						WLT[pathStatus].wifi_bssid=s[0].trim();
					} else WLT[pathStatus].wifi_bssid="00:00:00:00:00:00";

					s = String(body).match(/Bitrate :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/Bitrate\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						s[0] = String(s[0]).replace(/ .*/g, "");
						WLT[pathStatus].wifi_bitrate=s[0].trim();
					} else WLT[pathStatus].wifi_bitrate=-1;

					s = String(body).match(/Link Quality :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/Link Quality\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						s[0] = String(s[0]).replace(/\/100/g, "");
						WLT[pathStatus].wifi_link=s[0].trim();
					} else WLT[pathStatus].wifi_link=-1;

					s = String(body).match(/Signal Level :\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/Signal Level\s+:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						s[0] = String(s[0]).replace(/\/100/g, "");
						WLT[pathStatus].wifi_signal=s[0].trim();
					} else WLT[pathStatus].wifi_signal=-1;

					s = String(body).match(/TX Power ?:\s+<b>.*<.b><br.*/i, "");
					if (s) {
						s[0] = String(s[0]).replace(/TX Power ?:.*<b>/i, "");
						s[0] = String(s[0]).replace(/<\/?[^>]+(>|$)/g, "");
						s[0] = String(s[0]).replace(/.*no result.*/g, "-1");
						WLT[pathStatus].wifi_tx_power=s[0].trim();
					} else WLT[pathStatus].tx_power=-1;
                } else {
                    WLT[pathStatus].reachable = false;
                    if (error)
                        WLT[pathStatus].answer = error.toString();
                    else
                        WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] - no WLANThermo identified";
                    adapter.log.warn("checkWLT: " + WLT[pathStatus].answer + ".");
                }
                checkwlt_active = false;
				getWLTcfg(function() {cfg2states()});
				callback(null);
            });
        } catch (e) { 
                WLT[pathStatus].answer = "checkWLT: " + e.toString();
                checkwlt_active = false;
                adapter.log.error("checkWLT: " + WLT[pathStatus].answer + ".");
                callback(e);
        }
    } else {
		adapter.log.warn("checkWLT already running or udpates due");
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
    if (!pollwlt_active && !timer_postwlt) {
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
					//adapter.log.debug("pollWLT() wlt=" + JSON.stringify(WLT.wlt));
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
		adapter.log.warn("pollWLT already running or updates due");
		callback(null, WLT[pathStatus].answer);
	}
}


/******************************
 * Immediately reboot WLANThermo
 */
function rebootWLT(callback) {
	var url = "http://" + adapter.config.username + ":" + adapter.config.password + "@" + adapter.config.hostname + "/control/reboot.php";
    
	callback = (typeof(callback) === 'function') ? callback : function() {};
	adapter.log.info("rebootWLT");

	if (timer_postwlt) {
		adapter.log.warn("rebootWLT: configuration update running or due. WILL NOT SEND REBOOT request");
		return;
	}
	
	try {
		var request = require("request");
		var mydata = {reboot: "submit"};
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
				WLT[pathStatus].answer = "REBOOT requested";
				WLT[pathStatus].reachable = true;
				adapter.log.info("rebootWLT: " + WLT[pathStatus].answer + ".");
				callback(null);
			} else {
				WLT[pathStatus].reachable = false;
				if (error) 
					WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] " + String(error);
				else
					WLT[pathStatus].answer = "[" + (response && response.statusCode) + "] HTTP error";
				adapter.log.warn("rebootWLT: " + WLT[pathStatus].answer + ".");
				callback(WLT[pathStatus].answer);
			}
		});
	} catch (e) { 
		WLT[pathStatus].answer = "rebootWLT: " + e.toString();
		WLT[pathStatus].reachable = false;
		adapter.log.error("rebootWLT: " + WLT[pathStatus].answer + ".");
		callback(e);
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

	if (WLT[pathButtons].wlt_push_on)
		WLT.cfg["push_on"] = "True";
	else
		delete WLT.cfg["push_on"];

	callback();
}


/*****************************
 * store relevant config info as ioBroker states
 */
function cfg2states(callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
	
	if (WLT.cfg.beeper_enabled) {
		storeState(pathButtons + ".wlt_beeper", {val: true, ack: true}, "ne");
		storeState(pathStatus + ".wlt_beeper", {val: true, ack: true}, "ne");
	} else {
		storeState(pathButtons + ".wlt_beeper", {val: false, ack: true}, "ne");
		storeState(pathStatus + ".wlt_beeper", {val: false, ack: true}, "ne");
	}
	
	if (WLT.cfg.push_on) {
		storeState(pathButtons + ".wlt_push_on", {val: true, ack: true}, "ne");
		storeState(pathStatus + ".wlt_push_on", {val: true, ack: true}, "ne");
	} else {
		storeState(pathButtons + ".wlt_push_on", {val: false, ack: true}, "ne");
		storeState(pathStatus + ".wlt_push_on", {val: false, ack: true}, "ne");
	}
	
	for (var c = 0; c <= adapter.config.maxChannels; c++) {
		storeState(pathChannels + "." + c + ".temp_min", {val: WLT.cfg["temp_min"+c], ack: true}, "ne");
		storeState(pathChannels + "." + c + ".temp_max", {val: WLT.cfg["temp_max"+c], ack: true}, "ne");
		storeState(pathChannels + "." + c + ".name", {val: WLT.cfg["tch"+c], ack: true}, "ne");
		storeState(pathChannels + "." + c + ".color", {val: WLT.cfg["plot_color"+c], ack: true}, "ne");		
	
		if (WLT.cfg["alert"+c] === "True" || WLT.cfg["alert"+c] === "true")
			storeState(pathChannels + "." + c + ".alert", {val: true, ack: true}, "ne");
		else
			storeState(pathChannels + "." + c + ".alert", {val: false, ack: true}, "ne");
		
		if (WLT.cfg["ch_show"+c] === "True" || WLT.cfg["ch_show"+c] === "true")
			storeState(pathChannels + "." + c + ".show", {val: true, ack: true}, "ne");
		else
			storeState(pathChannels + "." + c + ".show", {val: false, ack: true}, "ne");
	}
	
	callback(null);
}


/*****************************
 * Handle updates that went into global WLT object
 * literally write WLT to states
 */
function handleWLT(what, callback) {
	if (typeof(what) !== 'string')
		what = "all";
	
	callback = (typeof(callback) === 'function') ? callback : function() {};

    //adapter.log.info("handleWLT: " + what);
	//adapter.log.debug("handleWLT(" + what + ") WLT=" + JSON.stringify(WLT));

	for (var key in WLT) {
		if (typeof(WLT[key]) !== 'object') continue;
		if (key !== what && what !== 'all') continue;
		
		if (key === 'wlt') {
			// write communication status, but only if wlt updates are requested
			// in other words: prevent writing these twice into states ;-)
			if (what !== "all") { 
				// one can assume these two got properly defined as ioBroker object already
				storeState(pathStatus + ".rc", {val:WLT[pathStatus].rc, ack:true}, "ne"); 
				storeState(pathStatus + ".answer", {val:WLT[pathStatus].answer, ack:true}, "ne");
				storeState(pathStatus + ".reachable", {val:WLT[pathStatus].reachable, ack:true}, "ne");
			}

			// In this for-loop: do not assign wlt object to WLT.wlt, because objects are 
			// handled as references. wlt object gets destroyed each time it is updated -> WLT looses data
			// Do also _not_ copy values. User might have a use case where temperatures get updated
			// from somewhere else, so create an (empty) object stucture under WLT out of wlt. And
			// write values as states to ioBroker. The event handler will pick them up und copy them
			// into the WLT object there. Might sound wired, but event handler needs to run anyway
			// and user might have this special use-case.
			for (var wkey in WLT.wlt) {
				var objpath = pathStatus;
				if (typeof(WLT.wlt[wkey]) === "object") {
					switch (wkey) {
						case "channel":
							objpath = pathChannels;
							//cpObj(WLT[pathChannels], WLT.wlt[wkey]);
							break;
						case "pit":
							objpath = pathPits + ".1";
							//cpObj([pathPits][1], WLT.wlt[wkey]);
							break;
						case "pit2":
							objpath = pathPits + ".2";
							//cpObj(WLT[pathPits][2], WLT.wlt[wkey]);
							break;
						default:
							break;
					}
					loopWLT(WLT.wlt[wkey], objpath);
				} else {
					// WLT[objpath][wkey] = WLT.wlt[wkey];
					var cu = cond_update;
					if (wkey === "temp") cu=cond_update_temp;
					createEmptyObject(wkey, typeof(WLT.wlt[wkey]), function(o) {
						storeState(objpath + "." + wkey, {val:WLT.wlt[wkey], ack:true}, cu, o);
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
function loopWLT(wlt, p, callback) {
	callback = (typeof(callback) === 'function') ? callback : function() {};
    //adapter.log.debug("loopWLT(" + wlt + ", " + p + ", " + ")");

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

    //adapter.log.debug("handleChannelUpdate(" + channel + ", " + JSON.stringify(state) + ")");
  
	if (!ch || !al) {
		callback("handleChannelUpdate: WLT[" + pathChannels + "][" + channel + "] or WLT[" + pathChannels + "][" + channel + "] undefined");
		//adapter.log.debug('handleChannelUpdate: either ch or al undefined - callback');
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
	adapter.log.debug("handleGlobalAck: " + ga);
	for (var i = 0; i <= adapter.config.maxChannels ; i++) {
		if (WLT[pathChannels][i].alarm && WLT[pathChannels][i].active) {
			WLT[pathChannels][i].ack = ga;
			storeState(pathChannels + "." + i + ".ack", {val: ga, ack: true}, cond_update);
		}
		if (!WLT[pathChannels][i].alarm || !ga) {
			WLT[pathChannels][i].ack = false;
			storeState(pathChannels + "." + i + ".ack", {val: false, ack: true}, cond_update);
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
				//adapter.log.debug("checkTimeout: alarm_timeout = true");
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
				//adapter.log.debug("checkTimeout: device turned off - removing device timeout alarm");
				WLT[pathStatus].alarm_timeout = false;
			}
		}
	} else {
		if (WLT[pathStatus].alarm_timeout) {
			//adapter.log.debug("checkTimeout - active=false - removing device timeout alarm");
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

    adapter.log.info("getWLTcfg");
	
	if (timer_postwlt || postwltcfg_active) {
		adapter.log.warn("getWLTcfg: configuration already in progress");
		callback("getWLTcfg: configuration already in progress");
		return;
	}

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
			
			WLT[pathStatus].reachable = true;
			WLT[pathStatus].rc = Number(response && response.statusCode);

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
						if (value === "true" || value === "True")
							WLT.cfg[token.replace("ch", "ch_show")] = value;
						else
							delete WLT.cfg[token.replace("ch", "ch_show")];
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
					WLT[pathStatus].answer = String(e);
					WLT[pathStatus].rc = -2;
					WLT[pathStatus].reachable = false;
					adapter.log.warn("Error reading device config: " + e);
					callback(e);
				}
			);
    } catch (e) {
		WLT[pathStatus].answer = String(e);
		WLT[pathStatus].reachable = false;
		WLT[pathStatus].rc = -3;
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

	if (timer_postwlt) {
		clearInterval(timer_postwlt);
		timer_postwlt = null;
	}
   
	if (postwltcfg_active) {
		callback("postCFGwlt already running");
		return;
	}
	
	postwltcfg_active = true;
	WLT.cfg["save"] = "submit";	
	
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
				//adapter.log.debug("postWLTcfg: " + WLT[pathStatus].answer + ".");
				//adapter.log.debug(JSON.stringify(WLT.cfg));
				postwltcfg_active = false;
				setTimeout(checkWLT, 3000, function(){handleWLT(pathStatus);});
				callback(null)
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


/*****************************
 * run tasks in order
 * 
 * This function, runSeries():
 * Copyright (c) Feross Aboukhadijeh
 * MIT License
 * https://github.com/feross/run-series
 */
function runSeries(tasks, cb) {
  var current = 0
  var results = []
  var isSync = true

  function done (err) {
    function end () {
      if (cb) cb(err, results)
    }
    if (isSync) process.nextTick(end)
    else end()
  }

  function each (err, result) {
    results.push(result)
    if (++current >= tasks.length || err) done(err)
    else tasks[current](each)
  }

  if (tasks.length > 0) tasks[0](each)
  else done(null)

  isSync = false
}

//-EOF-
