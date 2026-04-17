// ==========================
// LOAD SHAPEFILE
// ==========================
var india = ee.FeatureCollection("projects/majorproject-489714/assets/Final");

var ap = india.filter(ee.Filter.eq('name', 'Andhra Pradesh'));

Map.centerObject(ap, 7);
Map.addLayer(ap, {color:'red'}, 'Andhra Pradesh');



// ==========================
// LOAD LANDSAT 5 (2004)
// ==========================
var landsat2004 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
.filterBounds(ap)
.filterDate('2004-01-01','2004-12-31')
.median()
.clip(ap);

// RGB
Map.addLayer(
landsat2004,
{bands:['SR_B3','SR_B2','SR_B1'],min:0,max:30000},
'Landsat 2004'
);

// ==========================
// NDVI
// ==========================
var ndvi2004 = landsat2004.normalizedDifference(['SR_B4','SR_B3']).rename('NDVI');

Map.addLayer(
ndvi2004,
{min:-1,max:1,palette:['blue','white','green']},
'NDVI 2004'
);

// ==========================
// NDBI
// ==========================
var ndbi2004 = landsat2004.normalizedDifference(['SR_B5','SR_B4']).rename('NDBI');

Map.addLayer(
ndbi2004,
{min:-1,max:1,palette:['blue','white','red']},
'NDBI 2004'
);

// ==========================
// LST CALCULATION
// ==========================
var lst2004 = landsat2004.select('ST_B6')
.multiply(0.00341802)
.add(149.0)
.subtract(273.15)
.rename('LST');

Map.addLayer(
lst2004,
{min:20,max:45,palette:['blue','yellow','red']},
'LST 2004'
);

// ==========================
// URBAN & RURAL MASK
// ==========================
var urban2004 = ndbi2004.gt(0.1);
var rural2004 = ndvi2004.gt(0.3);

// ==========================
// TEMPERATURE CALCULATION
// ==========================
var urbanTemp2004 = lst2004.updateMask(urban2004).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

var ruralTemp2004 = lst2004.updateMask(rural2004).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print("Urban Temperature 2004", urbanTemp2004);
print("Rural Temperature 2004", ruralTemp2004);

// ==========================
// UHI CALCULATION
// ==========================
var UHI2004 = ee.Number(urbanTemp2004.get('LST'))
.subtract(ee.Number(ruralTemp2004.get('LST')));

print("UHI 2004", UHI2004);

// Mean rural temp
var ruralMean2004 = ee.Number(ruralTemp2004.get('LST'));

// ==========================
// UHI MAP
// ==========================
var uhiMap2004 = lst2004.subtract(ruralMean2004).rename('UHI');

// 🔥 Enhanced Visualization (IMPORTANT)
var uhiEnhanced2004 = uhiMap2004.unitScale(-5, 10);

Map.addLayer(
uhiEnhanced2004,
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
'UHI Map 2004 (Enhanced)'
);

// ==========================
// CORRELATION
// ==========================
var ndvi_lst_corr = ndvi2004.addBands(lst2004).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDVI vs LST Correlation", ndvi_lst_corr);

var ndbi_lst_corr = ndbi2004.addBands(lst2004).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDBI vs LST Correlation", ndbi_lst_corr);

// ==========================
// EXPORT
// ==========================
var uhiVis = uhiMap2004.visualize({
  min: -5,
  max: 10,
  palette: ['blue','cyan','green','yellow','orange','red']
});

Export.image.toDrive({
  image: uhiVis.clip(ap),
  description: 'UHI_2004_AP',
  scale: 200,
  region: ap,
  maxPixels: 1e13
});
// ==========================
// EXPORT RGB IMAGE (FOR CNN)
// ==========================
Export.image.toDrive({
  image: landsat2004.select(['SR_B3','SR_B2','SR_B1']),
  description: 'RGB_2004_AP',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});

// ==========================
// EXPORT BUILT-UP MASK
// ==========================
Export.image.toDrive({
  image: urban2004.selfMask(),
  description: 'Builtup_2004',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});

// ==========================
// EXPORT VEGETATION MASK
// ==========================
Export.image.toDrive({
  image: rural2004.selfMask(),
  description: 'Vegetation_2004',
  scale: 30,
  region: ap,
  maxPixels: 1e13
});

print('LST Percentile 2004', lst2004.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));

print('UHI Percentile 2004', uhiMap2004.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));