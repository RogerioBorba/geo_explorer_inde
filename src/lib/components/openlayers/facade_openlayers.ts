//import 'ol/ol.css';
//import 'ol-popup/src/ol-popup.css';
//import Popup from 'ol-popup/';
import { Fill} from 'ol/style';
import {toStringHDMS} from 'ol/coordinate';
import { transform, transformExtent } from 'ol/proj';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import View from 'ol/View';
//import Graticule from 'ol/Graticule';
import TileWMS from 'ol/source/TileWMS.js';
import TileLayer from 'ol/layer/Tile';
import Layer from 'ol/layer/Layer.js';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import VectorImageLayer from 'ol/layer/VectorImage.js';
import Draw from 'ol/interaction/Draw';
import { createBox } from 'ol/interaction/Draw';

import { ImageStatic, ImageWMS, Vector, XYZ, ImageTile } from 'ol/source';
import { Style, Icon, Stroke } from 'ol/style';
import WMSCapabilities from 'ol/format/WMSCapabilities';
import GeoJSON from 'ol/format/GeoJSON';
//import { WMSCapabilityLayer} from './LayerResource';
import { browser} from '$app/env';
import VectorSource from 'ol/source/Vector';
import { Polygon } from 'ol/geom';
import { Feature } from 'ol';
import type { IWMSLayer } from '../../ogc/wms/wmsCapabilities';
import CircleStyle from 'ol/style/Circle';
import { WFSLayerOL, WMSLayerOL } from './layerOL';
import type { IFeatureType } from '../../ogc/wfs/wfsCapabilities';
import { WFSLayer } from './wfs/wfsLayer';
export const osmBaseTile = new TileLayer({ source: new XYZ({url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'}), zIndex: 0 })
export const googleBaseTile = new TileLayer({source: new XYZ({url: 'http://mt{0-3}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'}), zIndex: 0})
//returns a google satelite TileLayer as baselayer
export const sateliteBaseTile = new TileLayer({source: new ImageTile({ url: 'http://mt1.google.com/vt/lyrs=s&hl=pl&&x={x}&y={y}&z={z}'}), zIndex: 0})
//returns a water TileLayer as baselayer
export const watercolorBaseTile = new TileLayer({source: new XYZ({url: 'http://{a-c}.tile.stamen.com/watercolor/{z}/{x}/{y}.png'}), zIndex: 0})
//returns wikimedia TileLayer as baselayer
export const wikimediaBaseTile = new TileLayer({source: new XYZ({url: 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png'}), zIndex: 0})
export const esriworldstreetTile = new TileLayer({source: new XYZ({url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attributions: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'}), zIndex: 0})
export const cartodbTile = new TileLayer({source: new XYZ({
  url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
  attributions: '© OpenStreetMap contributors © CARTO'})});
export const nullBaseTile = null;

/**
 * Um objeto contendo os diferentes tiles base para um mapa.
 *
 * @type {Object.<string, TileLayer | null>}
 * @property {TileLayer} osm - OSM base tile.
 * @property {TileLayer} google - Google base tile.
 * @property {TileLayer} satelite - Satelite base tile.
 * @property {TileLayer} watercolor - Watercolor base tile.
 * @property {TileLayer} wikimedia - Wikimedia base tile.
 * @property {TileLayer} cartodb - Carto DB base tile.
 * @property {null} null - Valor nulo.
 */
export const BaseTiles: Record<string, TileLayer| null> = {
  osm: osmBaseTile,
  google: googleBaseTile,
  googlesatelite: sateliteBaseTile,
  watercolor: watercolorBaseTile,
  wikimedia: wikimediaBaseTile,
  esriworldstreet: esriworldstreetTile,
  cartodb: cartodbTile,
  none: null,
};


export class FacadeOL {
    map: Map;
    view: View;
    currentBaseLayerName: string;
    currentBaseLayer: TileLayer | null;
    vectorSource: any;
    boundingBoxLayer: VectorLayer<any> | null;
    drawInteraction: Draw | null;

    constructor(id_map='id_map', coordinates_center=[-4331024.58685793, -1976355.8033415168], a_zoom_value = 4, a_baseLayer_name='OSM' ) {
      this.map = new Map({ target: id_map,  controls:[]});
      this.view = new View({ center: coordinates_center, zoom: a_zoom_value});
      this.map.setView(this.view);
      this.currentBaseLayer= osmBaseTile;
      this.currentBaseLayerName = 'osm';
      this.map.addLayer(this.currentBaseLayer);
      //this.addOverlay()  
      //this.onClickMap();
      this.vectorSource = new VectorSource();
      this.boundingBoxLayer = null;
      this.drawInteraction = null;
    }
    //returns a TileLayer based on name(a_baseLayer_name) or null
    baseLayer(a_baseLayer_name: string): TileLayer | null{
      // name: 'Wikimedia', value: 'wikimedia'}, {name: 'Nenhum', value: null}]
      return BaseTiles[a_baseLayer_name]
    }

    setBaseLayer(a_baseLayer_name: string) {
      console.log(a_baseLayer_name,);
      console.log(`this.currentBaseLayer: ${this.currentBaseLayer}`);
      if (! this.currentBaseLayer) return;
      this.map.removeLayer(this.currentBaseLayer);
      if (a_baseLayer_name == 'none')
        return
      this.currentBaseLayer = this.baseLayer(a_baseLayer_name);
      this.currentBaseLayerName = a_baseLayer_name ;
      if (! this.currentBaseLayer) return;
      this.map.addLayer(this.currentBaseLayer);
      this.currentBaseLayer.setZIndex(0);
    }
    // Ends - These operations above are related to the baselayer

    // Begins - These operations are related to the WMS
    getWMSCapabilitiesAsJSON(resquestedXml) {
      let  parser = new WMSCapabilities()
      return parser.read(resquestedXml)
    }

    getWMSCapabilityLayers(requestedXml) {
      const capability_json = this.getWMSCapabilitiesAsJSON(requestedXml)
      const layers = capability_json.Capability.Layer.Layer
      const entryPoint = capability_json.Capability.Request.GetCapabilities.DCPType[0].HTTP.Get.OnlineResource
      return layers.map((a_layer) => new WMSCapabilityLayer(a_layer, capability_json.version, entryPoint))
    }

    getWMSMap(wmsLayer) {
      let wmsSource = new ImageWMS({url: wmsLayer.sourceLayer, params: {'LAYERS': wmsLayer.name()}});
      return new ImageLayer({ source: wmsSource});
      //let wmsSource = new TileWMS({url: wmsLayer.sourceLayer, params: {'LAYERS': wmsLayer.name(), TILED: true}});
      //return  new TileLayer({ source: wmsSource});
    }

    //return a array of features of a vector layer by passing the zIndex of the layer
    getFeaturesFromVectorLayerOnMap(ZIndexOfTheLayer) {
      const layersList = this.map.getLayers().array_
      let featureList = []
      if(layersList[ZIndexOfTheLayer].type === "VECTOR"){
        featureList = layersList[ZIndexOfTheLayer].getSource().getFeatures()
      }
      return featureList
    }

    //return a array of objects with the features propreties by passing a array of features
    getPropertiesFromFeatures(featureList) {
      return featureList.map( feature => feature.getProperties() )
    }

    //recive a feature(OL gerated) object and a object with the new Properties and add this properties to the feature 
    addPropertiesInAFeature(OlFeature, newProperties) {
      debugger
      OlFeature.setProperties(newProperties)
    }

    //return a array of objects with the features propreties of a vector layer by passing the zIndex of the layer
    getPropertiesOfFeaturesFromVectorLayerOnMap(indexOfTheLayer) {
      const layersList = this.map.getLayers().array_
      const featureList = layersList[indexOfTheLayer].getSource().getFeatures()
      let propretiesList = featureList.map( feature => feature.getProperties() )
      return propretiesList
    }

    // Sets a collection of key-value pairs on feature. Note that this changes any existing properties and adds new ones (it does not remove any existing properties).
    setPropertiesOnFeaturesFromVectorLayerOnMap(indexOfTheLayer, indexOftheFeature, newProperties) {
      const layersList = this.map.getLayers().array_
      const featureList = layersList[indexOfTheLayer].getSource().getFeatures()
      featureList[indexOftheFeature].setProperties(newProperties)
      //console.log(featureList[indexOftheFeature].getProperties())
    } 

    addWMSLayer(iwmsLayer : IWMSLayer, url: string): WMSLayerOL {
      const wmsLayerOL = new WMSLayerOL(iwmsLayer, url);
      let wmsSource = new ImageWMS({url: url, params: {'LAYERS': iwmsLayer.name}});
      let image_layer = new ImageLayer({ source: wmsSource});
      this.map.addLayer(image_layer);
      wmsLayerOL.layer = image_layer;
      return wmsLayerOL
    };

    removeWMSLayer(wmsLayerOL: WMSLayerOL) {
      if (!wmsLayerOL.layer) return console.log("FacadeOL>>removeWMSLayer -- wmsLayer.layerAp null");
      this.map.removeLayer(wmsLayerOL.layer);
      wmsLayerOL.layer = null;
    }
    // End - These operations above are related to the WMS
    // Begin - Base operations to add GeoJson
    
    async addGeoJSONLayerOLD(geojson: any, style: Style | null = null): Promise<VectorImageLayer> {
      const geo_json = new GeoJSON();
      //const gjson_format = geo_json.readFeatures(geojson, {featureProjection: this.map.getView().getProjection()});
      const gjson_format = geo_json.readFeatures(geojson, {featureProjection: 'EPSG:3857'});
      const vector_source = new Vector({features: gjson_format});
      const vector_layer = new VectorImageLayer({ source: vector_source });
      //const vector_layer = new VectorLayer({ source: vector_source });

      console.log("vector style" + JSON.stringify(vector_layer.getStyle()))
      vector_layer.map = this.map;
      if (style)
          vector_layer.setStyle(style)

      //vector_layer.render('image');
      this.map.addLayer(vector_layer);
      return vector_layer; 
    }

    addGeoJSONLayer(iFeatureType: IFeatureType, geojson: any, properties: any, url: string): WFSLayerOL {
      const geo_json = new GeoJSON();
      const gjson_format = geo_json.readFeatures(geojson, {
        dataProjection: WFSLayer.GEOJSON_CRS,
        featureProjection: this.map.getView().getProjection()
      });
      const vector_source = new Vector({features: gjson_format});
      const vectorlayerImage = new VectorImageLayer({ source: vector_source });
      const vector_layer = new VectorLayer({ source: vector_source });
      const geoJsonType: string = geojson.features?.find((feature: any) => feature.geometry)?.geometry.type;
      if (!geoJsonType) throw new Error('O serviço WFS não retornou geometrias válidas.');
      const style = this.styleforGeojsonType(geoJsonType, properties.color);
      vectorlayerImage.setStyle(style);
      //vector_layer.render('image');
      this.map.addLayer(vectorlayerImage);
      const numCamadas = this.map.getLayers().getLength();
      //new WFSLayerOL()
      const wfsLayerOL = new WFSLayerOL(iFeatureType, url);
      wfsLayerOL.layer = vectorlayerImage;
      return wfsLayerOL; 
    }
    
    styleForLine(color: string) {
      return new Style({ stroke: new Stroke({color: color, width: 3}),});
    };
    
    styleForPolygon(color: string ) {
      const strokePolygon = new Stroke({color: color, width: 2,});
      const fillPolygon = new Fill({ color: 'rgba(0, 0, 255, 0.1)', });
      return new Style({ stroke: strokePolygon, fill: fillPolygon});
    };

    styleForPoint(color: string ) {
      const fill = new Fill({ color: color,});
      const stroke = new Stroke({color: '#000', width: 1,});
      const image =  new CircleStyle({ radius: 5,fill: fill, stroke: stroke});
      return new Style({image: image, fill: fill, stroke: stroke});
    };

   styleforGeojsonType(geojsonType: string, a_color: string) {

      if (geojsonType === "LineString" || geojsonType === "MultiLineString") return this.styleForLine(a_color);
      
      if (geojsonType === "Polygon" || geojsonType === "MultiPolygon") return this.styleForLine(a_color);
      
      return this.styleForPoint(a_color);
   };

   removeWFSLayerOL(a_layer: WFSLayerOL) {
      if (!a_layer.layer) return console.log("FacadeOL>>removeWMSLayer -- wfsLayer.layerAp null");
      this.map.removeLayer(a_layer.layer);
      a_layer.layer = null;
    }
    
    addWFSLayerFromCapability(wfsLayer) {
      this.map.addLayer(vectorLayer);
    }  
    // Begin - some affordance of OL
    showGraticule(color='rgba(255,120,0,0.9)', width=2, lineDash=[0.5, 4], showLabels=true) {
      let strokeStyle = new Stroke({ color: color, width: width, lineDash: lineDash })
     // let graticule = new Graticule({ strokeStyle: strokeStyle, showLabels: showLabels})
      graticule.setMap(this.map)
    }
    // Begin - These operations are related to the WFS

    // End - These operations are related to the WFS
     //End -Affordances
    
     // Begin - events
     addOverlay() {
      if (browser) {
        const container = document.getElementById('static-modal');
        const content = document.getElementById('popup-content');
        const closer = document.getElementById('popup-closer');
        const overlay = new Overlay({
          element: container,
          autoPan: {
            animation: {
              duration: 250,
            },
          },
        });

        this.popup = new Overlay({
          element: container,
          autoPan: true,
          autoPanAnimation: { duration: 250 }
        });

        if(closer)
          closer.onclick = () => {
            this.popup.setPosition(undefined);
            closer.blur();
            container.style.display = 'none'; // Esconde o popup
            return false;
          };

        this.map.addOverlay(this.popup);
        //this.map.addOverlay(overlay);
      }
    }

    displayFeatureInfo(evt, feature) {
      if (!feature) {
        console.log("Não há feature");
        return;
      }
        
      console.log(feature);
      console.log("---------");
      let prettyCoord = toStringHDMS(transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326'), 2);
              
      if (feature) {
        let str = ''
        const entries = Object.entries(feature.values_)
        console.log("feature.values_: ", feature.values_);
        entries.forEach(entry => {
          let key = entry[0];
          let value = entry[1];
          if(typeof(value) === 'string'){
            str += '<p>' + '<strong>' + key + '</strong>' + ': ' + value + '</p>'    
          }
          console.log(str);
          /*
          console.log(key,': ',value,typeof(value))
          if ((typeof key) != 'geometry' && (typeof value != 'object'))
            str += '<p>' + key + ': ' + value + '</p>'    
          */
        })
        
        const contentHTML = `<div>${str}</div>`;
        //const contentHTML = '<div><h2>Coordinates</h2><p>' + prettyCoord + '</p>' + str + '</div>';
        const container = document.getElementById('popup-content');
        container.innerHTML = contentHTML;

        this.popup.setPosition(evt.coordinate);
        const popupElement = document.getElementById('static-modal');
        popupElement.style.display = 'block';
       // this.popup.show(evt.coordinate, '<div><h2>Coordinates</h2><p>' + prettyCoord + '</p>' + str + '</div>')
      } //else
        //this.popup.show(evt.coordinate, '<div><h2>Coordinates</h2><p>' + prettyCoord + '</p></div>')

    }

    onClickMap() {
      this.map.on('singleclick', (evt) => {
       // console.log("singleclick:", evt);
        let layer = null;
        //forEachFeatureAtPixel(pixel, callback, options)
        let feature = this.map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) { return feature}, {});
        //console.log("feature: ", feature);
        this.displayFeatureInfo(evt, feature);
        
      })
    }
    // End - events

    // Begin  -  HyperResource related operations
    //createHyperResourceLayer(name, iri) {
    //  return new HyperResourceLayer(name, iri);
    //}

    async addVectorLayerFromGeoJSON(geoJson, style_iri) {
      let style = null 

      try { 
        if (style_iri) {
          let response = await fetchData(style_iri);
          const featureType = geoJson.features[0].geometry.type;
          
          if(featureType === "Point" || featureType === "MultiPoint"){ // verificar se estar funcionando corretamente os estilos para cada tipo de dado
            style = await new Style({ image: new Icon({src: response.data})});
          } else if (featureType === "LineString" || featureType === "MultiLineString") {
            console.log("Implementar estilo para linhas")
          } else if (featureType === "Polygon" || featureType === "MultiPolygon") {
            console.log("Implementar estilo para Poligono")
          } else if (featureType === "GeometryCollection") { // Antimeridian Cutting
            console.log("Implementar estilo para Poligono")
          }
        }
      } catch (e) {
        console.log("Houve algum erro durante a requisição. ");
        console.log(style_iri);
        console.log(e);
      } finally {
        
        const geo_json = new GeoJSON()
        const gjson_format = geo_json.readFeatures(geoJson, {featureProjection: this.map.getView().getProjection()})
        const vector_source = new Vector({features: gjson_format})
        const vector_layer = new VectorLayer({ source: vector_source })

        if (style)
          //vector_layer.render('image')
          vector_layer.setStyle(style)
        this.map.addLayer(vector_layer)
        return vector_layer
      }
    }

    async addHyperResourceImageLayer (response) {
      /*
      function insertSlashAtEnd(A_URL){
        let lastCaracter = A_URL.charAt(A_URL.length-1)
        if(lastCaracter !== "/")
          return A_URL+= "/"
        return A_URL
      }

      url = insertSlashAtEnd(url)
      */
      let coordinates
      try {
       //coordinates = await axios.get(`${url}envelope/transform/3857&true`)
       //coordinates = await axios.get(`${url}extent`)
      }
      catch(error){
        console.log(' --- Houve algum erro na requisição. --- \n', error)
      }
      // const extent = coordinates.data.coordinates[0][0].concat(coordinates.data[0].coordinates[0][2])
     const extent = [-78.0014412681607, -38.00057476206898, -25.000210844334454, 8.99970587551235]
     debugger
      let image_layer =  new ImageLayer({
        source: new ImageStatic({
          url: response.data,
          crossOrigin: '',
          projection: 'EPSG:4326',
          imageExtent: extent
        })
      })
      this.map.addLayer(image_layer)
      return image_layer
    }

    async addHyperResourceLayer(a_HyperResourceLayer) {
      let resp_get
      try {
        resp_get = await axios.get(a_HyperResourceLayer.iri)
      }
      catch(error) {
        console.log('Houve algum erro na requisição. ', error)
      }
      const gjson_format = new GeoJSON().readFeatures(resp_get.data, {featureProjection: this.map.getView().getProjection()})
      const vector_source = new Vector({features: gjson_format})
      const vector_layer = new VectorLayer({ source: vector_source })
      this.map.addLayer(vector_layer)

    }
    removeHyperResourceLayer(a_HyperResourceLayer) {}
    // End  - These operations are related to the HyperResource

    addRectangles(rectangles) {
      // Cria um vetor de feições
      const features = rectangles.map(rect => {
          const { eastBoundLongitude, northBoundLatitude, southBoundLatitude, westBoundLongitude } = rect;
          const coordinates = [
              [
                  [westBoundLongitude, southBoundLatitude],
                  [eastBoundLongitude, southBoundLatitude],
                  [eastBoundLongitude, northBoundLatitude],
                  [westBoundLongitude, northBoundLatitude],
                  [westBoundLongitude, southBoundLatitude]
              ]
          ];
          const polygon = new Polygon(coordinates).transform('EPSG:4326', 'EPSG:3857');
          return new Feature({ geometry: polygon });
      });

      const vectorSource = new VectorSource({ features });
      const vectorLayer = new VectorLayer({
          source: vectorSource,
          style: new Style({
              stroke: new Stroke({
                  color: 'black',
                  width: 0,
              }),
              fill: new Fill({
                  color: 'rgba(0, 0, 255, 0.0)',
              }),
          }),
      });

      // Adiciona a camada ao mapa
      this.map.addLayer(vectorLayer);
  }

  addBoundingBoxByCoordinates(westBoundLongitude: number, southBoundLatitude: number,  eastBoundLongitude: number, northBoundLatitude: number,fitToExtent = true
  ) {
    this.clearBoundingBox();

    const coordinates = [
      [
        [westBoundLongitude, southBoundLatitude],
        [eastBoundLongitude, southBoundLatitude],
        [eastBoundLongitude, northBoundLatitude],
        [westBoundLongitude, northBoundLatitude],
        [westBoundLongitude, southBoundLatitude]
      ]
    ];

    const polygon = new Polygon(coordinates).transform('EPSG:4326', 'EPSG:3857');
    const feature = new Feature({ geometry: polygon });
    const vectorSource = new VectorSource({ features: [feature] });

    this.boundingBoxLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        stroke: new Stroke({
          color: '#dc2626',
          width: 3
        }),
        fill: new Fill({
          color: 'rgba(220, 38, 38, 0.16)'
        })
      }),
      zIndex: 1000
    });

    this.map.addLayer(this.boundingBoxLayer);

    if (fitToExtent) {
      this.view.fit(polygon.getExtent(), {
        padding: [80, 80, 80, 80],
        duration: 300,
        maxZoom: 12
      });
    }
  }

  clearBoundingBox() {
    if (!this.boundingBoxLayer) return;
    this.map.removeLayer(this.boundingBoxLayer);
    this.boundingBoxLayer = null;
  }

  startBoundingBoxDraw(callback) {
    this.removeDrawInteraction();
    this.vectorSource.clear();

    const draw = new Draw({
      source: this.vectorSource,
      type: 'Circle',
      geometryFunction: createBox()
    });

    this.drawInteraction = draw;
    this.map.addInteraction(draw);

    draw.on('drawstart', () => {
      this.clearBoundingBox();
      this.vectorSource.clear();
    });

    draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const extent = geometry.getExtent();
      const transformedExtent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
      const [westBoundLongitude, southBoundLatitude, eastBoundLongitude, northBoundLatitude] = transformedExtent;

      this.removeDrawInteraction();
      this.vectorSource.clear();
      this.addBoundingBoxByCoordinates(
        westBoundLongitude,
        southBoundLatitude,
        eastBoundLongitude,
        northBoundLatitude,
        false
      );

      callback({
        westBoundLongitude,
        southBoundLatitude,
        eastBoundLongitude,
        northBoundLatitude
      });
    });
  }



  addDrawInteraction(callback) {
    const draw = new Draw({
        source: this.vectorSource,
        type: 'Polygon', // Pode ser 'Circle', 'LineString', 'Polygon', 'Point'
    });

    this.map.addInteraction(draw);

    draw.on('drawend', (event) => {
        const geometry = event.feature.getGeometry();
      if (!geometry) return;
        const extent = geometry.getExtent();
        const transformedExtent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
        // Converter extent para coordenadas no sistema de projeção do mapa, se necessário
        console.log("DIGITADO " + transformedExtent);
        const [westBoundLongitude, southBoundLatitude, eastBoundLongitude, northBoundLatitude] = transformedExtent;

        callback({
            westBoundLongitude,
            southBoundLatitude,
            eastBoundLongitude,
            northBoundLatitude
        });
    });

    this.drawInteraction = draw;
}

  removeDrawInteraction() {
      if (this.drawInteraction) {
          this.map.removeInteraction(this.drawInteraction);
          this.drawInteraction = null;
      }
  }
}
