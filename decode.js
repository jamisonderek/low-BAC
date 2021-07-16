/* eslint-disable linebreak-style */

/**
 *
 * @param {*} contents String that is HEX encoded.
 * @returns String that was the original data.
 */
function decodeObj(contents) {
  return contents.split(' ')
    .map((v) => String.fromCharCode(parseInt(v, 16)))
    .filter((v) => (v >= ' '))
    .join('');
}

exports.decodeObj = decodeObj;
