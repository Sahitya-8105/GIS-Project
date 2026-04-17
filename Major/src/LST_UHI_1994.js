// ==========================
// LOAD SHAPEFILE
// ==========================
var india = ee.FeatureCollection("projects/majorproject-489714/assets/Final");
var ap = india.filter(ee.Filter.eq('name', 'Andhra Pradesh'));

Map.centerObject(ap, 7);
Map.addLayer(ap, {color:'red'}, 'Andhra Pradesh');

// ==========================
// LOAD LANDSAT 5 (1994)
// ==========================
var image1994 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
  .filterBounds(ap)
  .filterDate('1994-01-01','1994-12-31')
  .median()
  .clip(ap);

// ==========================
// RGB
// ==========================
Map.addLayer(
image1994,
{bands:['SR_B3','SR_B2','SR_B1'],min:0,max:30000},
'Landsat 1994'
);

// ==========================
// NDVI
// ==========================
var ndvi1994 = image1994.normalizedDifference(['SR_B4','SR_B3']).rename('NDVI');

Map.addLayer(ndvi1994,
{min:-1,max:1,palette:['blue','white','green']},
'NDVI 1994'
);

// ==========================
// NDBI
// ==========================
var ndbi1994 = image1994.normalizedDifference(['SR_B5','SR_B4']).rename('NDBI');

Map.addLayer(ndbi1994,
{min:-1,max:1,palette:['blue','white','red']},
'NDBI 1994'
);

// ==========================
// LST (ONLY ONCE)
// ==========================
var lst1994 = image1994.select('ST_B6')
  .multiply(0.00341802)
  .add(149.0)
  .subtract(273.15)
  .rename('LST');

Map.addLayer(lst1994,
{min:20,max:45,palette:['blue','yellow','red']},
'LST 1994'
);

// ==========================
// LST STATISTICS (MIN MAX MEAN)
// ==========================
var stats1994 = lst1994.reduceRegion({
  reducer: ee.Reducer.min()
    .combine(ee.Reducer.max(), '', true)
    .combine(ee.Reducer.mean(), '', true),
  geometry: ap,
  scale: 30,
  maxPixels: 1e13
});

print('LST Stats 1994', stats1994);

// ==========================
// URBAN & RURAL MASK
// ==========================
var urban1994 = ndbi1994.gt(0.1);
var rural1994 = ndvi1994.gt(0.3);

// ==========================
// TEMPERATURE CALCULATION
// ==========================
var urbanTemp1994 = lst1994.updateMask(urban1994).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

var ruralTemp1994 = lst1994.updateMask(rural1994).reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print("Urban Temperature 1994", urbanTemp1994);
print("Rural Temperature 1994", ruralTemp1994);

// ==========================
// UHI CALCULATION
// ==========================
var UHI1994 = ee.Number(urbanTemp1994.get('LST'))
.subtract(ee.Number(ruralTemp1994.get('LST')));

print("UHI 1994", UHI1994);

// ==========================
// UHI MAP
// ==========================
var ruralMean1994 = ee.Number(ruralTemp1994.get('LST'));

var uhiMap1994 = lst1994.subtract(ruralMean1994).rename('UHI');

var uhiEnhanced1994 = uhiMap1994.unitScale(-5, 10);

Map.addLayer(uhiEnhanced1994,
{
  min: 0,
  max: 1,
  palette: ['blue','cyan','green','yellow','orange','red']
},
'UHI Map 1994'
);

// ==========================
// CORRELATION
// ==========================
var ndvi_lst_corr = ndvi1994.addBands(lst1994).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDVI vs LST Correlation 1994", ndvi_lst_corr);

var ndbi_lst_corr = ndbi1994.addBands(lst1994).reduceRegion({
  reducer: ee.Reducer.pearsonsCorrelation(),
  geometry: ap,
  scale: 500,
  maxPixels: 1e13
});

print("NDBI vs LST Correlation 1994", ndbi_lst_corr);

// ==========================
// EXPORT
// ==========================
var uhiVis = uhiMap1994.visualize({
  min: -5,
  max: 10,
  palette: ['blue','cyan','green','yellow','orange','red']
});

Export.image.toDrive({
  image: uhiVis.clip(ap),
  description: 'UHI_1994_AP',
  scale: 200,
  region: ap,
  maxPixels: 1e13
});


var stats = lst1994.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print('LST Min & Max:', stats);

print('LST Percentile 1994', lst1994.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));

print('UHI Percentile 1994', uhiMap1994.reduceRegion({
  reducer: ee.Reducer.percentile([5,95]),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
}));
var meanLST = lst1994.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: ap,
  scale: 30,
  maxPixels: 1e9
});

print('Mean LST 1994', meanLST);