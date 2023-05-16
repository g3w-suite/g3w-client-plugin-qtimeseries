import pluginConfig from './config';
import Service from "./service";
import SidebarItemComponent from './components/SidebarItem.vue';

const {base, inherit} = g3wsdk.core.utils;
const Plugin = g3wsdk.core.plugin.Plugin;
const GUI = g3wsdk.gui.GUI;
const addI18nPlugin = g3wsdk.core.i18n.addI18nPlugin;
const _Plugin = function() {
  base(this, {
    name: pluginConfig.name,
    i18n: true,
  });
  const pluginGroupTool = {
    position: 0,
    title: pluginConfig.title
  };
  this.panel; // plugin panel reference
  this.setReady(true);
  this.onAfterRegisterPluginKey;
  this.init = function() {
    //get config plugin from server
    this.config = this.getConfig();
    const enabled = this.registerPlugin(this.config.gid);
    this.setService(Service);
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

    this.createSideBarComponent(SidebarItemComponent,
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

new _Plugin;

