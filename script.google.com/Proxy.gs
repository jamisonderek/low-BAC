/**
 * This is a Proxy.gs file for script.google.com for routing the webhook data to the ngrok server.
 *
 */

//
// PLEASE CHANGE THIS TO YOUR NGROK SERVER.  :)
//
const webhookUri = 'https://jamisoncreations.ngrok.io/webhook';

/**
 * Encodes a string using the hex value of each character.
 * 
 * TODO: Research other encodings, for example Base64 (btoa) or similar would be less wasteful and
 * is still supported by TextWizard in Fiddler.
 *
 * @param {*} contents String to encode. 
 * @returns a HEX encoding string representing the contents.
 */
function encodeObj(contents) {
  let buffer='';  
  for (var i=0; i<contents.length; i++) {
    buffer += contents.charCodeAt(i).toString(16);
    buffer += ' ';
  }
  return buffer;
}

/**
 * This is the entry point when a POST call is made to our webhook.
 * 
 * create.arduino.cc will invoke the webhook in a set of trusted domains, like script.google.com,
 * but it can't be configured for custom domains.  We will forward on the POST data to our service,
 * encoding the body as "data" with a HEX stream on content (to avoid double encoding).  We return
 * our service webhook response as JSON data to the caller. 
 *
 * @oaram {*} e Event information. 
 * @returns a JSON response from the webhook.
 */
function doPost(e) {
  const options = {
    'method' : 'post',
    'payload' : { data: encodeObj(e.postData.contents) }
  };
  const response = UrlFetchApp.fetch(webhookUri, options).getContentText();
  return ContentService.createTextOutput(response).setMimeType(ContentService.MimeType.JSON);
}
