const {base, inherit, XHR} = g3wsdk.core.utils;
const GUI = g3wsdk.gui.GUI;
const BasePluginService = g3wsdk.core.plugin.PluginService;
const WMS_PARAMETER = {
  'raster': 'BAND',
  'vector': 'FILTER'
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
    const {layers=[]} = config;
    for (let i=0; i < layers.length; i++){
      const layer = layers[i];
      const projectLayer = this.project.getLayerById(layer.id);
      layer.wmsname = projectLayer.getWMSLayerName();
      layer.name = projectLayer.getName();
      layer.timed = false; // used to check which layer is timed request
      layer.current = i === 0; // set current layer at beginning
      if (layer.type === 'raster') {
        layer.options = await XHR.get({
          url: `/qtimeseries/api/raster/serie/${this.project.getId()}/${layer.id}`
        });
        layer.options.format = 'YYYY-MM-DD'
      }
    }

    this.state = {
      loading: false,
      layers
    };
    this.emit('ready');
  };

  /**
   * Get single raster,vectot time layer
   * @param layerId
   * @param date
   * @returns {Promise<unknown>}
   */
  this.getTimeLayer = function({layerId, date}={}){
    return new Promise((resolve, reject) =>{
      const layer = this.config.layers.find(layer => layer.id === layerId);
      layer.timed = true;
      const projectLayer = this.project.getLayerById(layerId);
      projectLayer.setChecked(true);
      const mapLayerToUpdate = this.mapService.getMapLayerByLayerId(layerId);
      mapLayerToUpdate.once('loadend', resolve);
      if (layer.type === 'raster'){
        const index = layer.options.dates.findIndex(_date => date ===_date);
        // check if date is inside dates available of raster layer
        if (index !== -1){
          this.mapService.updateMapLayer(mapLayerToUpdate, {
            force: false,
            [WMS_PARAMETER[layer.type]]: `${layer.wmsname},${index}` // in case of raster layer
          });
        }
      }  else {
        this.mapService.updateMapLayer(mapLayerToUpdate, {
          force: false,
          [WMS_PARAMETER[layer.type]]: `${layer.wmsname}:"${layer.options.field}"  = '${date}'` // in case of vector layer
        });
      }
    })
  };

  this.resetTimeLayer = function(layer){
    if (layer.timed) {
      const mapLayerToUpdate = this.mapService.getMapLayerByLayerId(layer.id);
      this.mapService.updateMapLayer(mapLayerToUpdate, {
        force: false,
        [WMS_PARAMETER[layer.type]]: undefined
      });
      layer.timed = false;
    }
  };

  /**
   * Method on open time series Panel
   */
  this.open = function(){
    const layer = this.state.layers.find(layer => layer.current);
    layer.start_date && this.getTimeLayer({
      layerId: layer.id,
      date: layer.start_date
    })
  };

  /**
   * Method on close time series Panel
   */
  this.close = function(){
    const layer = this.state.layers.find(layer => layer.timed);
    layer && this.resetTimeLayer(layer);
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