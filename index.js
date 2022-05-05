import pluginConfig from './config';
import Service from "./service";
import SidebarItem from './components/sidebar/sidebaritem';
const {base, inherit} = g3wsdk.core.utils;
const Plugin = g3wsdk.core.plugin.Plugin;
const GUI = g3wsdk.gui.GUI;
const addI18nPlugin = g3wsdk.core.i18n.addI18nPlugin;
const _Plugin = function() {
  base(this);
  const pluginGroupTool = {
    position: 0,
    title: pluginConfig.title
  };
  this.name = pluginConfig.name;
  this.panel; // plugin panel reference
  this.setReady(true);
  this.onAfterRegisterPluginKey;
  this.init = function() {
    //get config plugin from server
    this.config = this.getConfig();
    const enabled = this.registerPlugin(this.config.gid);
    this.setService(Service);
    // add i18n of the plugin
    addI18nPlugin({
      name: this.name,
      config: pluginConfig.i18n
    });
    // check if has some condition default true
    if (this.service.loadPlugin()) {
      this.service.once('ready', show => {
        //plugin registry
        if (enabled && show) {
          if (!GUI.isready) GUI.on('ready', ()=> this.setupGui.bind(this));
          else this.setupGui();
        }
      });
      //inizialize service
      this.service.init(this.config);
    }
  };
  //setup plugin interface
  this.setupGui = function() {
    const service = this.getService();
    // create an object that has a vue object structure
    const vueComponentObject = SidebarItem({
      service
    });
    this.createSideBarComponent(vueComponentObject,
      {
        id: pluginConfig.name,
        title: `plugins.${pluginConfig.name}.title`,
        open: false,
        collapsible: true,
        closewhenshowviewportcontent: false,
        iconConfig: {
          color: '#25bce9',
          icon: 'time',
        },
        mobile: true,
        sidebarOptions: {
          position: 'catalog'
        },
        events: {
          open: {
            when: 'before',
            cb: async bool =>{
              if (bool) service.open();
              else service.close();
            }
          }
        }
      });
  };

  this.load = function() {
    this.init();
  };

  this.unload = function() {
    this.emit('unload');
    this.service.clear();
  }
};

inherit(_Plugin, Plugin);

(function(plugin){
  plugin.init();
})(new _Plugin);

