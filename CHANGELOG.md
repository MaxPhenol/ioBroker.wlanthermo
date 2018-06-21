## Changelog

### EXPERIMENTAL FEATURES
* Adapter allows to change temp_min, temp_max and channel name on ioBroker
  side. To manage possible overload by button chatter in vis views,
  configuration is sent to thermometer 4 seconds after last change was done.
* Adapter buttons to control push notifications and buzzer of WLANThermo.

### 0.1.1 (2018-06-dd)
* (maxp) NEW: EXPERIMENTAL: WLT device configuration can be changed: temp_min,
              temp_max and name for each channel.
* (maxp) NEW: some more details in device status: wifi_*, ip_*, macaddr
* (maxp) NEW: optionally turn on/off archiving of temp, temp_min, temp_max
              for history- and influxdb-instances
* (maxp) NEW: Button: Reboot WLANThermo
* (maxp) NEW: Button: turn WLT beeper on and off
* (maxp) NEW: Button: turn WLT push notifications on and off
* (maxp) CHG: vis views
* (maxp) CHG: init functions
* (maxp) CHG: state roles changed to better match their context
* (maxp) FIX: handling of global acknowlishments

### 0.1.0 (2018-06-10)
* (maxp) initial adapter rlease

### 0.0.x
* (maxp) initial releases, as scripts for JavaScript Adapter


