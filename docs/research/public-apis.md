# Statens vegvesen public API inventory

_Checked 26 July 2026._

This inventory was assembled from the official [Data and APIs hub](https://www.vegvesen.no/fag/teknologi/apne-data/), [Dataportalen](https://dataut.vegvesen.no/), its public CKAN API, NVDB product documentation, Swagger/OpenAPI specifications, and live production endpoint checks.

Dataportalen contained **82 records**, including **21 records classified as data services**, when checked. Its metadata is not fully current, so this inventory uses current documentation and live checks where they disagree.

This document counts API products rather than every REST operation. DATEX publications and OGC protocols are enumerated separately because they provide materially different data.

## 1. Publicly callable without an account

| API | Purpose | Current access and documentation |
|---|---|---|
| **Dataportalen CKAN API** | Machine-readable discovery of Statens vegvesen datasets, distributions, and data services. Useful for searching metadata rather than retrieving road data itself. | Anonymous. [CKAN `package_search`](https://dataut.vegvesen.no/api/3/action/package_search?rows=1000) |
| **NVDB API Les V4** | The primary API for the National Road Database: road objects, segmented road network, nodes and links, object-type metadata, municipalities/counties, positions, routes, and change history. | No login for most data, but the `X-Client` header has been mandatory since 5 January 2026. Sensitive objects/properties require a bearer token and authorization. [Documentation](https://nvdb-docs.atlas.vegvesen.no/category/nvdb-api-les-v4/) · [API landing page](https://nvdbapiles.atlas.vegvesen.no/) |
| **NVDB TN-ITS Export API** | Standardized navigation-data exports. Provides snapshots and incremental changes for **speed limits, road names, road numbers, and maximum-height restrictions**. Intended for map and routing systems. | Anonymous; no security scheme declared. Monthly snapshots and daily updates. [API and Swagger](https://nvdb-tnits.atlas.vegvesen.no/) |
| **Trafikkdata GraphQL API** | Traffic-counting stations, hourly/daily traffic volumes, annual average daily traffic, traffic-volume indices, vehicle-length classes, and quality/coverage measures. | Anonymous GraphQL POST. Data is aggregated; one hour is the shortest interval and vehicle-by-vehicle data is not public. [GraphiQL](https://trafikkdata.no/graphql) · API: `https://trafikkdata-api.atlas.vegvesen.no` |
| **Route-planning API V3** | Calculates up to three GeoJSON routes and matrices. Supports ordinary cars, bicycles, tourist routes, and several heavy/special-transport classes, considering height, length, weight, road class, and road-related objects such as incidents, roadworks, ferries, cameras, and rest areas. | The current `/open/` production endpoint and Swagger declare no authentication, and an anonymous request succeeded. However, Dataportalen still says credentials must be requested and documents a **2,500-call daily limit**. [Documentation](https://www.vegvesen.no/ws/no/vegvesen/ruteplan/routingservice_v3_0/open/routingService/openapi/index.html) |
| **Parking Register read API** | Retrieves regulated parking areas, their geometry/sign information, and the responsible parking providers. | Anonymous. Use the current Atlas host, not the obsolete `www.vegvesen.no/ws/...` catalog URL. [Overview](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/parkeringsregisteret-api/) · [Swagger](https://parkreg-open.atlas.vegvesen.no/swagger-ui/index.html?configUrl=%2Fv3%2Fapi-docs%2Fswagger-config) |
| **NVDB Fiksvegdata API** | Reports errors in road-network, map, or route-planning data and retrieves the status of submitted reports. | Anonymous issue submission and limited reads are supported. Identified-user and case-management operations require bearer tokens and roles. [Documentation](https://www.nvdb.no/registrere-og-redigere-data/fiksvegdata/systemdokumentasjon/) · [OpenAPI](https://fiksvegdata-api.atlas.vegvesen.no/api-docs) |
| **OGC map APIs** | Geographical access to road weather, noise, selected NVDB objects, geotechnical reports, and DATEX traffic information. **WMS** returns rendered map images; **WFS** returns vector features for client-side processing. | Everyone may use them without registration. [Overview](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/ogc-karttjenester/hva-er-ogc-karttjenester/) · [Layers and capability URLs](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/ogc-karttjenester/kartlag/) |
| **Modern OGC APIs** | **OGC API Features** returns vector features; **Maps** renders collection maps; **Styles** exposes reusable map styles. Live collections also cover traffic flow, road-image coverage, charging stations, landslide data, and ferry routes. | Anonymous but not yet advertised on the main OGC documentation page. On inspection: 300 Features collections, 360 Maps collections, and 90 styles. [Features](https://ogckart-sn1.atlas.vegvesen.no/ogc/features/v1/) · [Maps](https://ogckart-sn1.atlas.vegvesen.no/ogc/maps/v1/) · [Styles](https://ogckart-sn1.atlas.vegvesen.no/ogc/styles/v1/) |
| **NVDB Export API** | Bulk export of NVDB road objects or the segmented road network as **CSV or SOSI**. It is a convenience layer over NVDB API Les. | Anonymous. [Documentation](https://www.nvdb.no/hent-og-se-data/eksport/nvdb-eksport/brukerveiledning/) · Current production base: `https://nvdb-eksport-x.atlas.vegvesen.no/` |
| **NVDB Reports API** | Generates Excel, CSV, Word, and GeoPackage reports for road lists, maintenance/operations contracts, KOSTRA/SSB, and related NVDB reporting. | Officially documented for direct use; OpenAPI declares no authentication and supporting endpoints worked anonymously. [Documentation](https://www.nvdb.no/hent-og-se-data/rapporter/systemdokumentasjon/) · [Swagger](https://nvdbrapportapi.atlas.vegvesen.no/swagger-ui/) |
| **NVDB Status API** | Operational status, dependencies, and incident/maintenance messages for NVDB services. Also offers WebSocket push notifications. | Public GET operations are anonymous; administrative writes use bearer authentication. [Documentation](https://nvdb.atlas.vegvesen.no/docs/produkter/status/) · [API](https://nvdbstatus-api.atlas.vegvesen.no/) |
| **NVDB Stedfesting API** | Snaps/georeferences road objects to the NVDB road network and provides position and route operations. | OpenAPI declares no authentication. [Documentation](https://www.nvdb.no/hent-og-se-data/stedfesting/api-referanse/) · [API](https://nvdbstedfesting.atlas.vegvesen.no/). A live position request currently failed because the service called an obsolete internal NVDB V4 path, so treat it as degraded. |

### Official WMS/WFS layer families

The currently documented families are:

- `vegvar_1_0` — road-weather observations and forecasts
- `norstoy_1_0` — strategic and forecast road-noise zones
- `nvdb_2_0` — selected NVDB objects such as rest areas, toll stations, and heavy-vehicle restrictions
- `rapportweb_1_0` — geotechnical, geological, hydrological, and natural-hazard reports
- `datex_3_1` — incidents, travel times, weather, and cameras

Live but less prominently documented namespaces include `geodata_1_0`, `trafikkflyt_1_0`, and `vegbilder_1_0`.

## 2. Free after obtaining credentials

### Technical vehicle lookup API

**Purpose:** Current, near-complete technical details for one vehicle, searched by registration number or VIN. Results include dimensions, weights, engine, axles, brakes, approved wheel/tyre combinations, registration dates, and inspection deadlines. It excludes owner information and mileage.

- Available to private individuals and organizations with Norwegian electronic ID.
- API keys are requested through Statens vegvesen and applications are normally processed automatically.
- No fee is published for this single-lookup API.
- Limit: **50,000 calls per key per day**.
- Header: `SVV-Authorization: Apikey <key>`.
- Registration numbers and VINs can be personal data and require a lawful basis for processing.
- [Access information](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/api-for-tekniske-kjoretoyopplysninger/)
- [Technical portal](https://autosys-kjoretoy-api.atlas.vegvesen.no/api-ui/index-api.html?apiId=enkeltoppslag)
- API base: `https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata`

### DATEX II 3.1

DATEX is **explicitly free**, licensed under NLOD, but requires registration and HTTP Basic credentials. Publications are XML pull services and also support SOAP/WSDL.

[Service overview](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/hva-er-datex/) · [Technical documentation](https://git.vegvesen.no/projects/DATEX2/repos/datex2-spesifications/browse/3.1/README.md)

Production base:

```text
https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/
```

The nine current publications are:

| Publication | Purpose |
|---|---|
| [`GetMeasuredWeatherData`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetMeasuredWeatherData/pullsnapshotdata) | Meteorological measurements from roadside stations; updated about every ten minutes. |
| [`GetMeasurementWeatherSiteTable`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetMeasurementWeatherSiteTable/pullsnapshotdata) | Coordinates, road references, and names for weather stations. |
| [`GetForecastPointData`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetForecastPointData/pullsnapshotdata) | Hourly forecasts approximately 24 hours ahead. |
| [`GetForecastPointLocations`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetForecastPointLocations/pullsnapshotdata) | Locations corresponding to forecast data. |
| [`GetCCTVSiteTable`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetCCTVSiteTable/pullsnapshotdata) | Road-camera locations and links to current pictures/video. |
| [`GetCCTVStatus`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetCCTVStatus/pullsnapshotdata) | Active/inactive operational status of cameras. |
| [`GetTravelTimeData`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetTravelTimeData/pullsnapshotdata) | Measured journey times and delay trends; updated about every five minutes. |
| [`GetPredefinedTravelTimeLocations`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetPredefinedTravelTimeLocations/pullsnapshotdata) | Geometry and identifiers for measured travel-time sections. |
| [`GetSituation`](https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetSituation/pullsnapshotdata) | Roadworks, closures, accidents, weather, floods, landslides, and other active/planned traffic situations nationwide. |

The anonymous OGC services expose simplified geographical forms of much of the same DATEX data, which may be easier for a CLI than parsing the full XML model.

## 3. Explicitly cost-free but restricted by eligibility

### HC-register APIs

These are explicitly described as **cost-free**, but are not open to arbitrary consumers. Authentication is HTTP Basic.

- **Permit-management interface:** municipalities and parking-system suppliers create and modify disabled-parking permits.
- **Validity-check interface:** parking companies and wardens check whether a permit is valid, stolen, lost, withdrawn, or associated with a deceased holder.

[Access information](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/hc-reg/) · [Swagger](https://hcreg.atlas.vegvesen.no/swagger-ui/index.html)

## 4. Publicly documented, but free access cannot be fully confirmed

| API | Purpose | Qualification |
|---|---|---|
| **Ferjedatabanken API** | Ferry-line, operator, contract, traffic, revenue, and statistics data, with history back to 2007. Previous-month figures are normally published after the 16th. | Catalogued as `PUBLIC` and CC BY 4.0, but all data methods require an `Authorization` token obtained through login. No public API tariff was found. [Catalog record](https://dataut.vegvesen.no/dataservice/ferjedatabank) · [Swagger](https://api.ferjedatabanken.no/swagger) |
| **AutoPASS Ferry Price API** | Ferry routes, sections, and active/all fare data. | Catalogued as `PUBLIC` and CC BY 4.0. Requires a login-generated token and the Swagger documentation instructs consumers to request access by email. No tariff was found. [Catalog record](https://dataut.vegvesen.no/dataservice/ferjepriser) · [Swagger](https://prisapi.autopassferje.no/swagger) |
| **Driver-licence check API** | Businesses can check valid licence classes, automatic-transmission restriction, rights codes, and professional-driver competence using national ID/D-number and surname. | Only suitable businesses are approved, terms must be signed, and Maskinporten is required. Limit: **2,000 people/day**. Searches are visible to the person, and their first search triggers an SMS. No public fee statement exists, so it cannot be classified as confirmed free. [Access information](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/api-for-sjekk-forerkort/) |
| **Parking Register write API** | Parking providers create, update, and deactivate their own regulated parking areas. | Provider-only companion to the open read API. No public fee is stated. [Overview](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/parkeringsregisteret-api/) |

An open-data license applies to the returned data; it does not by itself prove that API account provisioning is universally available or free.

## Not part of the free public inventory

- **Technical vehicle data with owner information** and **vehicle-event APIs** have published subscription prices and restricted eligibility.
- **NVDB API Skriv**, **Datafangst 2.0**, **Elveg ordering**, **NVDB REX/EKOM**, **ELRAPP**, eCOC, ownership-transfer, leasing-change, and test-plate APIs are workflow/write services for authorized partners.
- The bulk vehicle dataset is currently unavailable while its previous data hotel is replaced.
- RDS-TMC, ontology files, CSV downloads, and similar resources are datasets/downloads rather than APIs.
- SSB and Norvegiana APIs are linked from some Vegvesen catalog records but are third-party services, not operated by Statens vegvesen.
- **NVDB API Les V3** ceased being an open option in September 2025; use V4 even though several catalog resources still link to V3.

## Current implementation cautions

- Trafikkdata programmatic access uses **POST** to the Atlas endpoint. Browser/GraphiQL access moved to `trafikkdata.no/graphql` in March 2026.
- The old Parking Register API URL in Dataportalen returns 404; use `parkreg-open.atlas.vegvesen.no`.
- The Route Planner currently works anonymously, despite older metadata still documenting credentials.
- OGC API Tiles currently returns HTTP 500, while the DGGS service has no collections; neither should be a production dependency yet.
- The anonymous core APIs are the best initial CLI targets: **NVDB, Trafikkdata, Route Planner, Parking, TN-ITS, OGC, Fiksvegdata, Catalog, and Status**.
