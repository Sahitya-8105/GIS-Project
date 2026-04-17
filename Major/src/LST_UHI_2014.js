// ==========================
// LOAD SHAPEFILE
// ==========================
var india = ee.FeatureCollection("projects/majorproject-489714/assets/Final");

var ap = india.filter(ee.Filter.eq('name', 'Andhra Pradesh'));

Map.centerObject(ap, 7);
Map.addLayer(ap, {color:'red'}, 'Andhra Pradesh');

// ==========================
// LOAD SHAPEFILE
// ==========================
var india = ee.FeatureCollection("projects/majorproject-489714/assets/Final");

var ap = india.filter(ee.Filter.eq('name', 'Andhra Pradesh'));

Map.centerObject(ap, 7);
Map.addLayer(ap, {color:'red'}, 'Andhra Pradesh');


// ==========================
// LOAD LANDSAT 8 (2014)
// ==========================
var landsat2014 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
.filterBounds(ap)
.filterDate('2014-01-01','2014-12-30')  
.median()
.clip(ap);

// RGB
Map.addLayer(
landsat2014,
{bands:['SR_B4','SR_B3','SR_B2'],min:0,max:30000},
'Landsat 2014'
);

// ==========================
// NDVI
// ==========================
var ndvi2014 = landsat2014.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');

Map.addLayer(
ndvi2014,
{min:-1,max:1,palette:['blue','white','green']},
'NDVI 2014'
);

// ==========================
// NDBI
// ==========================
var ndbi2014 = landsat2014.normalizedDifference(['SR_B6','SR_B5']).rename('NDBI');

Map.addLayer(
ndbi2014,
{min:-1,max:1,palette:['blue','white','red']},
'NDBI 2014'
);

// ==========================
// LST CALCULATION
// ==========================
var lst2014 = landsat2014.select('ST_B10')
.multiply(0.00341802)
.add(149.0)
.subtract(273.15)
.rename('LST');

Map.addLayer(
lst2014,
{min:20,max:45,palette:['blue','yellow','red']},
'LST 2014'
);

// ==========================
// URBAN & RURAL MASK
// ==========================
var urban2014 = ndbi2014.gt(0.1);
var rural2014 = ndvi2014.gt(0.3);

// ==========================
// TEMPERATURE CALCULATION
// ==========================
var urbanTemp2014 = lst2014.updateMask(urban2014).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

var ruralTemp2014 = lst2014.updateMask(rural2014).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print("Urban Temperature 2014", urbanTemp2014);
print("Rural Temperature 2014", ruralTemp2014);

// ==========================
// UHI CALCULATION
// ==========================
var UHI2014 = ee.Number(urbanTemp2014.get('LST'))
.subtract(ee.Number(ruralTemp2014.get('LST')));

print("UHI 2014", UHI2014);

// Mean rural temp
var ruralMean2014 = ee.Number(ruralTemp2014.get('LST'));

// ==========================
// UHI MAP
// ==========================
var uhiMap2014 = lst2014.subtract(ruralMean2014).rename('UHI');

// 🔥 Enhanced Visualization
var uhiEnhanced2014 = uhiMap2014.unitScale(-5, 10);

Map.addLayer(
uhiEnhanced2014,
{
  min: 0,
  max: 1,
  palette: [
    'blue',
    'cyan',
    'green',
    'yellow',
    'orange',
    'red'
  ]
},
'UHI Map 2014 (Enhanced)'
);

// ==========================
// CORRELATION
// ==========================
var ndvi_lst_corr = ndvi2014.addBands(lst2014).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDVI vs LST Correlation", ndvi_lst_corr);

var ndbi_lst_corr = ndbi2014.addBands(lst2014).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDBI vs LST Correlation", ndbi_lst_corr);
// ==========================
// EXPORT
// ==========================
var uhiVis = uhiMap2014.visualize({
  min: -5,
  max: 10,
  palette: ['blue','cyan','green','yellow','orange','red']
});

Export.image.toDrive({
  image: uhiVis.clip(ap),
  description: 'UHI_2014_AP',
  scale: 200,
  region: ap,
  maxPixels: 1e13
});
// ==========================
// EXPORT RGB IMAGE (FOR CNN)
// ==========================
Export.image.toDrive({
  image: landsat2014.select(['SR_B3','SR_B2','SR_B1']),
  description: 'RGB_2014_AP',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});

// ==========================
// EXPORT BUILT-UP MASK
// ==========================
Export.image.toDrive({
  image: urban2014.selfMask(),
  description: 'Builtup_2014',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});

// ==========================
// EXPORT VEGETATION MASK
// ==========================
Export.image.toDrive({
  image: rural2014.selfMask(),
  description: 'Vegetation_2014',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});
print('LST Percentile 2014', lst2014.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));

print('UHI Percentile 2014', uhiMap2014.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));

var meanLST = lst2014.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print('Mean LST 2014', meanLST);