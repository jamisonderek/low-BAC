/* eslint-disable linebreak-style */
/* eslint-disable no-console */

const fordConnect = require('./fordConnect/fordConnect');

let activeVehicle;

/**
 * Updates the access token and sets the active vehicle to the vehicle with the
 * vehicleAuthorizationIndicator set to 1.
 *
 * We have this routine, since we only have a single user (one Alexa developer account for
 * the hack with the API access going away, so not publishing the Alexa skill publically).
 * To support multiple users we would simply add a listener on port 3000 and use the state to
 * do a user regisration lookup, with a quick expiry.  We would store the results refresh
 * tokens in a NoSQL database.
 */
async function init() {
  // Try to use the FORD_CODE environment variable to refresh our access token and refresh token.
  await fordConnect.updateTokenFromCode();

  // Try to use the FORD_REFRESH environment variable to refresh our access token and refresh token.
  await fordConnect.refreshToken(60);

  // Get the list of vehicles (hopefully one of the above APIs set our access token.)
  const vehicles = await fordConnect.getVehicles();
  if (vehicles.statusCode === 200) {
    // Grab the first vehicle that we have authorized (FordPass UI only lets you select 1 vehicle).
    // eslint-disable-next-line prefer-destructuring
    activeVehicle = vehicles.body.vehicles.filter((v) => v.vehicleAuthorizationIndicator === 1)[0];
    if (activeVehicle && activeVehicle.vehicleId) {
      console.log('\nAlexa commands will use the following vehicle:');
      console.log(activeVehicle);
    } else {
      console.error(`SPECBUG ${JSON.stringify(vehicles)}`);
      console.error('Did not get a vehicle back from getVehicles.');
      console.error('Please provide a new FORD_CODE or MYFORD_REFRESH.');
      process.exit(1);
    }
  } else if (vehicles.statusCode === 500) {
    // We got HTTP 500 during the hack and the request from Ford was to get a new token.
    // Refreshing the access token with the old refresh token would succeed OAuth calls,
    // but all calls to the FordConnect API still failed with HTTP 500.
    console.error(`500FORDCONNECT ${JSON.stringify(vehicles)}`);
    console.error('GOT 500 (INTERNAL SERVER ERROR) from FordConnect API calling getVehicles!');
    console.error('Please provide a new FORD_CODE or FORD_REFRESH.');
    process.exit(1);
  } else if (vehicles.stautsCode === 401) {
    console.error('Access deined.');
    console.error('Please provide a new FORD_CODE or FORD_REFRESH.');
  } else {
    console.log(`SPECBUG ${JSON.stringify(vehicles)}`);
    console.error('*** Unexpected error calling getVehicles.');
    process.exit(1);
  }
}

/**
 * This API should convert a userId into a vehicleId.  For now this always just returns the single
 * active vehicle.  To support multiple users, we could use a NoSQL database to do the persistent
 * mapping.
 *
 * @param {*} userId The user passed in the request.
 * @returns The vehicleId to use for the request.
 */
function toVehicleId(userId) {
  const { vehicleId } = activeVehicle;

  if (userId) {
    // TODO: Add mapping if we need to support multiple users.
  }

  return vehicleId;
}

/**
 * Updates the cloud data by geting a doStatus followed by a getStatus, to know when it is complete.
 * The timeout is set fairly tight, since we only have 8-10 seconds to return data to Alexa.
 *
 * @param {*} vehicleId The vehicle to push to the cloud.
 * @returns The response object from the getStatus (or undefined if the doStatus call failed).
 * For success the .statusCode should be 202 and the body.commandStatus should be COMPLETED.
 * Because of agressive timeouts it may still be PENDINGRESPONSE.
 */
async function cloudPush(vehicleId) {
  const response = await fordConnect.doStatus(vehicleId);
  if (response.statusCode === 202
    && response.body
    && response.body.status === 'SUCCESS'
    && response.body.commandStatus === 'COMPLETED'
    && response.body.commandId) {
    const { commandId } = response.body;

    // NOTE: We get an HTTP 202 from the GET call not a 200.
    const status = await fordConnect.getStatus(vehicleId, commandId);
    return status;
  }

  return undefined;
}

exports.vehicle = {
  init,
  toVehicleId,
  cloudPush,
};
