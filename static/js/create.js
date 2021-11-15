/* global Vue VeeValidate bchaddr */
async function init() {
  let data = {
    languages: {},
    languageTap: 0,
    modal: false,
    mounted: true,
    error: false,
    validate: {
      url: {
        regex:
          /^(?:(?:(?:https?):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})).?)(?::\d{2,5})?(?:[/?#]\S*)?$/i,
        required: true,
      },
      require: {
        required: true,
      },
      goal: {
        required: true,
        between: {
          min: 0.0001,
          max: 1e999,
        },
      },
      rangeDate: {
        required: true,
        afterDate: {
          ref: "start-date",
        },
      },
      cashAddress: {
        required: true,
        cashAddress: true,
      },
    },
    campaign: {
      title: "",
      track: {
        name: "",
        url: "",
      },
      recipients: [],
      date: {
        start: new Date().toISOString().split("T")[0],
        end: "",
      },
      abstract: "",
      social_media: false,
    },
  };

  let methods = {
    activeLanguage(index) {
      this.languageTap = index;
    },
    validateForm() {
      let formValid = true;
      for (let field in this.fields) {
        if (!this.fields[field].valid) {
          formValid = false;
        }
      }
      if (formValid) {
        this.$refs.form.submit();
      } else {
        this.$validator.validate();
        this.error = true;
      }
    },
    addRecipient() {
      let recipients = this.campaign.recipients;
      recipients.push({
        goal: 0,
        image_url: "",
        name: "",
        website: "",
        address: "",
      });
      this.campaign.recipients = recipients;
    },
    isValidAddress(address) {
      let isValidAddress = bchaddr.isValidAddress(address);
      return isValidAddress && !bchaddr.isLegacyAddress(address);
    },
  };

  Vue.use(VeeValidate, {
    classes: true,
    classNames: {
      valid: "",
      invalid: "border-danger",
    },
  });

  VeeValidate.Validator.extend("cashAddress", {
    getMessage: (title) => "The " + title + " is not correct.",
    validate(address) {
      let isValidAddress = bchaddr.isValidAddress(address);
      return isValidAddress && !bchaddr.isLegacyAddress(address);
    },
  });

  VeeValidate.Validator.extend("afterDate", {
    getMessage: () => "The date range is not correct.",
    validate(date, arg) {
      if(date) {
        let startElm = window.vue.$refs[arg.ref];
        let startDate = new Date(startElm.value);
        let endDate = new Date(date);
        return startDate < endDate;
      }
      return false;
    },
  });

  let app = new Vue({
    el: "#app",
    async mounted() {
      this.addRecipient();
      let req = await fetch("/static/ui/languages.json");
      let languages = await req.json();

      /* upper key languages */
      let result = {};
      for (let key in languages) {
        result[key.toUpperCase()] = languages[key];
      }
      this.languages = result;

      this.mounted = false;
    },
    data,
    methods,
  });

  window.vue = app;
}

init();
