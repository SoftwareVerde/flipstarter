/* global Vue VeeValidate EasyMDE marked bchaddr */
async function init() {
  const data = {
    languages: {},
    languageTap: 0,
    modal: false,
    mounted: true,
    error: false,
    socialPreview: "",
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
          max: 1e999, // eslint-disable-line
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
      default_language: "EN",
    },
  };

  const methods = {
    activeLanguage(index) {
      this.languageTap = index;
    },
    async validateForm() {
      const formValid = await this.$validator.validate();

      if (formValid) {
        this.$refs.form.submit();
      } else {
        this.error = true;
      }
    },
    addRecipient() {
      const recipients = this.campaign.recipients;
      recipients.push({
        goal: 0,
        image_url: "",
        avatar_image: "",
        name: "",
        website: "",
        address: "",
      });
      this.campaign.recipients = recipients;
    },
    isValidAddress(address) {
      const isValidAddress = bchaddr.isValidAddress(address);
      return isValidAddress && !bchaddr.isLegacyAddress(address);
    },
    changeMainLanguage(event, lang) {
      if(event.target.checked) {
        this.campaign.default_language = lang;
      }else {
        // by default we set english default language
        this.campaign.default_language = "EN";
      }
    },
    changeSocialPreview($event) {
      //
      const file = $event.target.files[0];

      //
      this.socialPreview = URL.createObjectURL(file);
    },
    removeSocialPreview() {
      // Remove file from file input
      this.$refs.socialPreviewInput.value = "";

      // Remove image from app
      this.socialPreview = "";
    }
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
      const isValidAddress = bchaddr.isValidAddress(address);
      return isValidAddress && !bchaddr.isLegacyAddress(address);
    },
  });

  VeeValidate.Validator.extend("afterDate", {
    getMessage: () => "The date range is not correct.",
    validate(date, arg) {
      if(date) {
        const startElm = window.vue.$refs[arg.ref];
        const startDate = new Date(startElm.value);
        const endDate = new Date(date);
        return startDate < endDate;
      }
      return false;
    },
  });

  const app = new Vue({
    el: "#app",
    async mounted() {
      this.addRecipient();
      const req = await fetch("/static/ui/languages.json");
      const languages = await req.json();

      /* upper key languages */
      for (const key in languages) {
        languages[key].abstract = "";
        languages[key].proposal = "";
        this.$set(this.languages, key.toUpperCase(), languages[key]);
      }

      this.mounted = false;
    },
    data,
    methods,
    directives: {
      easymde: {
        inserted: function (el) {
          const easyMDE = new EasyMDE({
            element: el,
            previewRender: (plainText) => {
              return `<div class="markdown-body">${marked.parse(plainText)}</div>`;
            },
            showIcons: ["code", "table"],
          });

          if(el.dataset.rtl) {
            easyMDE.codemirror.setOption("direction", "rtl");
          }

          //
          easyMDE.codemirror.on("change", () => {
            el.value = easyMDE.value();
            // run event input to use it in v-model
            // https://v2.vuejs.org/v2/guide/components.html#Using-v-model-on-Components
            el.dispatchEvent(new Event("input"));
          });
        },
      },
    },
  });

  window.vue = app;
}

init();
