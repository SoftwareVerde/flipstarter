const shared = require("./shared.js");

// Load the moment library to better manage time.
const moment = require("moment");
// set this page languages
const page_language = document.querySelector("html").lang;

// Load languages.json
const languages = require("./static/ui/languages.json");
// Load the locales we will use.
for(let lang in languages) {
  require("moment/locale/" + languages[lang].momentLocales + ".js");
}
// Load the marked library to parse markdown text,
const marked = require("marked");

// Load and initialize the DOMPurify library to ensure safety for parsed markdown.
const createDOMPurify = require("dompurify");
const DOMPurify = createDOMPurify(window);

// Load the celebratory confetti library.
const confetti = require("canvas-confetti").default;

//

const CAMPAIGN_ID = Number(window.location.hash.slice(1) || 1);

//
class flipstarter {
  constructor() {
    // Set languages in this class
    this.languages = languages;

    // Load the initial translation files in the background.
    this.loadTranslation(page_language);

    // Once the page is loaded, initialize flipstarter.
    window.addEventListener("load", this.initialize.bind(this));
  }

  async initialize() {
    const _ = this;

    // Wait for translations to finish loading..
    await this.translationLoadingPromise;

    // Wait for currency rates to be loaded..
    await this.loadCurrencyRates();

    // Fetch the campaign information from the backend.
    let response = await fetch(`/campaign/${CAMPAIGN_ID}`);
    let fundraiser = await response.json();

    this.campaign = fundraiser.campaign;
    this.campaign.recipients = fundraiser.recipients;
    this.campaign.contributions = {};

    // NOTE: The contributions object is a map, not an array.
    for (let i = 0; i < fundraiser.contributions.length; i += 1) {
        const contribution = fundraiser.contributions[i];
        this.campaign.contributions[contribution.contribution_id] = contribution;
    }

    // Make object with support languages in this campaign
    const available_languages = {};

    // Add languages data to campaign languages
    this.campaign.available_languages.split(",").forEach(
      (lang) => {
        available_languages[lang] = this.languages[lang];
      }
    );

    // NOTE: currencyValue is only available after setting the page's locale...
    const rootPage = location.pathname === "/";
    if (rootPage && localStorage.getItem("language")) {
      await this.updateTranslation(localStorage.getItem("language"));
    }
    else if (rootPage && available_languages[navigator.language.slice(0, 2)]) {
      await this.updateTranslation(navigator.language.slice(0, 2));
    }
    else {
      await this.updateTranslation(page_language);
    }

    // Apply website translation (or load website content).
    for (const lang in available_languages) {
      let { buttonColor } = available_languages[lang];
      document.getElementById("languageList").innerHTML += `
      <li>
        <a
        class="btn-floating"
        style="text-align: center; background: ${buttonColor || "#7b1fa2"};"
        id="translate-${lang}">
          ${lang}
        </a>
      </li>
      `;
    }
    for (const lang in available_languages) {
      document
        .getElementById("translate-" + lang)
        .addEventListener(
          "click",
          () => {
            localStorage.setItem("language", lang);
            this.updateTranslation.bind(
              this,
              lang,
              available_languages[lang].name
            )();
          }
        );
    }

    // Attach event handlers.
    const donationSlider = document.getElementById("donationSlider");
    const donationDollarInput = document.getElementById("donationDollar");
    const donationBchInput = document.getElementById("donationBch");

    // Set the slider min/max values...
    (function() {
        const remainingValue = _.calculateMinerFee() + (_.countRequestedSatoshis(_.campaign.recipients) - _.countCommittedSatoshis(_.campaign.contributions));
        const minimumDonation = shared.calculateMinimumDonation(_.campaign.contributions, remainingValue);

        donationSlider.setAttribute("min", minimumDonation);
        donationSlider.setAttribute("max", remainingValue);
    })();

    const synchronizeInputs = function(triggeringInput) {
        let satoshis = 0;
        if (triggeringInput == donationDollarInput) {
            satoshis = ((triggeringInput.value / _.currencyValue) * shared.SATS_PER_BCH).toFixed();
        }
        else if (triggeringInput == donationBchInput) {
            satoshis = (triggeringInput.value * shared.SATS_PER_BCH).toFixed();
        }
        else { // (triggeringInput == donationSlider)
            satoshis = triggeringInput.value;
        }

        if (triggeringInput != donationSlider) {
            // Update the donation slider...
            donationSlider.value = satoshis;
        }

        if (triggeringInput != donationDollarInput) {
            const dollars = ((satoshis / shared.SATS_PER_BCH) * _.currencyValue).toFixed(2);
            // Update the dollar input...
            donationDollarInput.value = dollars;
        }

        if (triggeringInput != donationBchInput) {
            // Update the BCH input...
            donationBchInput.value = (satoshis / shared.SATS_PER_BCH).toFixed(Math.log10(shared.SATS_PER_BCH));
        }

        // Trigger an input event to the slider since it is the "source of truth"...
        if (triggeringInput != donationSlider) {
            donationSlider.dispatchEvent(new Event("input"));
        }
    };

    [donationDollarInput, donationBchInput].forEach(function(input, index) {
        input.addEventListener("focus", function(event) {
            input.select();
        });
        input.addEventListener("change", function(event) {
            synchronizeInputs(input);
        });
    });
    donationSlider.addEventListener("input", function(event) {
        synchronizeInputs(donationSlider);
    });

    donationSlider.addEventListener("input", this.updateContributionInput.bind(this));

    const donateButton = document.getElementById("donateButton");
    donateButton.addEventListener("click", this.bindWallet);
    donateButton.addEventListener("click", this.toggleDonationSection.bind(this));

    document
      .getElementById("template")
      .addEventListener("click", this.copyTemplate.bind(this));
    document
      .getElementById("copyTemplateButton")
      .addEventListener("click", this.copyTemplate.bind(this));
    document
      .getElementById("commitTransaction")
      .addEventListener("click", this.parseCommitment.bind(this));

    //
    document
      .getElementById("contributionName")
      .addEventListener("change", this.updateTemplate.bind(this));
    document
      .getElementById("contributionName")
      .addEventListener("keyup", this.updateTemplate.bind(this));
    document
      .getElementById("contributionComment")
      .addEventListener("change", this.updateTemplate.bind(this));
    document
      .getElementById("contributionComment")
      .addEventListener("keyup", this.updateTemplate.bind(this));

    //
    document
      .getElementById("commitment")
      .addEventListener("change", this.updateCommitButton.bind(this));
    document
      .getElementById("commitment")
      .addEventListener("keyup", this.updateCommitButton.bind(this));

    // Update the campaign status and timer.
    this.updateTimerPresentation();

    //
    this.updateRecipientCount(this.campaign.recipients.length);
    this.updateCampaignProgressCounter();

    // Add track delivery url
    let track_delivery = document.querySelector("#track-delivery");
    track_delivery.textContent = this.campaign.track_name;
    track_delivery.href = this.campaign.track_url;

    // Add each recipient to the fundraiser.
    for (const recipientIndex in fundraiser.recipients) {
      const recipientAmount = Number(
        fundraiser.recipients[recipientIndex].recipient_satoshis / shared.SATS_PER_BCH
      ).toLocaleString();
      const recipientName = fundraiser.recipients[recipientIndex].user_alias;
      const recipientURL = fundraiser.recipients[recipientIndex].user_url;

      document.getElementById(
        "recipientList"
      ).innerHTML += `<li class='col s6 m6 l12'>
				<a href='${recipientURL}' target="_blank">
					<img src='${fundraiser.recipients[recipientIndex].user_image}' alt='${recipientName}' />
					<span>
						<b>${recipientName}</b>
						<i>${recipientAmount} BCH</i>
					</span>
				</a>
			</li>`;
    }

    // Update the input to reflect the current langauge.
    document.getElementById("donationSlider").dispatchEvent(new Event("input"));

    // Initialize the language selector.
    {
      // Fetch the DOM element.
      const languageSelector = document.getElementById("languageSelector");

      if(this.campaign.available_languages.split(",").length === 1) {
        languageSelector.style.display = "none";
      }

      // Create a function to show the language selector options.
      const showLanguageOptions = function () {
        languageSelector.className = "fixed-action-btn active";
      };

      // Create a function to hide the language selector options.
      const hideLanguageOptions = function () {
        languageSelector.className = "fixed-action-btn";
      };

      // Add mouse over and mouse out events.
      languageSelector.addEventListener("mouseover", showLanguageOptions);
      languageSelector.addEventListener("mouseout", hideLanguageOptions);
    }

    //
    const activateInputField = function (event) {
      const targetName = event.target.id;
      const label = document.querySelector(`label[for=${targetName}]`);

      if (document.activeElement === event.target || event.target.value > "") {
        label.className = "active";
      } else {
        label.className = "";
      }
    };

    //
    const contributionNameInput = document.getElementById("contributionName");
    const contributionCommentInput = document.getElementById(
      "contributionComment"
    );

    //
    contributionNameInput.addEventListener("focus", activateInputField);
    contributionNameInput.addEventListener("blur", activateInputField);
    contributionCommentInput.addEventListener("focus", activateInputField);
    contributionCommentInput.addEventListener("blur", activateInputField);

    const parseContributionEvents = function (event) {
      const eventData = JSON.parse(event.data);

      // Special case: fullfillment.
      if (eventData.fullfillment_transaction) {
        // Only trigger celebrations for the campaign we're actively working on.
        if (eventData.campaign_id === CAMPAIGN_ID) {
          // Trigger celebration.
          celebration(0.11);

          // Update timer and status message to indicate successful fullfillment.
          this.showFullfilledStatus(eventData.fullfillment_transaction);
        }
      } else {
        // If the data refers to the current campaign...
        if (eventData.campaign_id === CAMPAIGN_ID) {
          // .. and the data has been revoked before fullfillment..
          if (
            eventData.revocation_id &&
            (!this.campaign.fullfillment_timestamp ||
              eventData.revocation_timestamp <
                this.campaign.fullfillment_timestamp)
          ) {
            // .. remove it if we know it from earlier
            if (
              typeof this.campaign.contributions[eventData.contribution_id] !==
              "undefined"
            ) {
              // Delete it locally.
              delete this.campaign.contributions[eventData.contribution_id];
            }
          } else {
            // .. store the contribution locally.
            this.campaign.contributions[eventData.contribution_id] = eventData;
          }

          // .. update the contribution list.
          this.updateContributionList();

          // .. update the progress bar and contribution amount
          document.getElementById("campaignProgressBar").style.width =
            (
              (100 * this.countCommittedSatoshis(this.campaign.contributions)) /
              this.countRequestedSatoshis(this.campaign.recipients)
            ).toFixed(2) + "%";
          document.getElementById(
            "compaignContributionAmount"
          ).textContent = DOMPurify.sanitize(
            (
              this.countCommittedSatoshis(this.campaign.contributions) /
              shared.SATS_PER_BCH
            ).toFixed(2)
          );

          // .. move the current contribution bar accordingly.
          document.getElementById("campaignContributionBar").style.left =
            (
              100 *
              (this.countCommittedSatoshis(this.campaign.contributions) /
                this.countRequestedSatoshis(this.campaign.recipients))
            ).toFixed(2) + "%";
        }
      }
    };

    //
    this.eventSource = new EventSource("/events/");
    this.eventSource.addEventListener(
      "message",
      parseContributionEvents.bind(this)
    );

    // Update the timer every second.
    setInterval(this.updateExpiration.bind(this), 1000);
  }

  showFullfilledStatus(fullfillment_transaction) {
    // Mark the campaign as fullfilled which prevents form entry.
    this.updateStatus(
      "fullfilled",
      "statusFullfilled",
      this.translation["statusFullfilled"]
    );

    // Add interactive content to the status message.
    let sharingActions = "";
    sharingActions +=
      "<div id=\"sharingActions\" style=\"font-size: 1rem; opacity: 0.66;\">";
    if (typeof navigator.share === "function") {
      sharingActions += `<a id='shareAction' data-string='shareAction'><i class="icon-share"></i>${this.translation["shareAction"]}</a>`;
    }
    sharingActions += `<a id='celebrateAction' data-string='celebrateAction'><i class="icon-nightlife"></i>${this.translation["celebrateAction"]}</a>`;
    sharingActions += `<a id='fullfillmentLink' target='_blank' href='https://blockchair.com/bitcoin-cash/transaction/${fullfillment_transaction}'><i class="icon-label"></i>${fullfillment_transaction}</a>`;
    sharingActions += "</div>";
    document.getElementById("donateStatus").innerHTML += sharingActions;

    // Make the celebrate action clickable to trigger celebration effects.
    document
      .getElementById("celebrateAction")
      .addEventListener("click", celebration.bind(this, 0.75));

    // Make the share action clickabe to trigger sharing of the current url.
    if (typeof navigator.share === "function") {
      const shareUrl = function (url) {
        navigator.share({
          title: this.translation["shareTitle"],
          text: this.translation["shareText"],
          url: url,
        });
      };

      document
        .getElementById("shareAction")
        .addEventListener("click", shareUrl.bind(this, window.location.href));
    }

    // Change expiration to fullfillment counter.
    const timerElement = document.getElementById("timerLabel");
    timerElement.setAttribute("data-string", "fullfilledLabel");
    timerElement.textContent = this.translation["fullfilledLabel"];
  }

  updateTimerPresentation() {
    // If this campaign has already been fullfilled..
    if (this.campaign.fullfillment_timestamp > 0) {
      this.showFullfilledStatus(this.campaign.fullfillment_transaction);
    }
    // If this campaign has not yet started.
    else if (this.campaign.starts > moment().unix()) {
      // Mark the campaign as pending, which prevents form entry.
      this.updateStatus(
        null,
        "statusPending",
        this.translation["statusPending"]
      );

      // Change expiration to pending counter.
      const timerElement = document.getElementById("timerLabel");
      timerElement.setAttribute("data-string", "pendingLabel");
      timerElement.textContent = this.translation["pendingLabel"];

      // Automatically update campaign status 500ms after campaign starts.
      setTimeout(
        this.updateTimerPresentation.bind(this),
        (this.campaign.starts - moment().unix()) * 1000 + 500
      );
    }
    // If this campaign has already expired.
    else if (this.campaign.expires < moment().unix()) {
      // Change expiration to already expired counter.
      const timerElement = document.getElementById("timerLabel");
      timerElement.setAttribute("data-string", "expiredLabel");
      timerElement.textContent = this.translation["expiredLabel"];

      // Mark the campaign as expired, which prevents form entry.
      this.updateStatus(
        null,
        "statusExpired",
        this.translation["statusExpired"]
      );
    } else if (typeof this.campaign.active === "undefined") {
      // Mark the campaign as active.
      this.campaign.active = true;

      // Change expiration to active campaign counter..
      const timerElement = document.getElementById("timerLabel");
      timerElement.setAttribute("data-string", "expiresLabel");
      timerElement.textContent = this.translation["expiresLabel"];

      // Hide the status message.
      this.hideStatus();

      // Show the campaign input form.
      document.getElementById("donateForm").classList.remove("hidden");

      // Automatically update campaign status 500ms after campaign ends.
      setTimeout(
        this.updateTimerPresentation.bind(this),
        (this.campaign.expires - moment().unix()) * 1000 + 500
      );
    }
  }

  countCommittedSatoshis(contributions) {
    let committedSatoshis = 0;

    for (const contributionIndex in contributions) {
      const contribution = contributions[contributionIndex];

      if (typeof contribution.satoshis == "undefined") { continue; }
      if (contribution.revocation_id != null) { continue; }

      committedSatoshis += contributions[contributionIndex].satoshis;
    }

    return committedSatoshis;
  }

  countRequestedSatoshis(recipients) {
    let requestedSatoshis = 0;

    for (const recipientIndex in recipients) {
      requestedSatoshis += Number(
        recipients[recipientIndex].recipient_satoshis
      );
    }

    return requestedSatoshis;
  }

  calculateMinerFee() {
    // Aim for two satoshis per byte to get a clear margin for error and priority on fullfillment.
    const TARGET_FEE_RATE = 2;

    // Define byte weights for different transaction parts.
    const TRANSACTION_METADATA_BYTES = 10;
    const AVERAGE_BYTE_PER_RECIPIENT = 69;
    const AVERAGE_BYTE_PER_CONTRIBUTION = 296;

    // Get the number of recipients and contributions.
    const RECIPIENT_COUNT = this.campaign.recipients.length;
    const CONTRIBUTION_COUNT = Object.keys(this.campaign.contributions).length;

    // Calculate the miner fee necessary to cover a fullfillment transaction with the next (+1) contribution.
    const MINER_FEE =
      (TRANSACTION_METADATA_BYTES +
        AVERAGE_BYTE_PER_RECIPIENT * RECIPIENT_COUNT +
        AVERAGE_BYTE_PER_CONTRIBUTION * (CONTRIBUTION_COUNT + 1)) *
      TARGET_FEE_RATE;

    // Return the calculated miner fee.
    return MINER_FEE;
  }

  async updateContributionList() {
    const contributionListElement = document.getElementById("contributionList");

    // Empty the contribution list.
    contributionListElement.textContent = "";

    // Update the contribution counter.
    document.getElementById(
      "campaignContributorCount"
    ).textContent = Object.keys(this.campaign.contributions).length;

    if (Object.keys(this.campaign.contributions).length === 0) {
      // Get the empty message template node.
      const template = document.getElementById("emptyContributionMessage")
        .content.firstElementChild;

      // Import a copy of the template.
      const contributionMessage = document.importNode(template, true);

      // Add the copy to the contribution list.
      contributionListElement.appendChild(contributionMessage);
    } else {
      const contributionArray = Object.values(this.campaign.contributions);
      const sortedContributions = contributionArray.sort(
        (a, b) => Number(b.satoshis) - Number(a.satoshis)
      );
      for (const contributionIndex in sortedContributions) {
        //
        const contribution = sortedContributions[contributionIndex];

        this.addContributionToList(
          contribution.user_alias,
          contribution.contribution_comment,
          contribution.satoshis,
          contribution.satoshis /
            this.countRequestedSatoshis(this.campaign.recipients)
        );
      }
    }
  }

  async loadCurrencyRates() {
    try {
      // request the currency rates.
      const currencyRatesResponse = fetch("https://bitpay.com/api/rates/BCH");

      // Store the current rates.
      this.currencyRates = await (await currencyRatesResponse).json();
    } catch (error) {
      // request the currency rates.
      const currencyRatesResponse = fetch(
        "https://markets.api.bitcoin.com/rates?c=BCH"
      );

      // Store the current rates.
      this.currencyRates = await (await currencyRatesResponse).json();
    }
  }

  async updateTranslation(locale = "en") {
    // Hide the language selector.
    document.getElementById("languageSelector").className = "fixed-action-btn";

    // Set url from locale
    let url = "/" + locale;


    // Edit url state
    history.pushState({}, "", url);

    // Load the new translation.
    this.loadTranslation(locale);

    // Wait for translations to finish loading..
    await this.translationLoadingPromise;

    // Update the rendered translation.
    await this.applyTranslation(locale);

    // Update the input to reflect the current langauge.
    document.getElementById("donationSlider").dispatchEvent(new Event("input"));
  }

  async loadTranslation(locale = "en") {
    // Set default language.
    let languageCode = "en";

    // Make a list of availabe languages.
    const availableLanguages = {};

    Object.keys(this.languages).forEach((lang) => {
      availableLanguages[lang] = this.languages[lang];
    });
    // If the requested language has a translation..
    if (typeof availableLanguages[locale] !== "undefined") {
      // Overwrite the default language with the users langauge code.
      languageCode = locale;
    }

    // Initiate all requests in parallell.
    this.translationContentPromises = {
      interfaceResponse: fetch(`/static/ui/${languageCode}/interface.json`),
      introResponse: fetch(
        `/static/campaigns/${CAMPAIGN_ID}/${languageCode}/abstract.md`
      ),
      detailResponse: fetch(
        `/static/campaigns/${CAMPAIGN_ID}/${languageCode}/proposal.md`
      ),
    };

    // Wait for all requests to complete..
    this.translationLoadingPromise = Promise.all(
      Object.values(this.translationContentPromises)
    );
  }

  async applyTranslation(locale = "en") {
    // Set default language.
    let languageCode = "en";
    let languageCurrencyCode = "USD";

    // Make a list of supported translations.
    const languages = {};

    Object.keys(this.languages).forEach((lang) => {
      languages[lang] = this.languages[lang].name;
    });
    // Make a list of moment locales to use for each language.
    const momentLocales = {};

    Object.keys(this.languages).forEach((lang) => {
      momentLocales[lang] = this.languages[lang].momentLocales;
    });
    // Make a list of currencies to use for each language.
    const currencies = {};
    Object.keys(this.languages).forEach((lang) => {
      currencies[lang] = this.languages[lang].currency;
    });
    // If the requested language has a translation..
    if (typeof languages[locale] !== "undefined") {
      // Overwrite the default language.
      languageCode = locale;
      languageCurrencyCode = currencies[locale];
    }

    // Update the HTML language reference.
    document.getElementsByTagName("html")[0].setAttribute("lang", languageCode);

    // Store the current code and exchange rate.
    this.currencyCode = languageCurrencyCode;
    this.currencyValue = this.currencyRates.find(
      (obj) => obj.code === currencies[languageCode]
    ).rate;

    // Parse the campaign translations.
    const campaignIntro = await (
      await this.translationContentPromises.introResponse
    ).text();
    const campaignDetail = await (
      await this.translationContentPromises.detailResponse
    ).text();

    // Print out the campaign texts.
    document.getElementById("campaignAbstract").innerHTML = DOMPurify.sanitize(
      marked(campaignIntro)
    );
    document.getElementById("campaignDetails").innerHTML = DOMPurify.sanitize(
      marked(campaignDetail)
    );

    // Parse the interface translation.
    this.translation = await (
      await this.translationContentPromises.interfaceResponse
    ).json();

    // Fetch all strings to be translated.
    const stringElements = document.body.querySelectorAll("*[data-string]");

    // For each element..
    for (const index in stringElements) {
      if (typeof stringElements[index] === "object") {
        // Get the translation string key.
        const key = stringElements[index].getAttribute("data-string");

        // TODO: Look up the translation from a translation table.
        const value = this.translation[key];

        // Print out the translated value.
        stringElements[index].textContent = value;
      }
    }

    // Fetch all placeholders to be translated.
    const placeholderElements = document.body.querySelectorAll(
      "*[data-placeholder]"
    );

    // For each element..
    for (const index in placeholderElements) {
      if (typeof placeholderElements[index] === "object") {
        // Get the translation string key.
        const key = placeholderElements[index].getAttribute("data-placeholder");

        // TODO: Look up the translation from a translation table.
        const value = this.translation[key];

        // Print out the translated value.
        placeholderElements[index].setAttribute("placeholder", value);
      }
    }

    // Fetch all templates to be translated.
    const templates = document.body.querySelectorAll("template");

    // For each template..
    for (const templateIndex in templates) {
      if (typeof templates[templateIndex].content !== "undefined") {
        // Fetch all elements to be translated.
        const templateElements = templates[
          templateIndex
        ].content.querySelectorAll("*[data-string]");

        for (const index in templateElements) {
          if (typeof templateElements[index] === "object") {
            // Get the translation string key.
            const key = templateElements[index].getAttribute("data-string");

            // TODO: Look up the translation from a translation table.
            const value = this.translation[key];

            // Print out the translated value.
            templateElements[index].textContent = value;
          }
        }
      }
    }

    // Change moment to use the new locale.
    moment.locale(momentLocales[languageCode]);
  }

  async copyTemplate() {
    // Disable the name and comment inputs.
    document.getElementById("contributionName").disabled = true;
    document.getElementById("contributionComment").disabled = true;

    // Locate the template input elements.
    const templateTextArea = document.getElementById("template");
    const templateButton = document.getElementById("copyTemplateButton");

    // Select the template text.
    templateTextArea.select();
    templateTextArea.setSelectionRange(0, 99999);

    // Copy the selection to the clipboard.
    document.execCommand("copy");

    // Deselect the text.
    templateTextArea.setSelectionRange(0, 0);

    // Notify user that the template has been copied by changing the button appearance..
    templateButton.textContent = "Done";
    templateButton.disabled = "disabled";
  }

  async unbindWallet() {
      const wallet = window.Wallet.instance;
      if (! wallet._isBound) { return; }

      window.clearInterval(wallet._isBound);
      wallet._isBound = null;

      const address = wallet.getAddress();
      window.webSocket.addConnectCallback(function() {
          window.webSocket.send(JSON.stringify({
              removeAddress: address
          }));
      });
  }

  async bindWallet() {
      const wallet = window.Wallet.instance;
      if (wallet._isBound) { return; }

      const donationSlider = document.getElementById("donationSlider");
      const aliasInput = document.getElementById("contributionName");
      const commentInput = document.getElementById("contributionComment");
      const commitmentInput = document.getElementById("commitment");

      const address = wallet.getAddress();

      window.webSocket.addConnectCallback(function() {
          window.webSocket.send(JSON.stringify({
              addAddress: address
          }));
      });

      window.webSocket.addMessageReceivedCallback(async function(message) {
          if (message.transaction) {
              const transaction = message.transaction;

              webSocket._transactions = webSocket._transactions || [];
              if (webSocket._transactions.indexOf(transaction) >= 0) { return; }

              const alias = aliasInput.value;
              const comment = commentInput.value;
              const amount = Number(donationSlider.value);

              const recipients = window.flipstarter.campaign.recipients;
              const pledge = wallet.createPledge(transaction, recipients, amount, alias, comment);

              commitmentInput.value = pledge;
              if (pledge) {
                  webSocket._transactions.push(transaction);
                  window.flipstarter.parseCommitment(function(result) {
                      if (! result) { return; }

                      const refundAddress = wallet.getRefundAddress(transaction);

                      const revokeTokenContainer = document.getElementById("revokeToken");
                      const refundAddressInput = revokeTokenContainer.querySelector(".refund-address");
                      const tokenHexContainer = revokeTokenContainer.querySelector(".transaction-hex");

                      const isValidAddress = function(addressString) {
                          return ((typeof libauth.decodeCashAddress(addressString)) !== "string")
                      };

                      refundAddressInput.onchange = function(event) {
                          const customRefundAddressString = refundAddressInput.value;
                          if (isValidAddress(customRefundAddressString)) {
                              refundAddressInput.classList.remove("invalid");
                              tokenHexContainer.textContent = wallet.createRefundTransaction(transaction, amount, customRefundAddressString);
                          }
                          else {
                              refundAddressInput.classList.add("invalid");
                          }
                      };

                      refundAddressInput.value = refundAddress;
                      tokenHexContainer.textContent = wallet.createRefundTransaction(transaction, amount, refundAddress);
                      revokeTokenContainer.classList.remove("hidden");

                      window.flipstarter.unbindWallet();
                  });
              }
          }
      });

      wallet._isBound = window.setInterval(function() {
          if (window.webSocket.readyState != window.webSocket.OPEN) { return; }

          window.webSocket.send(JSON.stringify({
              addAddress: address
          }));
      }, 2500);
  }

  async toggleDonationSection(visibility = null) {
    const donationSlider = document.getElementById("donationSlider");
    const aliasInput = document.getElementById("contributionName");
    const commentInput = document.getElementById("contributionComment");
    const commitmentInput = document.getElementById("commitment");

    // Bind WebWallet...
    (function() {
        const webWalletContainer = document.getElementById("web-wallet");
        const wallet = window.Wallet.instance;

        const privateKeyWif = wallet.getPrivateKey();
        const cashAddress = wallet.getAddress();
        const amount = Number(donationSlider.value);
        const bchAmount = (amount / shared.SATS_PER_BCH).toFixed(8);
        const walletAddressImage = wallet.createQrCode(256, bchAmount);

        const walletAddressSpan = document.createElement("a");
        walletAddressSpan.setAttribute("href", cashAddress + "?amount=" + bchAmount);
        walletAddressSpan.textContent = cashAddress;

        const webWalletPrivateKeyContainer = webWalletContainer.querySelector(".private-key");
        webWalletPrivateKeyContainer.classList.add("hidden");
        webWalletPrivateKeyContainer.textContent = privateKeyWif;

        const webWalletPrivateKeyButton = webWalletContainer.querySelector(".private-key-button");
        webWalletPrivateKeyButton.onclick = function() {
            webWalletPrivateKeyContainer.classList.toggle("hidden");
        };

        const webWalletAddressContainer = webWalletContainer.querySelector(".address");
        while (webWalletAddressContainer.firstChild) {
            webWalletAddressContainer.firstChild.remove();
        }
        webWalletAddressContainer.appendChild(walletAddressImage);
        webWalletAddressContainer.appendChild(walletAddressSpan);
    })();

    const donateSection = document.getElementById("donateSection");

    if (visibility !== false && donateSection.classList.contains("hidden")) {
      donateSection.classList.remove("hidden");

      // Make name and comment enabled in case it was disabled as a result of an incomplete previous process.
      document.getElementById("contributionName").disabled = false;
      document.getElementById("contributionComment").disabled = false;

      // Disable the action button.
      document.getElementById("donateButton").disabled = true;
    }
    else {
      donateSection.classList.add("hidden");

      // Enable the action button.
      document.getElementById("donateButton").disabled = false;
    }
  }

  async updateCampaignProgressCounter() {
    document.getElementById(
      "campaignRequestAmount"
    ).textContent = DOMPurify.sanitize(
      (
        this.countRequestedSatoshis(this.campaign.recipients) / shared.SATS_PER_BCH
      ).toFixed(2)
    );
  }

  async updateExpiration() {
    // If the campaign has been fullfilled..
    if (this.campaign.fullfillment_timestamp > 0) {
      // Count from fullfillment..
      document.getElementById("campaignExpiration").textContent = moment().to(
        moment.unix(this.campaign.fullfillment_timestamp)
      );
    }
    // If the campaign has been not yet started..
    else if (this.campaign.starts > moment().unix()) {
      // Count from starting.
      document.getElementById("campaignExpiration").textContent = moment().to(
        moment.unix(this.campaign.starts)
      );
    } else {
      // Count from expiration.
      document.getElementById("campaignExpiration").textContent = moment().to(
        moment.unix(this.campaign.expires)
      );
    }
  }

  async updateRecipientCount(recipientCount) {
    document.getElementById(
      "campaignRecipientCount"
    ).textContent = recipientCount;
  }

  async updateCommitButton() {
    if (
      document.getElementById("commitment").value ===
      document.getElementById("template").value
    ) {
      document.getElementById("commitment").style.outline = "2px dotted red";
      document.getElementById("template").style.outline = "2px dotted red";

      // Keep the button disabled as this is not a valid pledge.
      document.getElementById("commitTransaction").disabled = true;
    } else {
      document.getElementById("commitment").style.outline = "none";
      document.getElementById("template").style.outline = "none";

      // Enable the button if there is content in the pledge textarea.
      document.getElementById("commitTransaction").disabled =
        document.getElementById("commitment").value === "";
    }
  }

  async updateTemplate() {
    // Locate the template input elements.
    const templateTextArea = document.getElementById("template");
    const templateButton = document.getElementById("copyTemplateButton");
    const title = document.getElementById("campaignTitle");

    // Display campaign title
    title.innerHTML = this.campaign.title;

    //
    templateButton.textContent = this.translation["copyButton"];
    templateButton.disabled = null;

    // Get the number of satoshis the user wants to donate.
    const satoshis = document
      .getElementById("donationAmount")
      .getAttribute("data-satoshis");

    // If the user wants to donate some satoshis..
    if (satoshis) {
      // Assemble the request object.
      let requestObject = {
        outputs: [],
        data: {
          alias: document.getElementById("contributionName").value,
          comment: document.getElementById("contributionComment").value,
        },
        donation: {
          amount: Number(satoshis),
        },
        expires: this.campaign.expires,
      };

      // For each recipient..
      for (const recipientIndex in this.campaign.recipients) {
        const outputValue = this.campaign.recipients[recipientIndex]
          .recipient_satoshis;
        const outputAddress = this.campaign.recipients[recipientIndex]
          .user_address;

        // Add the recipients outputs to the request.
        requestObject.outputs.push({
          value: outputValue,
          address: outputAddress,
        });
      }

      // Assemble an assurance request template.
      const templateString = shared.base64encode(JSON.stringify(requestObject));

      // Update the website template string.
      templateTextArea.textContent = templateString;
    } else {
      // Update the website template string.
      templateTextArea.textContent = "";
    }
  }

  async updateContributionInput(event) {
    let donationAmount;
    const requestedSatoshis = this.countRequestedSatoshis(
      this.campaign.recipients
    );
    const committedSatoshis = this.countCommittedSatoshis(
      this.campaign.contributions
    );

    // Hide donation section.
    this.toggleDonationSection(false);

    // Enable the action button.
    document.getElementById("donateButton").disabled = false;
    const donationSlider = document.getElementById("donationSlider");

    if (Number(donationSlider.value) <= 1) {
      // Reset metadata.
      document.getElementById("contributionName").value = "";
      document.getElementById("contributionComment").value = "";

      // Disable the action button.
      document.getElementById("donateButton").disabled = true;

      // Set amount to 0.
      donationAmount = 0;
    }
    else {
      donationAmount = Number(donationSlider.value);
    }

    const remainingValue = this.calculateMinerFee() + (this.countRequestedSatoshis(this.campaign.recipients) - this.countCommittedSatoshis(this.campaign.contributions));
    const willCompleteCampaign = (donationAmount >= remainingValue);

    if (willCompleteCampaign) {
      document.getElementById("donateText").textContent = this.translation["fullfillText"];
    }
    else {
      document.getElementById("donateText").textContent = this.translation["donateText"];
    }

    const contributionBar = document.getElementById("campaignContributionBar");
    contributionBar.style.left = (100 * (committedSatoshis / requestedSatoshis)).toFixed(2) + "%";
    contributionBar.style.width = (100 * donationAmount / requestedSatoshis).toFixed(2) + "%";

    const bchString = (donationAmount / shared.SATS_PER_BCH).toLocaleString();
    const dollarString = (this.currencyValue * (donationAmount / shared.SATS_PER_BCH)).toFixed(2);
    document.getElementById("donationAmount").textContent = bchString + " BCH (" + dollarString + " " + this.currencyCode + ")";

    //
    document.getElementById("donationAmount").setAttribute("data-satoshis", donationAmount);

    // Update the template text.
    this.updateTemplate();
  }

  /**
   *
   */
  async parseCommitment(callback) {
    //
    const base64text = document.getElementById("commitment").value;

    // Scope the commitment object to allow try-catch.
    let commitmentObject;

    try {
      // Attempt to decode the base64 contribution.
      commitmentObject = JSON.parse(shared.base64decode(base64text));
    } catch (error) {
      // Update form to indicate success and prevent further entry.
      this.updateStatus(
        "failed",
        "statusFailedStructure",
        this.translation["statusFailedStructure"]
      );

      //
      return "Parsed commitment is not properly structured.";
    }

    // Disable the commit button to prevent confusion.
    document.getElementById("commitTransaction").disabled = true;

    // Update form to indicate success and prevent further entry.
    this.updateStatus(
      "pending",
      "statusParsing",
      this.translation["statusParsing"]
    );

    //
    const contributionName = document.getElementById("contributionName").value;
    const contributionComment = document.getElementById("contributionComment")
      .value;

    // Validate that the commitment data matches the expectations.
    // Check that the contribution uses the correct structure.
    if (typeof commitmentObject.inputs === "undefined") {
      // Update form to indicate success and prevent further entry.
      this.updateStatus(
        "failed",
        "statusFailedStructure",
        this.translation["statusFailedStructure"]
      );

      //
      return "Parsed commitment is not properly structured.";
    }

    // Check that the contribution uses the same name.
    if (commitmentObject.data.alias !== contributionName) {
      // Update form to indicate success and prevent further entry.
      this.updateStatus(
        "failed",
        "statusFailedIntent",
        this.translation["statusFailedIntent"]
      );

      //
      return `Parsed commitments alias '${commitmentObject.data.alias}' does not match the contributors name '${contributionName}'.`;
    }

    // Check that the contribution uses the same comment.
    if (commitmentObject.data.comment !== contributionComment) {
      // Update form to indicate success and prevent further entry.
      this.updateStatus(
        "failed",
        "statusFailedIntent",
        this.translation["statusFailedIntent"]
      );

      //
      return `Parsed commitments alias '${commitmentObject.data.comment}' does not match the contributors comment '${contributionComment}'.`;
    }

    // NOTE: It is not possible to verify the amount without access to the UTXO database.
    // Pass through the intended amount so that verification can happen on backend.
    commitmentObject.data.amount = Number(
      document.getElementById("donationAmount").getAttribute("data-satoshis")
    );

    //
    const submissionOptions = {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commitmentObject),
    };

    // Submit the commitment to the backend.
    const submissionPromise = fetch(
      "/submit/" + CAMPAIGN_ID,
      submissionOptions
    );
    let submissionStatus = await submissionPromise;

    // If UTXO could not be found..
    if (submissionStatus.status === 404) {
      // Update status to let the user know we are retrying the submission.
      this.updateStatus(
        "pending",
        "statusRetrying",
        this.translation["statusRetrying"]
      );

      // Wait for a few seconds.
      const sleep = new Promise((resolve) => setTimeout(resolve, 3333));
      await sleep;

      // Resubmit to see if the preparation transaction has properly propagated.
      const reSubmissionPromise = fetch(
        "/submit/" + CAMPAIGN_ID,
        submissionOptions
      );
      submissionStatus = await reSubmissionPromise;
    }

    // If there was an error we don't understand..
    if (submissionStatus.status !== 200) {
      // Parse the error message.
      const errorMessage = await submissionStatus.text();

      // Update form to indicate failure and prevent further entry.
      this.updateStatus(
        "failed",
        "statusFailedUnkown",
        this.translation["statusFailedUnknown"] +
          `<br/><qoute>${errorMessage}</qoute>`
      );
    } else {
      // Reset slider amount.
      document.getElementById("donationSlider").value = 0;

      // Update the input to reflect new amount.
      document
        .getElementById("donationSlider")
        .dispatchEvent(new Event("input"));

      // Update form to indicate success and prevent further entry.
      this.updateStatus(
        null,
        "statusContribution",
        this.translation["statusContribution"]
      );

      if (callback) {
        window.setTimeout(function() {
          callback(true);
        }, 0);
      }
    }
  }

  updateStatus(type, label, content) {
    const donateField = document.getElementById("donateField");
    const donateStatus = document.getElementById("donateStatus");
    const donateForm = document.getElementById("donateForm");
    const donateSection = document.getElementById("donateSection");

    // Check if we already have a fullfillment status message..
    const fullfillmentStatus = donateField.className === "row fullfilled";

    // Only update status if we're not fullfilled..
    if (!fullfillmentStatus) {
      // Set the fieldset type.
      donateField.className = `row ${type}`;

      // Hide form and section.
      donateForm.classList.add("hidden");
      donateSection.classList.add("hidden");

      // Add status content.
      donateStatus.setAttribute("data-string", label);
      donateStatus.innerHTML = content;

      // Show status.
      donateStatus.classList.remove("hidden");
    }
  }

  hideStatus() {
    // Locate the status element.
    const donateStatus = document.getElementById("donateStatus");

    // Hide status.
    donateStatus.classList.add("hidden");
    donateStatus.textContent = "";
  }

  addContributionToList(alias, comment, amount, percent) {
    // Get the contribution list.
    const contributionList = document.getElementById("contributionList");

    // Get the template node.
    const template = document.getElementById("contributionTemplate").content
      .firstElementChild;

    // Import a copy of the template.
    const contributionEntry = document.importNode(template, true);

    // Calculate water level and randomize animation delay.
    const backgroundMin = 0.1;
    const backgroundMax = 3.5;
    const backgroundPosition = (
      backgroundMin +
      backgroundMax * (1 - percent)
    ).toFixed(2);
    const animationLength = 15;
    const animationDelay = (Math.random() * animationLength).toFixed(2);
    const contributionAmount = (amount / shared.SATS_PER_BCH).toFixed(2);

    // Update the data on the copy.
    contributionEntry.querySelector(
      ".contributionWaves"
    ).style.backgroundPosition = `0 ${backgroundPosition}rem`;
    contributionEntry.querySelector(
      ".contributionWaves"
    ).style.animationDelay = `-${animationDelay}s`;
    contributionEntry.querySelector(".contributionPercent").textContent =
      (percent * 100).toFixed(0) + "%";
    contributionEntry.querySelector(".contributionAlias").textContent = alias;
    contributionEntry.querySelector(
      ".contributionComment"
    ).textContent = DOMPurify.sanitize(comment, { ALLOWED_TAGS: [] });
    contributionEntry.querySelector(
      ".contributionAmount"
    ).textContent = `${contributionAmount} BCH`;

    // Hide the comment if not existing.
    if (comment === "") {
      contributionEntry.querySelector(".contributionComment").style.display =
        "none";
    }

    // Mark username as anonymous if not existing.
    if (alias === "") {
      contributionEntry.querySelector(
        ".contributionAlias"
      ).style.opacity = 0.37;
      contributionEntry.querySelector(".contributionAlias").textContent =
        "Anonymous";
    }

    // Add the copy to the contribution list.
    contributionList.appendChild(contributionEntry);
  }
}

// Start the application.
window.flipstarter = new flipstarter();

// Function that can be used to cause celebratory effects.
const celebration = function (volume = 0.11) {
  // Let the confetti burst in like fireworks!
  let fireworks = function () {
    // Left side of the screen.
    const leftConfetti = {
      particleCount: 50,
      angle: 60,
      spread: 90,
      origin: { x: 0 },
    };

    // Right side of the screen.
    const rightConfetti = {
      particleCount: 50,
      angle: 120,
      spread: 90,
      origin: { x: 1 },
    };

    // Trigger the confetti.
    confetti(leftConfetti);
    confetti(rightConfetti);
  };

  // Adjust volume to prevent heartattacks.
  document.getElementById("applause").volume = volume;

  // NOTE: https://gitlab.com/flipstarter/frontend/-/issues/64
  // Wrap audio play function in try-catch clause to prevent
  // abrupt halt of execution in case user has not yet interacted.
  try {
    // Play the sound effect.
    document.getElementById("applause").play();
  } catch (error) {
    // Do nothing.
  }

  // Burst multiple times with some delay.
  window.setTimeout(fireworks, 100);
  window.setTimeout(fireworks, 200);
  window.setTimeout(fireworks, 400);
  window.setTimeout(fireworks, 500);
  window.setTimeout(fireworks, 700);
};
