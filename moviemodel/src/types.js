/**
 * @typedef {Object} PredictRequest
 * @property {number} duration
 * @property {number} budget
 * @property {number} title_year
 * @property {string[]} genres
 * @property {string} content_rating
 *
 * @typedef {Object} PredictResponse
 * @property {number} predicted_rating
 * @property {number} confidence
 * @property {string} explanation
 */