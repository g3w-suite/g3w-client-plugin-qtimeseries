const template = require('./sidebaritem.html');
const STEPUNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes'];
export default function Sidebaritem({service, options={}}={}){
  return {
    name: "timeseries",
    template,
    data(){
      const {layers=[]} = service.state;
      const layer = layers[0];
      return {
        layers,
        step: 1,
        range: {
          value:null,
          min:null,
          max:null
        },
        stepunit: 'days', // get step unit
        currentdate: layer.start_date, //current date used for running
        current_layer_index: 0,
        status: 0, // status  [ 0: run, 1: pause, 2:stopped]
      };
    },
    computed: {
      layer(){
        return this.layers[this.current_layer_index];
      },
      disablerun(){
        return this.status === 0 && (!this.layer.start_date || !this.layer.end_date) ;
      },
      icon(){
        let icon;
        switch(this.status){
          case 0:
            icon = 'run';
            /**
             * Throttle function to call new imahge
             *
             */
            break;
          case 1:
            icon = 'pause';
            break;
        }
        return icon;
      }
    },
    methods:{
      setRangeValues(){
        this.range.min = 0;
        this.range.max = this.layers[this.current_layer_index].options.dates.length - 1;
        this.range.value = 0;
      },
      handleRangeSteps(){},
      async getTimeLayer() {
        await service.getTimeLayer({
          layerId: this.layers[this.current_layer_index].id,
          date: this.currentdate,
        });
      },
      changeRangeStep(value){
        this.$refs.rangecomponent.step = 1*value
      },
      changeStartDateTime(datetime){
        this.layers[this.current_layer_index].start_date = datetime;
        this.currentdate = datetime;
        this.changeEndDateTime(datetime);
        this.getTimeLayer();
      },
      changeEndDateTime(datetime){
        this.layer.enddate = datetime;
      },
      async click(){
        switch (this.status) {
          case 0:
            this.status = 1;
            await this.$nextTick();
            break;
          case 1:
            this.status = 0;
            await this.$nextTick();
            break;
        }
      }
    },
    watch: {
      async 'status'(status){
        if (status) {
          this.intervalEventHandler = setInterval(async ()=> {
            await this.getTimeLayer();
            const step = 1*this.step;
            this.currentdate = moment(this.currentdate, this.layer.options.format).add(step, this.stepunit).format(this.layer.options.format);
            this.range.value+= step;
          }, 2000)
        } else {
          clearInterval(this.intervalEventHandler);
          this.intervalEventHandler = null;
        }
      },
      current_layer_index(index){
        // in case of layer change set current key to true
        this.layers.forEach(_layer =>{
          layer.current = _layer.id === layer.id
        });
        this.setRangeValues();
      }
    },
    created() {
      this.intervalEventHandler = null;
      this.stepunits = STEPUNITS;
      this.setRangeValues();
    },
    async mounted(){},
    beforeDestroy(){
      service.clear();
    }
  }
};
