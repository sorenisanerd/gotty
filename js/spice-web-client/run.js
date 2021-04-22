/*
 eyeOS Spice Web Client
Copyright (c) 2015 eyeOS S.L.

Contact Jose Carlos Norte (jose@eyeos.com) for more information about this software.

This program is free software; you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3 as published by the
Free Software Foundation.
 
This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more
details.
 
You should have received a copy of the GNU Affero General Public License
version 3 along with this program in the file "LICENSE".  If not, see 
<http://www.gnu.org/licenses/agpl-3.0.txt>.
 
See www.eyeos.org for more details. All requests should be sent to licensing@eyeos.org
 
The interactive user interfaces in modified source and object code versions
of this program must display Appropriate Legal Notices, as required under
Section 5 of the GNU Affero General Public License version 3.
 
In accordance with Section 7(b) of the GNU Affero General Public License version 3,
these Appropriate Legal Notices must retain the display of the "Powered by
eyeos" logo and retain the original copyright notice. If the display of the 
logo is not reasonably feasible for technical reasons, the Appropriate Legal Notices
must display the words "Powered by eyeos" and retain the original copyright notice. 
 */
function getURLParameter (name) {
	return decodeURIComponent(
		(new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)')
			.exec(location.search) || [, ""])[1]
			.replace(/\+/g, '%20')
	) || null;
}


wdi.Debug.debug = false; //enable logging to javascript console
wdi.exceptionHandling = false; //disable "global try catch" to improve debugging
//if enabled, console errors do not include line numbers
//wdi.SeamlessIntegration = false; //enable window integration. (if disabled, full desktop is received)

wdi.IntegrationBenchmarkEnabled = false;// MS Excel loading time benchmark

function start () {
	app = new Application();

	var f = function (action, params) {
		if (action == 'windowClosed') {
			$(params.canvas).remove();
			$(params.eventLayer).remove();
		} else if (action == 'windowMoved') {
			$(params.canvas).css({
				'top': params.info.top + 'px',
				'left': params.info.left + 'px'
			});
			$(params.eventLayer).css({
				'top': params.info.top + 'px',
				'left': params.info.left + 'px'
			});
		} else if (action == 'init' || action == 'windowCreated') {
			var item = null;
			var canvas = null;
			var eventlayer = null;
			var body = $('body');

			for (var i in params) {
				item = params[i];
				var position = item.position * 2;
				canvas = $(item.canvas).css({
					'zIndex': 10000 - position - 1,
					'position': 'absolute',
					'top': item.info.top + 'px',
					'left': item.info.left + 'px'
				});
				eventlayer = $(item.eventLayer).css({
					'top': item.info.top + 'px',
					'left': item.info.left + 'px',
					'zIndex': 10000 - position
				})
				body.append(canvas);
				body.append(eventlayer);
			}
		} else if (action == 'ready') {
			var width = $(window).width();
			var height = $(window).height();

			app.sendCommand('setResolution', {
				'width': width,
				'height': height
			});
		} else if (action == 'resolution') {

		} else if (action == 'windowMinimized') {
			//in eyeos, this should minimize the window, not close it
			$(params.canvas).css({'display': 'none'});
			$(params.eventLayer).css({'display': 'none'});
		} else if (action == 'windowMaximized') {
			$(params.canvas).css({
				'top': params.info.top + 'px',
				'left': params.info.left + 'px'
			});
			$(params.eventLayer).css({
				'top': params.info.top + 'px',
				'left': params.info.left + 'px'
			});
		} else if (action == 'windowRestored') {
			//in eyeos, this should restore the window
			$(params.canvas).css({'display': 'block'});
			$(params.eventLayer).css({'display': 'block'});
			$(params.canvas).css({
				'top': params.info.top + 'px',
				'left': params.info.left + 'px'
			});
			$(params.eventLayer).css({
				'top': params.info.top + 'px',
				'left': params.info.left + 'px'
			});
		} else if (action == 'windowFocused') {
			//debugger; //eyeos should move the window to front!
		} else if (action == 'timeLapseDetected') {
			wdi.Debug.log('Detected time lapse of ', params, 'seconds');
		} else if (action == 'error') {
//                      alert('error');
		} else if ("checkResults") {
			//
		}
	};

	$(window)['resize'](function () {
		app.sendCommand('setResolution', {
			'width': $(window).width(),
			'height': $(window).height()
		});
	});

	var useWorkers = true;

	app.run({
		'callback': f,
		'context': this,
		'host': getURLParameter('host') || '127.0.0.1',
		'port': getURLParameter('port') || 8080,
		'protocol': getURLParameter('protocol') || 'ws',
		'token': '1q2w3e4r',
		'vmHost': getURLParameter('vmhost') || false,
		'vmPort': getURLParameter('vmport') || false,
		'useBus': false,
		'busHost': '10.11.12.200',
		'busPort': 61613,
		'busSubscriptions': ['/topic/00000000-0000-0000-0000-000000000000'],
		'busUser': '00000000-0000-0000-0000-000000000000',
		'busPass': 'potato',
        // Connection Control
		'connectionControl': false,
        'heartbeatToken': 'heartbeat',
		'heartbeatTimeout': 4000,//miliseconds
		'busFileServerBaseUrl': 'https://10.11.12.200/fileserver/',
		'layout': 'es',
		'clientOffset': {
			'x': 0,
			'y': 0
		},
		'useWorkers': useWorkers,
		'seamlessDesktopIntegration': false,
		'externalClipboardHandling': false,
		'disableClipboard': true,
		'layer': document.getElementById('testVdi'),
		'vmInfoToken': getURLParameter('vmInfoToken')
		//'language': navigator.language
	});
}

$(document).ready(start);
