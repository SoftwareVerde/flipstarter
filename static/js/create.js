var index = 1;

function addRecipient() {
  const maxRecipients = 6;

  if(index < maxRecipients) {
    $("#recipients").append(
      `<p>Recipient ${ index + 1 }</p>
      <div class="form-row text-muted">
        <div class="form-group col-lg-4">
          <label for="amount[${ index }]">Funding Goal <small>(amount in BCH)</small></label>
          <input required="" type="text" class="form-control" id="amount[${ index }]" name="amount[${ index }]">
        </div>
        <div class="form-group col-lg-4">
          <label for="image_url[${ index }]">Image URL</label>
          <input required="" type="text" class="form-control" id="image_url[${ index }]" name="image_url[${ index }]">
        </div>
        <div class="form-group col-lg-4">
          <label for="recipient_name[${ index }]">Recipient Name</label>
          <input required="" type="text" class="form-control" id="recipient_name[${ index }]" name="recipient_name[${ index }]">
        </div>
      </div>
      <div class="form-row text-muted">
        <div class="form-group col-md-6">
          <label for="bch_address[${ index }]">Bitcoin Cash Address</label>
          <input required="" type="text" class="form-control" id="bch_address[${ index }]" name="bch_address[${ index }]">
        </div>
        <div class="form-group col-md-6">
          <label for="project_url[${ index }]">Recipient Website</label>
          <input required="" type="text" class="form-control" id="project_url[${ index }]" name="project_url[${ index }]">
        </div>
      </div>`
    );
    index++;
  } else {
    $("#addRecipient").hide();
  }
};
