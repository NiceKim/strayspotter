const db = require('../db');
const { processImageUpload } = require('../services/image_handler');

async function uploadImage(req, res) {
  const file = req.file;
  const status = req.body.status;
  const userId = req.body.userID;
  const anonymousNickname = req.body.anonymousNickname;
  const anonymousPassword = req.body.anonymousPassword;

  if (!userId && (!anonymousNickname || !anonymousPassword)) {
    return res.status(400).send('Anonymous nickname and password are required!');
  }
  if (!file) return res.status(400).send('No file selected!');
  if (!status) return res.status(400).send('Status is required!');

  const catStatus = parseInt(status, 10);
  if (isNaN(catStatus) || catStatus < 0 || catStatus > 2) {
    return res.status(400).send('Invalid status. Must be 0 (good), 1 (concerned), or 2 (critical).');
  }

  const pool = db.pool;
  try {
    const pictureId = await processImageUpload(pool, file, catStatus);
    const postId = await db.insertPostToDb(pool, pictureId, userId);
    if (!userId) {
      await db.insertAnonymousUserDataToDb(pool, postId, anonymousNickname, anonymousPassword);
    }
    res.status(200).send('Picture successfully uploaded');
  } catch (err) {
    console.error('General error in upload:', err);
    res.status(400).send(err.message || 'File upload failed due to errors');
  }
}

module.exports = {
  uploadImage
};
