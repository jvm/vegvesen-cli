# Command reference

Generated from the same registry used by `vegvesen schema command`.

## version

- `vegvesen version` — Show CLI and machine-contract versions

## completion

- `vegvesen completion` — Generate shell completion

## doctor

- `vegvesen doctor` — Check local readiness and service health gates

## service

- `vegvesen service list` — List known services and support states
- `vegvesen service get` — Get exact service metadata

## schema

- `vegvesen schema command` — Describe command contract metadata
- `vegvesen schema output` — Show output JSON Schema

## config

- `vegvesen config path` — Show user config path
- `vegvesen config show` — Show config and effective sources
- `vegvesen config validate` — Validate user config
- `vegvesen config set` — Set an allowlisted non-sensitive value
- `vegvesen config unset` — Remove an allowlisted value

## catalog

- `vegvesen catalog package search` — Search catalog packages
- `vegvesen catalog package get` — Get exact package
- `vegvesen catalog resource get` — Get exact package resource
- `vegvesen catalog group list` — List catalog groups
- `vegvesen catalog group get` — Get exact catalog group
- `vegvesen catalog organization list` — List catalog organizations
- `vegvesen catalog organization get` — Get exact catalog organization
- `vegvesen catalog tag list` — List catalog tags
- `vegvesen catalog tag get` — Get exact catalog tag
- `vegvesen catalog status get` — Get catalog status

## nvdb

- `vegvesen nvdb catalog version` — Get active NVDB catalog version
- `vegvesen nvdb catalog type list` — List NVDB object types
- `vegvesen nvdb catalog type get` — Get exact NVDB object type
- `vegvesen nvdb catalog type history` — Get object types at catalog version
- `vegvesen nvdb catalog property get` — Get exact NVDB property type
- `vegvesen nvdb catalog property categories` — List NVDB property categories
- `vegvesen nvdb catalog product-spec get` — Get object type product specification
- `vegvesen nvdb catalog category list` — List NVDB object categories
- `vegvesen nvdb catalog unit list` — List NVDB units
- `vegvesen nvdb area county list` — List counties
- `vegvesen nvdb area municipality list` — List municipalities
- `vegvesen nvdb area road-authority list` — List road authorities
- `vegvesen nvdb area national-route list` — List national routes
- `vegvesen nvdb area contract list` — List contract areas
- `vegvesen nvdb area address list` — List addresses
- `vegvesen nvdb status current` — Get NVDB system status
- `vegvesen nvdb status dependency list` — List NVDB systems and services
- `vegvesen nvdb status message list` — List NVDB status messages
- `vegvesen nvdb status message get` — Get exact NVDB status message
- `vegvesen nvdb object list` — List NVDB road objects
- `vegvesen nvdb object get` — Get exact NVDB road object
- `vegvesen nvdb object versions` — List road-object versions
- `vegvesen nvdb object changes` — List road-object changes
- `vegvesen nvdb object statistics` — Get road-object statistics
- `vegvesen nvdb network link list` — List road-link sequences
- `vegvesen nvdb network link get` — Get exact road-link sequence
- `vegvesen nvdb network link changes` — List road-link changes
- `vegvesen nvdb network segment list` — List segmented road links
- `vegvesen nvdb network segment get` — Get segmented road links
- `vegvesen nvdb network segment statistics` — Get segmented-network statistics
- `vegvesen nvdb network node list` — List road-network nodes
- `vegvesen nvdb network node get` — Get exact road-network node
- `vegvesen nvdb network position locate` — Locate coordinates on road network
- `vegvesen nvdb network road-position locate` — Resolve one road position
- `vegvesen nvdb network road-position batch` — Resolve road positions in batch
- `vegvesen nvdb network route calculate` — Calculate NVDB network route
- `vegvesen nvdb monitor change-set get` — Get change-set status
- `vegvesen nvdb export object` — Export NVDB objects
- `vegvesen nvdb export network` — Export segmented network
- `vegvesen nvdb report family list` — List report families
- `vegvesen nvdb report generate` — Generate report
- `vegvesen nvdb report job get` — Get report job
- `vegvesen nvdb report job wait` — Wait for report job
- `vegvesen nvdb report artifact download` — Download report artifact

## parking

- `vegvesen parking provider list` — List parking providers
- `vegvesen parking provider get` — Get provider by organization number
- `vegvesen parking provider active` — List active parking providers
- `vegvesen parking area list` — List parking areas
- `vegvesen parking area get` — Get exact parking area
- `vegvesen parking area version` — Get exact parking area version
- `vegvesen parking sign-plan get` — Get sign-plan attachment
- `vegvesen parking assessment get` — Get assessment attachment

## route

- `vegvesen route calculate` — Calculate public-road route
- `vegvesen route matrix` — Calculate route matrix
- `vegvesen route road-feature query` — Query route road features

## traffic

- `vegvesen traffic station list` — List traffic stations
- `vegvesen traffic station get` — Get exact traffic station
- `vegvesen traffic volume hourly` — Read hourly traffic volume
- `vegvesen traffic volume daily` — Read daily traffic volume
- `vegvesen traffic volume length-class` — Read traffic volume by length class
- `vegvesen traffic aadt get` — Read annual average daily traffic
- `vegvesen traffic index station` — Read station indices
- `vegvesen traffic index area` — Read area index
- `vegvesen traffic index published` — List published indices
- `vegvesen traffic quality get` — Read traffic quality metrics
- `vegvesen traffic coverage get` — Read traffic coverage metrics
- `vegvesen traffic reference road-category list` — List road categories
- `vegvesen traffic reference area list` — List traffic areas

## ogc

- `vegvesen ogc wms capabilities` — Read WMS capabilities
- `vegvesen ogc wms map` — Render WMS map
- `vegvesen ogc wms feature-info` — Read WMS feature information
- `vegvesen ogc wfs capabilities` — Read WFS capabilities
- `vegvesen ogc wfs describe` — Describe WFS feature type
- `vegvesen ogc wfs feature` — Read WFS features
- `vegvesen ogc feature landing` — Read OGC feature landing
- `vegvesen ogc feature conformance` — Read OGC feature conformance
- `vegvesen ogc feature api` — Read OGC feature api
- `vegvesen ogc map landing` — Read OGC map landing
- `vegvesen ogc map conformance` — Read OGC map conformance
- `vegvesen ogc map api` — Read OGC map api
- `vegvesen ogc style landing` — Read OGC style landing
- `vegvesen ogc style conformance` — Read OGC style conformance
- `vegvesen ogc style api` — Read OGC style api
- `vegvesen ogc feature collection list` — List feature collections
- `vegvesen ogc feature collection get` — Get feature collection
- `vegvesen ogc feature queryable list` — List collection queryables
- `vegvesen ogc feature item list` — List feature items
- `vegvesen ogc feature item get` — Get exact feature item
- `vegvesen ogc map collection list` — List map collections
- `vegvesen ogc map collection get` — Get map collection
- `vegvesen ogc map style list` — List map styles
- `vegvesen ogc map render` — Render modern OGC map
- `vegvesen ogc style list` — List styles
- `vegvesen ogc style get` — Get style
- `vegvesen ogc style metadata` — Get style metadata

## tnits

- `vegvesen tnits type list` — List TN-ITS types
- `vegvesen tnits snapshot list` — List TN-ITS snapshots
- `vegvesen tnits snapshot download` — Download TN-ITS snapshot
- `vegvesen tnits update list` — List TN-ITS updates
- `vegvesen tnits update download` — Download TN-ITS update

## fiks

- `vegvesen fiks issue list` — List anonymous issues
- `vegvesen fiks issue get` — Get anonymous issue
- `vegvesen fiks issue create` — Create anonymous issue
- `vegvesen fiks attachment get` — Download issue attachment
- `vegvesen fiks attachment add` — Add issue attachment

## api

- `vegvesen api service list` — List generated-operation services
- `vegvesen api operation list` — List reviewed generated operations
- `vegvesen api operation describe` — Describe reviewed generated operation
- `vegvesen api operation call` — Call reviewed generated operation

