const {base, inherit, XHR} = g3wsdk.core.utils;
const GUI = g3wsdk.gui.GUI;
const BasePluginService = g3wsdk.core.plugin.PluginService;
const BASE_API_URL_RASTER_TYPE = '/qtimeseries/api/raster/serie/';
const VECTOR_STEP_UNITS = {
  d: "days"
};

const WMS_PARAMETER = {
  'raster': 'RBAND',
  'vector': 'FILTER'
};

const UPDATE_MAPLAYER_OPTIONS = {
  showSpinner: false
};

/**
 * Plugin service inherit from base plugin service
 * @constructor
 */
function PluginService(){
  base(this);
  this.init = async function(config={}) {
    this.project = this.getCurrentProject();
    this.config = config;
    this.mapService = GUI.getComponent('map').getService();
    for (let i=0; i < this.config.layers.length; i++){
      const layer = this.config.layers[i];
      const projectLayer = this.project.getLayerById(layer.id);
      layer.wmsname = projectLayer.getWMSLayerName();
      layer.name = projectLayer.getName();
      layer.timed = false; // used to check which layer is timed request
      switch(layer.type){
        case 'raster':
          layer.options = await XHR.get({
            url: `${BASE_API_URL_RASTER_TYPE}${this.project.getId()}/${layer.id}`
          });
          layer.options.stepunit = 'days';
          break;
      }
    }
    this.addVectorLayerFromConfigProject();
    this.state = {
      loading: false,
      layers: this.config.layers,
      panel: {
        open:false
      }
    };

    this.emit('ready');
  };

  this.addVectorLayerFromConfigProject = function(){
    this.project.getConfigLayers().forEach(layerConfig => {
      if (layerConfig.qtimeseries) {
        const projectLayer = this.project.getLayerById(layerConfig.id);
        const {field, units='d', mode, begin, end} = layerConfig.qtimeseries;
        const layer = {
          id: layerConfig.id,
          type: 'vector',
          name: projectLayer.getName(),
          wmsname: projectLayer.getWMSLayerName(),
          start_date: begin ,
          end_date: end,
          options: {
            dates: [],
            stepunit: VECTOR_STEP_UNITS[units],
            field
          }
        };
        this.config.layers.push(layer);
      }
    })
  };

  /**
   * Get single raster,vectot time layer
   * @param layerId
   * @param date
   * @returns {Promise<unknown>}
   */
  this.getTimeLayer = function({layer, date}={}){
    let findDate;
    return new Promise((resolve, reject) =>{
      const {id} = layer;
      const projectLayer = this.project.getLayerById(id);
      projectLayer.setChecked(true);
      const mapLayerToUpdate = this.mapService.getMapLayerByLayerId(id);
      mapLayerToUpdate.once('loadend', ()=> {
        this.mapService.showMapInfo({
          info: findDate,
          style: {
            fontSize: '1.2em'
          }
        });
        resolve();
      });
      if (layer.type === 'raster'){
        const index = layer.options.dates.findIndex(_date => moment(date).isSame(_date));
        // check if date is inside dates available of raster layer
        if (index !== -1){
          findDate = layer.options.dates[index];
          this.mapService.updateMapLayer(mapLayerToUpdate, {
            force: false,
            [WMS_PARAMETER[layer.type]]: `${layer.wmsname},${index}` // in case of raster layer
          }, UPDATE_MAPLAYER_OPTIONS);
        } else {
          this.mapService.showMapInfo({
            info: date,
            style: {
              fontSize: '1.2em',
              color: 'red'
            }
          });
          resolve();
        }
      } else {
        findDate = date;
        this.mapService.updateMapLayer(mapLayerToUpdate, {
          force: false,
          [WMS_PARAMETER[layer.type]]: `${layer.wmsname}:"${layer.options.field}" = '${findDate}'` // in case of vector layer
        }, UPDATE_MAPLAYER_OPTIONS);
      }
    })
  };

  this.resetTimeLayer = function(layer){
    return new Promise((resolve, reject) => {
      if (layer.timed){
        const mapLayerToUpdate = this.mapService.getMapLayerByLayerId(layer.id);
        mapLayerToUpdate.once('loadend',  ()=>{
          this.mapService.showMapInfo();
          resolve();
        });
        this.mapService.updateMapLayer(mapLayerToUpdate, {
          force: true,
          [WMS_PARAMETER[layer.type]]: undefined
        });
      } else resolve();
    })
  };

  /**
   * Method on open time series Panel
   */
  this.open = function(){
    this.state.panel.open = true;
  };

  /**
   * Method on close time series Panel
   */
  this.close = function(){
    const layer = this.state.layers.find(layer => layer.timed);
    layer && this.resetTimeLayer(layer);
    this.state.panel.open = false;
  };

  /**
   * Clear time series
   */
  this.clear = function(){
    this.close();
  };
}

inherit(PluginService, BasePluginService);

export default new PluginService;