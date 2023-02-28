import {STEP_UNITS} from "../../constant";
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
        step: layers[0].options.step,
        /**@TODO**/
        start_date: layers[0].start_date,
        end_date: layers[0].end_date,
        stepunitmultiplier: layers[0].options.stepunitmultiplier,
        /** @TODO **/
        format: 'YYYY-MM-DD HH:mm:ss',
        min_date: layers[0].start_date,
        max_date: layers[0].end_date,
        step_units: STEP_UNITS,
        current_step_unit: layers[0].options.stepunit,
        change_step_unit: false,
        current_step_unit_label: STEP_UNITS.find(step_unit => step_unit.moment === layers[0].options.stepunit).label,
        range: {
          value:0,
          min:0,
          max:0
        },
        changed_layer: false,
        current_layers_index: layers.map((_,index) => index.toString()),
        currentLayerDateTimeIndex: null,
        status: 0, // status  [1: play, -1: back, 0: pause]
      };
    },
    computed: {
      /**
       * set from disable property
       * @returns {boolean}
       */
      formDisabled(){
        return this.status !== 0;
      },
      /**
       * Array of selected layers
       * @returns {unknown[]}
       */
      select_layers(){
        this.changed_layer = true;
        setTimeout(()=> this.changed_layer = false);
        return this.current_layers_index.map(index => this.layers[index]);
      },
      /**
       * Property to disable run button
       * @returns {boolean|boolean}
       */
      disablerun(){
        return this.status === 0 && (!this.start_date || !this.end_date) ;
      },
      /**
       * check if dates are valid
       * @returns {boolean|boolean}
       */
      validRangeDates(){
        const {multiplier, step_unit} = this.getMultiplierAndStepUnit();
        return this.validateStartDateEndDate() && moment(this.end_date).diff(moment(this.start_date), step_unit) / multiplier >= this.getStepValue();
      },
    },
    methods:{
      /**
       * Method to initialize the form time series on open and close
       */
      initLayerTimeseries(){
        this.status = 0;
        this.setDates();
        this.min_date = this.start_date;
        this.currentLayerDateTimeIndex = this.start_date;
        this.range.value = 0;
        this.range.min = 0;
        this.resetRangeInputData();
        this.currentLayerDateTimeIndex && this.getTimeLayer();
        this.showCharts = false;
      },
      setDates(){
        if (this.select_layers.length > 1) {
          this.start_date = moment.min(this.select_layers.map(layer => layer.start_date));
          this.end_date = moment.max(this.select_layers.map(layer => layer.end_date));
        } else {
          const {start_date, end_date} = this.layers[this.current_layers_index[0]];
          this.start_date = start_date;
          this.end_date = end_date;
        }
      },
      /**
       * Method to reset range on change start date or end date time
       */
      resetRangeInputData(){
        // reset range value to 0
        this.range.value = 0;
        // set max range
        const {multiplier, step_unit} = this.getMultiplierAndStepUnit();
        this.range.max = this.validateStartDateEndDate() ?
          Number.parseInt(moment(this.end_date).diff(moment(this.start_date), step_unit) / multiplier * this.stepunitmultiplier) : 0;
      },
      /**
       * Method call when change range input step unit
       */
      changeRangeInputOnChangeStepUnit(){
        // reset range value to 0
        this.range.value = 0;
        // set max range
        const {multiplier, step_unit} = this.getMultiplierAndStepUnit();
        this.range.max = this.validateStartDateEndDate() ?
          Number.parseInt(moment(this.end_date).diff(moment(this.start_date), step_unit) / multiplier * this.stepunitmultiplier) : 0;
      },
      /*
        Method to extract step unit and eventually multiply factor (10, 100) in case es: decade e centrury for moment purpose
       */
      getMultiplierAndStepUnit(){
        return service.getMultiplierAndStepUnit(this.current_step_unit);
      },
      /**
       * Reset time layers to original map layers no filter by time or band
       * @param layers
       * @returns {Promise<void>}
       */
      async resetTimeLayer(layers=this.select_layers){
        this.pause();
        await service.resetTimeLayer(layers);
        layers.forEach(layer => layer.timed = false);
      },
      /**
       * Method to call server request image
       * @returns {Promise<void>}
       */
      async getTimeLayer() {
        await this.$nextTick();
        try {
          await service.getTimeLayer({
            layers: this.select_layers,
            step: this.step,
            date: this.currentLayerDateTimeIndex,
            end_date : this.end_date,
            stepunit: this.current_step_unit
          });
        } catch(err){
        }
        this.select_layers.forEach(layer => layer.timed = true);
      },
      /**
       * In case of change step
       * @param value
       * @returns {Promise<void>}
       */
      async changeRangeStep({value}){
        this.range.value = 1*value;
        const {mutltiplier, step_unit} = this.getMultiplierAndStepUnit();
        this.currentLayerDateTimeIndex = moment(this.start_date).add(this.range.value * mutltiplier, step_unit);
        await this.getTimeLayer()
      },
      /**
       * Listener method called when start date is changed
       * @param datetime
       */
      changeStartDateTime(datetime=null){
        datetime = moment(datetime).isValid() ? datetime : null;
        this.start_date = datetime;
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
        this.end_date = datetime;
        // reset range input
        this.resetRangeInputData();
      },
      /**
       *
       * @returns {boolean}
       */
      validateStartDateEndDate(){
        let arevalidstartenddate = false;
        if (this.start_date && this.end_date){
          arevalidstartenddate = moment(this.start_date).isValid() &&
            moment(this.end_date).isValid();
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
        const step = 1*this.getStepValue();
        const {multiplier, step_unit} = this.getMultiplierAndStepUnit();
        this.currentLayerDateTimeIndex = moment(this.currentLayerDateTimeIndex)[status === 1 ? 'add' : 'subtract'](step * multiplier, step_unit);
      },
      /**
       * Method to calculate step valued based on current input step value and possible multipliere sted (es. decde, centuries)
       * @returns {number}
       */
      getStepValue(){
        return 1*this.step*this.stepunitmultiplier;
      },
      /**
       * Play method (forward or backward)
       * status: 1 (forward) -1 (backward)
       */
      run(status){
        if (this.status !== status) {
          // used to wait util the image request to layers is loaded
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
                 try {
                   await this.getTimeLayer();
                 } catch(err){console.log(err)}
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
       * Pause methods stop to run
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
          this.currentLayerDateTimeIndex = this.end_date;
          this.getTimeLayer();
        } else {
          this.range.value = this.range.min;
          this.currentLayerDateTimeIndex = this.start_date;
          this.getTimeLayer();
        }
      },
      /**
       * Method to remove clear x symbol to remove
       * one layer from multiple select. Work with at least one layer
       */
      hideSingleLayerSelectionClear(){
        $(this.$refs['select-layers'])
          .siblings('.select2-container')
          .find('.select2-selection__choice__remove').hide();
      }
    },
    watch: {
      /**
       * @since v3.5 add step watch
       */
      step(){
        this.getTimeLayer();
      },
      /**
       * handler when current step unit is change
       */
      current_step_unit: {
        async handler(step_unit){
          // set true to change
          this.change_step_unit = true;
          this.select_layers.forEach(layer => layer.options.stepunit = step_unit);
          this.current_step_unit_label = STEP_UNITS.find(_step_unit => _step_unit.moment === step_unit).label;
          this.initLayerTimeseries();
          await this.$nextTick();
          // set false to see changed translation of label
          this.change_step_unit = false;
        },
        immediate: false
      },
      current_layers_index: {
        immediate: false,
        async handler(new_index_layers, old_index_layers){
        /**
         * check if try to remove selected layer
         */
          await this.$nextTick();
          new_index_layers.length === 1 && this.hideSingleLayerSelectionClear();
          const previousLayers = old_index_layers.map(index => this.layers[index]);
          this.resetTimeLayer(previousLayers);
          this.initLayerTimeseries();
        }
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
        !bool && this.changeStartDateTime(this.start_date);
      }
    },
    created() {
      this.intervalEventHandler = null;
    },
    async mounted(){
      /**
       * method to disable (add g3w-disable class) to option select
       * for avoid to haven't no layer selected. At least need to has one layer to work with
       */
      this.disabledSingleLayerClickUnSelect = ()=> {
        setTimeout(() => {
          if (this.select_layers.length === 1)
            $('.select2-results__options li[aria-selected="true"]').addClass('g3w-disabled');
          else $('.select2-results__options li').removeClass('g3w-disabled');
        })
      };
      await this.$nextTick();
      /**
       * listen one sidebar panel plugin to register event select2:open
       */
      service.onafter('open', ()=> {
        $('#timeserieslayer').on('select2:open', this.disabledSingleLayerClickUnSelect);
      });
      /**
       * listen close sidebar plugin to unregister select2:open
       */
      service.onafter('close', ()=> {
        $('#timeserieslayer').off('select2:open', this.disabledSingleLayerClickUnSelect);
      })
    },
    beforeDestroy(){
      service.clear();
    }
  }
};
