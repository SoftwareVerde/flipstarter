/* eslint-disable */
var index = 1;

function addRecipient() {
  const maxRecipients = 6;

  if (index < maxRecipients) {
    $("#recipients").append(
      `<div>
      <p class="d-inline">Recipient ${index + 1}</p>
      <div class="remove btn btn-link text-danger d-inline float-right">Remove</div>
      <div class="form-row text-muted">
        <div class="form-group col-lg-4">
          <label for="amount[${index}]">Funding Goal <small>(amount in BCH)</small></label>
          <input type="number" class="form-control goal-input" id="amount[${index}]" name="amount[${index}]" step="0.00000001" required>
        </div>
        <div class="form-group col-lg-4">
          <label for="image_url[${index}]">Image URL</label>
          <input type="text" class="form-control check-url" id="image_url[${index}]" name="image_url[${index}]" required>
        </div>
        <div class="form-group col-lg-4">
          <label for="recipient_name[${index}]">Recipient Name</label>
          <input type="text" class="form-control" id="recipient_name[${index}]" name="recipient_name[${index}]" required>
        </div>
      </div>
      <div class="form-row text-muted">
        <div class="form-group col-md-6">
          <label for="bch_address[${index}]">Bitcoin Cash Address <small>(include bitcoincash: prefix)</small></label>
          <input type="text" class="form-control check-bch-address" id="bch_address[${index}]" name="bch_address[${index}]" required>
        </div>
        <div class="form-group col-md-6">
          <label for="project_url[${index}]">Recipient Website</label>
          <input type="text" class="form-control check-url" id="project_url[${index}]" name="project_url[${index}]" required>
        </div>
      </div>
      </div>`
    );
    index++;
  } else {
    $(".js-add-recipient").hide();
  }
}

// Remove recipient
$("#recipients").on("click", ".remove", function() {
  $(this).parent("div").remove();
  index--;
});

// Prevent letters in date inputs
$(".date-input").on("keypress", function(evt) {
  if (evt.which < 48 || evt.which > 57) {
    evt.preventDefault();
  }
});

// Allow only numbers and dot in goal input
$(".goal-input").on("keypress", function(evt) {
  if (evt.which < 46 || evt.which > 57 || evt.which === 47) {
    evt.preventDefault();
  }
});

// Check if URL is valid
function validateURL(textval) {
  // regex modified from https://github.com/jquery-validation/jquery-validation/blob/c1db10a34c0847c28a5bd30e3ee1117e137ca834/src/core.js#L1349
  var urlregex = /^(?:(?:(?:https?):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})).?)(?::\d{2,5})?(?:[/?#]\S*)?$/i;
  return urlregex.test(textval);
}

// Validate form before submitting
function validateForm() {
  var formValid = true;
  var inputValid = true;
  var startDate = ()=> $("#start_year").val() + "-" + $("#start_month").val() + "-" + $("#start_day").val();
  var endDate = ()=> $("#end_year").val() + "-" + $("#end_month").val() + "-" + $("#end_day").val();
  var valid = {
    blank : true,
    url : true,
    address : true,
    date : true
  }
  $('.form-control').removeClass('border-danger text-danger');

  $('.form-control').each(function() {
    inputValid = true;
    if($(this).prop('required')){
      // test for blank while required
      var isBlank = $(this).val().length == 0 || $(this).val() == " ";
      if(isBlank){
        valid.blank = false;
        inputValid = false;
        formValid = false;
      }else{ 

        // test start date is big than end date
        if($(this).hasClass('end-date')){
          var validateDate = $("#start_date").datepicker('getDate') <= $(this).datepicker('getDate');
          if(!validateDate) {
            valid.date = false;
            inputValid = false;
            formValid = false;
          }
        }

        // test for check URL
        if($(this).hasClass('check-url') && !validateURL($(this).val())){
          valid.url = false;
          inputValid = false;
          formValid = false;
        }

        // Test for BCH address
        if ($(this).hasClass('check-bch-address')) {
          var isValidAddress = bchaddr.isValidAddress($(this).val());
          if(isValidAddress){
            var isLegacyAddress = bchaddr.isLegacyAddress($(this).val());
            // isLegacyAddress throws an error if it is not given a valid BCH address
            if (isLegacyAddress) {  
              valid.address = false;
              inputValid = false;
              formValid = false;
            }
          } else {
            valid.address = false;
            inputValid = false;
            formValid = false;
          }
        }

        // Test year
        if($(this).hasClass('check_year')){
          var year = $(this).val()
          if(year < 1000 || year > 3000){
            valid.date = false;
            inputValid = false;
            formValid = false;
          }
        }

        // Test day
        if($(this).hasClass('check_day')){
          var year = parseInt($('#' + $(this).data('range') + '_year').val());
          var day = parseInt($(this).val());
          var month = parseInt($('#' + $(this).data('range') + '_month').val());
          if(!year || !day || year < 1000 || year > 3000){
            valid.date = false;
            inputValid = false;
            formValid = false;
          }else {
            // convert from d to dd
            $(this).val((day < 10) ? '0' + day : day.toString());

            var monthLength = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

            // Adjust for leap years
            if(year % 400 == 0 || (year % 100 != 0 && year % 4 == 0)){
              monthLength[1] = 29;
            }
  
            if(!(day > 0 && day <= monthLength[month - 1])){
              valid.date = false;
              inputValid = false;
              formValid = false;
            }
          }
        }
      }
      
      // After all validation
      if (!inputValid) {
        $(this).addClass('border-danger text-danger');
      }
    }})
  // Submit if everything is valid
  if (formValid) {
    $("#form").submit();
  } else {
    $("#error").removeClass("d-none");
    $("#error").html(
    `<p>Some fields are incorrect,</p>
      <ul>
        ${!valid.blank ? "<li> Blank field </li>" : ""}
        ${!valid.date ? "<li> Date range is incorrect </li>" : ""}
        ${!valid.url ? "<li> One or more link address is incorrect </li>" : ""}
        ${!valid.address ? "<li> One or more wallet address is invalid </li>" : ""}
      </ul>
      </p>`
    );
  }
}

// Add languages tap
async function addLanguages() {
  let req = await fetch("/static/ui/languages.json");
  let languages = await req.json();
  // Start add tags
  for (let lang in languages) {
    let language = languages[lang];

    $("#nav-tab").append(`
      <a
        class="nav-item nav-link"
        id="${language.name}-tab"
        data-toggle="tab"
        href="#${language.name}"
        role="tab"
        aria-controls="${language.name}"
        aria-selected="false"
      >
        ${language.name} ${language.unicode}
      </a>
    `);

    lang = lang.toUpperCase();
    let required = lang === "EN" ? 'required' : '';
    
    $("#nav-item").append(`
      <div class="tab-pane fade" id="${language.name}" role="tabpanel" aria-labelledby="${language.name}-tab">
        <div class="form-group">
          <label for="abstract${lang}">Project Abstract <small>(Markdown Format Supported)</small></label>
          <textarea class="form-control" id="abstract${lang}" name="abstract${lang}" rows="4" ${required}></textarea>
        </div>
        <div class="form-group">
          <label for="proposal${lang}">Project Proposal <small>(Markdown Format Supported)</small></label>
          <textarea class="form-control" id="proposal${lang}" name="proposal${lang}" rows="4"></textarea>
        </div>
      </div>
    `);
  }
}

addLanguages().then((e) => {
  $("#English-tab").click();
});
