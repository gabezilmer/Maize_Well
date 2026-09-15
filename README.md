# Maize_Well

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-q3yyq5rt)

🌱 Maize Well
Precision Agriculture & Spatial Soil Modeling Platform

Maize Well is a full-stack precision agriculture application that turns a hand-drawn field boundary into an automated, data-grounded agronomic report. Draw a polygon on a satellite map and the platform pulls live soil, terrain, and climate data for that exact footprint, models topsoil characteristics with a trained regression model, and turns the result into acreage, yield, and revenue estimates a grower can act on.

Live demo: [![DEMO](https://maize-well-p1g8.bolt.host)] Case study: a 93.44-acre soybean field, mapped end-to-end from boundary → soil profile → $60,736 projected revenue.

✨ Core Features
Field-Centric Workspace — Draw a custom field boundary on an interactive map and get an exact, geodesic acreage calculation instantly.
Automated Environmental Pipeline — A backend data-engineering loop queries topography, climate, and soil chemistry for any drawn coordinates — no manual downloads or GIS software required.
Cloud Spatial Processing — Integrates with Google Earth Engine to sample large-scale raster datasets (e.g. OpenLandMap soil layers) for continuous variables like surface clay %, sand %, and pH at the field's exact location.
Predictive Soil Diagnostics — A scikit-learn Random Forest regression model predicts topsoil metrics and flags crop viability based on localized environmental variance.
Interactive Heatmaps — Leaflet + Turf.js render moisture and organic-matter grids across user-defined field zones.
Financial & Yield Modeling — Converts acreage and crop type into projected yield and gross revenue using USDA NASS regional benchmarks.
Longitudinal Soil Health Tracking — Grower-logged lab tests are layered on top of the remote-sensed baseline, so the model's estimates get validated (and improved) over time.
🧱 Architecture
Browser (React + Leaflet)
   │  user draws boundary → Turf.js computes geodesic acreage
   ▼
FastAPI Backend  ──▶  Google Earth Engine   (soil raster sampling)
   │               ──▶  Open-Meteo API        (historical & live climate)
   │               ──▶  USGS 3DEP API         (elevation & aspect)
   │               ──▶  USDA NASS benchmarks  (yield & price data)
   ▼
scikit-learn Random Forest Regressor
   │  predicts topsoil metrics + crop viability from environmental variance
   ▼
Dashboards: Field Overview · Soil Health · Diagnostics · Rotation · Financials

The frontend never talks to the external data providers directly — every request is proxied and normalized through the FastAPI layer, which is what makes the "draw a boundary, get a full report" experience possible without the user ever touching an API key or a GIS tool.

🛠️ Tech Stack

Frontend (Client)

React & Vite (scaffolded via Bolt.new)
Tailwind CSS
Leaflet (web map rendering)
Turf.js (geospatial polygon processing & grid generation)

Backend (Server & Data API)

Python & FastAPI (RESTful API architecture)
Google Earth Engine Python API (cloud spatial soil queries)
Open-Meteo API (historical & predictive climate profiling)
USGS National Map API (elevation & topography)
USDA SSURGO / SoilGrids / NASS (soil taxonomy and yield benchmarks)

Machine Learning

scikit-learn (Random Forest Regressor)
Pandas (data cleaning & structuring)
📊 Data Sources at a Glance
Feature / Metric	Provider / Technology	Purpose
Satellite Imagery	Esri World Imagery (Leaflet)	Field visualization & boundary tracing
Acreage Calculation	Turf.js (geodesic math)	Instant, accurate boundary acreage
Soil Sampling	Google Earth Engine + OpenLandMap	Continuous clay %, sand %, pH at exact field location
Soil Classification	SoilGrids & USDA SSURGO	Topsoil texture and local series mapping
Elevation & Terrain	USGS 3DEP National Map API	Elevation range, slope, drainage aspect
Climate	Open-Meteo API	Real-time conditions + historical rainfall/temperature
Yield & Revenue	USDA NASS benchmarks	Regional yield (bu/ac) and price modeling
Soil Prediction	scikit-learn Random Forest	Predicts topsoil metrics from environmental variance
🚀 Local Development Setup

Note: Running this locally requires an authenticated Google Cloud Project configured for Google Earth Engine access.

1. Clone the repository

bash
git clone https://github.com/your-username/maize-well.git
cd maize-well

2. Start the backend API (FastAPI)

bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload

3. Start the frontend (Vite)

bash
cd frontend
npm install
npm run dev

4. Environment variables Create a .env file in /backend with your Google Earth Engine service account credentials and any API keys (Open-Meteo, USGS) required by the pipeline. See .env.example for the expected keys.

🗺️ Roadmap

Accounts & Access

 Multi-user accounts with shared access for businesses and farm teams
 Separate personal-use tier for garden-scale growers, distinct from commercial farm accounts

Reporting

 PDF export of field reports (financials, soil health, diagnostics)
 Annual "Year in Review" report — season-over-season yield, soil trend, and rotation summary

Agronomic Intelligence

 Suggestive crop scheduling — recommend the next crop from soil health trends, rotation history, and prior yields
 Goal-driven agronomy — grower sets a target (e.g. "increase topsoil organic matter") and the platform generates a plan to reach it
 Expanded IPM (Integrated Pest Management) tooling layered on the existing diagnostics engine
 Monoculture vs. polyculture field configuration — support diversified / intercropped field layouts, not just single-crop fields
