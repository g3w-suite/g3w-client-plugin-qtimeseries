const template = require('./sidebaritem.html');
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
          value:0,
          min:0,
          max:0
        },
        current_layer_index: 0,
        currentLayerDateTimeIndex: null,
        showCharts: false,
        status: 0, // status  [1: play, -1: back, 0: pause]
      };
    },
    computed: {
      formDisabled(){
        return this.status !== 0 || this.showCharts;
      },
      stepunitLabel(){
        let {stepunitmultiplier, stepunit} = this.layer.options;
        switch(stepunitmultiplier){
          case(10):
            stepunit = 'decades';
            break;
          case(100):
            stepunit = 'centuries';
            break;
        }
        return stepunit;
      },
      layer(){
        return this.layers[this.current_layer_index];
      },
      layerMinDate(){
        return this.layer.options.dates && this.layer.options.dates[0];
      },
      layerMaxDate(){
        return this.layer.options.dates && this.layer.options.dates[this.layer.options.dates.length -1];
      },
      disablerun(){
        return this.status === 0 && (!this.layer.start_date || !this.layer.end_date) ;
      },
      validRangeDates(){
        return this.validateStartDateEndDate() && moment(this.layer.end_date).diff(moment(this.layer.start_date), this.layer.options.stepunit) >= this.getStepValue();;
      },
    },
    methods:{
      /**
       * Method to initialize the form time series on open and close
       */
      initLayerTimeseries(){
        this.status = 0;
        this.currentLayerDateTimeIndex = this.layer.start_date;
        this.range.value = 0;
        this.range.min = 0;
        this.range.max = this.layer.options.dates ? this.layer.options.dates.length - 1 : 0;
        this.currentLayerDateTimeIndex && this.getTimeLayer();
        this.showCharts = false;
      },
      /**
       * Method to reset range on change start date or end date time
       */
      resetRangeInputData(){
        // reste range value to 0
        this.range.value = 0;
        // set max range
        this.range.max = this.validateStartDateEndDate() ?
          Number.parseInt(moment(this.layer.end_date).diff(moment(this.layer.start_date), this.layer.options.stepunit) / this.layer.options.stepunitmultiplier) : 0;
      },
      /**
       * Reset time layer to original map layer no filter by time or band
       * @param layer
       * @returns {Promise<void>}
       */
      async resetTimeLayer(layer=this.layer){
        this.pause();
        await service.resetTimeLayer(layer);
        layer.timed = false;
      },
      /**
       * Method to call server request image
       * @returns {Promise<void>}
       */
      async getTimeLayer() {
        await service.getTimeLayer({
          layer: this.layer,
          date: this.currentLayerDateTimeIndex
        });
        this.layer.timed = true;
      },
      /**
       * In case of change step
       * @param value
       * @returns {Promise<void>}
       */
      async changeRangeStep({value}){
        this.range.value = 1*value;
        this.currentLayerDateTimeIndex = moment(this.layer.start_date).add(this.range.value, this.layer.options.stepunit);
        await this.getTimeLayer()
      },
      /**
       * Listener method called when start date is changed
       * @param datetime
       */
      changeStartDateTime(datetime=null){
        datetime = moment(datetime).isValid() ? datetime : null;
        this.layer.start_date = datetime;
        this.currentLayerDateTimeIndex = datetime;
        this.resetRangeInputData();
        if (moment(datetime).isValid()) this.getTimeLayer();
        else this.resetTimeLayer();
      },
      /**
       * Listener Method called when end date is chanhed
       * @param datetime
       * @returns {Promise<void>}
       */
      async changeEndDateTime(datetime){
        // set end_date
        this.layer.end_date = datetime;
        // reset range input
        this.resetRangeInputData();
      },
      /**
       *
       * @returns {boolean}
       */
      validateStartDateEndDate(){
        let arevalidstartenddate = false;
        if (this.layer.start_date && this.layer.end_date){
          arevalidstartenddate = moment(this.layer.start_date).isValid() &&
            moment(this.layer.end_date).isValid();
        }
        return arevalidstartenddate;
      },
      /**
       * Set current status (play, pause)
       * @param status
       */
      setStatus(status=0){
        this.status = status;
      },
      /**
       *
       * @param status 1 play, -1 back
       */
      setCurrentDateTime(status){
        const step = this.getStepValue();
        this.currentLayerDateTimeIndex = moment(this.currentLayerDateTimeIndex)[status === 1 ? 'add' : 'subtract'](step, this.layer.options.stepunit);
      },
      /**
       * Method to calculate step valued based on current input step value and possible multipliere sted (es. decde, centuries)
       * @returns {number}
       */
      getStepValue(){
        return 1*this.step*this.layer.options.stepunitmultiplier;
      },
      /**
       * Play method (forward or backward)
       * status: 1 (forward) -1 (backward)
       */
      run(status){
        if (this.status !== status) {
          // used to wait util the image request to layer is loaded
          let waiting= false;
          clearInterval(this.intervalEventHandler);
          this.intervalEventHandler = setInterval(async ()=> {
           if (!waiting) {
             try {
               const step = 1*this.step;
               this.range.value = status === 1 ? this.range.value + step: this.range.value - step;
               if (this.range.value > this.range.max || this.range.value < 0) {
                 this.resetRangeInputData();
                 this.pause();
                 this.fastBackwardForward(-1);
               } else {
                 this.setCurrentDateTime(status);
                 waiting = true;
                 await this.getTimeLayer();
                 waiting = false;
               }
             } catch(err){
               this.pause();
             }
           }
          }, 1000);
          this.setStatus(status);
        } else this.pause()
      },
      /**
       * Pause methos stop to run
       */
      pause(){
        clearInterval(this.intervalEventHandler);
        this.intervalEventHandler = null;
        this.setStatus();
      },
      /**
       * Method to go step value unit forward or backward
       * @param direction
       */
      stepBackwardForward(direction){
        const step = this.getStepValue();
        this.range.value = direction === 1 ? this.range.value + step : this.range.value - step;
        this.setCurrentDateTime(direction);
        this.getTimeLayer()
      },
      /**
       * Method to go to end (forward) or begin (backward) of date range
       * @param direction
       */
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
      },
      /**
       * Method to show raster chart
       */
      showRasterLayerCharts(){
        this.showCharts = !this.showCharts;
        this.showCharts ? this.resetTimeLayer() : this.initLayerTimeseries();
        service.chartsInteraction({
          active: this.showCharts,
          layer: this.layer
        })
      }
    },
    watch: {
      /**
       * Listen change layer on selection
       * @param new_index_layer
       * @param old_index_layer
       */
      current_layer_index(new_index_layer, old_index_layer){
        const previousLayer = this.layers[old_index_layer];
        if (previousLayer.timed) {
          this.resetTimeLayer(previousLayer);
          previousLayer.timed = false;
        }
        this.initLayerTimeseries();
      },
      /**
       * Listener of open close panel
       * @param bool
       */
      'panel.open'(bool){
        if (bool) this.initLayerTimeseries();
        else this.resetTimeLayer()
      },
      /**
       * Check is range between start date and end date is valid range
       * @param bool
       */
      validRangeDates(bool){
        !bool && this.changeStartDateTime(this.layer.start_date);
      }
    },
    created() {
      this.intervalEventHandler = null;
    },
    async mounted(){},
    beforeDestroy(){
      service.clear();
    }
  }
};
