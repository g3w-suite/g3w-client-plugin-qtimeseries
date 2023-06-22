import pluginConfig from './config';
import Service from "./service";
import SidebarItemComponent from './components/SidebarItem.vue';

const {base, inherit} = g3wsdk.core.utils;
const {Plugin} = g3wsdk.core.plugin;
const {GUI} = g3wsdk.gui;

const _Plugin = function() {
  base(this, {
    name: pluginConfig.name,
    i18n: pluginConfig.i18n,
    service: Service
  });

  this.panel; // plugin panel reference

  this.setReady(true);

  this.onAfterRegisterPluginKey;

  const enabled = this.registerPlugin(this.config.gid);
  // check if it has some condition default true
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

