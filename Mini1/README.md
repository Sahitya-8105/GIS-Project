# 🌍 Land Use Land Cover (LULC) Analysis using Google Earth Engine

## 📌 Project Overview
This project focuses on analyzing Land Use Land Cover (LULC) changes over time using satellite imagery and cloud-based geospatial processing. The study is carried out using Google Earth Engine, which enables efficient handling of large-scale remote sensing data.

The project evaluates LULC patterns for four different years to understand environmental changes, urban expansion, and land transformation.

---

## 🛰️ Study Area
- Region: Andhra Pradesh  
- Platform: Google Earth Engine  

---

## 📅 Time Period
The analysis is performed for the following years:
- 1990  
- 2004  
- 2014  
- 2024  

---

## 🗂️ Project Structure

MINI1/
│── src/
│ ├── LULC_1990.js
│ ├── LULC_2004.js
│ ├── LULC_2014.js
│ └── LULC_2024.js
│
│── Outputs/
│ ├── 1990.png
│ ├── 2004.png
│ ├── 2014.png
│ └── 2024.png
│
│── README.md



---

## 🧠 Methodology

### 1. Data Collection
- Landsat satellite imagery (Landsat 7 & Landsat 8)
- Cloud filtering applied to remove noisy data

### 2. Preprocessing
- Image clipping using Region of Interest (ROI)
- Median compositing
- Band selection for analysis

### 3. Classification Techniques
The following machine learning algorithms are used:
- Support Vector Machine (SVM)  
- Random Forest (RF)  

### 4. Training Data
- 8 land cover classes:
  - Waterbodies  
  - Vegetation  
  - Urban  
  - Fallow  
  - Barren  
  - Forest  
  - Rural  
  - Mining  

### 5. Accuracy Assessment
- Confusion Matrix  
- Overall Accuracy  
- Kappa Coefficient  
- Producer’s Accuracy  
- Consumer’s Accuracy  

### 6. Area Calculation
- Pixel area method used  
- Results converted into square kilometers  

---

## 📊 Results

### 🗺️ LULC Maps

#### 1990
![LULC 1990](outputs/maps/LULC_1990.png)

#### 2004
![LULC 2004](outputs/maps/LULC_2004.png)

#### 2014
![LULC 2014](outputs/maps/LULC_2014.png)

#### 2024
![LULC 2024](outputs/maps/LULC_2024.png)

---

## 🚀 Tools & Technologies
- Google Earth Engine  
- JavaScript  
- Remote Sensing  
- Machine Learning  

---

## 📈 Key Insights
- Increase in urban areas over time  
- Reduction in vegetation in certain regions  
- Changes in land usage patterns due to development  
- Expansion of mining and barren lands in specific areas  

---

## 🎯 Conclusion
This project demonstrates how cloud-based geospatial platforms and machine learning techniques can be effectively used to monitor land cover changes over time. The results help in understanding environmental impacts and support sustainable planning.

---

## 👤 Author
- Padmanabhuni Naga Durga Sahitya  

---