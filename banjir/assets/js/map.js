//map.js - JavaScript for PetaJakarta web map

/**
*@file LeafletJS map to display data from cognicity server (PetaJakarta.org)
*@copyright (c) Tomas Holderness & SMART Infrastructure Facility January 2014
*@module map
*/

/**
	Format popup with an embedded tweet

	@param {object} feature - a GeoJSON feature representing a report
*/
var tweetPopup = function(feature){
	var popup = '<div id="tweet-container" style="width:250px; height:300px; overflow-y:scroll"><blockquote class="twitter-tweet"><a target="_blank"  href="'+feature.properties.url+'">'+feature.properties.text+'</a></blockquote></div>';
	return popup;
};
/**
	Format popup with a Detik report

	@param {object} feature - a GeoJSON feature representing a report
*/
var detikPopup = function(feature){
	var popup = '<div id="detik-container" style="width:250px; height:300px; overflow:auto; background-color:white;"><div class="media"><a class="pull-left" href="#"><img class="media-object" src="https://pasangmata.detik.com/assets/fe/img/logo_detik.png" height="22"></a><div class="media-body"><h4 class="media-heading">PASANGMATA.COM</h4></div></div><p class="lead" style="margin:0;">'+feature.properties.title+'</p><img class="img-responsive" src="'+feature.properties.image_url+'" width="230"/><h5>'+feature.properties.text+'</h5><h5>'+feature.properties.created_at+'</h5><a href="'+feature.properties.url+'" target="_blank">'+feature.properties.url+'</a></div>';

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
			layer.bindPopup(tweetPopup(feature));
		}
		// Render as Detik report
		else if (feature.properties.source == 'detik'){
			layer.bindPopup(detikPopup(feature));
		}
		// Default to text rendering
		else {
			layer.bindPopup(feature.properties.text.parseURL());
		}
	}
};

/**
	Add a text popup to the provided layer

	@param {object} feature - a GeoJSON feature
	@param {L.ILayer} layer - the layer to attach the popup to
*/

/**
	Get a map overlay layer from the geoserver

	@param {string} layer - the layer to be fetched
	@return {L.TileLayer} layer - the layer that was fetched from the server
*/
var getInfrastructure = function(layer) {
	return new RSVP.Promise(function(resolve, reject){
		// Use live data
		jQuery.getJSON("/banjir/data/api/v2/infrastructure/"+layer+"?format=topojson", function(data){
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
	Get TopoJSON representing flooding reports from the server

	@param {string} type - the type of report to get: `'confirmed'` or `'uncomfirmed'`
	@param {function} callback - a function to be called when data is finished loading

	Converts TopoJson to GeoJson using topojson
*/
var getReports = function(type) {
	return new RSVP.Promise(function(resolve, reject) {
		// Use live data
		jQuery.getJSON('/banjir/data/api/v2/reports/'+type+'?format=topojson', function(data) {
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
		jQuery.getJSON('/banjir/data/api/v2/reports/confirmed/'+id+'?format=geojson', function(data){
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

/**
	Get GeoJSON representing counts of reports in RW polygons
	@param {function} callback - a function to be called when data is finished loading
	@param {level} string - administrative boundary level to load. Can be 'rw' or 'village', also passed to load function for identification
*/
var getAggregates = function(level) {
	return new RSVP.Promise(function(resolve, reject) {
		jQuery.getJSON('/banjir/data/api/v2/aggregates/live?format=topojson&level='+level+'&hours='+aggregateHours, function(data) {
			resolve(topojson.feature(data, data.objects.collection));
		});
	});
};

/**
	Plots confirmed points on the map as circular markers
	@param {object} reports - a GeoJSON object containing report locations
*/
var loadConfirmedPoints = function(reports) {
	if (reports) {
		loadTable(reports); //sneaky loadTable function.

		window.reportsBadge.textContent = reports.features.length;

		window.confirmedPoints = L.geoJson(reports, {
			pointToLayer: function(feature, latlng) {
				return L.circleMarker(latlng, styleConfirmed);
			},
			onEachFeature: markerPopup
		});
  } else {
		window.confirmedPoints = L.geoJson();
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
			if ( !validateNumberParameter(id,0) ) err = new Error( "'report id parameter is invalid" );
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
	Plots counts of reports in RW polygons

	@param {string} level - string - administrative boundary level to load. Can be 'rw' or 'village', should be passed from getfunction
	@param {object} aggregates - a GeoJSON object containing polygon features
*/

var aggregateLayers = {};
var aggregateVersions = {};
var aggregateInc = 0;

var loadAggregates = function(level, aggregates){
	var aggregateLayer = L.geoJson(aggregates, {style:styleAggregates, onEachFeature:labelAggregates});
	aggregateLayers[level] = aggregateLayer;
	aggregateLayers[level].version = aggregateInc;
  aggregateVersions[level] = aggregateInc;
  aggregateInc += 1;
  updateTable(level, aggregates);
	return aggregateLayers[level];
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
		weight:2.5,
		opacity:1,
	},
	pumps:L.icon({
		iconUrl: '/banjir/img/pump.svg',
		iconSize: [28,28],
		iconAnchor: [14, 14],
		popupAnchor: [0, 0],
	}),
	floodgates:L.icon({
		iconUrl: '/banjir/img/floodgate.svg',
		iconSize: [28,28],
		iconAnchor: [14, 14],
		popupAnchor: [0, 0],
	})
};

/**
	Styles counts of reports in RW polygons

	@param {object} feature - individual Leaflet/GeoJSON feature object
	*/
function styleAggregates(feature) {
    return {
        fillColor: feature.properties.flooded ? '#00f' : getColor(feature.properties.count),
        weight: 0,
				//disabled polygon borders for clarity
        //opacity: 1,
        //color: 'white',
        //dashArray: '3',
        fillOpacity: 0.7
    };
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
function labelAggregates(feature, layer) {
		// commented pop up label as working on touch/info box
    // does this feature have a property named count?
  	/*if (feature.properties && feature.properties.count && feature.properties.level_name) {
        layer.bindPopup(JSON.stringify(feature.properties.level_name+': '+feature.properties.count+' reports'));
    }*/
		layer.on({
			mouseover: highlightAggregate,
			mouseout: resetAggregate,
      click: highlightAggregate,
			dblclick: zoomToFeature
		});
		
//		layer.attr('id',feature.properties.pkey);
}

var activeAggregate = null;

/**
	Visual highlighting of polygon when hovered over with the mouse

	@param {object} event - leaflet event object
*/
function highlightAggregate(e) {
	var layer = e.target;
  
	highlightTableRow( layer );  
	highlightLayer( layer );
}

/**
 * Highlight the layer
 * @param {object} layerElement Leaflet layer object
 */
function highlightLayer(layerElement) {
	// If we've got an already highlighted layer, unhighlight it
	if (activeAggregate !== null) {
		activeAggregate.setStyle(styleAggregates(activeAggregate.feature));
		activeAggregate.bringToBack();
	}
	
	// Highlight the layer
	layerElement.setStyle({
		weight: 5,
		color: '#333',
		opacity:1,
		dashArray: '',
		fillOpacity: 0.7
	});
	
	layerElement.bringToFront(); //buggy?
	
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
	// Find table row which corresponds to the layer
	var $row = $('#t-'+layerElement.feature.properties.pkey);
	
	// If we have an active highlight, remove the highlight from the table row
	if (activeAggregate !== null) {
		var $highlightedRow = $('#t-'+activeAggregate.feature.properties.pkey);
		$highlightedRow.removeClass('highlighted');
	}
	
	// Highlight the table row
	$row.addClass('highlighted');
	
	// Scroll the table view to the highlighted item
	var rowTop = $row.offset().top;
	var $table = $("#table");
	var tableTop = $table.offset().top;
	$table.scrollTop( $table.scrollTop()  + rowTop - tableTop);
}

/**
	Reset style of aggregate after hover over

	@param {object} event - leaflet event object
*/
function resetAggregate(e){
	var layer = e.target;

	layer.setStyle(styleAggregates(layer.feature));
	layer.bringToBack();

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

/**
	Center the map on the user's location if they're in jakarta & add a pin to show location
	See http://leafletjs.com/examples/mobile.html for reference implementation.

	@param {Position} position - the user's position as provided by client browser
*/
var setViewJakarta = function(position) {
	if (position.coords.latitude >= -6.4354 && position.coords.latitude <= -5.9029 &&
		  position.coords.longitude >= 106.5894 && position.coords.longitude <= 107.0782) {
				map.setView(L.latLng(position.coords.latitude,position.coords.longitude), 17); // Set to the users current view

				//Remove existing marker if present
				if (window.bluedot){
					map.removeLayer(window.bluedot);
				}
				// Add new marker
				window.bluedot = L.marker([position.coords.latitude,position.coords.longitude]);
				window.bluedot.addTo(map);
	}
};

// Create timestamp control
var timestamp = L.control({'position':'bottomright'});

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
	var time = String(new Date()).slice(0,21);
	this._div = L.DomUtil.create('div', 'info');
	this._div.innerHTML = time;
	return this._div;
};

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

if (document.documentElement.lang == 'in'){
	hover_text = 'Arahkan ke area';
	reports_text = 'laporan';
}
else {
	hover_text = 'Hover over an area';
	reports_text = 'reports';
}

info.update = function(properties){

		this._div.innerHTML = (properties ? properties.level_name+': '+properties.count+' '+reports_text : hover_text);
};

/**
	Legend box
*/
var legend = L.control({position:'bottomright'});

legend.onAdd = function(map) {

	var div = L.DomUtil.create('div', 'info legend'),
	grades = [0,1, 5, 10, 15, 20, 25, 30],
	labels = [];
  // label for legend
	if (document.documentElement.lang == 'in') {
		div.innerHTML+='Jumlah laporan<BR>';
	}
	else {
		div.innerHTML+='Number of reports<BR>';
	}
	// loop through density intervals and generate label with coloured square
	for (var i=0; i <grades.length; i++) {
		div.innerHTML += '<i class="color" style="background:'+getColor(grades[i]+1) + '"></i>';
	}
  div.innerHTML += '<br>';
	// loop through density intervals and generate label with coloured square
	for (i=0; i <grades.length-1; i++) {
		div.innerHTML += '<span class="number">'+grades[i]+'</span>';
	}
	div.innerHTML +='<span class="number" style="margin-left:1px;">'+grades[grades.length-1]+'+</span>';
	//div.innerHTML +='+';

	return div;
};

var aggregatesControl = L.control({position:'bottomright'});

var hideAggregates = function() {
  if (aggregateLayers) {
    if (aggregateLayers.subdistrict) {
      map.removeLayer(aggregateLayers.subdistrict);
      window.layerControl.removeLayer(aggregateLayers.subdistrict);
    }
    if (aggregateLayers.village) {
      map.removeLayer(aggregateLayers.village);
      window.layerControl.removeLayer(aggregateLayers.village);
    }
    if (aggregateLayers.rw) {
      map.removeLayer(aggregateLayers.rw);
      window.layerControl.removeLayer(aggregateLayers.rw);
    }
  }
};

var reloadAggregates = function() {
  var promises = {
    subdistrict: getAggregates('subdistrict')
				.then(function(aggregates) {
					return loadAggregates('subdistrict', aggregates);
				}),
    village: getAggregates('village')
				.then(function(aggregates) {
					return loadAggregates('village', aggregates);
				}),
    rw: getAggregates('rw')
				.then(function(aggregates) {
					return loadAggregates('rw', aggregates);
				})
  };

  return RSVP.hash(promises);
};

// Turn layers on/off depending on zoom level
var updateAggregateVisibility = function() {
	var zoom  = map.getZoom();

	if (zoom < 13) {
		hideAggregates();
		if (map.hasLayer(window.confirmedPoints) === false){
			aggregateLayers.subdistrict.addTo(map);
			aggregateLayers.subdistrict.bringToBack();
		}
		window.layerControl.addBaseLayer(aggregateLayers.subdistrict, layernames.subdistrict);

	} else if (zoom >= 13 && zoom <= 14) {
		hideAggregates();
		if (map.hasLayer(window.confirmedPoints) === false){
			aggregateLayers.village.addTo(map);
			aggregateLayers.village.bringToBack();
		}
		window.layerControl.addBaseLayer(aggregateLayers.village, layernames.village);

	} else if (zoom >= 15) {
		hideAggregates();
		if (map.hasLayer(window.confirmedPoints) === false){
			aggregateLayers.rw.addTo(map);
			aggregateLayers.rw.bringToBack();
		}
		window.layerControl.addBaseLayer(aggregateLayers.rw, layernames.neighbourhood);

	}
	else {
		hideAggregates();

	}
  activeAggregate = null;
};

aggregatesControl.onAdd = function(map) {
	var div = L.DomUtil.create('div', 'info control aggregates');

  var buttonGroup = L.DomUtil.create('div', 'btn-group', div);
  var buttons = [];
	var labels = [];
	if (document.documentElement.lang == 'in'){
		labels = ['1 jam', '3 jam', '6 jam'];
	}
	else {
  	labels = ['1hr', '3hrs', '6hrs'];
	}
  var values = [1, 3, 6];

  var clickCallback = function() {
    $('.control.aggregates button.active').removeClass('active');
    this.className += " active";
    aggregateHours = parseInt(this.getAttribute('value'), 10);
    aggregateLayers.subdistrict.foo = "bar";
		map.spin(true);
    hideAggregates();
    reloadAggregates().then(function() {
      updateAggregateVisibility();
			map.spin(false);
    });
  };

  for (var i = 0; i < 3; i++) {
    buttons[i] = L.DomUtil.create('button', 'btn btn-default', buttonGroup);
    buttons[i].setAttribute('value', values[i]);
    buttons[i].setAttribute('disabled', true);
    buttons[i].textContent = labels[i];
    buttons[i].addEventListener("click", clickCallback);
  }
  L.DomUtil.addClass(buttons[Math.round(aggregateHours/3)], 'active');

  return div;
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

var locationControl = L.control({position:'bottomleft'});

locationControl.onAdd = function(map){
	var div = L.DomUtil.create('div', 'leaflet-control');
	var locationLink = L.DomUtil.create('a', 'leaflet-control-location-button', div);
	locationLink.textContent = 'Current Location';
	locationLink.setAttribute('href', '#');
	locationLink.setAttribute('onclick', 'navigator.geolocation.getCurrentPosition(setViewJakarta); return false;');

	return div;
};

//Initialise map
var latlon = new L.LatLng(-6.1924, 106.8317); //Centre Jakarta
var map = L.map('map').setView(latlon, 12); // Initialise map
map.attributionControl.setPrefix('');

//Specify default image path for Leaflet
L.Icon.Default.imagePath = '/banjir/css/images/';

//Check user location and alter map view accordingly
map.locate({setView:false});
if ('geolocation' in navigator && window.isTouch) {
	navigator.geolocation.getCurrentPosition(setViewJakarta);
}

// Reports control
infoControl.addTo(map);
reportsControl.addTo(map);
locationControl.addTo(map);

// Basemap - check for HD/Retina display
// See: http://www.robertprice.co.uk/robblog/2011/05/detecting_retina_displays_from_javascript_and_css-shtml/
var tileformat = '.png128';
if (window.devicePixelRatio > 1) {
	tileformat = '@2x.png128';
}
var base = L.tileLayer('https://api.mapbox.com/v4/petajakarta.lcf40klb/{z}/{x}/{y}'+tileformat+'?access_token=pk.eyJ1IjoicGV0YWpha2FydGEiLCJhIjoiTExKVVZ5TSJ9.IFf5jeFKz2iwMpBi5N3kUg').addTo(map);
var markerMap = {}; //Reference list of markers stored outside of Leaflet

// Styles for confirmed points
var styleConfirmed = {
    radius: 7,
    fillColor: "blue",
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

// URL replacement in tweets
String.prototype.parseURL = function() {
	return this.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function(url) {
		return "<a target='_blank' href='"+url+"'>"+url+"</a>";
	});
};

var layernames = {};

if (document.documentElement.lang == 'in'){
	layernames.confirmed = 'Laporan dikonfirmasi';
	layernames.subdistrict = 'Laporan Kecamatan';
	layernames.village = 'Laporan Desa';
	layernames.neighbourhood = 'Laporan RW';
	layernames.waterways = 'Aliran Air';
	layernames.pumps = 'Pompa Air';
	layernames.floodgates = 'Pintu Air';
}
else {
	layernames.confirmed = 'Confirmed Reports';
	layernames.subdistrict = 'Subdistrict Aggregates';
	layernames.village = 'Village Aggregates';
	layernames.neighbourhood = 'Neighbourhood Aggregates';
	layernames.waterways = 'Waterways';
	layernames.pumps = 'Pumps';
	layernames.floodgates = 'Floodgates';
}

var loadPrimaryLayers = function(layerControl) {
	var layerPromises = {
		confirmed: getReports('confirmed')
			.then(loadConfirmedPoints)};

  if (!window.isTouch) {
    layerPromises.subdistrict = getAggregates('subdistrict')
      .then(function(aggregates) {
        return loadAggregates('subdistrict', aggregates);
      });
  }

	return new RSVP.Promise(function(resolve, reject) {
		RSVP.hash(layerPromises).then(function(overlays) {

      if (!window.isTouch) {
        layerControl.addBaseLayer(overlays.subdistrict, layernames.subdistrict);
        //overlays.subdistrict
      }

			layerControl.addBaseLayer(overlays.confirmed, layernames.confirmed);
			overlays.confirmed.addTo(map);
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
				})
		};

    if (!window.isTouch) {
      _.extend(secondaryPromises, {
      village: getAggregates('village')
				.then(function(aggregates) {
					return loadAggregates('village', aggregates);
				}),
      rw: getAggregates('rw')
				.then(function(aggregates) {
					return loadAggregates('rw', aggregates);
				})
      });
    }

		RSVP.hash(secondaryPromises).then(function(overlays) {
			// Add overlays to the layer control
			showURLReport();
			layerControl.addOverlay(overlays.waterways, layernames.waterways);
			layerControl.addOverlay(overlays.pumps, layernames.pumps);
			layerControl.addOverlay(overlays.floodgates, layernames.floodgates);
		});
	});
};

// Load reports
$(function() {
	map.spin(true);
	window.layerControl = L.control.layers({}, {}, {position: 'bottomleft'}).addTo(map);
	loadPrimaryLayers(window.layerControl).then(loadSecondaryLayers);
});

/**
	Listen for map events and load required layers [non-touch devices]
*/
if (!window.isTouch){
	//Update aggregates by zoom level
	map.on('zoomend', function(){
			updateAggregateVisibility();
	});

	//Toggle Aggregate legend
	map.on('baselayerchange', function(event){
		if (event.layer == window.confirmedPoints){
			if (info._map){
				map.removeControl(info);
			}
			if (legend._map){
				map.removeControl(legend);
			}
			if (aggregatesControl._map){
				map.removeControl(aggregatesControl);
			}
		}
		else {
			//Update legend boxes
			if (!info._map){
				info.addTo(map);
				info.update();
			}

			if (!legend._map){
				legend.addTo(map);
			}
			if (!aggregatesControl._map){
				aggregatesControl.addTo(map);
				$('.control.aggregates button').prop('disabled', false);
			}
			event.layer.bringToBack();
		}
	});
}

/**
	Ask popups to render using Twitter embedded tweets
*/
map.on('popupopen', function(popup){
	if ($('tweet-container')){
			twttr.widgets.load($('.leaflet-popup-content'));
		}
});

/**
 * Fill the data in the table view from aggregate data
 * @param level Level of the aggregate data
 * @param aggregates Aggregate data
 */
function updateTable(level,aggregates) {
console.log('Update table for '+level);
	// Only fill data from the village table FIXME
	if ( level === 'village' ) {
		
		// Construct HTML for table view of the aggregate data
		var html = "";
		$.each( aggregates.features, function( i, feature ) {
			html += "<tr class='village' id='t-" + feature.properties.pkey + "'>";
			html += "<td><a class='village-toggle' data-expanded=''>+</a></td>";
			html += "<td>" + feature.properties.pkey + "</td>";
			html += "<td>" + feature.properties.level_name + "</td>";
			html += "<td>" + feature.properties.count + "</td>";
			html += "<td>1</td>";
			html += "<td><a class='flooded-toggle'>Flooded</a></td>";
			html += "</tr>";
			
			html += "<tr class='rw t-" + feature.properties.pkey + "' style='display:none;' id='t-" + feature.properties.pkey + "'>";
			html += "<td></td>";
			html += "<td>123</td>";
			html += "<td>RW 1</td>";
			html += "<td>1</td>";
			html += "<td>2</td>";
			html += "<td></td>";
			html += "</tr>";			

			html += "<tr class='rw t-" + feature.properties.pkey + "' style='display:none;' id='t-" + feature.properties.pkey + "'>";
			html += "<td></td>";
			html += "<td>456</td>";
			html += "<td>RW 2</td>";
			html += "<td>3</td>";
			html += "<td>4</td>";
			html += "<td></td>";
			html += "</tr>";			
		});
		$("#table table tbody").html( html );

		// Store references to layers with each row
		$("#table tr[id^=t]").each( function(i) {
			var $row = $(this);
			var id = $(this).attr('id');
			var lid = id.substring(2, id.length);
			$.each( aggregateLayers[level]._layers, function(i,layer) {
				if ( layer.feature.properties.pkey === Number(lid) ) {
					$row.data( 'layer', layer );
				}
			});
			// TODO Neighbourhood layers
		});
		
		// When hovering over a table row, highlight the row and the corresponding layer
		$("#table tr[id^=t]").on('mouseover', function() {
			highlightLayer( $(this).data('layer') );
			$(this).addClass('highlighted');
		}).on('mouseout', function() {
			$(this).removeClass('highlighted');
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
		
		// Handle the 'Flooded' toggle button
		$('.flooded-toggle').on('click', function() {
			var $toggleButton = $(this);
			var villageClass = '.' + $toggleButton.closest('tr').attr('id');
			// TODO Send event to server
			if ($toggleButton.data('flooded')) {
				$toggleButton.removeClass('flooded');
				$toggleButton.data('flooded', false);
				$toggleButton.closest('tr').data('layer').feature.properties.flooded = false;
				highlightLayer( $toggleButton.closest('tr').data('layer') );
			} else {
				$toggleButton.addClass('flooded');
				$toggleButton.data('flooded', true);
				$toggleButton.closest('tr').data('layer').feature.properties.flooded = true;
				$toggleButton.closest('tr').data('layer').setStyle({fillColor:'#00f'});
			}
		});
		
	}
	
}
