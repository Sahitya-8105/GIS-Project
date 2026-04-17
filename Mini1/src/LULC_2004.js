Map.addLayer(table);

// Load and preprocess Landsat 7 imagery
var dataset = ee.ImageCollection("LANDSAT/LE07/C02/T1")
  .filterBounds(table)
  .filterMetadata('CLOUD_COVER_LAND', 'less_than', 1)
  .filterDate('2004-01-01', '2004-12-31')
  .median()
  .clip(table);

// Center the map on the ROI
Map.centerObject(table, 8);

// Visualization parameters for true color
var imageVisParam = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 30000,
  gamma: 1.4
};

Map.addLayer(dataset, imageVisParam, "LANDSAT5");

// Merge all 8 training classes
var c = waterbodies.merge(vegetation).merge(urban).merge(fallow)
          .merge(barren).merge(forest).merge(rural).merge(mining);

// Ensure 'class' property is numeric
c = c.map(function(feature) {
  var classValue = ee.Algorithms.If(
    feature.get('class'),
    ee.Number.parse(feature.get('class')),
    ee.Number(-1)
  );
  return feature.set('class', classValue);
});

// Filter out invalid training features
c = c.filter(ee.Filter.neq('class', -1));

// Sample training data
var training = dataset.sampleRegions({
  collection: c,
  properties: ['class'],
  scale: 30
});

// Use more bands for better classification
var inputBands = ['B1','B2', 'B3', 'B4', 'B5','B7'];


// SVM classifier
var classifier = ee.Classifier.libsvm().train({
  features: training,
  classProperty: 'class',
  inputProperties: inputBands
});

var classified = dataset.select(inputBands).classify(classifier);

// Visualization
var visParams = {
  min: 1,
  max: 8,
  palette: ['#172be6', '#fbff13', '#ff0000', '#ffa050', '#bba47b', '#34d634', '#ff2f2f', '#ecff6f']
};
Map.addLayer(classified, visParams, 'SVM Classified Image');

// Accuracy assessment
var withRandom = training.randomColumn('random');
var split = 0.8;
var trainingPartition = withRandom.filter(ee.Filter.lt('random', split));
var testingPartition = withRandom.filter(ee.Filter.gte('random', split));

var trainAccuracy = classifier.confusionMatrix();
print('SVM Confusion matrix:', trainAccuracy);
print('SVM Training overall accuracy:', trainAccuracy.accuracy());
print('SVM Kappa accuracy:', trainAccuracy.kappa());
print('SVM Producers accuracy:', trainAccuracy.producersAccuracy());
print('SVM Consumers accuracy:', trainAccuracy.consumersAccuracy());

// Random Forest classifier
var classifierRF = ee.Classifier.smileRandomForest(50).train({
  features: training,
  classProperty: 'class',
  inputProperties: inputBands
});

var classifiedRF = dataset.select(inputBands).classify(classifierRF);
Map.addLayer(classifiedRF, visParams, 'Random Forest Classified Image');

// Accuracy for RF
var trainAccuracyRF = classifierRF.confusionMatrix();
print('RF Confusion matrix:', trainAccuracyRF);
print('RF Training overall accuracy:', trainAccuracyRF.accuracy());
print('RF Kappa accuracy:', trainAccuracyRF.kappa());
print('RF Producers accuracy:', trainAccuracyRF.producersAccuracy());
print('RF Consumers accuracy:', trainAccuracyRF.consumersAccuracy());

// Create masks for each land cover class
var waterMask = classifiedRF.eq(1);
var vegetationMask = classifiedRF.eq(2);
var urbanMask = classifiedRF.eq(3);
var fallowMask = classifiedRF.eq(4);
var barrenMask = classifiedRF.eq(5);
var forestMask = classifiedRF.eq(6);
var ruralMask = classifiedRF.eq(7);
var miningMask = classifiedRF.eq(8);

// Multiply mask by pixel area and convert to sq.km
var waterArea = waterMask.multiply(ee.Image.pixelArea()).divide(1e6);
var vegetationArea = vegetationMask.multiply(ee.Image.pixelArea()).divide(1e6);
var urbanArea = urbanMask.multiply(ee.Image.pixelArea()).divide(1e6);
var fallowArea = fallowMask.multiply(ee.Image.pixelArea()).divide(1e6);
var barrenArea = barrenMask.multiply(ee.Image.pixelArea()).divide(1e6);
var forestArea = forestMask.multiply(ee.Image.pixelArea()).divide(1e6);
var ruralArea = ruralMask.multiply(ee.Image.pixelArea()).divide(1e6);
var miningArea = miningMask.multiply(ee.Image.pixelArea()).divide(1e6);

// Calculate total area for each class using reduceRegion
var waterSum = waterArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

var vegetationSum = vegetationArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

var urbanSum = urbanArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

var fallowSum = fallowArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

var barrenSum = barrenArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

var forestSum = forestArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

var ruralSum = ruralArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

var miningSum = miningArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table,
  scale: 30,
  maxPixels: 1e9
}).get('classification');

// Dictionary of class-wise areas
var areaDict = ee.Dictionary({
  'Water': waterSum,
  'Vegetation': vegetationSum,
  'Urban': urbanSum,
  'Fallow': fallowSum,
  'Barren': barrenSum,
  'Forest': forestSum,
  'Rural': ruralSum,
  'Mining': miningSum
});

print('Land Cover Area in sq.km:', areaDict);

// Convert areaDict to a FeatureCollection manually
var keys = ['Water', 'Vegetation', 'Urban', 'Fallow', 'Barren', 'Forest', 'Rural', 'Mining'];
var values = [waterSum, vegetationSum, urbanSum, fallowSum, barrenSum, forestSum, ruralSum, miningSum];

// Fix invalid property name by removing special characters in the key
var features = ee.FeatureCollection(keys.map(function(key, index) {
  return ee.Feature(null, {
    'LandCoverClass': key,
    'Area_sqkm': ee.Number(values[index])
  });
}));

// Create a bar chart with updated property names
var chart = ui.Chart.feature.byFeature(features, 'LandCoverClass', ['Area_sqkm'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Land Cover Area (sq.km) - 2004',
    hAxis: {title: 'Land Cover Class'},
    vAxis: {title: 'Area (sq.km)'},
    legend: {position: 'none'},
    colors: ['#1f77b4']
  });

print(chart);
Export.image.toDrive({
  image: classifiedRF,   // <- for that year
  description: 'LULC_2004_RF',
  folder: 'GEE_LULC',
  fileNamePrefix: 'LULC_2004',
  region: table.geometry(),
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
