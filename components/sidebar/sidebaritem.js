const template = require('./sidebaritem.html');
const STEPUNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes'];
const STATUS = {}
export default function Sidebaritem({service, options={}}={}){
  return {
    name: "timeseries",
    template,
    data(){
      const {layers=[], panel} = service.state;
      return {
        layers,
        panel,
        step: 1,
        range: {
          value:null,
          min:null,
          max:null
        },
        stepunit: 'days', // get step unit
        current_layer_index: 0,
        currentLayerDateTimeIndex: null,
        status: 0, // status  [1: play, -1: back, 0: pause]
      };
    },
    computed: {
      layer(){
        return this.layers[this.current_layer_index];
      },
      layerMinDate(){
        return this.layer.options.dates[0];
      },
      layerMaxDate(){
        return this.layer.options.dates[this.layer.options.dates.length -1];
      },
      disablerun(){
        return this.status === 0 && (!this.layer.start_date || !this.layer.end_date) ;
      },
      validRangeDates(){
        return moment(this.layer.start_date).isValid() &&
          moment(this.layer.end_date).isValid()
          && moment(this.layer.end_date).diff(moment(this.layer.start_date)) >= 0;
      },
    },
    methods:{
      /**
       * Method to initiliaze the form time series on open and close
       */
      initLayerTimeseries(){
        this.status = 0;
        this.range.value = 0;
        this.range.min = 0;
        this.range.max = this.layer.options.dates.length ? this.layer.options.dates.length - 1 : 0;
        this.layer.start_date = this.layer.start_date && this.layerMinDate;
        this.layer.end_date = this.layer.end_date && this.layerMaxDate;
        this.currentLayerDateTimeIndex = moment(this.layer.start_date);
        this.layer.start_date && this.getTimeLayer();
      },
      resetRangeData(){
        this.range.value = 0;
        // set max range
        this.range.max = moment(this.layer.start_date).isValid() && moment(this.layer.end_date).isValid() ? moment(this.layer.end_date).diff(moment(this.layer.start_date), this.stepunit): 0;
      },
      async resetTimeLayer(layer=this.layer){
        this.pause();
        await service.resetTimeLayer(layer);
        layer.timed = false;
        this.currentLayerDateTimeIndex = this.layer.start_date;
      },
      async getTimeLayer() {
        await service.getTimeLayer({
          layer: this.layer,
          date: this.currentLayerDateTimeIndex
        });
        this.layer.timed = true;
      },
      async changeRangeStep({value}){
        this.range.value = 1*value;
        this.currentLayerDateTimeIndex = moment(this.layer.start_date).add(this.range.value, this.layer.options.stepunit);
        await this.getTimeLayer()
      },
      changeStartDateTime(datetime){
        this.layer.start_date = datetime;
        this.currentLayerDateTimeIndex = datetime;
        this.resetRangeData();
        if (moment(datetime).isValid()) this.getTimeLayer();
        else this.resetTimeLayer();

      },
      async changeEndDateTime(datetime){
        this.layer.end_date = datetime;
        this.resetRangeData();
      },
      setStatus(status=0){
        this.status = status;
      },
      /**
       *
       * @param status 1 play, -1 back
       */
      setCurrentDateTime(status){
        const step = 1*this.step;
        this.currentLayerDateTimeIndex = moment(this.currentLayerDateTimeIndex)[status === 1 ? 'add' : 'subtract'](step, this.layer.options.stepunit);
      },
      run(status){
        if (this.status !== status) {
          clearInterval(this.intervalEventHandler);
          this.intervalEventHandler = setInterval(async ()=> {
            await this.getTimeLayer();
            const step = 1*this.step;
            this.range.value = status === 1 ? this.range.value + step: this.range.value - step;
            if (this.range.value > this.range.max || this.range.value < 0) {
              this.resetRangeData();
              this.pause();
            } else this.setCurrentDateTime(status);
            }, 1000);
          this.setStatus(status);
        } else this.pause()
      },
      pause(){
        clearInterval(this.intervalEventHandler);
        this.intervalEventHandler = null;
        this.setStatus();
      },
      stepBackwardForward(direction){
        const step = 1*this.step;
        this.range.value = direction === 1 ? this.range.value + step : this.range.value - step;
        this.setCurrentDateTime(direction);
        this.getTimeLayer()
      },
      fastBackwardForward(direction){
        if (direction === 1) {
          this.range.value = this.range.max;
          this.currentLayerDateTimeIndex = this.layer.end_date;
          this.getTimeLayer();
        } else {
          this.range.value = this.range.min;
          this.currentLayerDateTimeIndex = this.layer.start_date;
          this.getTimeLayer();
        }
      }
    },
    watch: {
      current_layer_index(new_index_layer, old_index_layer){
        const previousLayer = this.layers[old_index_layer];
        if (previousLayer.timed) {
          this.resetTimeLayer(previousLayer);
          previousLayer.timed = false;
        }
        this.initLayerTimeseries();
      },
      'panel.open'(bool){
        if (bool) this.initLayerTimeseries();
        else this.resetTimeLayer()
      },
      validRangeDates(bool){
        !bool && this.resetTimeLayer();
      }
    },
    created() {
      this.intervalEventHandler = null;
      this.stepunits = STEPUNITS;
    },
    async mounted(){},
    beforeDestroy(){
      service.clear();
    }
  }
};
