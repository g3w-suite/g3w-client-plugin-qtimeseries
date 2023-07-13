import {STEP_UNITS} from './constant';
const {base, inherit, toRawType} = g3wsdk.core.utils;
const {GUI} = g3wsdk.gui;
const BasePluginService = g3wsdk.core.plugin.PluginService;

const WMS_PARAMETER = 'TIME';

const UPDATE_MAPLAYER_OPTIONS = {
  showSpinner: false
};

/**
 * Plugin service inherit from base plugin service
 * @constructor
 */
function PluginService(){
  this.setters = {
    open(){
      this._open();
    },
    close(){
      this._close()
    }
  };

  base(this);

  this.init = function(config={}) {
    this.project = this.getCurrentProject();
    this.config = config;
    this.mapService = GUI.getService('map');
    this.getChartConfig = {
      interaction: null,
      keyListener: null,
      indexcolor: 0,
      chart: null,
      layer: new ol.layer.Vector({
        source: new ol.source.Vector()
      })
    };

    this.addProjectLayerFromConfigProject();

    const show = this.config.layers.length > 0;
    if (show) {
      this.state = {
        loading: false,
        layers: this.config.layers,
        panel: {
          open: false
        }
      };
    }
    this.emit('ready', show);
  };
  
  /**
   * Method to add  layer from project layers configuration qtimseries
   */
  this.addProjectLayerFromConfigProject = function(){
    this.project.getConfigLayers().forEach(layerConfig => {
      if (toRawType(layerConfig.qtimeseries) === 'Object') {
        let {field, step=1, units='d', start_date=null, end_date=null} = layerConfig.qtimeseries;
        const startDateTimeZoneOffset = new Date(start_date).getTimezoneOffset();
        const endDateTimeZoneOffset = new Date(end_date).getTimezoneOffset();
        start_date = moment(start_date).add(startDateTimeZoneOffset, 'minutes');
        end_date = moment(end_date).add(endDateTimeZoneOffset, 'minutes');
        const stepunit_and_multiplier = STEP_UNITS.find(step_unit => step_unit.qgis === units).moment.split(':');
        let stepunit = stepunit_and_multiplier.length > 1 ? stepunit_and_multiplier[1]: stepunit_and_multiplier[0];
        const stepunitmultiplier = stepunit_and_multiplier.length > 1 ? 1*stepunit_and_multiplier[0] : 1;
        const id = layerConfig.id;
        const projectLayer = this.project.getLayerById(id);
        const name = projectLayer.getName();
        const wmsname = projectLayer.getWMSLayerName();
        this.config.layers.push({
          id,
          name,
          wmsname,
          start_date,
          end_date,
          options: {
            range_max: moment(end_date).diff(moment(start_date), stepunit) - 1,
            format,
            step, //added
            stepunit,
            stepunitmultiplier,
            field
          }
        });
      }
    })
  };

  /**
   * Get single 
   * @param layerId
   * @param date
   * @returns {Promise<unknown>}
   */
  this.getTimeLayer = function({layers, date, step, end_date, stepunit}={}){
    return new Promise((resolve, reject) =>{
      let findDate;
      let endDate;
      const ids = layers.map(layer => layer.id);
      const projectLayers = ids.map(id => this.project.getLayerById(id));
      projectLayers.forEach(projectLayer => projectLayer.setChecked(true));
      const mapLayersToUpdate = ids.map(id => this.mapService.getMapLayerByLayerId(id));
      const {multiplier, step_unit} = this.getMultiplierAndStepUnit(stepunit);
      const findDateTimeZoneOffset = new Date(date).getTimezoneOffset();
      findDate = moment(date).add(Math.abs(findDateTimeZoneOffset), 'minutes').toISOString();
      endDate = moment(findDate).add(step * multiplier, step_unit).toISOString();
      const layerEndDate = moment(end_date).add(Math.abs(findDateTimeZoneOffset), 'minutes').toISOString();
      const isAfter = moment(endDate).isAfter(layerEndDate);
      if (isAfter) endDate = layerEndDate;
      const wmsParam = `${findDate}/${endDate}`;
      let mapLayersToUpdateDone = mapLayersToUpdate.length;
      mapLayersToUpdate.forEach(mapLayerToUpdate => {
        mapLayerToUpdate.once('loadend', ()=> {
          const info =  endDate ? `${findDate} - ${endDate}` : findDate;
          this.mapService.showMapInfo({
            info,
            style: {
              fontSize: '1.2em',
              color: 'grey',
              border: '1px solid grey',
              padding: '10px'
            }
          });
          mapLayersToUpdateDone-=1;
          mapLayersToUpdateDone === 0 && resolve();
        });
        mapLayerToUpdate.once('loaderror', () => {
          const info =  endDate ? `${findDate} - ${endDate}` : findDate;
          this.mapService.showMapInfo({
            info,
            style: {
              fontSize: '1.2em',
              color: 'red',
              border: '1px solid red',
              padding: '10px'
            }
          });
          mapLayersToUpdateDone-=1;
          mapLayersToUpdateDone === 0 && reject();
        });
        this.mapService.updateMapLayer(mapLayerToUpdate, {
          force: true,
          [WMS_PARAMETER]: wmsParam
        }, UPDATE_MAPLAYER_OPTIONS);
      });
    })
  };

  this.getMultiplierAndStepUnit = function(stepunit){
    const multiplier_step_unit = stepunit.split(':');
    return {
      multiplier: multiplier_step_unit.length > 1 ? 1* multiplier_step_unit[0] : 1,
      step_unit: multiplier_step_unit.length > 1 ? multiplier_step_unit[1] : stepunit
    }
  };

  this.resetTimeLayer = function(layers, hideInfo=false){
    return new Promise((resolve, reject) => {
      let layersLength = layers.length;
      layers.forEach(layer => {
        if (layer.timed){
          const mapLayerToUpdate = this.mapService.getMapLayerByLayerId(layer.id);
          hideInfo && mapLayerToUpdate.once('loadend',  () => {
            this.mapService.showMapInfo();
            layersLength-=1;
            layersLength === 0 && resolve();
          });
          this.mapService.updateMapLayer(mapLayerToUpdate, {
            force: true,
            [WMS_PARAMETER]: undefined
          });
        } else resolve();
      })
      
    })
  };

  /**
   * Method on open time series Panel
   */
  this._open = function(){
    this.state.panel.open = true;
  };

  /**
   * Method on close time series Panel
   */
  this._close = function(){
    const layers = this.state.layers.filter(layer => layer.timed);
    layers && this.resetTimeLayer(layers, true);
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