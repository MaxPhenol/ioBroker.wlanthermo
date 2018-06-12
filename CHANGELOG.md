## Changelog

### EXPERIMENTAL FEATURES
* Adapter allows to change temp_min, temp_max and channel name on ioBroker side. To manage possible overload by button chatter in vis views, configuration is sent to thermometer 4 seconds after last change was done.

### 0.1.1 (2018-06-dd)
* (maxp) EXPERIMENTAL: WLT device configuration can be changed: temp_min, temp_max and name for each channel.
* (maxp) EXPERIMENTAL: ioBroker button "wlt_beeper" to control temp alarm beeper of WLANThermo
* (maxp) NEW: some more details in device status
* (maxp) NEW: temperatures (incl min, max) with defaults for history- and influxdb adapter
* (maxp) NEW: Temperatures get stored in history and influxdb only if WLT device is "active"ly used
* (maxp) NEW: Button: Reboot WLANThermo
* (maxp) CHG: VIS views
* (maxp) FIX: handling of global acknowlishments

### 0.1.0 (2018-06-10)
* (maxp) initial adapter rlease

### 0.0.x
* (maxp) initial releases, as scripts for JavaScript Adapter


