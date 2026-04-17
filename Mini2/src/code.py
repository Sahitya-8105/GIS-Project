
!pip -q install rasterio

import os, gc
import numpy as np
import rasterio
from rasterio.enums import Resampling
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow.keras import layers, models

# Optional: be gentle on GPU memory (doesn't affect CPU RAM)
gpus = tf.config.experimental.list_physical_devices('GPU')
for g in gpus:
    try:
        tf.config.experimental.set_memory_growth(g, True)
    except:
        pass

# -------- Google Drive (Colab) --------
from google.colab import drive
drive.mount('/content/drive')

BASE = "/content/drive/MyDrive/mini2_data"  # <-- change if needed
files = {
    "1994": os.path.join(BASE, "climate_1994.tif"),
    "2004": os.path.join(BASE, "climate_2004.tif"),
    "2014": os.path.join(BASE, "climate_2014.tif"),
    "2024": os.path.join(BASE, "climate_2024.tif"),
}
years = list(files.keys())

# Outputs
os.makedirs("outputs", exist_ok=True)
os.makedirs("outputs/zone_maps", exist_ok=True)
os.makedirs("outputs/heatmaps", exist_ok=True)
os.makedirs("outputs/histograms", exist_ok=True)

def load_stack_raw(path, step=8):
    """
    Read raster as (H, W, C) float32 with downsampling to save RAM.
    Uses averaging resampling instead of naive slicing.
    """
    with rasterio.open(path) as src:
        out_h = max(1, src.height // step)
        out_w = max(1, src.width  // step)
        arr = src.read(
            out_shape=(src.count, out_h, out_w),
            resampling=Resampling.average
        )
    return np.transpose(arr, (1, 2, 0)).astype(np.float32)

def per_band_standardize(arr):
    # standardize per band: (x - mean)/std
    x = arr.astype(np.float32, copy=True)
    for b in range(x.shape[-1]):
        m = np.nanmean(x[..., b])
        s = np.nanstd(x[..., b]) + 1e-6
        x[..., b] = (x[..., b] - m) / s
    return np.nan_to_num(x)

def make_weak_labels_raw(ndvi, savi, ndbi, lst):
    """

    """
    ndvi_hi = np.nanpercentile(ndvi, 70)
    ndvi_lo = np.nanpercentile(ndvi, 30)
    savi_hi = np.nanpercentile(savi, 60)
    ndbi_hi = np.nanpercentile(ndbi, 70)
    lst_warm = np.nanpercentile(lst, 60)
    lst_hot  = np.nanpercentile(lst, 80)

    lab = np.full(ndvi.shape, 3, dtype=np.uint8)

    # vegetation (cool)
    lab[(ndvi >= ndvi_hi) & (savi >= savi_hi) & (lst < lst_warm)] = 0
    # built-up & warm
    lab[(ndbi >= ndbi_hi) & (lst >= lst_warm)] = 1
    # hot/bare
    lab[(ndvi <= ndvi_lo) & (lst >= lst_hot)] = 2
    return lab

def get_data_for_year(year, step=8):
    """
    Returns:
      std_img: standardized image for model (H,W,4)
      labels : weak labels built on RAW (H,W) in {0,1,2,3}
      raw_img: RAW image for stats/plots (H,W,4)
    """
    raw = load_stack_raw(files[year], step=step)
    ndvi, savi, ndbi, lst = raw[...,0], raw[...,1], raw[...,2], raw[...,3]
    labels = make_weak_labels_raw(ndvi, savi, ndbi, lst)
    std = per_band_standardize(raw.copy())
    return std, labels, raw

PATCH = 64
NUM_CLASSES = 4

def patch_generator(img, lab, batch_size=8):
    h, w, _ = img.shape
    while True:
        X, Y = [], []
        for _ in range(batch_size):
            i = np.random.randint(0, h - PATCH)
            j = np.random.randint(0, w - PATCH)
            X.append(img[i:i+PATCH, j:j+PATCH, :])
            Y.append(lab[i:i+PATCH, j:j+PATCH])
        X = np.array(X, dtype=np.float32)
        Y = tf.keras.utils.to_categorical(np.array(Y), NUM_CLASSES)
        yield X, Y

def build_unet(input_shape=(PATCH, PATCH, 4), num_classes=NUM_CLASSES):
    inp = layers.Input(input_shape)
    # Encoder
    c1 = layers.Conv2D(8, 3, activation='relu', padding='same')(inp)
    p1 = layers.MaxPooling2D()(c1)
    c2 = layers.Conv2D(16, 3, activation='relu', padding='same')(p1)
    p2 = layers.MaxPooling2D()(c2)
    # Bottleneck
    b  = layers.Conv2D(32, 3, activation='relu', padding='same')(p2)
    # Decoder
    u1 = layers.UpSampling2D()(b); u1 = layers.Concatenate()([u1, c2])
    c3 = layers.Conv2D(16, 3, activation='relu', padding='same')(u1)
    u2 = layers.UpSampling2D()(c3); u2 = layers.Concatenate()([u2, c1])
    c4 = layers.Conv2D(8, 3, activation='relu', padding='same')(u2)
    out = layers.Conv2D(num_classes, 1, activation='softmax')(c4)
    model = models.Model(inp, out)
    model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
    return model

model = build_unet()
model.summary()

train_img, train_lab, _ = get_data_for_year("1994", step=8)
val_img,   val_lab,   _ = get_data_for_year("2004", step=8)

train_gen = patch_generator(train_img, train_lab, batch_size=8)
val_gen   = patch_generator(val_img,   val_lab,   batch_size=8)

history = model.fit(
    train_gen,
    validation_data=val_gen,
    steps_per_epoch=100,
    validation_steps=20,
    epochs=5,
    verbose=1
)

del train_img, train_lab, val_img, val_lab
gc.collect()

def predict_full(img_std, model, patch=PATCH, stride=PATCH, batch_size=8):
    h, w, _ = img_std.shape
    out = np.zeros((h, w), dtype=np.uint8)

    for i in range(0, h - patch + 1, stride):
        batch, locs = [], []
        for j in range(0, w - patch + 1, stride):
            batch.append(img_std[i:i+patch, j:j+patch, :])
            locs.append((i, j))
            if len(batch) == batch_size:
                preds = model.predict(np.array(batch, dtype=np.float32), verbose=0)
                for (ii, jj), p in zip(locs, preds):
                    out[ii:ii+patch, jj:jj+patch] = np.argmax(p, axis=-1)
                batch, locs = [], []
        if batch:
            preds = model.predict(np.array(batch, dtype=np.float32), verbose=0)
            for (ii, jj), p in zip(locs, preds):
                out[ii:ii+patch, jj:jj+patch] = np.argmax(p, axis=-1)
    return out

tab_cmap = plt.cm.get_cmap("tab10", NUM_CLASSES)

for yr in years:
    print(f"Predicting {yr} ...")
    img_std, _, _ = get_data_for_year(yr, step=4)   # a bit finer for prediction
    pred_map = predict_full(img_std, model, patch=PATCH, stride=PATCH, batch_size=8)

    # Save
    np.save(f"outputs/zone_maps/zone_map_{yr}.npy", pred_map)
    plt.imsave(f"outputs/zone_maps/zone_map_{yr}.png", pred_map, cmap=tab_cmap, vmin=0, vmax=NUM_CLASSES-1)

    # Quick console stats to ensure it's not a single class
    u, c = np.unique(pred_map, return_counts=True)
    print(f"{yr} class distribution:", dict(zip(u.tolist(), c.tolist())))

    del img_std, pred_map
    gc.collect()

print("Saved zone maps to outputs/zone_maps/")

band_names = ["NDVI","SAVI","NDBI","LST"]
cmaps = ["RdYlGn","YlGn","Blues","inferno"]

for yr in years:
    raw = load_stack_raw(files[yr], step=8)  # RAW for plotting stats
    for b, (name, cm) in enumerate(zip(band_names, cmaps)):
        arr = raw[..., b]
        # Heatmap
        plt.figure(figsize=(6,5))
        plt.imshow(arr, cmap=cm)
        plt.colorbar(fraction=0.046, pad=0.04)
        plt.title(f"{name} — {yr}")
        plt.axis('off')
        plt.savefig(f"outputs/heatmaps/{name}_{yr}.png", bbox_inches='tight')
        plt.close()

        # Histogram
        vals = arr.ravel()
        vals = vals[~np.isnan(vals)]
        plt.figure(figsize=(6,4))
        plt.hist(vals, bins=50)
        plt.title(f"{name} Distribution — {yr}")
        plt.xlabel("Value"); plt.ylabel("Frequency")
        plt.savefig(f"outputs/histograms/{name}_hist_{yr}.png", bbox_inches='tight')
        plt.close()
    del raw; gc.collect()

print("Saved heatmaps to outputs/heatmaps/ and histograms to outputs/histograms/")

def convert_lst(raw_lst):
    """
    Convert raw LST to Kelvin using scale factor.
    Most LST products (e.g. MODIS MOD11) use 0.02.
    """
    return raw_lst * 0.00341802 + 149.0   # Kelvin

means = {k: [] for k in band_names}

for yr in years:
    raw = load_stack_raw(files[yr], step=8)
    for b, name in enumerate(band_names):
        vals = raw[..., b]
        if name == "LST":       # apply scaling
            vals = convert_lst(vals)
        means[name].append(float(np.nanmean(vals)))
    del raw; gc.collect()

xs = list(map(int, years))
plt.figure(figsize=(7,5))
for name in band_names:
    plt.plot(xs, means[name], marker='o', label=name)
plt.grid(True)
plt.legend()
plt.title("AP Indices — Mean Trends (1994–2024)")
plt.xlabel("Year"); plt.ylabel("Mean (scaled)")
plt.savefig("outputs/trend_graphs.png", bbox_inches='tight')
plt.close()

print("Saved trend graph to outputs/trend_graphs.png")
for yr_i, yr in enumerate(years):
    ndvi, savi, ndbi, lst = [means[n][yr_i] for n in band_names]

    print(f"\n📅 Year {yr}:")
    print(f"🌿 NDVI : {ndvi:.3f}  → vegetation health (−1 to +1)")
    print(f"🌾 SAVI : {savi:.3f}  → soil-adjusted vegetation index")
    print(f"🏙 NDBI : {ndbi:.3f}  → built-up index")
    print(f"🔥 LST  : {lst:.2f} K  ≈ {lst - 273.15:.2f} °C  → land surface temperature")

from IPython.display import Image, display
import glob

# Zone maps
for f in sorted(glob.glob("outputs/zone_maps/*.png")):
    print(f)
    display(Image(filename=f))

# Heatmaps (first 8 as sample)
for f in sorted(glob.glob("outputs/heatmaps/*.png"))[:8]:
    print(f)
    display(Image(filename=f))

# Histograms (first 8 as sample)
for f in sorted(glob.glob("outputs/histograms/*.png"))[:8]:
    print(f)
    display(Image(filename=f))

# Trend graph
display(Image(filename="outputs/trend_graphs.png"))

import shutil

drive_out = "/content/drive/MyDrive/mini2_outputs"
shutil.copytree("outputs", drive_out, dirs_exist_ok=True)

print("Copied all results to", drive_out)