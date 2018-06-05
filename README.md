![Logo](admin/wlanthermo.png)
# ioBroker.wlanthermo
=================

WLANThermo is a wonderfull and perhaps the best and most versatile meat and BBQ thermometer and pitmaster controller. It got developed by enthusiasts and participants of ```https://www.grillsportverein.de``` and ```https://www.wlanthermo.de```. See the communities there for more information.
This adapter reads WLANThermo's measurements and settings and updates corresponding states in ioBroker. This can be used for flexible alarming and mobile views. Eg. set up individual vis views with temperatures and alarm information for the available channels of your device (aka temperature sensors) or channel-globally, as you desire.

Moreover, notifications and temperature alarms can be set up via ioBroker, temporary alarm acknowlishments are also supported, eg as vis buttons. ioBroker could fire a siren if it gets too hot in the pit. A smart plug with a piezo buzzer connected to an USB power supply could be feasible as a simple example. See below for more.

## Motivation

Nerd-fun. And sometimes, it is easier to have a mobile phone in the garden area rather than a laptop. Which can also be annoying during longjobs over night, if used as a night stand for getting alarms while in bed. ;-)

The WLANThermo app for iOS vanished unfortunately, this adapter with some vis views and smart plugs might help out here, too.

## Use Case

Turn your WLANThermo on. While you prepare your BBQ-sports equipment, WLANThermo gets found by ioBroker automatically. Next, look at what you want to BBQ and configure the themometer accordingly. Having done this, do your last steps preparing your goods to get BBQ'ed.

In the meanwhile, WLANThermo configuration got read and shown in ioBroker: temperature alarms, channel names and such. Last check, looking at the mobile phone: vis views suggest to start.

Once the temperatures rise above the min-thresholds, temperature monitoring starts. Have a beer or two with your guest and forget the side fire box. Temperatures will fall, but WLANTHhermo -> ioBroker -> pushSafer or -> DIY-smart-plug-piezo-buzzer alarms you. If it gets too hot inside your equipment, ioBroker alarms, too. But repeating alarms can become annoying. So you can acknowledge the alarms and correct the fire and heat inside the sports equipment.

Now that the temperatures get normal again, the acknowlishments and alarms get turned off automatically and regular temperature monitoring continues.

Watch the graphs on how the core meat temperature rises. When the desired core temperature got reached, remove the sensors. Hit the button in vis to turn the ioBroker pice off, get to the table and enjoy the results.

### Fun Use Cases

If you have Philips Hue lights, you can attract your guests with the color of your light bulbs corresponding to the meat temperature: changing smoothly from blue->rose->red->dark red and finally to flashing if it's too late for the meat (aka "well done") - ;-)

Have ioBroker to turn the TV off to get the family to the table right in time. 2h later, the vacuum cleaner robot gets sent under the table, but only if the light there is turned off and the TV back on - LOL

If in the worst case your smoker overheats, ioBroker can open the Gardena watering system automatically! - ROTFL


## How to use

The adapter requires some configuration: hostname or IP address of your WLANThermo, as well as the user and password to access the device' web frontend.
Once configured adapter reads WLANThermo's data via HTTP and stores it as states in ioBroker. There are also buttons available for eg. manual checks. 
Intervals and timeouts can get configured under Settings.
Under channels, one can find the information regarding the usually 8-12 temperature channels, along with ioBroker's alarms. The admin panel has more details available for each data field.

### Alarming

Each time temperature updates come in, alarms are evaluated. Min/max as well as a general alarm for each channel. Users that just want to have one alarm for all channels as a kind of a summary might want to look into the channel named "global".
Be aware of the following: after reset/startup, a channel remains inactive (active=false). Once the temperature gets above alarm_min, the channel gets active(=true). From now on, temp_min is used as the lower threshold for that channel. In other words: if the temperature falls below temp_min, an alarm is raised. This behaviour is the same as WLANThermo does it and allows temperature monitoring from the very beginning on.

### Monitoring
´
The device is monitored and reachable is set to false if it obviously not reachable. Moreover, alarm_timeout is raised, if there is no temperature update for a certain time.


## Changelog

### 0.1.0 (2018-06-06)
* (maxp) initial adapter rlease

### 0.0.x
* (maxp) initial releases, as scripts for JavaScript Adapter

## License
The MIT License (MIT)

Copyright (c) 2018 maxp <max.phenol@outlook.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
