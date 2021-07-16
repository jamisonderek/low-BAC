/* eslint-disable linebreak-style */
/* eslint-disable no-console */

/**
 * Webhook listener for events from Arduino cloud.
 *
 * LOWBAC_HTTPPORT - Port for listening for webhook requests (default 80).
 */

const express = require('express');
const http = require('http');
const formidable = require('express-formidable');
const { decodeObj } = require('./decode');
const { vehicle } = require('./vehicle');
const fordConnect = require('./fordConnect/fordConnect');

const app = express();
app.use(formidable());
const httpServer = http.createServer(app);
const httpPort = parseInt(process.env.LOWBAC_HTTPPORT, 10) || 8080;
if (process.env.NODE_ENV !== 'test') {
  console.log(`Listening on port ${httpPort} for webhook calls.`);
  httpServer.listen(httpPort);
} else {
  console.log('WARNING: Environment set to "test" so not enabling listener.');
}

/**
 * Invokes the doCommand and checkCommand (e.g. doStartEngine, checkStartEngine) and
 * returns a message about its success or failure.
 *
 * @param {*} intent The name of the intent being invoked.
 * @param {*} vehicleId The vehicleId for the request.
 * @param {*} doCommand A function to invoke for doing command (e.g. doStartEngine)
 * @param {*} checkCommand A function to invoke for cheking the status (e.g. checkStartEngine)
 * @returns A message indicating if the command was successful.
 */
async function actionWithCheck(intent, vehicleId, doCommand, checkCommand) {
  let message;

  const response = await doCommand(vehicleId);

  if (response.statusCode === 202
    && response.body
    && response.body.status === 'SUCCESS'
    && response.body.commandStatus === 'COMPLETED'
    && response.body.commandId) {
    const { commandId } = response.body;
    message = `Sent ${intent} command`;

    const checkResponse = await checkCommand(vehicleId, commandId);

    if (checkResponse.statusCode === 200) {
      if (checkResponse.body && checkResponse.body.commandStatus === 'COMPLETED') {
        message += ' and got confirmation.';
      } else if (checkResponse.body && checkResponse.body.commandStatus === 'PENDINGRESPONSE') {
        message += ' but confirmation is pending.';
      } else if (checkResponse.body && checkResponse.body.commandStatus) {
        message += ` but confirmation is ${checkResponse.body.commandStatus}.`;
      } else if (checkResponse.body && checkResponse.body.status) {
        message += ` but confirmation status is ${checkResponse.body.status}.`;
      } else {
        console.error(JSON.stringify(response));
        message += ' but confirmation failed.';
      }
    } else {
      console.error(JSON.stringify(response));
      message += ` but confirmation gave status code ${checkResponse.statusCode}.`;
    }
  } else {
    console.error(JSON.stringify(response));
    message = `Failed to ${intent}.`;
  }

  return message;
}

// Update the token and gets the authorized vehicle.
vehicle.init();

app.post('/webhook', async (req, res) => {
  console.log('\nwebhook invoked');
  const data = decodeObj(req.fields.data);
  const json = JSON.parse(data);
  // eslint-disable-next-line camelcase
  const { webhook_id, thing_id, values } = json;

  let doorLocks;
  let startVehicle;

  // eslint-disable-next-line camelcase
  console.log(`${webhook_id}.${thing_id} : `);
  for (let i = 0; i < values.length; i += 1) {
    console.log(`${values[i].name}: "${values[i].value}" @ ${values[i].updated_at}`);
    if (values[i].name === 'doorLocks' && values[i].value === false) {
      doorLocks = true;
    }

    if (values[i].name === 'startVehicle' && values[i].value === true) {
      startVehicle = true;
    }
  }

  if (doorLocks) {
    console.log('\n*** Sent message to FordConnect unlock doors. ***');
    const vehicleId = vehicle.toVehicleId('arduino-iot');
    const message = await actionWithCheck('unlock vehicle', vehicleId, fordConnect.doUnlock, fordConnect.checkUnlock);
    if (message !== 'Sent unlock vehicle command and got confirmation.') {
      console.log(message);
    }
  }

  if (startVehicle) {
    console.log('\n*** Sent message to FordConnect start vehicle. ***');
    const vehicleId = vehicle.toVehicleId('arduino-iot');
    const message = await actionWithCheck('start vehicle', vehicleId, fordConnect.doStartEngine, fordConnect.checkStartEngine);
    if (message !== 'Sent start vehicle command and got confirmation.') {
      console.log(message);
    }
  }

  res.statusCode = 200;
  res.send('Message processed.');
});
