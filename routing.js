var geoserverUrl = 'http://192.168.12.64:8080/geoserver';

// only update route every half-second during a drag
setInterval(function() { allowRefresh = true; }, 500);

var source;
var target;

/* vertex layer */
var wmsSource = new ol.source.ImageWMS({
  url: geoserverUrl + '/wms',
  params: {
    'LAYERS': 'tutorial:vertices'
  }
});

var wmsLayer = new ol.layer.Image({
  source: wmsSource
});

/* route layer */
var routeLayer;
var route;
var vectorSource;

/* marker layer */
var sourceFeature = new ol.Feature({
  geometry: new ol.geom.Point(
      ol.proj.transform([-70.26, 43.665], 'EPSG:4326', 'EPSG:3857'))
});
sourceFeature.setStyle(
    [new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({
          color: 'rgba(0, 255, 128, 1)'
        }),
        stroke: new ol.style.Stroke({
          color: 'rgba(0, 255, 128, 1)',
          width: 2
        })
      })
    })]
);
sourceFeature.on('change', changeHandler);
var targetFeature = new ol.Feature({
  geometry: new ol.geom.Point(
      ol.proj.transform([-70.255, 43.67], 'EPSG:4326', 'EPSG:3857'))
});
targetFeature.setStyle(
    [new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({
          color: 'rgba(255, 0, 128, 1)'
        }),
        stroke: new ol.style.Stroke({
          color: 'rgba(255, 0, 128, 1)',
          width: 2
        })
      })
    })]
);
targetFeature.on('change', changeHandler);

/* map */
var view = new ol.View2D({
  center: ol.proj.transform([-70.26, 43.67], 'EPSG:4326', 'EPSG:3857'),
  zoom: 12
});

var viewProjection = /** @type {ol.proj.Projection} */
    (view.getProjection());

var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    }), wmsLayer
  ],
  view: view
});

var markers = new ol.FeatureOverlay({
  features: [sourceFeature, targetFeature],
  map: map
});

var modify = new ol.interaction.Modify({
  features: markers.getFeatures()
});
map.addInteraction(modify);

var changed;
map.on('pointerup', function(evt) {
  if (changed) {
    console.log('changed');
  }
  changed = false;
});

/*
map.on('singleclick', function(evt) {
  document.getElementById('info').innerHTML = '';
  var viewResolution = (view.getResolution());
  var url = wmsSource.getGetFeatureInfoUrl(
      evt.coordinate, viewResolution, viewProjection,
      {'INFO_FORMAT': 'application/json'});
  if (url) {
    $.getJSON(url, function(d) {
      var geojson = new ol.format.GeoJSON();
      var features = geojson.readFeatures(d);
      if (target) {
        source = features[0];
        target = null;
        // clear route
      } else if (source) {
        target = features[0];
        getRoute();
      } else {
        source = features[0];
      }
    })
  }
});
*/

function getRoute() {
  map.removeLayer(routeLayer);
  var viewParams = [
    'source:' + source.getId().split('.')[1],
    'target:' + target.getId().split('.')[1],
    'cost:time'
  ];

  var url = geoserverUrl + '/wfs?service=WFS&version=1.0.0&' +
      'request=GetFeature&typeName=tutorial:shortest_path&' +
      'outputformat=text/javascript&' +
      'format_options=callback:loadFeatures&viewparams=' + viewParams.join(';');
  vectorSource = new ol.source.ServerVector({
    format: new ol.format.GeoJSON(),
    strategy: ol.loadingstrategy.all,
    loader: function(extent, resolution, projection) {
      $.ajax({
        url: url,
        dataType: 'jsonp'
      });
    },
    projection: 'EPSG:3857'
  });
  routeLayer = new ol.layer.Vector({
    source: vectorSource,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(0, 0, 255, 0.6)',
        width: 8
      })
    })
  });

  map.addLayer(routeLayer);
}

var loadFeatures = function(response) {
  var currentFeatures = vectorSource.getFeatures();
  for (var i = currentFeatures.length - 1; i >= 0; --i) {
    vectorSource.removeFeature(currentFeatures[i]);
  }
  routeLayer.getSource().addFeatures(routeLayer.getSource()
      .readFeatures(response));
};

function changeHandler(e) {
  changed = true;
  if (!allowRefresh) {
    return;
  }

  allowRefresh = false;
  var feature = e.target;
  document.getElementById('info').innerHTML = '';
  var viewResolution = /** @type {number} */ (view.getResolution());
  var url = wmsSource.getGetFeatureInfoUrl(
      feature.getGeometry().getCoordinates(), viewResolution, viewProjection,
      {'INFO_FORMAT': 'application/json', 'BUFFER': 20 });
  if (url) {
    $.getJSON(url, function(d) {
      var geojson = new ol.format.GeoJSON();
      var features = geojson.readFeatures(d);
      if (feature == sourceFeature) {
        if (features.length == 0) {
          map.removeLayer(routeLayer);
          source = null;
          return;
        }
        source = features[0];
      } else {
        if (features.length == 0) {
          map.removeLayer(routeLayer);
          target = null;
          return;
        }
        target = features[0];
      }
      if (source && target) {
        getRoute();
      }
    });
  }
}

