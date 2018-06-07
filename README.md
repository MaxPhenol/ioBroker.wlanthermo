![Logo](admin/wlanthermo-logo.png)
# ioBroker.wlanthermo
=================

WLANThermo is a wonderful and perhaps the best and most versatile meat and BBQ thermometer and pitmaster controller. It got initially developed by enthusiasts and members of https://www.grillsportverein.de. Finally, the material around the device got gathered with a new project homepage at https://www.wlanthermo.de. See the communities there for more information.

This adapter for ioBroker supports WLANThermo mini devices only for now. It reads temperatures and settings and writes them as states to ioBroker. This allows flexible alarming, smart home automation and mobile views.

Moreover, notifications and temperature alarms can be set up via ioBroker, temporary alarm acknowlishments are also supported, eg as vis buttons on your mobile. ioBroker could fire a siren if it gets too hot in the pit. A smart plug with a piezo buzzer connected to an USB power supply could be feasible as a simple example.

## Motivation

Nerd-fun. And sometimes, it is easier to have a mobile phone in the garden area rather than a tablet or laptop. Which can also be annoying during longjobs over night, if used as a night stand for getting alarms while in bed.
The WLANThermo app for iOS vanished unfortunately, this adapter with some vis views and smart plugs might help out here, too.

## Use Case

Turn your WLANThermo on. While you prepare your BBQ equipment, WLANThermo gets found by ioBroker automatically. Next, look at what you want to BBQ and configure the themometer accordingly. Having done this, do your last steps preparing your goods to get BBQ'ed.

In the meanwhile, WLANThermo's data got read and shown in ioBroker: temperatures, thresholds, channel names and such. Last check, looking at the mobile phone: vis views suggest to start.

Once the temperatures rises above temp_min, temperature monitoring starts. Have a beer or two with your guest and forget the side fire box. Temperatures will fall, but WLANTHhermo -> ioBroker -> pushSafer or -> DIY-smart-plug-piezo-buzzer alarms you. If it gets too hot inside your equipment, ioBroker alarms, too. But repeating alarms can become annoying. So you can acknowledge the alarms and correct the fire and heat inside the sports equipment.

Now that the temperatures get normal again, the acknowlishments and alarms get turned off automatically and regular temperature monitoring continues.

Watch the graphs on how the core meat temperature rises. When the desired core temperature got reached, remove the sensors. Hit the button in vis to turn the ioBroker pice off, get to the table and enjoy the results.


## How to use

### Installation

Log in to your ioBroker, go to adapters in admin panel, click on the github icon and install it from this (custom) URL: https://github.com/MaxPhenol/ioBroker.wlanthermo.git

Or via npm:

```npm install https://github.com/MaxPhenol/ioBroker.wlanthermo/tarball/master/```

### Configuration

The adapter requires some basic configuration, available in the adapter settings via ioBroker's admin panel: hostname or IP address of your WLANThermo, as well as the user and password to access the device' web frontend.
When done, the adapter starts to work. Intervals and timeouts can get configured under "Settings" in the object tree (Objects tab).

### Alarming

Each time temperature updates come in, alarms are evaluated. Min/max as well as a general alarm for each channel. The "global" channel is a kind of a summary of all channels, if you prefer just global alarming.
Be aware of the following: after reset/startup, a channel remains inactive (active=false). Once the temperature gets above alarm_min, the channel gets active(=true). From then on, temp_min is used as the lower threshold for that channel. In other words: if the temperature falls below temp_min, an alarm is raised. This behaviour is the same as WLANThermo does it and allows temperature monitoring from the very beginning on.

### Monitoring

The device is monitored as configured. If it is not reachable, the state "reachable" is set to false. Moreover, if there is no temperature update for a certain time, the state "alarm_timeout" gets true.


## Changelog

### 0.1.0 (2018-06-06)
* (maxp) initial adapter rlease

### 0.0.x
* (maxp) initial releases, as scripts for JavaScript Adapter


## Legal Notice

The logo and the icon of this adapter are copyrighted by and taken from the original WLANThermo project at https://www.wlanthermo.de, which is licensed under GPLv3.

## License

Copyright (c) 2018 by MaxPhenol, license: GPLv3

