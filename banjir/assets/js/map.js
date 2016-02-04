//map.js - JavaScript for PetaJakarta web map

/**
*@file LeafletJS map to display data from cognicity server (PetaJakarta.org)
*@copyright (c) Tomas Holderness & SMART Infrastructure Facility January 2014
*@module map
*/

// URL replacement in tweets
String.prototype.parseURL = function() {
	return this.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function(url) {
		return "<a target='_blank' href='"+url+"'>"+url+"</a>";
	});
};

/*
* Specify layernames
*/
var layernames = {};
if (document.documentElement.lang == 'in' || document.documentElement.lang == 'id'){
	layernames.confirmed = 'Laporan Banjir';
	layernames.verified = 'Laporan BPBD';
	layernames.waterways = 'Aliran Air';
	layernames.pumps = 'Pompa Air';
	layernames.floodgates = 'Pintu Air';
	layernames.floodheights = {
		title:'Tinggi Banjir',
		tentative_areas:'Hati-Hati'
	};
	layernames.floodgauges = 'Tinggi Muka Air';
}
else {
	layernames.confirmed = 'Flood Reports';
	layernames.verified = 'BPBD Reports';
	layernames.waterways = 'Waterways';
	layernames.pumps = 'Pumps';
	layernames.floodgates = 'Floodgates';
	layernames.floodheights = {
		title:'Flood Heights',
		tentative_areas:'Use Caution'
		};
	layernames.floodgauges = 'River Gauges';

}

/**
	Format popup with an embedded tweet

	@param {object} feature - a GeoJSON feature representing a report
*/
var tweetPopup = function(feature){
	var popup = '<div id="tweet-container" style="width:220px; height:auto; max-height:220px; overflow-y:scroll"><blockquote class="twitter-tweet" data-conversation="none"><a target="_blank"  href="'+feature.properties.url+'">'+feature.properties.text+'</a></blockquote></div>';
	if (feature.properties.status == 'verified'){
		popup = '<div style="padding:5px"><img src="/banjir/img/bpbd_dki.png" height="35px;"> @BPBDJakarta <i>Retweeted</i></div><div id="tweet-container" style="width:220px; height:auto; max-height:220px; overflow-y:scroll;"><blockquote class="twitter-tweet"><a target="_blank"  href="'+feature.properties.url+'">'+feature.properties.text+'</a></blockquote></div>';
	}
	return popup;
};
/**
	Format popup with a Detik report

	@param {object} feature - a GeoJSON feature representing a report
*/
var detikPopup = function(feature){
	var popup = '<div id="detik-container" style="width:220px; height:220px; overflow-y:scroll; background-color:white;"><div class="media"><a class="pull-left" href="#"><img class="media-object" src="/banjir/img/logo_detik.png" height="22"></a><div class="media-body"><h4 style="font-size:18px; line-height:1.2;" class="media-heading">PASANGMATA.COM</h4></div></div><p class="lead" style="margin:4px;font-size:16px;">'+feature.properties.title+'</p><img class="img-responsive" src="'+feature.properties.image_url+'" width="210"/><h5>'+feature.properties.text+'</h5><h5>'+feature.properties.created_at.replace('T',' ')+'</h5><a href="'+feature.properties.url+'" target="_blank">'+feature.properties.url+'</a></div>';
	return popup;
};

/**
	Format popup with a Qlue report

	@param {object} feature - a GeoJSON feature representing a report
*/

var qluePopup = function(feature){
	var popup = '<div id="qlue-container" style="width:220px; height:220px; overflow-y:scroll; background-color:white;"><div class="media"><a class="pull-left" href="#"><img class="media-object" src="/banjir/img/logo_qlue.png" height="32"></a></div><p class="lead" style="margin-bottom:4px;margin-top:4px;font-size:16px;">'+feature.properties.title+'</p><img class="img-responsive" src="'+feature.properties.image_url.replace('http://','https://')+'" width="210"/><h5>'+feature.properties.text+'</h5><h5>'+feature.properties.created_at.replace('T',' ')+'</div>';
	return popup;
};

/**
	Add a popup to the provided layer based on the provided feature's text property

	@param {object} feature - a GeoJSON feature
	@param {L.ILayer} layer - the layer to attach the popup to
*/
var markerPopup = function(feature, layer) {
	if (feature.properties) {
		markerMap[feature.properties.pkey] = layer;
		// Render as tweet
		if (feature.properties.source == 'twitter'){
			layer.bindPopup(tweetPopup(feature), {autoPanPadding:([0,140])});
		}
		// Render as Detik report
		else if (feature.properties.source == 'detik'){
			layer.bindPopup(detikPopup(feature), {autoPanPadding:([0,60])});
		}

		// Render as Qlue
		else if (feature.properties.source == 'qlue'){
			layer.bindPopup(qluePopup(feature), {autoPanPadding:([0,60])});
		}

		// Default to text rendering
		else {

			var message = "";
			if (feature.properties.title && feature.properties.title.length !== 0){
				message += feature.properties.title;
			}
			if (feature.properties.text && feature.properties.text.length !==0){
				message += '&#151'+feature.properties.text;
			}
			layer.bindPopup(message, {autoPanPadding:([0,60])});
		}
	}
};

/**
	Get a map overlay layer from the geoserver

	@param {string} layer - the layer to be fetched
	@return {L.TileLayer} layer - the layer that was fetched from the server
*/
var getInfrastructure = function(layer) {
	return new RSVP.Promise(function(resolve, reject){
		// Use live data
		jQuery.getJSON("https://petajakarta.org/banjir/data/api/v2/infrastructure/"+layer+"?format=topojson", function(data){
				if (data.features !== null){
					resolve(topojson.feature(data, data.objects.collection));
				} else {
					resolve(null);
				}
		});
	});
};

/**
	Add a text popup to the provided layer

	@param {object} feature - a GeoJSON feature
	@param {L.ILayer} layer - the layer to attach the popup to
*/
var infrastructureMarkerPopup = function(feature, layer){
	if (feature.properties){
		layer.bindPopup(feature.properties.name);
	}
};

/**
	Returns floodgauge icon and color based on siaga (alert) level

	@param {level} integer - the alert level (1-4)
*/
var getSiagaLevelIconography = function(level){
	switch (level) {
		case 1:
			return {'color':'#FF4000','icon':'floodgauge_1.svg'};
		case 2:
			return {'color':'#FF8000','icon':'floodgauge_2.svg'};
		case 3:
			return {'color':'#F7D358','icon':'floodgauge_3.svg'};
		default:
			return {'color':'#01DF01','icon':'floodgauge.svg'};
	}
};

/**
	Format popup with a floodgauge report

	@param {object} feature - a GeoJSON feature representing a report
*/
var floodgaugePopoup = function(feature){

	var label = 'Water Level (cm)';
	if (document.documentElement.lang == 'in' || document.documentElement.lang == 'id'){
			label = 'Tinggi Muka Air (cm)';
	}
	var popup = '';
	if (feature.properties !== null){
		popup = '<div id="floodgauge-container" style="width:220px; height:220px; overflow-y:scroll"><div class="media"><img class="media-object pull-left" src="/banjir/img/dki_jayaraya.png" height="22"/><img class="media-object pull-left" src="/banjir/img/bpbd_dki.png" height="22"/><h4 style="font-size:18px; line-height:1.2;" class="media-heading pull-left">'+feature.properties.gaugenameid+'</h4></div>'+label+'&nbsp;&nbsp|&nbsp;&nbsp;<span style="color:black; background-color:'+getSiagaLevelIconography(feature.properties.observations[feature.properties.observations.length-1].warninglevel).color+'">'+feature.properties.observations[feature.properties.observations.length-1].warningnameid+'</span><canvas id="gaugeChart" class="chart" width="210" height="180"></canvas></div>';
	}
	else {
		popup = 'Data not available | Tidak ada data';
	}
	return popup;
};

/**
	Add a text popup to the floodgauge layer

	@param {object} feature - a GeoJSON feature
	@param {L.ILayer} layer - the layer to attach the popup to
*/
var floodgaugeMarker = function(feature, layer){
	if (feature.properties){
		layer.bindPopup(floodgaugePopoup(feature),{autoPanPadding:([0,60])});
	}
};

/**
	Get TopoJSON representing flooding reports from the server

	@param {string} type - the type of report to get: `'confirmed'` or `'uncomfirmed'`
	@param {function} callback - a function to be called when data is finished loading

	Converts TopoJson to GeoJson using topojson
*/
var getReports = function(type) {
	return new RSVP.Promise(function(resolve, reject) {
		// Use live data
		jQuery.getJSON('https://petajakarta.org/banjir/data/api/v2/reports/'+type+'?format=topojson', function(data) {
			if (data.features !== null){
				//Convert topojson back to geojson for Leaflet
				resolve(topojson.feature(data, data.objects.collection));
			} else {
				resolve(null);
			}
		});
	});
};

/**
	Get TopoJSON representing a single confirmed flooding report

	@param {integer} id - the unique id of the confirmed report to get

	For single point feature GeoJSON is smaller than TopoJSON
*/
var getReport = function(id) {
	return new RSVP.Promise(function(resolve, reject){
		jQuery.getJSON('https://petajakarta.org/banjir/data/api/v2/reports/confirmed/'+id+'?format=geojson', function(data){
			if (data.features !== null){
				resolve(data);
			}
				else {
					resolve(null);
				}
		});
	});
};

var aggregateHours = 1;
// TODO Edit mode temporary fix
var editMode = true;

/**
	Get GeoJSON representing counts of reports in RW polygons
	@param {function} callback - a function to be called when data is finished loading
	@param {level} string - administrative boundary level to load. Can be 'rw' or 'village', also passed to load function for identification
*/
var getAggregates = function(level) {
	return new RSVP.Promise(function(resolve, reject) {
		jQuery.getJSON('/banjir/data/api/v2/aggregates/live?format=topojson&level='+level+'&hours='+aggregateHours, function(data, textStatus, jqXHR) {
			// TODO Edit mode temporary fix
			if ( jqXHR.getResponseHeader('REM-editor') === 'false' ) {
				editMode = false;
			}
			resolve(topojson.feature(data, data.objects.collection));
		});
	});
};

var getDimsStates = function() {
	return new RSVP.Promise(function(resolve, reject) {
		jQuery.getJSON('/banjir/data/api/v2/rem/dims?format=topojson', function(data, textStatus, jqXHR) {
			resolve(topojson.feature(data, data.objects.collection));
		});
	});
};

/** Style confirmed reports
		@param {object} feature - geojson report feature
*/
var iconConfirmedReports = function(feature){
	//default confirmed style
	var myicon = L.divIcon({className: 'div-icon-confirmed', html:'<p><span class="glyphicon glyphicon-tint" aria-hidden="true"></span></p>', popupAnchor:[5,0]});
	//else return verified style
	if (feature.properties.status == 'verified'){
		myicon = L.divIcon({className: 'div-icon-verified', html:'<p><span class="glyphicon glyphicon-tint" aria-hidden="true"></span></p>', popupAnchor:[5,0]});
	}
	return (myicon);
};

/**
	Plots confirmed points on the map as circular markers
	@param {object} reports - a GeoJSON object containing report locations
*/
var loadConfirmedPoints = function(reports) {
	if (reports) {
		loadTable(reports); //sneaky loadTable function.
		// badge reports button
		window.reportsBadge.textContent = reports.features.length;
		window.confirmedPoints_geojson = reports;
		// create points
		window.confirmedPoints = L.geoJson(reports, {
			pointToLayer: function(feature, latlng) {
				var zIndexOffset = 0;
				if (feature.properties.status == 'verified') zIndexOffset = 1000;
				return  L.marker(latlng, {icon:iconConfirmedReports(feature), zIndexOffset: zIndexOffset});
			},
			onEachFeature: markerPopup
		});
	} else {
		// TODO This 'empty' response stops crashes later on - could the server return an empty response?
		// Or could our other code treat an empty/null object as an empty response?
		window.confirmedPoints_geojson = {
			type: "FeatureCollection",
			features: []
		};
		window.confirmedPoints = L.geoJson(null, {
			pointToLayer: function(feature, latlng) {
				var zIndexOffset = 0;
				if (feature.properties.status == 'verified') zIndexOffset = 1000;
				return  L.marker(latlng, {icon:iconConfirmedReports(feature), zIndexOffset: zIndexOffset});
			},
			onEachFeature: markerPopup
		});
	}

	return window.confirmedPoints;
};

/**
	If a unique ID is specified in the URL, zoom to this point, getting specified point if need.
 	@param {object} report - a GeoJSON object contiaing report location and metadata
*/
var showURLReport = function() {
	//Test if URL parameter present
	if ($.url('?report')){
			//Check if Integer
			var id = parseInt($.url('?report'));
			var err;
			if ( !validateNumberParameter(id,1) ) err = new Error( "'report id parameter is invalid" );
			if (err) {
				console.log(err);
				return;
			}
			//Zoom to object if exists
			if (markerMap.hasOwnProperty(id)){
				centreMapOnPopup(id);
			}

			else {
				//Else attempt to get from server
				var promise = getReport(id);
				promise.then(function(data){
					window.confirmedPoints.addData(data);
					centreMapOnPopup(id);
					});
				}
			}
};

/**
 * Load the outline polygons
 */
var loadOutlines = function(village, rw, dimsStates){
	// Put counts in map with key as 'source'
	// Add total counts
	function updateCounts(features) {
		$.each( features, function(i,feature) {
			var newCounts = {
				total: 0
			};
			if (feature.properties.counts) {
				$.each( feature.properties.counts, function(j, count) {
					newCounts[count.source] = count.count;
					newCounts.total += count.count;
				});
			}
			feature.properties.counts = newCounts;

			if (!feature.properties.state) {
				feature.properties.state = 0;
			}
		});
	}

	// Manipulate response for easy parsing into table view
	updateCounts( village.features );
	updateCounts( rw.features );

	outlineLayer = L.geoJson(rw, {style:styleOutline, onEachFeature:labelOutlines});
	populateTable(village, outlineLayer, rw, dimsStates);
	$('#legendbox').append(heightsLegend);
	return outlineLayer;
};

/**
	Plots hydrological infrastructure on map

	@param {string} layer - string - name of infrastructure layer to load
	@param {object} infrastructure - a GeoJSON object containing infrastructure features
*/

var loadInfrastructure = function(layer, infrastructure){
	if(infrastructure) {
		if (layer == 'waterways'){
			window[layer] = L.geoJson(infrastructure, {style:styleInfrastructure[layer]});
		}
		else if (layer == 'floodgauges'){

			window[layer] = L.geoJson(infrastructure, {
				pointToLayer: function(feature, latlng) {
					return L.marker(latlng, {icon: L.icon(
																			{iconUrl:'/banjir/img/'+getSiagaLevelIconography(feature.properties.observations[feature.properties.observations.length-1].warninglevel).icon,
																				iconSize: [22,22],
																				iconAnchor: [11, 11],
																				popupAnchor: [0, 0], }
																			)});
				}, onEachFeature: floodgaugeMarker
			}).addTo(map);
			$('#legendbox').append(gaugesLegend);
		}
		else {
			window[layer] = L.geoJson(infrastructure, {
				pointToLayer: function(feature, latlng) {
					return L.marker(latlng, {icon: styleInfrastructure[layer]});
				}, onEachFeature: infrastructureMarkerPopup
			});
		}
	}
	else {
			window[layer] = L.geoJson();
	}

	return window[layer];
};

var styleInfrastructure = {
	waterways:{
		color:'#3960ac',
		weight:0.9,
		opacity:1,
	},
	pumps:L.icon({
		iconUrl: '/banjir/img/pump.svg',
		iconSize: [22,22],
		iconAnchor: [11, 11],
		popupAnchor: [0, 0],
	}),
	floodgates:L.icon({
		iconUrl: '/banjir/img/floodgate.svg',
		iconSize: [22,22],
		iconAnchor: [11, 11],
		popupAnchor: [0, 0],
	})
};

/**
Styles outline polygons

@param {object} feature - individual Leaflet/GeoJSON feature object
*/
function styleOutline(feature) {
	var style = {
		weight: 0.5,
		color: 'black',
		fillOpacity: 0.8
	};
	// Set layer fill colour based on state
	if (feature.properties.state === 0) {
		style.fillColor = 'transparent';
	} else if (feature.properties.state === 1) {
		// Use caution
		style.fillColor = 'yellow';
	} else if (feature.properties.state === 2) {
		// >=10cm
		style.fillColor = '#9fd2f2';
	} else if (feature.properties.state === 3) {
		// >70cm
		style.fillColor = '#3399FF';
	} else if (feature.properties.state === 4) {
		// >150cm
		style.fillColor = '#045a8d';
	}
	return style;
}

function updateOutline(layer) {
	layer.setStyle(styleOutline(layer.feature));
}

/**
	Return a colour based on input number - based on Color Brewer

	@param {integer} d - number representing some attribute (e.g. count)

*/
function getColor(d) {
    return d > 30 ? '#800026' :
           d > 25  ? '#BD0026' :
           d > 20  ? '#E31A1C' :
           d > 15  ? '#FC4E2A' :
           d > 10   ? '#FD8D3C' :
           d > 5   ? '#FEB24C' :
           d > 1   ? '#FED976' :
					 d > 0	?	'#FFEDA0' :
                      '#FFEDA0';
}

/**
Set a popup label for an aggregate poplygon based on it's count attribute

@param {object} feature - individual Leaflet/GeoJSON object
@param {object}	layer - leaflet layer object
*/
function labelOutlines(feature, layer) {
	layer.on({
		mouseover: highlightOutline,
		mouseout: resetOutline,
		click: highlightOutline,
		dblclick: zoomToFeature
	});
}

var activeAggregate;

/**
Visual highlighting of polygon when hovered over with the mouse

@param {object} event - leaflet event object
*/
function highlightOutline(e) {
	var layer = e.target;

	highlightTableRow( layer );
	highlightOutlineLayer( layer );
}

/**
 * Highlight the layer
 * @param {object} layerElement Leaflet layer object
 */
function highlightOutlineLayer(layerElement) {
	// If we've got an already highlighted layer, unhighlight it
	if ( activeAggregate ) {
		activeAggregate.setStyle(styleOutline(activeAggregate.feature));
	}

	// Highlight the layer
	layerElement.setStyle({
		weight: 3,
		color: 'red',
		opacity:1,
		dashArray: '',
		fillOpacity: 0.7
	});

	// Update the tooltip
	info.update(layerElement.feature.properties);

	// Retain which layer is highlighted
	activeAggregate = layerElement;
}

/**
 * Highlight the table row
 * @param {object} layerElement Leaflet layer object
 */
function highlightTableRow(layerElement) {
	// Find table row which corresponds to the layer - VILLAGE LEVEL

	var row = levelNameToId(layerElement.feature.properties.parent_name);
	if (row.length===0) {
		// FIXME This should not happen. Verify that this won't occur, or handle the error if it does.
		return;
	}

	// If we have an active highlight, remove the highlight from the table row
	if ( activeAggregate ) {
		$('#table_village_'+levelNameToId(activeAggregate.feature.properties.parent_name)).removeClass('highlighted');
	}

	// Highlight the table row
	$('#table_village_'+row).addClass('highlighted');

	// Scroll the table view to the highlighted item
	var rowTop = $('#table_village_'+row).offset().top;
	var $table = $("#table");
	var tableTop = $table.offset().top;
	$table.scrollTop( $table.scrollTop()  + rowTop - tableTop);

}

/**
Reset style of aggregate after hover over

@param {object} event - leaflet event object
*/
function resetOutline(e){
	var layer = e.target;

	layer.setStyle(styleOutline(layer.feature));

	info.update();
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
		//pan to
}

/**
	Centre the map on a given location and open a popup's text box.

	Turn on point layer if required.

	@param {string} pkey - the key of the marker to display
	@param {number} lat - latitude to center on
	@param {number} lon - longitude to center on
*/
var centreMapOnPopup = function(pkey,lat,lon) {
	if (map.hasLayer(window.confirmedPoints) === false){
		window.confirmedPoints.addTo(map);
	}

	var m = markerMap[pkey];
	map.setView(m._latlng, 17);
	m.openPopup();
};

// Create timestamp control
var timestamp = L.control({'position':'topright'});

/**
	Toggle timestamp on map based on checkbox behaviour

	@param {Boolean} checkbox - true/false representation of checkbox state
*/
var toggle_timestamp = function(checkbox){

	if (checkbox === true){
		timestamp.addTo(map);
	}
	else {
		if (timestamp._map){
			map.removeControl(timestamp);
		}
	}
};
// Create timestamp text
timestamp.onAdd = function(map){
	var time = String(new Date()).slice(4,21);
	this._div = L.DomUtil.create('div', 'info');
	this._div.innerHTML = time;
	return this._div;
};

// map legend
var mapLegend = L.control({position:'bottomright'});

mapLegend.onAdd = function(map) {
	var div = L.DomUtil.create('div', 'info legend');
	div.innerHTML += '<div id="legendbox"><div class="sublegend"><div><span class="div-icon-confirmed-legend glyphicon glyphicon-tint" aria-hidden="true" style="margin-left:1px;"></span>&nbsp;'+layernames.confirmed+'</div><div><span class="div-icon-verified-legend glyphicon glyphicon-tint" aria-hidden="true" style="margin-right:1px;"></span>'+layernames.verified+'</div></div></div>';
	return div;
};

//flood heights scale
var heightsLegend = '<div id="heightsLegend"><div class="sublegend"><div style="font-weight:bold">'+layernames.floodheights.title+'</div><div><i class="color" style="background:#045a8d;"></i><span>&gt; 151 cm</span></div><div><i class="color" style="background:#3399FF"></i><span>&nbsp;71 cm &ndash; 150 cm </span></div><div><i class="color" style="background:#9fd2f2"></i><span>&nbsp;10 cm &ndash; 70 cm</span></div><i class="color" style="background:yellow"></i><span>&nbsp;'+layernames.floodheights.tentative_areas+'</span></div></div>';

//flood gauges legend
var siagaNames = {};
if (document.documentElement.lang == 'in' || document.documentElement.lang == 'id'){
	siagaNames[1] = 'Siaga I';
	siagaNames[2] = 'Siaga II';
	siagaNames[3] = 'Siaga III';
	siagaNames[4] = 'Siaga IV';
}
else {
		siagaNames[1] = 'Alert Level 1';
		siagaNames[2] = 'Alert Level 2';
		siagaNames[3] = 'Alert Level 3';
		siagaNames[4] = 'Alert Level 4';
}
var gaugesLegend = '<div id="gaugesLegend"><div class="sublegend"><div style="font-weight:bold">'+layernames.floodgauges+'</div><div><img src="/banjir/img/floodgauge_1.svg" height="18px;" width="auto" /><span>&nbsp;'+siagaNames[1]+'</span></div><div><img src="/banjir/img/floodgauge_2.svg" height="18px;" width="auto" /><span>&nbsp;'+siagaNames[2]+'</span></div><div><img src="/banjir/img/floodgauge_3.svg" height="18px;" width="auto" /><span>&nbsp;'+siagaNames[3]+'</span></div><div><img src="/banjir/img/floodgauge.svg" height="18px;" width="auto" /><span>&nbsp;'+siagaNames[4]+'</span></div></div>';

//infrastructure legend items
var pumpsLegend = '<div id="pumpsLegend"><div class="sublegend"><div><img src="/banjir/img/pump.svg" height="18px;" width="auto" /><span>&nbsp;'+layernames.pumps+'</span></div></div>';
var floodgatesLegend =  '<div id="floodgatesLegend"><div class="sublegend"><div><img src="/banjir/img/floodgate.svg" height="18px;" width="auto" /><span>&nbsp;'+layernames.floodgates+'</span></div></div>';
var waterwaysLegend = '<div id="waterwaysLegend"><div class="sublegend"><div><span style="background-color:#3960ac; font-size:6px;padding-top:8px;margin-left:8px;margin-right:5px;">&nbsp;</span><span>&nbsp;'+layernames.waterways+'</span></div></div>';


/**
	Information box for aggregate details
*/
var info = L.control({'position':'topright'});
//Create info box
info.onAdd = function(map){
	this.flag = 1;
	this._div = L.DomUtil.create('div', 'info'); // Create a div with class info
	this.update();
	return this._div;
};

//Update info box
var hover_text;
var reports_text;

if (document.documentElement.lang == 'in' || document.documentElement.lang == 'id'){
	hover_text = 'Arahkan ke area';
	reports_text = 'laporan';
}
else {
	hover_text = 'Hover over an area';
	reports_text = 'reports';
}

info.update = function(properties){
		this._div.innerHTML = (properties ? properties.parent_name+', '+properties.level_name : hover_text);
};

var reportsControl = L.control({position:'bottomleft'});

reportsControl.onAdd = function(map) {
  var div = L.DomUtil.create('div', 'leaflet-control');

  var reportsLink = L.DomUtil.create('a', 'leaflet-control-reports-button', div);
  //reportsLink.textContent = "<span class='badge'>4</span>";
  reportsLink.setAttribute('data-toggle', 'modal');
  reportsLink.setAttribute('href', '#reportsModal');

	window.reportsBadge = L.DomUtil.create('span', 'badge progress-bar-danger', reportsLink);

  return div;
};

var infoControl = L.control({position:'bottomleft'});

infoControl.onAdd = function(map) {
  var div = L.DomUtil.create('div', 'leaflet-control');
  var infoLink = L.DomUtil.create('a', 'leaflet-control-info-button', div);
  infoLink.textContent = "Information";
  infoLink.setAttribute('data-toggle', 'modal');
  infoLink.setAttribute('href', '#infoModal');

  return div;
};

//Initialise map
var latlon = new L.LatLng(-6.1924, 106.8317); //Centre Jakarta
var map = L.map('map').setView(latlon, 11); // Initialise map
map.attributionControl.setPrefix('');

//Specify default image path for Leaflet
L.Icon.Default.imagePath = '/banjir/css/images/';

// Reports control
infoControl.addTo(map);
reportsControl.addTo(map);

// Basemap - check for HD/Retina display
// See: http://www.robertprice.co.uk/robblog/2011/05/detecting_retina_displays_from_javascript_and_css-shtml/
var tileformat = '.png128';
if (window.devicePixelRatio > 1) {
	tileformat = '@2x.png128';
}
var base = L.tileLayer('https://api.mapbox.com/v4/petajakarta.lcf40klb/{z}/{x}/{y}'+tileformat+'?access_token=pk.eyJ1IjoicGV0YWpha2FydGEiLCJhIjoiTExKVVZ5TSJ9.IFf5jeFKz2iwMpBi5N3kUg').addTo(map);
var markerMap = {}; //Reference list of markers stored outside of Leaflet


/**
 * Initial loading of layers.
 */
var loadPrimaryLayers = function(layerControl) {
	// Load confirmed reports and both village and rw outlines.
//	var layerPromises = {
//		confirmed: getReports('confirmed')
//			.then(loadConfirmedPoints),
//		outlines: getAggregates('village')
//			.then(function(village) {
//				return getAggregates('rw').then( function(rw) {
//					return loadOutlines(village, rw);
//				});
//			})
//	};
	var layerPromises = {
			confirmed: getReports('confirmed')
				.then(loadConfirmedPoints),
			village: getAggregates('village'),
			rw: getAggregates('rw'),
			states: getDimsStates()
		};

	// Once all loaded, setup the map and controls.
	return new RSVP.Promise(function(resolve, reject) {
		RSVP.hash(layerPromises).then(function(overlays) {
			// add confirmed points to the map
			overlays.confirmed.addTo(map);
			layerControl.addBaseLayer(overlays.confirmed, layernames.confirmed);

			// use turf for a point in polygon count operations
			var counted_rw = turf.count(overlays.rw, window.confirmedPoints_geojson, 'pt_count');
			var counted_village = turf.count(overlays.village, window.confirmedPoints_geojson, 'pt_count');
			// add outlines to map, and pass for table population
			outlines = loadOutlines(counted_village, counted_rw, overlays.states);
			outlines.addTo(map);

			map.spin(false);

			resolve(layerControl);
		}, reject);
	});
};

var loadSecondaryLayers = function(layerControl) {
	return new RSVP.Promise(function(resolve, reject) {
		secondaryPromises = {
			waterways: getInfrastructure('waterways')
				.then(function(waterways){
					return loadInfrastructure('waterways', waterways);
				}),
			pumps: getInfrastructure('pumps')
				.then(function(pumps){
					return loadInfrastructure('pumps', pumps);
				}),
			floodgates: getInfrastructure('floodgates')
				.then(function(floodgates){
					return loadInfrastructure('floodgates', floodgates);
				}),
			floodgauges: getInfrastructure('floodgauges')
				.then(function(floodgauges){
					return loadInfrastructure('floodgauges', floodgauges);
				})
			// TODO These were already fetched for the primary layers can we cache the data for this call?
			/*village: getAggregates('village')
				.then(function(aggregates) {
					return loadAggregates('village', aggregates);
				}),
			rw: getAggregates('rw')
				.then(function(aggregates) {
					return loadAggregates('rw', aggregates);
				})*/
		};

		RSVP.hash(secondaryPromises).then(function(overlays) {
			// Add overlays to the layer control
			layerControl.addOverlay(overlays.floodgauges, layernames.floodgauges);
			layerControl.addOverlay(overlays.waterways, layernames.waterways);
			layerControl.addOverlay(overlays.pumps, layernames.pumps);
			layerControl.addOverlay(overlays.floodgates, layernames.floodgates);
			showURLReport(); //once point layers loaded zoom to report specified in URL

		});
	});
};

// Load reports
$(function() {
	map.spin(true);
	window.layerControl = L.control.layers({}, {}, {position: 'bottomleft'}).addTo(map);
	loadPrimaryLayers(window.layerControl).then(loadSecondaryLayers);

	// Always show info box
	info.addTo(map);
	info.update();
});


/**
	Listen for map events and load required layers
*/
map.on('overlayremove', function(event){
	if (event.layer == window.floodgauges){
		$('#gaugesLegend').remove();
	}
	else if (event.layer == window.pumps){
		$('#pumpsLegend').remove();
	}
	else if (event.layer == window.waterways){
		$('#waterwaysLegend').remove();
	}
	else if (event.layer == window.floodgates){
		$('#floodgatesLegend').remove();
	}
});

map.on('overlayadd', function(event){
	if (event.layer == window.floodgauges) {
		$('#legendbox').append(gaugesLegend);
	}
	else if (event.layer == window.pumps) {
		$('#legendbox').append(pumpsLegend);
	}
	else if (event.layer == window.waterways) {
		$('#legendbox').append(waterwaysLegend);
	}
	else if (event.layer == window.floodgates) {
		$('#legendbox').append(floodgatesLegend);
	}
});

/**
	Ask popups to render using Twitter embedded tweets
*/
map.on('popupopen', function(popup){

	if ($('tweet-container')){
			twttr.widgets.load($('.leaflet-popup-content'));
		}
	if ($('floodgauge-container')){
		if (popup.popup._source.feature.properties !== null){
				var properties = popup.popup._source.feature.properties;
				var ctx = $("#gaugeChart").get(0).getContext("2d");
				var data = {
					labels : [],
					datasets : [{
						label: "",
						fillColor: "rgba(151,187,205,0.2)",
						strokeColor: "rgba(151,187,205,1)",
						pointColor: "rgba(151,187,205,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(151,187,205,1)",
						data: []
					}]
				};
				for (var i = 0; i < properties.observations.length; i++){
					data.labels.push(properties.observations[i].measuredatetime.slice(11,16));
					data.datasets[0].data.push(properties.observations[i].depth);
				}
				var gaugeChart = new Chart(ctx).Line(data, {bezierCurve:true, scaleLabel: "<%= ' ' + value%>"});
			}
		}
});

/**
 * Transform a plain text level name into a string suitable for use as a DOM ID
 * @param levelName Level name in plain text
 * @returns Level name suitable for use as a DOM ID
 */
function levelNameToId(levelName) {
	return levelName.replace(/ /g,"_");
}

/**
 * Fill the data in the table view from aggregate data
 * @param {object} outlines The village aggregate data response from the server
 * @param {object} outlineLayer The Leaflet LayerGroup for the outlines
 * @param {object} rw The neighbourhood aggregate data response from the server
 * @param {object} dimsStates The DIMS state data
 */
function populateTable(outlines, outlineLayer, rw, dimsStates) {

	var html = "";
	for (var i = 0; i < outlines.features.length; i++){
		// Filter RW data by current village row
		var key = "parent_name";
		var value = outlines.features[i].properties.level_name;
		var filtered = turf.filter(rw, key, value);

		// Build RW rows
		var rw_html = "";
		for (var x = 0; x < filtered.features.length; x++){
			rw_html += "<tr id='table_rw_" + filtered.features[x].properties.pkey + "' data-pkey='" + filtered.features[x].properties.pkey + "' class='rw table_village_" + levelNameToId(filtered.features[x].properties.parent_name) + "' style='display:none;'>";
			rw_html += "<td></td>";
			rw_html += "<td>" + filtered.features[x].properties.pkey + "</td>";
			rw_html += "<td>"+filtered.features[x].properties.level_name+"</td>";
			rw_html += "<td>" + filtered.features[x].properties.pt_count + "</td>";
			rw_html += "<td class='dimsStatus'></td>";
			rw_html += "<td>";
			// TODO Edit mode temporary fix
			if (editMode) {
				rw_html += "<select class='flooded-state'>";
				rw_html += "<option value='0'>Not set</option>";
				rw_html += "<option value='1'>Hati-Hati</option>";
				rw_html += "<option value='2'>10&ndash;70cm</option>";
				rw_html += "<option value='3'>71&ndash;150cm</option>";
				rw_html += "<option value='4'>151cm +</option>";
				rw_html += "</select>";
			}
			rw_html += "</td>";
			rw_html += "</tr>";
		}
		// Village row
		html += "<tr class='village' id='table_village_" + levelNameToId(outlines.features[i].properties.level_name) + "' data-level_name='" + outlines.features[i].level_name + "'>";
		html += "<td><a class='village-toggle' data-expanded=''>+</a></td>";
		html += "<td>" + outlines.features[i].properties.pkey + "</td>";
		html += "<td>" + outlines.features[i].properties.level_name + "</td>";
		if (outlines.features[i].properties.pt_count > 0){
			html += "<td style='color:red;font-weight:bold'>" + outlines.features[i].properties.pt_count+ "</td>";
		}
		else {
			html += "<td>" + outlines.features[i].properties.pt_count+ "</td>";
		}
		html += "<td></td>";
		html += "<td></td>";
		html += "<td></td>";
		html += "</tr>";
		html += rw_html;

	}
	$("#table table tbody").append( html );

	for (i=0; i<dimsStates.features.length; i++) {
		var feature = dimsStates.features[i];
		$("#table_rw_"+feature.properties.pkey+" .dimsStatus").text( feature.properties.level );
	}

	// Build lookup table of outline layers by pkey
	var outlineLayers = {};
	$.each( outlineLayer._layers, function(i,layer) {
		outlineLayers[layer.feature.properties.pkey] = layer;
	});

	// Store references to layers with each row
	$("#table tr[id^=table_rw_]").each( function(i) {
		var $row = $(this);
		$row.data( 'layer', outlineLayers[$row.data('pkey')] );
		updateFloodedOutlineLayer($row);
	});

	// When hovering over a table row, highlight the row and the corresponding layer
	$("#table tr[id^=table_rw_]").on('mouseover', function() {
		// Remove all highlights
		$("#table tr.highlighted").removeClass('highlighted');
		var layer = $(this).data('layer');
		if (!layer || !layer._map) {
			// TODO This probably should not occur. Verify that it shouldn't happen and either
			// remove this return, or handle the error if it could occur.
			return;
		}
		highlightOutlineLayer( layer );
		$(this).addClass('highlighted');
	}).on('mouseout', function() {
		// Remove all highlights
		$("#table tr.highlighted").removeClass('highlighted');
	});

	// Expand/collapse the neighbourhood data rows for the village
	$('.village-toggle').on('click', function() {
		var $toggleButton = $(this);
		var villageClass = '.' + $toggleButton.closest('tr').attr('id');
		if ($toggleButton.data('expanded')) {
			$toggleButton.text('+');
			$( villageClass ).hide();
			$toggleButton.data('expanded', false);
		} else {
			$toggleButton.text('-');
			$( villageClass ).show();
			$toggleButton.data('expanded', true);
		}
	});

	// Change the flooded state of the row
	// Update the state internally and push the change to the server
	function updateFloodedState($row) {
		var layer = $row.data('layer');

		$.ajax('/banjir/data/api/v2/rem/flooded/'+layer.feature.properties.pkey, {
			method: 'PUT',
			data: 'state='+layer.feature.properties.state
		});
	}

	function updateFloodedOutlineLayer($row) {
		var layer = $row.data('layer');
		var $select = $('.flooded-state', $row);

		if ( $select.val() !== layer.feature.properties.state ) {
			$select.val(layer.feature.properties.state);
		}

		updateOutline(layer);
	}

	// Handle the 'Flooded' state dropdown
	$('.flooded-state').on('change', function() {
		var $select = $(this);
		var $row = $select.closest('tr');
		var layer = $row.data('layer');

		layer.feature.properties.state = parseInt($select.val());

		updateFloodedState($row);
		updateFloodedOutlineLayer($row);
	});

}
// Finally, add the legend
mapLegend.addTo(map);
