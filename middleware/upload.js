const multer = require('multer');
const path = require('path');

// Cấu hình lưu trữ file upload
const storage = multer.diskStorage({
    destination: function (request, file, cb) {
        cb(null, path.join(__dirname, '../uploads/'));
    },
    filename: function (request, file, cb) {
        // Đặt tên file kèm mốc thời gian để tránh trùng lặp
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
