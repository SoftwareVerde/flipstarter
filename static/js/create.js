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
  $('.form-control').removeClass('border-danger text-danger');

  $('.form-control').each(function() {
    inputValid = true;
    if ( ($(this).prop('required') && ($(this).val().length == 0 || $(this).val() == " ")) // test for blank while required
      || ($(this).hasClass('check-url') && !validateURL($(this).val())) // test for check URL
    ) {
      inputValid = false;
      formValid = false;
    }

    // Test for BCH address
    if ($(this).hasClass('check-bch-address')) {
      if (bchaddr.isValidAddress($(this).val())) {
        if (bchaddr.isLegacyAddress($(this).val())) {
          // isLegacyAddress throws an error if it is not given a valid BCH address
          // this explains the nested if
          inputValid = false;
          formValid = false;
        }
      } else {
        inputValid = false;
        formValid = false;
      }
    }

    // After all validation
    if (!inputValid) {
      $(this).addClass('border-danger text-danger');
    }
  });

  // Submit if everything is valid
  if (formValid) {
    $("#form").submit();
  } else {
    $("#error").removeClass("d-none");
  }
}
