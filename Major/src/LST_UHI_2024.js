// ==========================
// LOAD SHAPEFILE
// ==========================
var india = ee.FeatureCollection("projects/majorproject-489714/assets/Final");

var ap = india.filter(ee.Filter.eq('name', 'Andhra Pradesh'));

Map.centerObject(ap, 7);
Map.addLayer(ap, {color:'red'}, 'Andhra Pradesh');


// Load Landsat 8 (2024)
var landsat2024 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
.filterBounds(ap)
.filterDate('2024-01-01','2024-12-31')
.median()
.clip(ap);

// Display RGB
Map.addLayer(
landsat2024,
{bands:['SR_B4','SR_B3','SR_B2'],min:0,max:30000},
'Landsat 2024'
);

// NDVI
var ndvi2024 = landsat2024.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');

Map.addLayer(
ndvi2024,
{min:-1,max:1,palette:['blue','white','green']},
'NDVI 2024'
);

// NDBI
var ndbi2024 = landsat2024.normalizedDifference(['SR_B6','SR_B5']).rename('NDBI');

Map.addLayer(
ndbi2024,
{min:-1,max:1,palette:['blue','white','red']},
'NDBI 2024'
);

// LST calculation (Landsat 8)
var lst2024 = landsat2024.select('ST_B10')
.multiply(0.00341802)
.add(149.0)
.subtract(273.15)
.rename('LST');

// Display LST
Map.addLayer(
lst2024,
{min:20,max:45,palette:['blue','yellow','red']},
'LST 2024'
);

// Urban & Rural masks
var urban2024 = ndbi2024.gt(0.1);
var rural2024 = ndvi2024.gt(0.3);

// Urban temperature
var urbanTemp2024 = lst2024.updateMask(urban2024).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

// Rural temperature
var ruralTemp2024 = lst2024.updateMask(rural2024).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print("Urban Temperature 2024", urbanTemp2024);
print("Rural Temperature 2024", ruralTemp2024);

// UHI calculation
var UHI2024 = ee.Number(urbanTemp2024.get('LST'))
.subtract(ee.Number(ruralTemp2024.get('LST')));

print("UHI 2024", UHI2024);

// Mean rural temp
var ruralMean2024 = ee.Number(ruralTemp2024.get('LST'));

// UHI Map
var uhiMap2024 = lst2024.subtract(ruralMean2024).rename('UHI');

// 🔥 Enhanced Visualization (IMPORTANT)
var uhiEnhanced = uhiMap2024.unitScale(-5, 10);

Map.addLayer(
uhiEnhanced,
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
'UHI Map 2024 (Enhanced)'
);

// Correlation NDVI vs LST
var ndvi_lst_corr = ndvi2024.addBands(lst2024).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDVI vs LST Correlation", ndvi_lst_corr);

// Correlation NDBI vs LST
var ndbi_lst_corr = ndbi2024.addBands(lst2024).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDBI vs LST Correlation", ndbi_lst_corr);

// ==========================
// EXPORT
// ==========================
var uhiVis = uhiMap2024.visualize({
  min: -5,
  max: 10,
  palette: ['blue','cyan','green','yellow','orange','red']
});

Export.image.toDrive({
  image: uhiVis.clip(ap),
  description: 'UHI_2024_AP',
  scale: 200,
  region: ap,
  maxPixels: 1e13
});
// ==========================
// EXPORT RGB IMAGE (FOR CNN)
// ==========================
Export.image.toDrive({
  image: landsat2024.select(['SR_B3','SR_B2','SR_B1']),
  description: 'RGB_2024_AP',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});

// ==========================
// EXPORT BUILT-UP MASK
// ==========================
Export.image.toDrive({
  image: urban2024.selfMask(),
  description: 'Builtup_2024',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});

// ==========================
// EXPORT VEGETATION MASK
// ==========================
Export.image.toDrive({
  image: rural2024.selfMask(),
  description: 'Vegetation_2024',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});
print('LST Percentile 2024', lst2024.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));

print('UHI Percentile 2024', uhiMap2024.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));

var meanLST = lst2024.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print('Mean LST 2024', meanLST);